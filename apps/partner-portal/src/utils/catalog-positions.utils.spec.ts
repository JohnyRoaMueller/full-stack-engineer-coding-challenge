import { describe, expect, it } from 'vitest';
import { CatalogPositionResponse } from '../services/pricing-catalogs.service';
import {
  centsToEuroInput,
  formatNetPriceEuro,
  formatVatRate,
  parseEuroToCents,
  parseVatPercentToRate,
  summarizeAttributes,
  toPositionTableRow,
  vatRateToPercentInput,
  versionPositionsToInputs,
} from './catalog-positions.utils';

function samplePositionResponse(
  overrides: Partial<CatalogPositionResponse> = {},
): CatalogPositionResponse {
  return {
    id: 'pos-1',
    key: 'window-install',
    label: 'Window installation',
    unit: 'piece',
    netPrice: 12550,
    vatRate: '0.190000',
    minQuantity: 1,
    maxQuantity: 10,
    attributes: {
      uValue: 0.9,
      frameMaterial: 'wood',
    },
    surcharges: [
      {
        id: 'surcharge-1',
        key: 'travel',
        label: 'Travel',
        flatAmount: 2500,
        percentageRate: null,
        sortOrder: 0,
      },
    ],
    ...overrides,
  };
}

describe('versionPositionsToInputs', () => {
  it('maps backend position responses to editable catalog inputs', () => {
    const inputs = versionPositionsToInputs([samplePositionResponse()]);

    expect(inputs).toEqual([
      {
        key: 'window-install',
        label: 'Window installation',
        unit: 'piece',
        netPrice: 12550,
        vatRate: '0.190000',
        minQuantity: 1,
        maxQuantity: 10,
        attributes: {
          uValue: 0.9,
          frameMaterial: 'wood',
        },
        surcharges: [
          {
            key: 'travel',
            label: 'Travel',
            flatAmount: 2500,
            percentageRate: null,
            sortOrder: 0,
          },
        ],
      },
    ]);
  });
});

describe('toPositionTableRow', () => {
  it('maps catalog position inputs to formatted table rows', () => {
    const [input] = versionPositionsToInputs([samplePositionResponse()]);
    const row = toPositionTableRow(input, 'de-DE');

    expect(row).toEqual({
      key: 'window-install',
      label: 'Window installation',
      unit: 'piece',
      netPriceEuro: '125,50\u00a0€',
      vatRateLabel: '19 %',
      attributesSummary: 'uValue: 0.9, frameMaterial: wood',
    });
  });

  it('uses the provided empty label when attributes are missing', () => {
    const [input] = versionPositionsToInputs([
      samplePositionResponse({ attributes: {}, surcharges: [] }),
    ]);

    expect(toPositionTableRow(input, 'de-DE', 'n/a').attributesSummary).toBe('n/a');
  });
});

describe('formatNetPriceEuro', () => {
  it('formats cents as EUR for German locale', () => {
    expect(formatNetPriceEuro(1999, 'de-DE')).toBe('19,99\u00a0€');
  });

  it('formats cents as EUR for English locale', () => {
    expect(formatNetPriceEuro(1999, 'en-US')).toBe('€19.99');
  });
});

describe('formatVatRate', () => {
  it('formats whole-number VAT rates without decimals', () => {
    expect(formatVatRate('0.190000')).toBe('19 %');
  });

  it('formats fractional VAT rates with two decimals', () => {
    expect(formatVatRate('0.075000')).toBe('7.50 %');
  });
});

describe('summarizeAttributes', () => {
  it('joins attribute key-value pairs and skips empty values', () => {
    expect(
      summarizeAttributes({
        uValue: 0.9,
        frameMaterial: 'wood',
        notes: '',
        optional: null,
      }),
    ).toBe('uValue: 0.9, frameMaterial: wood');
  });
});

describe('price and VAT parsing helpers', () => {
  it('parses euro input strings to cents', () => {
    expect(parseEuroToCents('12,50')).toBe(1250);
    expect(parseEuroToCents('12.50')).toBe(1250);
    expect(parseEuroToCents('')).toBeNull();
    expect(parseEuroToCents('-1')).toBeNull();
  });

  it('converts cents back to euro input strings', () => {
    expect(centsToEuroInput(1250)).toBe('12.50');
  });

  it('round-trips VAT percent input and stored rate', () => {
    expect(parseVatPercentToRate('19')).toBe('0.190000');
    expect(vatRateToPercentInput('0.190000')).toBe('19');
    expect(vatRateToPercentInput('0.075000')).toBe('7.50');
  });
});
