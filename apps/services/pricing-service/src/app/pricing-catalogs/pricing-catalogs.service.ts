import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtPayload, UserRole } from '@sandbox/types';
import { DataSource, IsNull, Repository } from 'typeorm';

import { Craftsman } from '../craftsmen/entities/craftsman.entity';
import { CraftsmanTradeAssignment } from '../craftsmen/entities/craftsman-trade-assignment.entity';
import { TradeConfig } from '../trades/entities/trade-config.entity';
import {
  PricingSchema,
  validatePositionAttributes,
} from '../trades/pricing-schema-validator';
import { CatalogDiscount } from './entities/catalog-discount.entity';
import { CatalogPosition } from './entities/catalog-position.entity';
import { PositionSurcharge } from './entities/position-surcharge.entity';
import {
  CatalogVersionStatus,
  PricingCatalogVersion,
} from './entities/pricing-catalog-version.entity';
import { CreatePricingCatalogDto } from './dto/create-pricing-catalog.dto';
import { CatalogDiscountInputDto } from './dto/catalog-discount-input.dto';
import { CatalogPositionInputDto } from './dto/catalog-position-input.dto';
import { PositionSurchargeInputDto } from './dto/position-surcharge-input.dto';
import { QueryPricingCatalogsDto } from './dto/query-pricing-catalogs.dto';
import {
  PricingCatalogVersionListItemDto,
  PricingCatalogVersionResponseDto,
  toPricingCatalogVersionListItem,
  toPricingCatalogVersionResponse,
} from './dto/pricing-catalog-version-response.dto';
import { QuoteRequestDto } from './dto/quote-request.dto';
import { QuoteResponseDto } from './dto/quote-response.dto';
import { UpdatePricingCatalogDto } from './dto/update-pricing-catalog.dto';
import {
  calculateQuote,
  QuoteCalculationError,
  QuoteCatalogData,
} from './quote-calculator';

const VERSION_RELATIONS = {
  positions: { surcharges: true },
  discounts: true,
} as const;

@Injectable()
export class PricingCatalogsService {
  private readonly logger = new Logger(PricingCatalogsService.name);

  constructor(
    @InjectRepository(PricingCatalogVersion)
    private readonly versions: Repository<PricingCatalogVersion>,
    @InjectRepository(Craftsman) private readonly craftsmen: Repository<Craftsman>,
    @InjectRepository(TradeConfig) private readonly trades: Repository<TradeConfig>,
    private readonly dataSource: DataSource,
  ) {}

  async list(
    query: QueryPricingCatalogsDto,
    user: JwtPayload,
  ): Promise<PricingCatalogVersionListItemDto[]> {
    this.assertCanAccessCatalog(query.craftsmanId, user);

    const items = await this.versions.find({
      where: { craftsmanId: query.craftsmanId, trade: query.trade },
      order: { createdAt: 'DESC' },
    });

    return items.map(toPricingCatalogVersionListItem);
  }

  async findOne(versionId: string, user: JwtPayload): Promise<PricingCatalogVersionResponseDto> {
    const version = await this.loadVersionOrThrow(versionId);
    this.assertCanAccessCatalog(version.craftsmanId, user);
    return toPricingCatalogVersionResponse(version);
  }

  async create(
    dto: CreatePricingCatalogDto,
    user: JwtPayload,
  ): Promise<PricingCatalogVersionResponseDto> {
    this.assertCanAccessCatalog(dto.craftsmanId, user);

    const craftsman = await this.craftsmen.findOne({ where: { id: dto.craftsmanId } });
    if (!craftsman) {
      throw new NotFoundException(`Craftsman ${dto.craftsmanId} not found`);
    }

    await this.assertTradeExists(dto.trade);

    const existingDraft = await this.versions.findOne({
      where: {
        craftsmanId: dto.craftsmanId,
        trade: dto.trade,
        status: CatalogVersionStatus.DRAFT,
      },
    });
    if (existingDraft) {
      throw new ConflictException(
        `A DRAFT catalog already exists for craftsman ${dto.craftsmanId} and trade ${dto.trade}`,
      );
    }

    const saved = await this.versions.save(
      this.versions.create({
        craftsmanId: dto.craftsmanId,
        trade: dto.trade,
        status: CatalogVersionStatus.DRAFT,
        effectiveFrom: null,
        effectiveUntil: null,
        publishedByUserId: null,
      }),
    );

    this.logger.log(`Created draft catalog ${saved.id} for ${dto.craftsmanId}/${dto.trade}`);

    return this.findOne(saved.id, user);
  }

