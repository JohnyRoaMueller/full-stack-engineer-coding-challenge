import { QuoteResponse } from '../services/pricing-catalogs.service';
import { formatNetPriceEuro, formatVatRate } from './catalog-positions.utils';

export interface QuoteLineBreakdownRow {
  positionKey: string;
  quantity: number;
  net: string;
  gross: string;
  surchargesSummary: string;
  discountsSummary: string;
}

export interface QuoteVatBreakdownRow {
  vatRateLabel: string;
  netTotal: string;
  vatAmount: string;
  grossTotal: string;
}

export interface QuoteBreakdownView {
  lines: QuoteLineBreakdownRow[];
  vatBreakdown: QuoteVatBreakdownRow[];
  totals: {
    net: string;
    totalDiscount: string;
    vat: string;
    gross: string;
  };
}

function formatAppliedItems(
  items: ReadonlyArray<{ label: string; amount: number }>,
  locale: string,
  emptyLabel: string,
): string {
  if (items.length === 0) {
    return emptyLabel;
  }
  return items
    .map((item) => `${item.label}: ${formatNetPriceEuro(item.amount, locale)}`)
    .join(', ');
}

export function quoteResponseToBreakdown(
  response: QuoteResponse,
  locale = 'de-DE',
  emptyLabel = '—',
): QuoteBreakdownView {
  return {
    lines: response.lines.map((line) => ({
      positionKey: line.positionKey,
      quantity: line.quantity,
      net: formatNetPriceEuro(line.net, locale),
      gross: formatNetPriceEuro(line.gross, locale),
      surchargesSummary: formatAppliedItems(line.appliedSurcharges, locale, emptyLabel),
      discountsSummary: formatAppliedItems(line.appliedDiscounts, locale, emptyLabel),
    })),
    vatBreakdown: response.vatBreakdown.map((entry) => ({
      vatRateLabel: formatVatRate(String(entry.vatRate)),
      netTotal: formatNetPriceEuro(entry.netTotal, locale),
      vatAmount: formatNetPriceEuro(entry.vatAmount, locale),
      grossTotal: formatNetPriceEuro(entry.grossTotal, locale),
    })),
    totals: {
      net: formatNetPriceEuro(response.totals.net, locale),
      totalDiscount: formatNetPriceEuro(response.totals.totalDiscount, locale),
      vat: formatNetPriceEuro(response.totals.vat, locale),
      gross: formatNetPriceEuro(response.totals.gross, locale),
    },
  };
}
