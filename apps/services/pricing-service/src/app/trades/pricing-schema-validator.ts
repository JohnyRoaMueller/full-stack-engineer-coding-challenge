export type SchemaFieldType = 'string' | 'number' | 'boolean' | 'enum';

export interface SchemaDependsOn {
  readonly field: string;
  readonly equals: string | number | boolean;
}

export interface PricingSchemaField {
  readonly name: string;
  readonly type: SchemaFieldType;
  readonly required?: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly values?: readonly string[];
  readonly dependsOn?: SchemaDependsOn;
}

export interface PricingSchema {
  readonly fields: readonly PricingSchemaField[];
}

export interface FieldValidationError {
  readonly field: string;
  readonly message: string;
  readonly code: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly FieldValidationError[];
}

function isDependsOnConditionMet(
  dependsOn: SchemaDependsOn,
  attributes: Record<string, unknown>,
): boolean {
  if (!(dependsOn.field in attributes)) {
    return false;
  }
  return attributes[dependsOn.field] === dependsOn.equals;
}

function isFieldRequired(
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

function isMissingValue(value: unknown): boolean {
  return value === undefined || value === null;
}

function validateFieldType(
  field: PricingSchemaField,
  value: unknown,
): FieldValidationError | null {
  switch (field.type) {
    case 'string':
      if (typeof value !== 'string') {
        return {
          field: field.name,
          message: `Field "${field.name}" must be a string`,
          code: 'INVALID_TYPE',
        };
      }
      return null;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return {
          field: field.name,
          message: `Field "${field.name}" must be a finite number`,
          code: 'INVALID_TYPE',
        };
      }
      if (field.min !== undefined && value < field.min) {
        return {
          field: field.name,
          message: `Field "${field.name}" must be at least ${field.min}`,
          code: 'BELOW_MIN',
        };
      }
      if (field.max !== undefined && value > field.max) {
        return {
          field: field.name,
          message: `Field "${field.name}" must be at most ${field.max}`,
          code: 'ABOVE_MAX',
        };
      }
      return null;
    case 'boolean':
      if (typeof value !== 'boolean') {
        return {
          field: field.name,
          message: `Field "${field.name}" must be a boolean`,
          code: 'INVALID_TYPE',
        };
      }
      return null;
    case 'enum': {
      const allowed = field.values ?? [];
      if (typeof value !== 'string') {
        return {
          field: field.name,
          message: `Field "${field.name}" must be a string enum value`,
          code: 'INVALID_TYPE',
        };
      }
      if (!allowed.includes(value)) {
        return {
          field: field.name,
          message: `Field "${field.name}" must be one of: ${allowed.join(', ')}`,
          code: 'INVALID_ENUM',
        };
      }
      return null;
    }
    default:
      return {
        field: field.name,
        message: `Field "${field.name}" has unsupported schema type`,
        code: 'UNSUPPORTED_SCHEMA_TYPE',
      };
  }
}

function normalizeSchema(schema: PricingSchema | null | undefined): PricingSchema {
  if (!schema || !Array.isArray(schema.fields)) {
    return { fields: [] };
  }
  return schema;
}

/**
 * Pure validator for catalog position attributes against a trade pricing schema.
 * Per DESIGN.md §1.2 — runs on every draft write, not only on publish.
 */
export function validatePositionAttributes(
  schema: PricingSchema | null | undefined,
  attributes: Record<string, unknown> | null | undefined,
): ValidationResult {
  const normalizedSchema = normalizeSchema(schema);
  const attrs = attributes ?? {};
  const errors: FieldValidationError[] = [];
  const declaredNames = new Set(normalizedSchema.fields.map((f) => f.name));

  for (const key of Object.keys(attrs)) {
    if (!declaredNames.has(key)) {
      errors.push({
        field: key,
        message: `Unknown attribute "${key}" is not declared in the pricing schema`,
        code: 'UNKNOWN_FIELD',
      });
    }
  }

  for (const field of normalizedSchema.fields) {
    const value = attrs[field.name];

    if (isMissingValue(value)) {
      if (isFieldRequired(field, attrs)) {
        errors.push({
          field: field.name,
          message: `Field "${field.name}" is required`,
          code: 'REQUIRED',
        });
      }
      continue;
    }

    const typeError = validateFieldType(field, value);
    if (typeError) {
      errors.push(typeError);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