  async update(
    versionId: string,
    dto: UpdatePricingCatalogDto,
    user: JwtPayload,
  ): Promise<PricingCatalogVersionResponseDto> {
    const version = await this.loadVersionOrThrow(versionId);
    this.assertCanAccessCatalog(version.craftsmanId, user);
    this.assertDraftMutable(version);

    if (dto.effectiveFrom !== undefined) {
      version.effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : null;
      await this.versions.save(version);
    }

    const positions = dto.positions;
    const discounts = dto.discounts;

    if (positions !== undefined) {
      const tradeConfig = await this.trades.findOne({ where: { trade: version.trade } });
      if (!tradeConfig) {
        throw new NotFoundException(`Trade ${version.trade} not found`);
      }
      const schema = extractPricingSchema(tradeConfig.metadata);
      this.assertUniquePositionKeys(positions);
      for (const positionDto of positions) {
        const attributes = positionDto.attributes ?? {};
        const validation = validatePositionAttributes(schema, attributes);
        if (!validation.valid) {
          throw new BadRequestException({
            message: 'Position attributes failed schema validation',
            errors: validation.errors,
          });
        }
        for (const surchargeDto of positionDto.surcharges ?? []) {
          this.assertValidSurchargeInput(surchargeDto);
        }
      }
    }

    if (discounts !== undefined) {
      this.assertUniqueDiscountKeys(discounts);
      for (const discountDto of discounts) {
        this.assertValidDiscountInput(discountDto);
      }
    }

    if (positions !== undefined || discounts !== undefined) {
      await this.dataSource.transaction(async (tx) => {
        const positionRepo = tx.getRepository(CatalogPosition);
        const surchargeRepo = tx.getRepository(PositionSurcharge);
        const discountRepo = tx.getRepository(CatalogDiscount);

        if (positions !== undefined) {
          await positionRepo.delete({ versionId });

          for (const positionDto of positions) {
            const position = await positionRepo.save(
              positionRepo.create({
                versionId,
                key: positionDto.key,
                label: positionDto.label,
                unit: positionDto.unit,
                netPrice: positionDto.netPrice,
                vatRate: positionDto.vatRate,
                minQuantity: positionDto.minQuantity ?? null,
                maxQuantity: positionDto.maxQuantity ?? null,
                attributes: positionDto.attributes ?? {},
              }),
            );

            for (const surchargeDto of positionDto.surcharges ?? []) {
              await surchargeRepo.save(
                surchargeRepo.create({
                  positionId: position.id,
                  key: surchargeDto.key,
                  label: surchargeDto.label,
                  flatAmount: surchargeDto.flatAmount ?? null,
                  percentageRate: surchargeDto.percentageRate ?? null,
                  sortOrder: surchargeDto.sortOrder ?? 0,
                }),
              );
            }
          }
        }

        if (discounts !== undefined) {
          await discountRepo.delete({ versionId });

          for (const discountDto of discounts) {
            await discountRepo.save(
              discountRepo.create({
                versionId,
                key: discountDto.key,
                label: discountDto.label,
                flatAmount: discountDto.flatAmount ?? null,
                percentageRate: discountDto.percentageRate ?? null,
                cap: discountDto.cap ?? null,
                appliesTo: discountDto.appliesTo,
                sortOrder: discountDto.sortOrder ?? 0,
              }),
            );
          }
        }
      });
    }

    return this.findOne(versionId, user);
  }

