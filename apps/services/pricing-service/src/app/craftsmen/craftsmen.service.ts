import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, Repository } from 'typeorm';
import { JwtPayload, PaginatedResponse, UserRole } from '@sandbox/types';

import { Craftsman } from './entities/craftsman.entity';
import { CraftsmanTradeAssignment } from './entities/craftsman-trade-assignment.entity';
import { QuoteRequestDto } from '../pricing-catalogs/dto/quote-request.dto';
import { QuoteResponseDto } from '../pricing-catalogs/dto/quote-response.dto';
import { PricingCatalogsService } from '../pricing-catalogs/pricing-catalogs.service';
import { CreateCraftsmanDto } from './dto/create-craftsman.dto';
import { UpdateCraftsmanDto } from './dto/update-craftsman.dto';
import { QueryCraftsmenDto } from './dto/query-craftsmen.dto';
import { CraftsmanResponseDto } from './dto/craftsman-response.dto';

@Injectable()
export class CraftsmenService {
  private readonly logger = new Logger(CraftsmenService.name);

  constructor(
    @InjectRepository(Craftsman) private readonly craftsmen: Repository<Craftsman>,
    @InjectRepository(CraftsmanTradeAssignment)
    private readonly assignments: Repository<CraftsmanTradeAssignment>,
    private readonly dataSource: DataSource,
    private readonly pricingCatalogs: PricingCatalogsService,
  ) {}

  async list(
    query: QueryCraftsmenDto,
    user: JwtPayload,
  ): Promise<PaginatedResponse<CraftsmanResponseDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const qb = this.craftsmen
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.tradeAssignments', 'a');

    if (query.q) {
      qb.andWhere('c.companyName ILIKE :q', { q: `%${query.q}%` });
    }
    if (query.trade) {
      qb.andWhere('a.trade = :trade AND a.is_active = true', { trade: query.trade });
    }

    // Row-level scoping: CRAFTSMAN users may only see their own record.
    if (this.isCraftsmanOnly(user)) {
      if (!user.craftsmanId) {
        return { items: [], total: 0, page, pageSize };
      }
      qb.andWhere('c.id = :id', { id: user.craftsmanId });
    }

    qb.orderBy('c.companyName', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map(CraftsmanResponseDto.from),
      total,
      page,
      pageSize,
    };
  }

  async findOne(id: string, user: JwtPayload): Promise<CraftsmanResponseDto> {
    this.assertCanAccess(id, user);
    const craftsman = await this.craftsmen.findOne({
      where: { id },
      relations: ['tradeAssignments'],
    });
    if (!craftsman) {
      throw new NotFoundException(`Craftsman ${id} not found`);
    }
    return CraftsmanResponseDto.from(craftsman);
  }

  async create(dto: CreateCraftsmanDto, user: JwtPayload): Promise<CraftsmanResponseDto> {
    if (this.isCraftsmanOnly(user)) {
      throw new ForbiddenException('Craftsmen cannot create new craftsman records');
    }

    return this.dataSource.transaction(async (tx) => {
      const craftsman = tx.getRepository(Craftsman).create({
        companyName: dto.companyName,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        vatNumber: dto.vatNumber ?? null,
        addressLine1: dto.addressLine1 ?? null,
        addressLine2: dto.addressLine2 ?? null,
        postalCode: dto.postalCode ?? null,
        city: dto.city ?? null,
        country: dto.country ?? 'Germany',
        isActive: dto.isActive ?? true,
      });
      const saved = await tx.getRepository(Craftsman).save(craftsman);

      if (dto.trades && dto.trades.length > 0) {
        const uniq = Array.from(new Set(dto.trades));
        if (uniq.length !== dto.trades.length) {
          throw new BadRequestException('Duplicate trade codes in payload');
        }
        await tx.getRepository(CraftsmanTradeAssignment).save(
          uniq.map((trade) =>
            tx.getRepository(CraftsmanTradeAssignment).create({
              craftsmanId: saved.id,
              trade,
              isActive: true,
            }),
          ),
        );
      }

      this.logger.log(`Created craftsman ${saved.id} (${saved.companyName})`);

      const fresh = await tx.getRepository(Craftsman).findOne({
        where: { id: saved.id },
        relations: ['tradeAssignments'],
      });
      // Non-null assertion is safe — we just inserted the row in this transaction.
      return CraftsmanResponseDto.from(fresh as Craftsman);
    });
  }

  async update(
    id: string,
    dto: UpdateCraftsmanDto,
    user: JwtPayload,
  ): Promise<CraftsmanResponseDto> {
    this.assertCanAccess(id, user);
    const existing = await this.craftsmen.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Craftsman ${id} not found`);
    }
    Object.assign(existing, {
      ...(dto.companyName !== undefined && { companyName: dto.companyName }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.vatNumber !== undefined && { vatNumber: dto.vatNumber }),
      ...(dto.addressLine1 !== undefined && { addressLine1: dto.addressLine1 }),
      ...(dto.addressLine2 !== undefined && { addressLine2: dto.addressLine2 }),
      ...(dto.postalCode !== undefined && { postalCode: dto.postalCode }),
      ...(dto.city !== undefined && { city: dto.city }),
      ...(dto.country !== undefined && { country: dto.country }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });
    await this.craftsmen.save(existing);
    const refreshed = await this.craftsmen.findOne({
      where: { id },
      relations: ['tradeAssignments'],
    });
    return CraftsmanResponseDto.from(refreshed as Craftsman);
  }

  async remove(id: string, user: JwtPayload): Promise<void> {
    if (this.isCraftsmanOnly(user)) {
      throw new ForbiddenException('Craftsmen cannot delete craftsman records');
    }
    const result = await this.craftsmen.delete({ id });
    if (result.affected === 0) {
      throw new NotFoundException(`Craftsman ${id} not found`);
    }
    this.logger.log(`Deleted craftsman ${id}`);
  }

  async quoteActiveCatalog(
    craftsmanId: string,
    trade: string,
    dto: QuoteRequestDto,
    user: JwtPayload,
  ): Promise<QuoteResponseDto> {
    return this.pricingCatalogs.quoteActiveForCraftsmanTrade(craftsmanId, trade, dto, user);
  }

  // ---------------------------------------------------------------------
  // Authorization helpers
  // ---------------------------------------------------------------------

  private isCraftsmanOnly(user: JwtPayload): boolean {
    return user.roles.includes(UserRole.CRAFTSMAN) && !user.roles.includes(UserRole.ADMIN);
  }

  /**
   * Enforces row-level scoping. ADMIN bypasses; CRAFTSMAN may only touch their
   * own bound craftsman id. Throws `ForbiddenException` on mismatch.
   */
  private assertCanAccess(craftsmanId: string, user: JwtPayload): void {
    if (!this.isCraftsmanOnly(user)) {
      return;
    }
    if (user.craftsmanId !== craftsmanId) {
      throw new ForbiddenException('Craftsmen may only access their own record');
    }
  }
}
