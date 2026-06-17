import type { DiscountAppliesTo } from './entities/catalog-discount.entity';

/** Input line for quote evaluation. */
export interface QuoteLineInput {
  readonly positionKey: string;
  readonly quantity: number;
  readonly appliedSurchargeKeys?: readonly string[];
}

/** Catalog snapshot passed into the pure calculator (decoupled from TypeORM). */
export interface QuoteCatalogPosition {
  readonly key: string;
  readonly label: string;
  readonly unit: string;
  readonly netPrice: number;
  readonly vatRate: string | number;
  readonly minQuantity: number | null;
  readonly maxQuantity: number | null;
  readonly surcharges: readonly QuoteCatalogSurcharge[];
}

export interface QuoteCatalogSurcharge {
  readonly key: string;
  readonly label: string;
  readonly flatAmount: number | null;
  readonly percentageRate: string | number | null;
  readonly sortOrder: number;
}

export interface QuoteCatalogDiscount {
  readonly key: string;
  readonly label: string;
  readonly flatAmount: number | null;
  readonly percentageRate: string | number | null;
  readonly cap: number | null;
  readonly appliesTo: DiscountAppliesTo;
  readonly sortOrder: number;
}

export interface QuoteCatalogData {
  readonly positions: readonly QuoteCatalogPosition[];
  readonly discounts: readonly QuoteCatalogDiscount[];
}

export interface AppliedSurchargeResult {
  readonly key: string;
  readonly label: string;
  readonly amount: number;
}

export interface AppliedDiscountResult {
  readonly key: string;
  readonly label: string;
  readonly amount: number;
}

export interface QuoteLineResult {
  readonly positionKey: string;
  readonly quantity: number;
  /** Fractional cents after surcharges and discounts. */
  readonly net: number;
  /** Fractional cents (net × (1 + vatRate)). */
  readonly gross: number;
  readonly appliedSurcharges: readonly AppliedSurchargeResult[];
  readonly appliedDiscounts: readonly AppliedDiscountResult[];
}

export interface VatBreakdownEntry {
  readonly vatRate: number;
  readonly netTotal: number;
  readonly vatAmount: number;
  readonly grossTotal: number;
}

export interface QuoteTotals {
  readonly net: number;
  readonly totalDiscount: number;
  readonly vat: number;
  readonly gross: number;
}

export interface QuoteResult {
  readonly lines: readonly QuoteLineResult[];
  readonly vatBreakdown: readonly VatBreakdownEntry[];
  readonly totals: QuoteTotals;
}

export class QuoteCalculationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'QuoteCalculationError';
  }
}

interface LineState {
  readonly positionKey: string;
  readonly quantity: number;
  readonly vatRate: number;
  readonly lineNet: number;
  netAfterSurcharges: number;
  netAfterDiscounts: number;
  readonly appliedSurcharges: AppliedSurchargeResult[];
  readonly appliedDiscounts: AppliedDiscountResult[];
}

/** Round half-up to integer cents (positive money amounts only). */
export function roundHalfUp(value: number): number {
  return Math.round(value);
}

function toRate(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

function sortByOrder<T extends { sortOrder: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder || 0);
}

function assertQuantityInRange(
  positionKey: string,
  quantity: number,
  minQuantity: number | null,
  maxQuantity: number | null,
): void {
  if (minQuantity !== null && quantity < minQuantity) {
    throw new QuoteCalculationError(
      `Quantity ${quantity} for position "${positionKey}" is below minimum ${minQuantity}`,
      'QUANTITY_BELOW_MIN',
    );
  }
  if (maxQuantity !== null && quantity > maxQuantity) {
    throw new QuoteCalculationError(
      `Quantity ${quantity} for position "${positionKey}" exceeds maximum ${maxQuantity}`,
      'QUANTITY_ABOVE_MAX',
    );
  }
}

function applyLineSurcharges(
  lineNet: number,
  surcharges: readonly QuoteCatalogSurcharge[],
  appliedKeys: readonly string[],
): { netAfterSurcharges: number; applied: AppliedSurchargeResult[] } {
  const surchargeByKey = new Map(surcharges.map((s) => [s.key, s]));
  for (const key of appliedKeys) {
    if (!surchargeByKey.has(key)) {
      throw new QuoteCalculationError(
        `Surcharge "${key}" is not declared on the position`,
        'UNKNOWN_SURCHARGE',
      );
    }
  }

  let running = lineNet;
  const applied: AppliedSurchargeResult[] = [];

  for (const surcharge of sortByOrder(surcharges)) {
    if (!appliedKeys.includes(surcharge.key)) {
      continue;
    }

    if (surcharge.flatAmount !== null) {
      running += surcharge.flatAmount;
      applied.push({ key: surcharge.key, label: surcharge.label, amount: surcharge.flatAmount });
    } else if (surcharge.percentageRate !== null) {
      const rate = toRate(surcharge.percentageRate);
      const amount = running * rate;
      running += amount;
      applied.push({ key: surcharge.key, label: surcharge.label, amount });
    }
  }

  return { netAfterSurcharges: running, applied };
}

function discountAppliesToLine(appliesTo: DiscountAppliesTo, positionKey: string): boolean {
  if (appliesTo.type === 'subtotal') {
    return true;
  }
  return appliesTo.keys.includes(positionKey);
}

