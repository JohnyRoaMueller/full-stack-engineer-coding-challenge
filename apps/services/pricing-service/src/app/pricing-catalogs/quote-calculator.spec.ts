import {
  calculateQuote,
  QuoteCalculationError,
  QuoteCatalogData,
  roundHalfUp,
} from './quote-calculator';

function basePosition(
  overrides: Partial<QuoteCatalogData['positions'][number]> = {},
): QuoteCatalogData['positions'][number] {
  return {
    key: 'item-a',
    label: 'Item A',
    unit: 'piece',
    netPrice: 1000,
    vatRate: '0.190000',
    minQuantity: null,
    maxQuantity: null,
    surcharges: [],
    ...overrides,
  };
}

function baseCatalog(overrides: Partial<QuoteCatalogData> = {}): QuoteCatalogData {
  return {
    positions: [basePosition()],
    discounts: [],
    ...overrides,
  };
}

describe('roundHalfUp', () => {
  it('rounds half-up to integer cents', () => {
    expect(roundHalfUp(966.5325)).toBe(967);
    expect(roundHalfUp(183.641175)).toBe(184);
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(3.5)).toBe(4);
  });
});

describe('calculateQuote', () => {
  describe('DESIGN.md §3.2 example (fractional line, rounded totals)', () => {
    it('matches the documented single-line scenario', () => {
      const catalog = baseCatalog({
        positions: [
          basePosition({
            key: 'widget',
            netPrice: 333,
            vatRate: '0.190000',
            surcharges: [
              {
                key: 'rush',
                label: 'Rush fee',
                flatAmount: null,
                percentageRate: '0.075000',
                sortOrder: 0,
              },
            ],
          }),
        ],
        discounts: [
          {
            key: 'promo',
            label: '10% off',
            flatAmount: null,
            percentageRate: '0.100000',
            cap: null,
            appliesTo: { type: 'subtotal' },
            sortOrder: 0,
          },
        ],
      });

      const result = calculateQuote(catalog, [
        { positionKey: 'widget', quantity: 3, appliedSurchargeKeys: ['rush'] },
      ]);

      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].net).toBeCloseTo(966.5325, 4);
      expect(result.lines[0].gross).toBeCloseTo(966.5325 * 1.19, 4);

      expect(result.vatBreakdown).toEqual([
        {
          vatRate: 0.19,
          netTotal: 967,
          vatAmount: 184,
          grossTotal: 1151,
        },
      ]);

      expect(result.totals).toEqual({
        net: 967,
        totalDiscount: 107,
        vat: 184,
        gross: 1151,
      });
    });
  });

  describe('validation', () => {
    it('rejects unknown position keys', () => {
      expect(() =>
        calculateQuote(baseCatalog(), [{ positionKey: 'missing', quantity: 1 }]),
      ).toThrow(new QuoteCalculationError('Unknown position key "missing"', 'UNKNOWN_POSITION'));
    });

    it('rejects quantity below minimum', () => {
      const catalog = baseCatalog({
        positions: [basePosition({ minQuantity: 2 })],
      });
      expect(() =>
        calculateQuote(catalog, [{ positionKey: 'item-a', quantity: 1 }]),
      ).toThrow(QuoteCalculationError);
    });

    it('rejects quantity above maximum', () => {
      const catalog = baseCatalog({
        positions: [basePosition({ maxQuantity: 5 })],
      });
      expect(() =>
        calculateQuote(catalog, [{ positionKey: 'item-a', quantity: 6 }]),
      ).toThrow(QuoteCalculationError);
    });

    it('allows quantity exactly at minQuantity', () => {
      const catalog = baseCatalog({
        positions: [basePosition({ minQuantity: 2, netPrice: 500 })],
      });
      const result = calculateQuote(catalog, [{ positionKey: 'item-a', quantity: 2 }]);
      expect(result.lines[0].net).toBe(1000);
    });

    it('allows quantity exactly at maxQuantity', () => {
      const catalog = baseCatalog({
        positions: [basePosition({ maxQuantity: 5, netPrice: 100 })],
      });
      const result = calculateQuote(catalog, [{ positionKey: 'item-a', quantity: 5 }]);
      expect(result.lines[0].net).toBe(500);
    });

    it('rejects undeclared surcharge keys', () => {
      expect(() =>
        calculateQuote(baseCatalog(), [
          { positionKey: 'item-a', quantity: 1, appliedSurchargeKeys: ['ghost'] },
        ]),
      ).toThrow(
        new QuoteCalculationError(
          'Surcharge "ghost" is not declared on the position',
          'UNKNOWN_SURCHARGE',
        ),
      );
    });

    it('rejects duplicate position keys in input', () => {
      expect(() =>
        calculateQuote(baseCatalog(), [
          { positionKey: 'item-a', quantity: 1 },
          { positionKey: 'item-a', quantity: 2 },
        ]),
      ).toThrow(QuoteCalculationError);
    });
  });

  describe('edge cases', () => {
    it('handles an empty line list', () => {
      const result = calculateQuote(baseCatalog(), []);
      expect(result.lines).toEqual([]);
      expect(result.vatBreakdown).toEqual([]);
      expect(result.totals).toEqual({ net: 0, totalDiscount: 0, vat: 0, gross: 0 });
    });

    it('handles zero-quantity lines', () => {
      const result = calculateQuote(baseCatalog(), [{ positionKey: 'item-a', quantity: 0 }]);
      expect(result.lines[0].net).toBe(0);
      expect(result.totals).toEqual({ net: 0, totalDiscount: 0, vat: 0, gross: 0 });
    });
  });

  describe('surcharges', () => {
    it('sums flat surcharges and chains percentage surcharges in sort order', () => {
      const catalog = baseCatalog({
        positions: [
          basePosition({
            netPrice: 1000,
            surcharges: [
              {
                key: 'flat',
                label: 'Flat',
                flatAmount: 100,
                percentageRate: null,
                sortOrder: 0,
              },
              {
                key: 'pct',
                label: '10%',
                flatAmount: null,
                percentageRate: '0.100000',
                sortOrder: 1,
              },
            ],
          }),
        ],
      });

      const result = calculateQuote(catalog, [
        { positionKey: 'item-a', quantity: 1, appliedSurchargeKeys: ['flat', 'pct'] },
      ]);

      // lineNet 1000 → +100 flat → 1100 → +10% → 1210
      expect(result.lines[0].net).toBeCloseTo(1210, 4);
    });

    it('chains multiple percentage surcharges multiplicatively', () => {
      const catalog = baseCatalog({
        positions: [
          basePosition({
            netPrice: 1000,
            surcharges: [
              {
                key: 'pct-10',
                label: '10%',
                flatAmount: null,
                percentageRate: '0.100000',
                sortOrder: 0,
              },
              {
                key: 'pct-5',
                label: '5%',
                flatAmount: null,
                percentageRate: '0.050000',
                sortOrder: 1,
              },
            ],
          }),
        ],
      });

      const result = calculateQuote(catalog, [
        { positionKey: 'item-a', quantity: 1, appliedSurchargeKeys: ['pct-10', 'pct-5'] },
      ]);

      // 1000 × 1.10 × 1.05 = 1155
      expect(result.lines[0].net).toBeCloseTo(1155, 4);
    });

    it('treats 0% percentage and 0 flat surcharges as no-ops', () => {
      const catalog = baseCatalog({
        positions: [
          basePosition({
            surcharges: [
              {
                key: 'zero-pct',
                label: 'Zero %',
                flatAmount: null,
                percentageRate: '0.000000',
                sortOrder: 0,
              },
              {
                key: 'zero-flat',
                label: 'Zero flat',
                flatAmount: 0,
                percentageRate: null,
                sortOrder: 1,
              },
            ],
          }),
        ],
      });

      const result = calculateQuote(catalog, [
        {
          positionKey: 'item-a',
          quantity: 2,
          appliedSurchargeKeys: ['zero-pct', 'zero-flat'],
        },
      ]);

      expect(result.lines[0].net).toBe(2000);
    });
  });

  describe('discounts', () => {
    it('applies percentage discount with cap before stacking the next discount', () => {
      const catalog = baseCatalog({
        positions: [basePosition({ netPrice: 10000 })],
        discounts: [
          {
            key: 'capped',
            label: '20% capped at 100',
            flatAmount: null,
            percentageRate: '0.200000',
            cap: 100,
            appliesTo: { type: 'subtotal' },
            sortOrder: 0,
          },
          {
            key: 'follow-up',
            label: '10% follow-up',
            flatAmount: null,
            percentageRate: '0.100000',
            cap: null,
            appliesTo: { type: 'subtotal' },
            sortOrder: 1,
          },
        ],
      });

      const result = calculateQuote(catalog, [{ positionKey: 'item-a', quantity: 1 }]);

      // 10000 - 100 (capped) = 9900; 10% of 9900 = 990 → net 8910
      expect(result.lines[0].net).toBeCloseTo(8910, 4);
      expect(result.totals.totalDiscount).toBe(1090);
    });

    it('stacks multiple discounts in declaration order', () => {
      const catalog = baseCatalog({
        positions: [basePosition({ netPrice: 1000 })],
        discounts: [
          {
            key: 'first',
            label: 'Flat 100',
            flatAmount: 100,
            percentageRate: null,
            cap: null,
            appliesTo: { type: 'subtotal' },
            sortOrder: 0,
          },
          {
            key: 'second',
            label: '10%',
            flatAmount: null,
            percentageRate: '0.100000',
            cap: null,
            appliesTo: { type: 'subtotal' },
            sortOrder: 1,
          },
        ],
      });

      const result = calculateQuote(catalog, [{ positionKey: 'item-a', quantity: 1 }]);

      // 1000 - 100 = 900; 10% of 900 = 90 → net 810
      expect(result.lines[0].net).toBeCloseTo(810, 4);
    });

    it('applies position-scoped discounts only to matching lines', () => {
      const catalog = baseCatalog({
        positions: [
          basePosition({ key: 'a', netPrice: 1000 }),
          basePosition({ key: 'b', netPrice: 2000 }),
        ],
        discounts: [
          {
            key: 'on-a',
            label: '50% on A',
            flatAmount: null,
            percentageRate: '0.500000',
            cap: null,
            appliesTo: { type: 'positions', keys: ['a'] },
            sortOrder: 0,
          },
        ],
      });

      const result = calculateQuote(catalog, [
        { positionKey: 'a', quantity: 1 },
        { positionKey: 'b', quantity: 1 },
      ]);

      expect(result.lines[0].net).toBeCloseTo(500, 4);
      expect(result.lines[1].net).toBe(2000);
    });

    it('caps flat discount at applicable subtotal', () => {
      const catalog = baseCatalog({
        positions: [basePosition({ netPrice: 500 })],
        discounts: [
          {
            key: 'big-flat',
            label: 'Flat 1000',
            flatAmount: 1000,
            percentageRate: null,
            cap: null,
            appliesTo: { type: 'subtotal' },
            sortOrder: 0,
          },
        ],
      });

      const result = calculateQuote(catalog, [{ positionKey: 'item-a', quantity: 1 }]);

      expect(result.lines[0].net).toBe(0);
      expect(result.totals.totalDiscount).toBe(500);
    });

    it('produces different results when discount order is swapped', () => {
      const discountsAfirst = baseCatalog({
        positions: [basePosition({ netPrice: 1000 })],
        discounts: [
          {
            key: 'flat',
            label: 'Flat 100',
            flatAmount: 100,
            percentageRate: null,
            cap: null,
            appliesTo: { type: 'subtotal' },
            sortOrder: 0,
          },
          {
            key: 'pct',
            label: '10%',
            flatAmount: null,
            percentageRate: '0.100000',
            cap: null,
            appliesTo: { type: 'subtotal' },
            sortOrder: 1,
          },
        ],
      });

      const discountsPctFirst = baseCatalog({
        positions: [basePosition({ netPrice: 1000 })],
        discounts: [
          {
            key: 'pct',
            label: '10%',
            flatAmount: null,
            percentageRate: '0.100000',
            cap: null,
            appliesTo: { type: 'subtotal' },
            sortOrder: 0,
          },
          {
            key: 'flat',
            label: 'Flat 100',
            flatAmount: 100,
            percentageRate: null,
            cap: null,
            appliesTo: { type: 'subtotal' },
            sortOrder: 1,
          },
        ],
      });

      const flatFirst = calculateQuote(discountsAfirst, [{ positionKey: 'item-a', quantity: 1 }]);
      const pctFirst = calculateQuote(discountsPctFirst, [{ positionKey: 'item-a', quantity: 1 }]);

      // flat then 10%: 1000 → 900 → 810;  10% then flat: 1000 → 900 → 800
      expect(flatFirst.lines[0].net).toBeCloseTo(810, 4);
      expect(pctFirst.lines[0].net).toBeCloseTo(800, 4);
      expect(flatFirst.lines[0].net).not.toBeCloseTo(pctFirst.lines[0].net!, 4);
    });

    it('records cumulative discount allocations on a position', () => {
      const catalog = baseCatalog({
        positions: [basePosition({ netPrice: 1000 })],
        discounts: [
          {
            key: 'flat',
            label: 'Flat 50',
            flatAmount: 50,
            percentageRate: null,
            cap: null,
            appliesTo: { type: 'subtotal' },
            sortOrder: 0,
          },
          {
            key: 'pct',
            label: '10%',
            flatAmount: null,
            percentageRate: '0.100000',
            cap: null,
            appliesTo: { type: 'subtotal' },
            sortOrder: 1,
          },
        ],
      });

      const result = calculateQuote(catalog, [{ positionKey: 'item-a', quantity: 1 }]);

      expect(result.lines[0].appliedDiscounts).toHaveLength(2);
      const allocated = result.lines[0].appliedDiscounts.reduce((sum, d) => sum + d.amount, 0);
      expect(allocated).toBeCloseTo(145, 4);
      expect(result.lines[0].net).toBeCloseTo(855, 4);
    });
  });

  describe('mixed VAT rates', () => {
    it('groups fractional nets per rate and rounds once per VAT bucket', () => {
      const catalog = baseCatalog({
        positions: [
          basePosition({ key: 'std', netPrice: 333, vatRate: '0.190000' }),
          basePosition({ key: 'reduced', netPrice: 333, vatRate: '0.070000' }),
        ],
      });

      const result = calculateQuote(catalog, [
        { positionKey: 'std', quantity: 1 },
        { positionKey: 'reduced', quantity: 1 },
      ]);

      expect(result.vatBreakdown).toHaveLength(2);
      expect(result.vatBreakdown.find((v) => v.vatRate === 0.19)).toEqual({
        vatRate: 0.19,
        netTotal: 333,
        vatAmount: 63,
        grossTotal: 396,
      });
      expect(result.vatBreakdown.find((v) => v.vatRate === 0.07)).toEqual({
        vatRate: 0.07,
        netTotal: 333,
        vatAmount: 23,
        grossTotal: 356,
      });
      expect(result.totals.net).toBe(666);
      expect(result.totals.vat).toBe(86);
      expect(result.totals.gross).toBe(752);
    });

    it('aggregates fractional nets per VAT rate before rounding once', () => {
      const surcharge = {
        key: 'rush',
        label: 'Rush fee',
        flatAmount: null,
        percentageRate: '0.075000',
        sortOrder: 0,
      };
      const discount = {
        key: 'promo',
        label: '10% off',
        flatAmount: null,
        percentageRate: '0.100000',
        cap: null,
        appliesTo: { type: 'subtotal' as const },
        sortOrder: 0,
      };
      const catalog = baseCatalog({
        positions: [
          basePosition({ key: 'a', netPrice: 333, surcharges: [surcharge] }),
          basePosition({ key: 'b', netPrice: 333, surcharges: [surcharge] }),
        ],
        discounts: [discount],
      });

      const result = calculateQuote(catalog, [
        { positionKey: 'a', quantity: 3, appliedSurchargeKeys: ['rush'] },
        { positionKey: 'b', quantity: 3, appliedSurchargeKeys: ['rush'] },
      ]);

      // Per line: 999 × 1.075 × 0.9 = 966.5325; bucket sum = 1933.065
      expect(result.lines[0].net).toBeCloseTo(966.5325, 4);
      expect(result.lines[1].net).toBeCloseTo(966.5325, 4);
      expect(result.vatBreakdown).toEqual([
        {
          vatRate: 0.19,
          netTotal: 1933,
          vatAmount: 367,
          grossTotal: 2300,
        },
      ]);
    });
  });

  describe('invariants', () => {
    it('keeps gross >= net on rounded totals for non-negative inputs', () => {
      const catalog = baseCatalog({
        positions: [
          basePosition({
            netPrice: 777,
            surcharges: [
              {
                key: 'pct',
                label: '7.5%',
                flatAmount: null,
                percentageRate: '0.075000',
                sortOrder: 0,
              },
            ],
          }),
        ],
        discounts: [
          {
            key: 'pct-off',
            label: '12%',
            flatAmount: null,
            percentageRate: '0.120000',
            cap: 50,
            appliesTo: { type: 'subtotal' },
            sortOrder: 0,
          },
        ],
      });

      const result = calculateQuote(catalog, [
        { positionKey: 'item-a', quantity: 4, appliedSurchargeKeys: ['pct'] },
      ]);

      expect(result.totals.gross).toBeGreaterThanOrEqual(result.totals.net);
    });

    it('sums per-rate VAT into the quote total VAT', () => {
      const catalog = baseCatalog({
        positions: [
          basePosition({ key: 'a', netPrice: 500, vatRate: '0.190000' }),
          basePosition({ key: 'b', netPrice: 300, vatRate: '0.070000' }),
          basePosition({ key: 'c', netPrice: 200, vatRate: '0.190000' }),
        ],
      });

      const result = calculateQuote(catalog, [
        { positionKey: 'a', quantity: 1 },
        { positionKey: 'b', quantity: 1 },
        { positionKey: 'c', quantity: 1 },
      ]);

      const vatSum = result.vatBreakdown.reduce((sum, entry) => sum + entry.vatAmount, 0);
      expect(result.totals.vat).toBe(vatSum);
    });

    it('doubles net exactly when all quantities are doubled', () => {
      const catalog = baseCatalog({
        positions: [
          basePosition({ key: 'a', netPrice: 333 }),
          basePosition({ key: 'b', netPrice: 777 }),
        ],
      });

      const single = calculateQuote(catalog, [
        { positionKey: 'a', quantity: 1 },
        { positionKey: 'b', quantity: 2 },
      ]);
      const doubled = calculateQuote(catalog, [
        { positionKey: 'a', quantity: 2 },
        { positionKey: 'b', quantity: 4 },
      ]);

      expect(doubled.totals.net).toBe(single.totals.net * 2);
    });
  });
});
