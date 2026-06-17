import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogPosition } from '../pricing-catalogs/entities/catalog-position.entity';
import { TradeConfig } from './entities/trade-config.entity';
import { TradeConfigResponseDto } from './dto/trade-config-response.dto';
import { UpdateTradeDto } from './dto/update-trade.dto';
import {
  findPositionsViolatingSchema,
  PricingSchema,
} from './pricing-schema-validator';

@Injectable()
export class TradesService {
  private readonly logger = new Logger(TradesService.name);

  constructor(
    @InjectRepository(TradeConfig) private readonly repo: Repository<TradeConfig>,
    @InjectRepository(CatalogPosition)
    private readonly positions: Repository<CatalogPosition>,
  ) {}

  async list(): Promise<TradeConfigResponseDto[]> {
    const items = await this.repo.find({ order: { trade: 'ASC' } });
    return items.map(TradeConfigResponseDto.from);
  }

  async findByCode(trade: string): Promise<TradeConfigResponseDto> {
    const found = await this.repo.findOne({ where: { trade } });
    if (!found) {
      throw new NotFoundException(`Trade ${trade} not found`);
    }
    return TradeConfigResponseDto.from(found);
  }

  async update(trade: string, dto: UpdateTradeDto): Promise<TradeConfigResponseDto> {
    if (dto.displayName === undefined && dto.pricingSchema === undefined) {
      throw new BadRequestException('At least one of displayName or pricingSchema must be provided');
    }

    const existing = await this.repo.findOne({ where: { trade } });
    if (!existing) {
      throw new NotFoundException(`Trade ${trade} not found`);
    }

    if (dto.pricingSchema !== undefined) {
      const newSchema: PricingSchema = { fields: dto.pricingSchema.fields };
      const catalogPositions = await this.positions.find({
        where: { version: { trade } },
        select: ['key', 'attributes', 'versionId'],
      });

      const conflicts = findPositionsViolatingSchema(
        catalogPositions.map((position) => ({
          versionId: position.versionId,
          key: position.key,
          attributes: position.attributes,
        })),
        newSchema,
      );

      if (conflicts.length > 0) {
        throw new ConflictException({
          message: 'New pricingSchema would invalidate existing catalog positions',
          conflicts,
        });
      }

      existing.metadata = {
        ...existing.metadata,
        pricingSchema: newSchema,
      };
    }

    if (dto.displayName !== undefined) {
      existing.displayName = dto.displayName;
    }

    const saved = await this.repo.save(existing);
    this.logger.log(`Updated trade ${trade}`);

    return TradeConfigResponseDto.from(saved);
  }
}