  async publish(
    versionId: string,
    user: JwtPayload,
  ): Promise<PricingCatalogVersionResponseDto> {
    const preVersion = await this.loadVersionOrThrow(versionId);
    this.assertCanAccessCatalog(preVersion.craftsmanId, user);

    await this.dataSource.transaction(async (tx) => {
      const assignmentRepo = tx.getRepository(CraftsmanTradeAssignment);
      const versionRepo = tx.getRepository(PricingCatalogVersion);

      const assignment = await assignmentRepo
        .createQueryBuilder('assignment')
        .setLock('pessimistic_write')
        .where('assignment.craftsman_id = :craftsmanId', { craftsmanId: preVersion.craftsmanId })
        .andWhere('assignment.trade = :trade', { trade: preVersion.trade })
        .getOne();

      if (!assignment) {
        throw new NotFoundException(
          `No trade assignment for craftsman ${preVersion.craftsmanId} and trade ${preVersion.trade}`,
        );
      }

      const version = await versionRepo
        .createQueryBuilder('version')
        .setLock('pessimistic_write')
        .where('version.id = :versionId', { versionId })
        .getOne();
      if (!version) {
        throw new NotFoundException(`Pricing catalog version ${versionId} not found`);
      }

      this.assertDraftMutable(version);

      if (!version.effectiveFrom) {
        throw new BadRequestException('effectiveFrom must be set before publishing');
      }

      const tradeConfig = await tx.getRepository(TradeConfig).findOne({ where: { trade: version.trade } });
      if (!tradeConfig) {
        throw new NotFoundException(`Trade ${version.trade} not found`);
      }
      const schema = extractPricingSchema(tradeConfig.metadata);
      const positions = await tx.getRepository(CatalogPosition).find({ where: { versionId } });
      for (const position of positions) {
        const validation = validatePositionAttributes(schema, position.attributes ?? {});
        if (!validation.valid) {
          throw new BadRequestException({
            message: 'Position attributes failed schema validation',
            errors: validation.errors,
          });
        }
      }

      const activePublished = await versionRepo.findOne({
        where: {
          craftsmanId: version.craftsmanId,
          trade: version.trade,
          status: CatalogVersionStatus.PUBLISHED,
          effectiveUntil: IsNull(),
        },
      });

      if (activePublished && activePublished.id !== version.id) {
        activePublished.effectiveUntil = version.effectiveFrom;
        await versionRepo.save(activePublished);
      }

      version.status = CatalogVersionStatus.PUBLISHED;
      version.publishedByUserId = user.sub;
      await versionRepo.save(version);

      this.logger.log(
        `Published catalog ${version.id} for ${version.craftsmanId}/${version.trade}`,
      );
    });

    return this.findOne(versionId, user);
  }

