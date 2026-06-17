import { describe, expect, it } from 'vitest';
import { QuoteResponse } from '../services/pricing-catalogs.service';
import { quoteResponseToBreakdown } from './quote-breakdown.utils';

const sampleQuote: QuoteResponse = {
  lines: [
    {
      positionKey: 'install',
      quantity: 2,
      net: 10000,
      gross: 11900,
      appliedSurcharges: [{ key: 'travel', label: 'Travel', amount: 500 }],
      appliedDiscounts: [{ key: 'promo', label: 'Promo', amount: 200 }],
    },
  ],
  vatBreakdown: [
    {
      vatRate: 0.19,
      netTotal: 10000,
      vatAmount: 1900,
      grossTotal: 11900,
    },
  ],
  totals: {
    net: 10000,
    totalDiscount: 200,
    vat: 1900,
    gross: 11900,
  },
};

describe('quoteResponseToBreakdown', () => {
  it('maps quote lines to formatted breakdown rows', () => {
    const breakdown = quoteResponseToBreakdown(sampleQuote, 'de-DE');

    expect(breakdown.lines).toHaveLength(1);
    expect(breakdown.lines[0]).toEqual({
      positionKey: 'install',
      quantity: 2,
      net: '100,00\u00a0€',
      gross: '119,00\u00a0€',
      surchargesSummary: 'Travel: 5,00\u00a0€',
      discountsSummary: 'Promo: 2,00\u00a0€',
    });
  });

  it('maps VAT breakdown and totals', () => {
    const breakdown = quoteResponseToBreakdown(sampleQuote, 'de-DE');

    expect(breakdown.vatBreakdown[0]).toEqual({
      vatRateLabel: '19 %',
      netTotal: '100,00\u00a0€',
      vatAmount: '19,00\u00a0€',
      grossTotal: '119,00\u00a0€',
    });
    expect(breakdown.totals.gross).toBe('119,00\u00a0€');
  });

  it('uses em dash when no surcharges or discounts on a line', () => {
    const breakdown = quoteResponseToBreakdown(
      {
        ...sampleQuote,
        lines: [
          {
            positionKey: 'flat',
            quantity: 1,
            net: 5000,
            gross: 5950,
            appliedSurcharges: [],
            appliedDiscounts: [],
          },
        ],
      },
      'de-DE',
    );

    expect(breakdown.lines[0]?.surchargesSummary).toBe('—');
    expect(breakdown.lines[0]?.discountsSummary).toBe('—');
  });
});