function computeDiscountAmount(
  applicableBase: number,
  discount: QuoteCatalogDiscount,
): number {
  if (applicableBase <= 0) {
    return 0;
  }

  if (discount.flatAmount !== null) {
    return Math.min(discount.flatAmount, applicableBase);
  }

  if (discount.percentageRate !== null) {
    const raw = applicableBase * toRate(discount.percentageRate);
    if (discount.cap !== null) {
      return Math.min(raw, discount.cap);
    }
    return raw;
  }

  return 0;
}

function distributeDiscount(
  lines: LineState[],
  discountAmount: number,
  appliesTo: DiscountAppliesTo,
): Map<string, number> {
  const allocations = new Map<string, number>();
  if (discountAmount <= 0) {
    return allocations;
  }

  const applicableLines = lines.filter((line) => discountAppliesToLine(appliesTo, line.positionKey));
  const applicableBase = applicableLines.reduce((sum, line) => sum + line.netAfterDiscounts, 0);

  if (applicableBase <= 0) {
    return allocations;
  }

  let remaining = discountAmount;
  for (let i = 0; i < applicableLines.length; i++) {
    const line = applicableLines[i];
    const isLast = i === applicableLines.length - 1;
    const share = isLast
      ? remaining
      : (line.netAfterDiscounts / applicableBase) * discountAmount;
    const allocation = Math.min(share, line.netAfterDiscounts);
    line.netAfterDiscounts -= allocation;
    remaining -= allocation;
    allocations.set(line.positionKey, (allocations.get(line.positionKey) ?? 0) + allocation);
  }

  return allocations;
}

/**
 * Pure quote calculator per DESIGN.md §3.
 *
 * Evaluation order: line net → surcharges → catalog discounts → VAT grouping.
 * Fractional precision until VAT-group and quote-total rounding (half-up).
 */
export function calculateQuote(
  catalog: QuoteCatalogData,
  lines: readonly QuoteLineInput[],
): QuoteResult {
  const positionByKey = new Map(catalog.positions.map((p) => [p.key, p]));
  const seenKeys = new Set<string>();
  const lineStates: LineState[] = [];

  for (const input of lines) {
    if (seenKeys.has(input.positionKey)) {
      throw new QuoteCalculationError(
        `Duplicate position key "${input.positionKey}" in quote lines`,
        'DUPLICATE_POSITION',
      );
    }
    seenKeys.add(input.positionKey);

    const position = positionByKey.get(input.positionKey);
    if (!position) {
      throw new QuoteCalculationError(
        `Unknown position key "${input.positionKey}"`,
        'UNKNOWN_POSITION',
      );
    }

    assertQuantityInRange(
      input.positionKey,
      input.quantity,
      position.minQuantity,
      position.maxQuantity,
    );

    const lineNet = input.quantity * position.netPrice;
    const appliedSurchargeKeys = input.appliedSurchargeKeys ?? [];
    const { netAfterSurcharges, applied } = applyLineSurcharges(
      lineNet,
      position.surcharges,
      appliedSurchargeKeys,
    );

    lineStates.push({
      positionKey: input.positionKey,
      quantity: input.quantity,
      vatRate: toRate(position.vatRate),
      lineNet,
      netAfterSurcharges,
      netAfterDiscounts: netAfterSurcharges,
      appliedSurcharges: applied,
      appliedDiscounts: [],
    });
  }

  let totalDiscountAmount = 0;

  for (const discount of sortByOrder(catalog.discounts)) {
    const applicableLines = lineStates.filter((line) =>
      discountAppliesToLine(discount.appliesTo, line.positionKey),
    );
    const applicableBase = applicableLines.reduce((sum, line) => sum + line.netAfterDiscounts, 0);
    const discountAmount = computeDiscountAmount(applicableBase, discount);

    if (discountAmount <= 0) {
      continue;
    }

    totalDiscountAmount += discountAmount;
    const allocations = distributeDiscount(lineStates, discountAmount, discount.appliesTo);

    for (const [positionKey, amount] of allocations) {
      if (amount <= 0) {
        continue;
      }
      const line = lineStates.find((l) => l.positionKey === positionKey);
      if (!line) {
        continue;
      }
      line.appliedDiscounts.push({
        key: discount.key,
        label: discount.label,
        amount,
      });
    }
  }

  const resultLines: QuoteLineResult[] = lineStates.map((line) => {
    const net = line.netAfterDiscounts;
    return {
      positionKey: line.positionKey,
      quantity: line.quantity,
      net,
      gross: net * (1 + line.vatRate),
      appliedSurcharges: line.appliedSurcharges,
      appliedDiscounts: line.appliedDiscounts,
    };
  });

  const netByVatRate = new Map<number, number>();
  for (const line of lineStates) {
    netByVatRate.set(line.vatRate, (netByVatRate.get(line.vatRate) ?? 0) + line.netAfterDiscounts);
  }

  const vatBreakdown: VatBreakdownEntry[] = [...netByVatRate.entries()]
    .sort(([a], [b]) => a - b)
    .map(([vatRate, fractionalNet]) => {
      const netTotal = roundHalfUp(fractionalNet);
      const vatAmount = roundHalfUp(fractionalNet * vatRate);
      return {
        vatRate,
        netTotal,
        vatAmount,
        grossTotal: netTotal + vatAmount,
      };
    });

  const totals: QuoteTotals = {
    net: vatBreakdown.reduce((sum, entry) => sum + entry.netTotal, 0),
    totalDiscount: roundHalfUp(totalDiscountAmount),
    vat: vatBreakdown.reduce((sum, entry) => sum + entry.vatAmount, 0),
    gross: vatBreakdown.reduce((sum, entry) => sum + entry.grossTotal, 0),
  };

  return { lines: resultLines, vatBreakdown, totals };
}
