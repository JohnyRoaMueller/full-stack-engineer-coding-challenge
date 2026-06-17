import { ApiProperty } from '@nestjs/swagger';
import { CatalogVersionStatus } from '../entities/pricing-catalog-version.entity';
import { PositionUnit } from '../entities/catalog-position.entity';
import { DiscountAppliesTo } from '../entities/catalog-discount.entity';
import { CatalogDiscount } from '../entities/catalog-discount.entity';
import { CatalogPosition } from '../entities/catalog-position.entity';
import { PositionSurcharge } from '../entities/position-surcharge.entity';
import { PricingCatalogVersion } from '../entities/pricing-catalog-version.entity';

export class PositionSurchargeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  key: string;

  @ApiProperty()
  label: string;

  @ApiProperty({ nullable: true })
  flatAmount: number | null;

  @ApiProperty({ nullable: true })
  percentageRate: string | null;

  @ApiProperty()
  sortOrder: number;
}

export class CatalogPositionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  key: string;

  @ApiProperty()
  label: string;

  @ApiProperty({ enum: PositionUnit })
  unit: PositionUnit;

  @ApiProperty()
  netPrice: number;

  @ApiProperty()
  vatRate: string;

  @ApiProperty({ nullable: true })
  minQuantity: number | null;

  @ApiProperty({ nullable: true })
  maxQuantity: number | null;

  @ApiProperty({ type: Object })
  attributes: Record<string, unknown>;

  @ApiProperty({ type: [PositionSurchargeResponseDto] })
  surcharges: PositionSurchargeResponseDto[];
}

export class CatalogDiscountResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  key: string;

  @ApiProperty()
  label: string;

  @ApiProperty({ nullable: true })
  flatAmount: number | null;

  @ApiProperty({ nullable: true })
  percentageRate: string | null;

  @ApiProperty({ nullable: true })
  cap: number | null;

  @ApiProperty()
  appliesTo: DiscountAppliesTo;

  @ApiProperty()
  sortOrder: number;
}

export class PricingCatalogVersionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  craftsmanId: string;

  @ApiProperty()
  trade: string;

  @ApiProperty({ enum: CatalogVersionStatus })
  status: CatalogVersionStatus;

  @ApiProperty({ nullable: true })
  effectiveFrom: string | null;

  @ApiProperty({ nullable: true })
  effectiveUntil: string | null;

  @ApiProperty({ nullable: true })
  publishedByUserId: string | null;

  @ApiProperty({ type: [CatalogPositionResponseDto] })
  positions: CatalogPositionResponseDto[];

  @ApiProperty({ type: [CatalogDiscountResponseDto] })
  discounts: CatalogDiscountResponseDto[];
}

export class PricingCatalogVersionListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  craftsmanId: string;

  @ApiProperty()
  trade: string;

  @ApiProperty()
  status: string;

  @ApiProperty({ nullable: true })
  effectiveFrom: string | null;

  @ApiProperty({ nullable: true })
  effectiveUntil: string | null;

  @ApiProperty()
  createdAt: string;
}

function mapSurcharge(s: PositionSurcharge): PositionSurchargeResponseDto {
  return {
    id: s.id,
    key: s.key,
    label: s.label,
    flatAmount: s.flatAmount,
    percentageRate: s.percentageRate,
    sortOrder: s.sortOrder,
  };
}

function mapPosition(p: CatalogPosition): CatalogPositionResponseDto {
  return {
    id: p.id,
    key: p.key,
    label: p.label,
    unit: p.unit,
    netPrice: p.netPrice,
    vatRate: p.vatRate,
    minQuantity: p.minQuantity,
    maxQuantity: p.maxQuantity,
    attributes: p.attributes,
    surcharges: (p.surcharges ?? []).map(mapSurcharge).sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

function mapDiscount(d: CatalogDiscount): CatalogDiscountResponseDto {
  return {
    id: d.id,
    key: d.key,
    label: d.label,
    flatAmount: d.flatAmount,
    percentageRate: d.percentageRate,
    cap: d.cap,
    appliesTo: d.appliesTo,
    sortOrder: d.sortOrder,
  };
}

export function toPricingCatalogVersionResponse(
  version: PricingCatalogVersion,
): PricingCatalogVersionResponseDto {
  return {
    id: version.id,
    craftsmanId: version.craftsmanId,
    trade: version.trade,
    status: version.status,
    effectiveFrom: version.effectiveFrom?.toISOString() ?? null,
    effectiveUntil: version.effectiveUntil?.toISOString() ?? null,
    publishedByUserId: version.publishedByUserId,
    positions: (version.positions ?? []).map(mapPosition).sort((a, b) => a.key.localeCompare(b.key)),
    discounts: (version.discounts ?? []).map(mapDiscount).sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

export function toPricingCatalogVersionListItem(
  version: PricingCatalogVersion,
): PricingCatalogVersionListItemDto {
  return {
    id: version.id,
    craftsmanId: version.craftsmanId,
    trade: version.trade,
    status: version.status,
    effectiveFrom: version.effectiveFrom?.toISOString() ?? null,
    effectiveUntil: version.effectiveUntil?.toISOString() ?? null,
    createdAt: version.createdAt.toISOString(),
  };
}
