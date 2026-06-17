import { TradeCode } from '@sandbox/types';
import { apiClient } from './api.service';

export type CatalogVersionStatus = 'DRAFT' | 'PUBLISHED';

export type PositionUnit = 'piece' | 'm2' | 'meter' | 'hour' | 'flat';

export type DiscountAppliesTo =
  | { type: 'subtotal' }
  | { type: 'positions'; keys: string[] };

export interface PositionSurchargeResponse {
  id: string;
  key: string;
  label: string;
  flatAmount: number | null;
  percentageRate: string | null;
  sortOrder: number;
}

export interface CatalogPositionResponse {
  id: string;
  key: string;
  label: string;
  unit: PositionUnit;
  netPrice: number;
  vatRate: string;
  minQuantity: number | null;
  maxQuantity: number | null;
  attributes: Record<string, unknown>;
  surcharges: PositionSurchargeResponse[];
}

export interface CatalogDiscountResponse {
  id: string;
  key: string;
  label: string;
  flatAmount: number | null;
  percentageRate: string | null;
  cap: number | null;
  appliesTo: DiscountAppliesTo;
  sortOrder: number;
}

export interface PricingCatalogVersionResponse {
  id: string;
  craftsmanId: string;
  trade: string;
  status: CatalogVersionStatus;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  publishedByUserId: string | null;
  positions: CatalogPositionResponse[];
  discounts: CatalogDiscountResponse[];
}

export interface PricingCatalogVersionListItem {
  id: string;
  craftsmanId: string;
  trade: string;
  status: CatalogVersionStatus;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  createdAt: string;
}

export interface PositionSurchargeInput {
  key: string;
  label: string;
  flatAmount?: number | null;
  percentageRate?: string | null;
  sortOrder?: number;
}

export interface CatalogPositionInput {
  key: string;
  label: string;
  unit: PositionUnit;
  netPrice: number;
  vatRate: string;
  minQuantity?: number | null;
  maxQuantity?: number | null;
  attributes?: Record<string, unknown>;
  surcharges?: PositionSurchargeInput[];
}

export interface CatalogDiscountInput {
  key: string;
  label: string;
  flatAmount?: number | null;
  percentageRate?: string | null;
  cap?: number | null;
  appliesTo: DiscountAppliesTo;
  sortOrder?: number;
}

export interface CreatePricingCatalogInput {
  craftsmanId: string;
  trade: TradeCode;
}

export interface UpdatePricingCatalogInput {
  positions?: CatalogPositionInput[];
  discounts?: CatalogDiscountInput[];
  effectiveFrom?: string | null;
}

export interface QuoteLineInput {
  positionKey: string;
  quantity: number;
  appliedSurchargeKeys?: string[];
}

export interface QuoteRequest {
  lines: QuoteLineInput[];
}

export interface AppliedSurchargeResponse {
  key: string;
  label: string;
  amount: number;
}

export interface AppliedDiscountResponse {
  key: string;
  label: string;
  amount: number;
}

export interface QuoteLineResponse {
  positionKey: string;
  quantity: number;
  net: number;
  gross: number;
  appliedSurcharges: AppliedSurchargeResponse[];
  appliedDiscounts: AppliedDiscountResponse[];
}

export interface VatBreakdownResponse {
  vatRate: number;
  netTotal: number;
  vatAmount: number;
  grossTotal: number;
}

export interface QuoteTotalsResponse {
  net: number;
  totalDiscount: number;
  vat: number;
  gross: number;
}

export interface QuoteResponse {
  lines: QuoteLineResponse[];
  vatBreakdown: VatBreakdownResponse[];
  totals: QuoteTotalsResponse;
}

export function listCatalogVersions(
  craftsmanId: string,
  trade: TradeCode,
): Promise<PricingCatalogVersionListItem[]> {
  return apiClient
    .get<PricingCatalogVersionListItem[]>('/pricing-catalogs', {
      params: { craftsmanId, trade },
    })
    .then((r) => r.data);
}

export function getCatalogVersion(versionId: string): Promise<PricingCatalogVersionResponse> {
  return apiClient
    .get<PricingCatalogVersionResponse>(`/pricing-catalogs/${versionId}`)
    .then((r) => r.data);
}

export function createCatalogVersion(
  input: CreatePricingCatalogInput,
): Promise<PricingCatalogVersionResponse> {
  return apiClient
    .post<PricingCatalogVersionResponse>('/pricing-catalogs', input)
    .then((r) => r.data);
}

export function updateCatalogVersion(
  versionId: string,
  input: UpdatePricingCatalogInput,
): Promise<PricingCatalogVersionResponse> {
  return apiClient
    .patch<PricingCatalogVersionResponse>(`/pricing-catalogs/${versionId}`, input)
    .then((r) => r.data);
}

export function publishCatalogVersion(versionId: string): Promise<PricingCatalogVersionResponse> {
  return apiClient
    .post<PricingCatalogVersionResponse>(`/pricing-catalogs/${versionId}/publish`)
    .then((r) => r.data);
}

export function quoteCatalogVersion(
  versionId: string,
  request: QuoteRequest,
): Promise<QuoteResponse> {
  return apiClient
    .post<QuoteResponse>(`/pricing-catalogs/${versionId}/quote`, request)
    .then((r) => r.data);
}
