import { describe, expect, it } from 'vitest';
import { PricingSchema } from '../services/trades.service';
import {
  attributesToFormValues,
  buildSchemaFormFieldDefinitions,
  formValuesToAttributes,
  isSchemaFieldVisible,
} from './pricing-schema-form.utils';

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

describe('pricing-schema-form.utils', () => {
  it('maps pricingSchema to visible form field definitions', () => {
    const definitions = buildSchemaFormFieldDefinitions(windowsSchema(), {
      frameMaterial: 'wood',
    });

    expect(definitions.find((item) => item.field.name === 'woodTreatment')?.visible).toBe(true);
    expect(definitions.find((item) => item.field.name === 'woodTreatment')?.required).toBe(true);
    expect(definitions.find((item) => item.field.name === 'uValue')?.required).toBe(true);
  });

  it('hides dependsOn fields when the condition is not met', () => {
    expect(
      isSchemaFieldVisible(windowsSchema().fields[2], { frameMaterial: 'pvc' }),
    ).toBe(false);
  });

  it('round-trips attributes through form values', () => {
    const schema = windowsSchema();
    const attributes = {
      uValue: 0.9,
      frameMaterial: 'aluminium',
      hasTripleGlazing: true,
    };

    const formValues = attributesToFormValues(schema, attributes);
    expect(formValues).toEqual({
      uValue: '0.9',
      frameMaterial: 'aluminium',
      woodTreatment: '',
      hasTripleGlazing: true,
    });

    expect(formValuesToAttributes(schema, formValues)).toEqual(attributes);
  });

  it('omits hidden dependsOn values from submitted attributes', () => {
    const schema = windowsSchema();

    expect(
      formValuesToAttributes(schema, {
        uValue: '1.1',
        frameMaterial: 'pvc',
        woodTreatment: 'lacquer',
        hasTripleGlazing: false,
      }),
    ).toEqual({
      uValue: 1.1,
      frameMaterial: 'pvc',
    });
  });
});