  async quote(versionId: string, dto: QuoteRequestDto, user: JwtPayload): Promise<QuoteResponseDto> {
    const version = await this.loadVersionOrThrow(versionId);
    this.assertCanAccessCatalog(version.craftsmanId, user);

    const craftsman = await this.craftsmen.findOne({ where: { id: version.craftsmanId } });
    if (!craftsman) {
      throw new NotFoundException(`Craftsman ${version.craftsmanId} not found`);
    }
    if (!craftsman.isActive) {
      throw new BadRequestException(`Craftsman ${version.craftsmanId} is not active`);
    }

    try {
      const result = calculateQuote(toQuoteCatalogData(version), dto.lines);
      return QuoteResponseDto.from(result);
    } catch (error) {
      if (error instanceof QuoteCalculationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private async loadVersionOrThrow(versionId: string): Promise<PricingCatalogVersion> {
    const version = await this.versions.findOne({
      where: { id: versionId },
      relations: VERSION_RELATIONS,
    });
    if (!version) {
      throw new NotFoundException(`Pricing catalog version ${versionId} not found`);
    }
    return version;
  }

  private assertDraftMutable(version: PricingCatalogVersion): void {
    if (version.status !== CatalogVersionStatus.DRAFT) {
      throw new BadRequestException(`Published catalog versions cannot be modified`);
    }
  }

  private async assertTradeExists(trade: string): Promise<void> {
    const found = await this.trades.findOne({ where: { trade } });
    if (!found) {
      throw new NotFoundException(`Trade ${trade} not found`);
    }
  }

  private assertUniquePositionKeys(positions: CatalogPositionInputDto[]): void {
    const keys = positions.map((p) => p.key);
    if (new Set(keys).size !== keys.length) {
      throw new BadRequestException('Duplicate position keys in payload');
    }
  }

  private assertUniqueDiscountKeys(discounts: CatalogDiscountInputDto[]): void {
    const keys = discounts.map((d) => d.key);
    if (new Set(keys).size !== keys.length) {
      throw new BadRequestException('Duplicate discount keys in payload');
    }
  }

  private assertValidSurchargeInput(surcharge: PositionSurchargeInputDto): void {
    const hasFlat = surcharge.flatAmount !== undefined && surcharge.flatAmount !== null;
    const hasPct =
      surcharge.percentageRate !== undefined &&
      surcharge.percentageRate !== null &&
      surcharge.percentageRate !== '';
    if (hasFlat === hasPct) {
      throw new BadRequestException(
        `Surcharge "${surcharge.key}" must have exactly one of flatAmount or percentageRate`,
      );
    }
  }

  private assertValidDiscountInput(discount: CatalogDiscountInputDto): void {
    const hasFlat = discount.flatAmount !== undefined && discount.flatAmount !== null;
    const hasPct =
      discount.percentageRate !== undefined &&
      discount.percentageRate !== null &&
      discount.percentageRate !== '';
    if (hasFlat === hasPct) {
      throw new BadRequestException(
        `Discount "${discount.key}" must have exactly one of flatAmount or percentageRate`,
      );
    }
    if (discount.cap !== undefined && discount.cap !== null && !hasPct) {
      throw new BadRequestException(
        `Discount "${discount.key}" cap is only valid with percentageRate`,
      );
    }
    const appliesTo = discount.appliesTo as { type?: unknown; keys?: unknown };
    if (appliesTo.type !== 'subtotal' && appliesTo.type !== 'positions') {
      throw new BadRequestException(
        `Discount "${discount.key}" appliesTo.type must be "subtotal" or "positions"`,
      );
    }
    if (appliesTo.type === 'positions' && (!Array.isArray(appliesTo.keys) || appliesTo.keys.length === 0)) {
      throw new BadRequestException(
        `Discount "${discount.key}" with appliesTo.positions must contain at least one key`,
      );
    }
    if (appliesTo.type === 'positions') {
      const keysUnknown = appliesTo.keys as unknown[];
      const invalid = keysUnknown.some((key: unknown) => typeof key !== 'string' || key.trim().length === 0);
      if (invalid) {
        throw new BadRequestException(
          `Discount "${discount.key}" appliesTo.positions keys must be non-empty strings`,
        );
      }
      const keys = keysUnknown as string[];
      if (new Set(keys).size !== keys.length) {
        throw new BadRequestException(
          `Discount "${discount.key}" appliesTo.positions keys must be unique`,
        );
      }
    }
    if (appliesTo.type === 'subtotal' && appliesTo.keys !== undefined) {
      throw new BadRequestException(
        `Discount "${discount.key}" appliesTo.subtotal must not define keys`,
      );
    }
  }

  private isCraftsmanOnly(user: JwtPayload): boolean {
    return user.roles.includes(UserRole.CRAFTSMAN) && !user.roles.includes(UserRole.ADMIN);
  }

  private assertCanAccessCatalog(craftsmanId: string, user: JwtPayload): void {
    if (!this.isCraftsmanOnly(user)) {
      return;
    }
    if (user.craftsmanId !== craftsmanId) {
      throw new ForbiddenException('Craftsmen may only access their own pricing catalogs');
    }
  }
}

function extractPricingSchema(metadata: Record<string, unknown>): PricingSchema | null {
  const raw = metadata.pricingSchema;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const fields = (raw as PricingSchema).fields;
  if (!Array.isArray(fields)) {
    return { fields: [] };
  }
  return { fields };
}

function toQuoteCatalogData(version: PricingCatalogVersion): QuoteCatalogData {
  return {
    positions: (version.positions ?? []).map((position) => ({
      key: position.key,
      label: position.label,
      unit: position.unit,
      netPrice: position.netPrice,
      vatRate: position.vatRate,
      minQuantity: position.minQuantity,
      maxQuantity: position.maxQuantity,
      surcharges: (position.surcharges ?? []).map((surcharge) => ({
        key: surcharge.key,
        label: surcharge.label,
        flatAmount: surcharge.flatAmount,
        percentageRate: surcharge.percentageRate,
        sortOrder: surcharge.sortOrder,
      })),
    })),
    discounts: (version.discounts ?? []).map((discount) => ({
      key: discount.key,
      label: discount.label,
      flatAmount: discount.flatAmount,
      percentageRate: discount.percentageRate,
      cap: discount.cap,
      appliesTo: discount.appliesTo,
      sortOrder: discount.sortOrder,
    })),
  };
}
