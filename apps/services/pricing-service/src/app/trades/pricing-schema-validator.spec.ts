import {
  PricingSchema,
  validatePositionAttributes,
} from './pricing-schema-validator';

function windowsSchema(): PricingSchema {
  return {
    fields: [
      { name: 'uValue', type: 'number', required: true, min: 0.1, max: 2.0 },
      {
        name: 'frameMaterial',
        type: 'enum',
        required: true,
        values: ['wood', 'aluminium', 'pvc'],
      },
      {
        name: 'woodTreatment',
        type: 'string',
        dependsOn: { field: 'frameMaterial', equals: 'wood' },
      },
      { name: 'hasTripleGlazing', type: 'boolean' },
    ],
  };
}

describe('validatePositionAttributes', () => {
  describe('happy path', () => {
    it('accepts valid attributes for all field types', () => {
      const result = validatePositionAttributes(windowsSchema(), {
        uValue: 0.9,
        frameMaterial: 'aluminium',
        hasTripleGlazing: true,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('accepts empty attributes when no fields are required', () => {
      const schema: PricingSchema = {
        fields: [{ name: 'notes', type: 'string' }],
      };

      const result = validatePositionAttributes(schema, {});

      expect(result.valid).toBe(true);
    });

    it('accepts omitted woodTreatment when frameMaterial is not wood', () => {
      const result = validatePositionAttributes(windowsSchema(), {
        uValue: 1.1,
        frameMaterial: 'pvc',
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('required fields', () => {
    it('rejects missing unconditionally required fields', () => {
      const result = validatePositionAttributes(windowsSchema(), {
        frameMaterial: 'wood',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'uValue',
        message: 'Field "uValue" is required',
        code: 'REQUIRED',
      });
    });

    it('treats null and undefined as missing', () => {
      const result = validatePositionAttributes(windowsSchema(), {
        uValue: null,
        frameMaterial: 'pvc',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'uValue' && e.code === 'REQUIRED')).toBe(true);
    });
  });

  describe('dependsOn', () => {
    it('requires woodTreatment when frameMaterial is wood', () => {
      const result = validatePositionAttributes(windowsSchema(), {
        uValue: 0.8,
        frameMaterial: 'wood',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'woodTreatment',
        message: 'Field "woodTreatment" is required',
        code: 'REQUIRED',
      });
    });

    it('accepts woodTreatment when frameMaterial is wood and value is provided', () => {
      const result = validatePositionAttributes(windowsSchema(), {
        uValue: 0.8,
        frameMaterial: 'wood',
        woodTreatment: 'lacquer',
      });

      expect(result.valid).toBe(true);
    });

    it('uses strict equality for dependsOn activation', () => {
      const schema: PricingSchema = {
        fields: [
          { name: 'frameMaterial', type: 'string', required: true },
          {
            name: 'woodTreatment',
            type: 'string',
            dependsOn: { field: 'frameMaterial', equals: 'wood' },
          },
        ],
      };

      const result = validatePositionAttributes(schema, {
        frameMaterial: 'WOOD',
      });

      expect(result.valid).toBe(true);
      expect(result.errors.some((e) => e.field === 'woodTreatment')).toBe(false);
    });
  });

  describe('type validation', () => {
    it('rejects wrong types', () => {
      const result = validatePositionAttributes(windowsSchema(), {
        uValue: '0.9',
        frameMaterial: 'wood',
        woodTreatment: 'oil',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'uValue',
        message: 'Field "uValue" must be a finite number',
        code: 'INVALID_TYPE',
      });
    });

    it('rejects non-boolean values for boolean fields', () => {
      const result = validatePositionAttributes(windowsSchema(), {
        uValue: 1.0,
        frameMaterial: 'pvc',
        hasTripleGlazing: 'yes',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'hasTripleGlazing')).toBe(true);
    });
  });

  describe('numeric min / max', () => {
    it('rejects values below min', () => {
      const result = validatePositionAttributes(windowsSchema(), {
        uValue: 0.05,
        frameMaterial: 'pvc',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'uValue',
        message: 'Field "uValue" must be at least 0.1',
        code: 'BELOW_MIN',
      });
    });

    it('rejects values above max', () => {
      const result = validatePositionAttributes(windowsSchema(), {
        uValue: 2.5,
        frameMaterial: 'pvc',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'uValue',
        message: 'Field "uValue" must be at most 2',
        code: 'ABOVE_MAX',
      });
    });

    it('accepts boundary values min and max', () => {
      const atMin = validatePositionAttributes(windowsSchema(), {
        uValue: 0.1,
        frameMaterial: 'pvc',
      });
      const atMax = validatePositionAttributes(windowsSchema(), {
        uValue: 2.0,
        frameMaterial: 'pvc',
      });

      expect(atMin.valid).toBe(true);
      expect(atMax.valid).toBe(true);
    });
  });

  describe('enum', () => {
    it('rejects values outside the allowed list', () => {
      const result = validatePositionAttributes(windowsSchema(), {
        uValue: 1.0,
        frameMaterial: 'steel',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'frameMaterial' && e.code === 'INVALID_ENUM')).toBe(
        true,
      );
    });
  });

  describe('unknown fields', () => {
    it('rejects attributes not declared in the schema', () => {
      const result = validatePositionAttributes(windowsSchema(), {
        uValue: 1.0,
        frameMaterial: 'pvc',
        mysteryField: 'surprise',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'mysteryField',
        message: 'Unknown attribute "mysteryField" is not declared in the pricing schema',
        code: 'UNKNOWN_FIELD',
      });
    });

    it('rejects any attribute when schema has no fields', () => {
      const result = validatePositionAttributes({ fields: [] }, { foo: 'bar' });

      expect(result.valid).toBe(false);
      expect(result.errors[0]?.code).toBe('UNKNOWN_FIELD');
    });
  });

  describe('edge cases', () => {
    it('handles null schema and null attributes', () => {
      const result = validatePositionAttributes(null, null);

      expect(result.valid).toBe(true);
    });

    it('validates optional fields when a value is present', () => {
      const result = validatePositionAttributes(windowsSchema(), {
        uValue: 1.0,
        frameMaterial: 'pvc',
        hasTripleGlazing: 'nope',
      });

      expect(result.valid).toBe(false);
    });
  });
});
