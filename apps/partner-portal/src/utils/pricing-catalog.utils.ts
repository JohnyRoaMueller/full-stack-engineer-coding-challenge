import {
  CatalogDiscountInput,
  CatalogDiscountResponse,
  CatalogPositionInput,
  CatalogPositionResponse,
  PricingCatalogVersionListItem,
} from '../services/pricing-catalogs.service';

export function findDraftVersion(
  versions: PricingCatalogVersionListItem[],
): PricingCatalogVersionListItem | null {
  return versions.find((version) => version.status === 'DRAFT') ?? null;
}

export function findActivePublishedVersion(
  versions: PricingCatalogVersionListItem[],
): PricingCatalogVersionListItem | null {
  return (
    versions.find(
      (version) => version.status === 'PUBLISHED' && version.effectiveUntil === null,
    ) ?? null
  );
}

export function toPositionInput(position: CatalogPositionResponse): CatalogPositionInput {
  return {
    key: position.key,
    label: position.label,
    unit: position.unit,
    netPrice: position.netPrice,
    vatRate: position.vatRate,
    minQuantity: position.minQuantity,
    maxQuantity: position.maxQuantity,
    attributes: position.attributes,
    surcharges: position.surcharges.map((surcharge) => ({
      key: surcharge.key,
      label: surcharge.label,
      flatAmount: surcharge.flatAmount,
      percentageRate: surcharge.percentageRate,
      sortOrder: surcharge.sortOrder,
    })),
  };
}

export function toDiscountInput(discount: CatalogDiscountResponse): CatalogDiscountInput {
  return {
    key: discount.key,
    label: discount.label,
    flatAmount: discount.flatAmount,
    percentageRate: discount.percentageRate,
    cap: discount.cap,
    appliesTo: discount.appliesTo,
    sortOrder: discount.sortOrder,
  };
}
