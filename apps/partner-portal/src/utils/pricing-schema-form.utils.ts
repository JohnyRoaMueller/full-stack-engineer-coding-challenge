import { TFunction } from 'i18next';
import {
  PricingSchema,
  PricingSchemaField,
  PricingSchemaFieldDependsOn,
} from '../services/trades.service';

export interface SchemaFormFieldDefinition {
  field: PricingSchemaField;
  visible: boolean;
  required: boolean;
}

export function isDependsOnConditionMet(
  dependsOn: PricingSchemaFieldDependsOn,
  attributes: Record<string, unknown>,
): boolean {
  if (!(dependsOn.field in attributes)) {
    return false;
  }
  return attributes[dependsOn.field] === dependsOn.equals;
}

export function isSchemaFieldRequired(
  field: PricingSchemaField,
  attributes: Record<string, unknown>,
): boolean {
  if (field.required === true) {
    return true;
  }
  if (field.dependsOn && isDependsOnConditionMet(field.dependsOn, attributes)) {
    return true;
  }
  return false;
}

export function isSchemaFieldVisible(
  field: PricingSchemaField,
  attributes: Record<string, unknown>,
): boolean {
  if (!field.dependsOn) {
    return true;
  }
  return isDependsOnConditionMet(field.dependsOn, attributes);
}

export function buildSchemaFormFieldDefinitions(
  schema: PricingSchema | null | undefined,
  attributes: Record<string, unknown>,
): SchemaFormFieldDefinition[] {
  return (schema?.fields ?? []).map((field) => ({
    field,
    visible: isSchemaFieldVisible(field, attributes),
    required: isSchemaFieldRequired(field, attributes),
  }));
}

export function formAttributeToValue(
  field: PricingSchemaField,
  raw: string | boolean | undefined,
): unknown {
  if (raw === undefined) {
    return undefined;
  }
  if (field.type === 'boolean') {
    return raw === true;
  }
  if (raw === '') {
    return undefined;
  }
  if (field.type === 'number') {
    const normalized = String(raw).trim().replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return String(raw);
}

export function buildAttributesForVisibilityCheck(
  schema: PricingSchema,
  formAttributes: Record<string, string | boolean>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of schema.fields) {
    const raw = formAttributes[field.name];
    if (field.type === 'boolean') {
      if (raw === true || raw === false) {
        result[field.name] = raw;
      }
      continue;
    }
    const parsed = formAttributeToValue(field, raw);
    if (parsed !== undefined) {
      result[field.name] = parsed;
    }
  }
  return result;
}

export function attributesToFormValues(
  schema: PricingSchema | null | undefined,
  attributes: Record<string, unknown> | undefined,
): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (const field of schema?.fields ?? []) {
    const value = attributes?.[field.name];
    if (field.type === 'boolean') {
      result[field.name] = typeof value === 'boolean' ? value : false;
      continue;
    }
    if (field.type === 'number' && typeof value === 'number') {
      result[field.name] = String(value);
      continue;
    }
    if (value !== undefined && value !== null) {
      result[field.name] = String(value);
      continue;
    }
    result[field.name] = '';
  }
  return result;
}

export function formValuesToAttributes(
  schema: PricingSchema,
  formAttributes: Record<string, string | boolean>,
): Record<string, unknown> {
  const visibilityAttributes = buildAttributesForVisibilityCheck(schema, formAttributes);
  const result: Record<string, unknown> = {};

  for (const { field, visible } of buildSchemaFormFieldDefinitions(schema, visibilityAttributes)) {
    if (!visible) {
      continue;
    }
    const raw = formAttributes[field.name];
    if (field.type === 'boolean') {
      if (raw === true) {
        result[field.name] = true;
      }
      continue;
    }
    const parsed = formAttributeToValue(field, raw);
    if (parsed !== undefined) {
      result[field.name] = parsed;
    }
  }

  return result;
}

export function validateSchemaFieldValue(
  field: PricingSchemaField,
  raw: string | boolean | undefined,
  required: boolean,
  t: TFunction,
): true | string {
  if (field.type === 'boolean') {
    if (required && raw !== true && raw !== false) {
      return t('validation.required');
    }
    return true;
  }

  const text = raw === undefined ? '' : String(raw).trim();
  if (text === '') {
    return required ? t('validation.required') : true;
  }

  if (field.type === 'number') {
    const normalized = text.replace(',', '.');
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      return t('pricingCatalog.positions.schema.errors.invalidNumber', { field: field.name });
    }
    if (field.min !== undefined && parsed < field.min) {
      return t('pricingCatalog.positions.schema.errors.min', {
        field: field.name,
        min: field.min,
      });
    }
    if (field.max !== undefined && parsed > field.max) {
      return t('pricingCatalog.positions.schema.errors.max', {
        field: field.name,
        max: field.max,
      });
    }
    return true;
  }

  if (field.type === 'enum') {
    const allowed = field.values ?? [];
    if (!allowed.includes(text)) {
      return t('pricingCatalog.positions.schema.errors.enum', {
        field: field.name,
        values: allowed.join(', '),
      });
    }
    return true;
  }

  return true;
}

export function schemaFieldLabel(field: PricingSchemaField): string {
  return field.name;
}
