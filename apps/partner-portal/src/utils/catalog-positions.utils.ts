import {
  CatalogPositionInput,
  CatalogPositionResponse,
  PositionUnit,
} from '../services/pricing-catalogs.service';
import { toPositionInput } from './pricing-catalog.utils';

export interface PositionTableRow {
  key: string;
  label: string;
  unit: PositionUnit;
  netPriceEuro: string;
  vatRateLabel: string;
  attributesSummary: string;
}

export function formatNetPriceEuro(cents: number, locale = 'de-DE'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

export function formatVatRate(vatRate: string): string {
  const percent = Number(vatRate) * 100;
  if (!Number.isFinite(percent)) {
    return '—';
  }
  const formatted = percent % 1 === 0 ? percent.toFixed(0) : percent.toFixed(2);
  return `${formatted} %`;
}

export function summarizeAttributes(
  attributes: Record<string, unknown> | undefined,
  emptyLabel = '—',
): string {
  const entries = Object.entries(attributes ?? {}).filter(
    ([, value]) => value !== null && value !== undefined && value !== '',
  );
  if (entries.length === 0) {
    return emptyLabel;
  }
  return entries.map(([name, value]) => `${name}: ${String(value)}`).join(', ');
}

export function toPositionTableRow(
  position: CatalogPositionInput,
  locale = 'de-DE',
  emptyLabel = '—',
): PositionTableRow {
  return {
    key: position.key,
    label: position.label,
    unit: position.unit,
    netPriceEuro: formatNetPriceEuro(position.netPrice, locale),
    vatRateLabel: formatVatRate(position.vatRate),
    attributesSummary: summarizeAttributes(position.attributes, emptyLabel),
  };
}

export function versionPositionsToInputs(
  positions: CatalogPositionResponse[],
): CatalogPositionInput[] {
  return positions.map(toPositionInput);
}

export function parseEuroToCents(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (normalized === '') {
    return null;
  }
  const euros = Number(normalized);
  if (!Number.isFinite(euros) || euros < 0) {
    return null;
  }
  return Math.round(euros * 100);
}

export function centsToEuroInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function parseVatPercentToRate(value: string): string | null {
  const normalized = value.trim().replace(',', '.');
  if (normalized === '') {
    return null;
  }
  const percent = Number(normalized);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    return null;
  }
  const rate = percent / 100;
  return rate.toFixed(6);
}

export function vatRateToPercentInput(vatRate: string): string {
  const percent = Number(vatRate) * 100;
  if (!Number.isFinite(percent)) {
    return '';
  }
  return percent % 1 === 0 ? percent.toFixed(0) : percent.toFixed(2);
}
