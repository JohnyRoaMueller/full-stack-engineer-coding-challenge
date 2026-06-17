import { apiClient } from './api.service';

export type SchemaFieldType = 'string' | 'number' | 'boolean' | 'enum';

export interface PricingSchemaFieldDependsOn {
  field: string;
  equals: string | number | boolean;
}

export interface PricingSchemaField {
  name: string;
  type: SchemaFieldType;
  required?: boolean;
  min?: number;
  max?: number;
  values?: string[];
  dependsOn?: PricingSchemaFieldDependsOn;
}

export interface PricingSchema {
  fields: PricingSchemaField[];
}

/** Mirrors `TradeConfigResponseDto` from pricing-service. */
export interface TradeConfigResponse {
  id: string;
  trade: string;
  displayName: string;
  isActive: boolean;
  metadata: Record<string, unknown>;
}

export function getTrade(trade: string): Promise<TradeConfigResponse> {
  return apiClient.get<TradeConfigResponse>(`/trades/${trade}`).then((r) => r.data);
}

/** Reads `metadata.pricingSchema` when present and well-formed. */
export function extractPricingSchema(metadata: Record<string, unknown>): PricingSchema | null {
  const raw = metadata.pricingSchema;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const fields = (raw as PricingSchema).fields;
  if (!Array.isArray(fields)) {
    return { fields: [] };
  }
  return { fields };
}
