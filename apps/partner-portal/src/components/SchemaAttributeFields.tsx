import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import {
  Control,
  Controller,
  FieldErrors,
  UseFormRegister,
  useWatch,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { PricingSchema } from '../services/trades.service';
import {
  buildAttributesForVisibilityCheck,
  buildSchemaFormFieldDefinitions,
  schemaFieldLabel,
  validateSchemaFieldValue,
} from '../utils/pricing-schema-form.utils';

export interface PositionFormValues {
  key: string;
  label: string;
  unit: string;
  netPriceEuro: string;
  vatPercent: string;
  attributes: Record<string, string | boolean>;
}

interface SchemaAttributeFieldsProps {
  schema: PricingSchema;
  control: Control<PositionFormValues>;
  register: UseFormRegister<PositionFormValues>;
  errors: FieldErrors<PositionFormValues>;
}

export function SchemaAttributeFields({
  schema,
  control,
  register,
  errors,
}: SchemaAttributeFieldsProps): JSX.Element | null {
  const { t } = useTranslation();
  const watchedAttributes = useWatch({ control, name: 'attributes' }) ?? {};
  const visibilityAttributes = buildAttributesForVisibilityCheck(schema, watchedAttributes);
  const definitions = buildSchemaFormFieldDefinitions(schema, visibilityAttributes);
  const visibleDefinitions = definitions.filter((definition) => definition.visible);

  if (visibleDefinitions.length === 0) {
    return null;
  }

  return (
    <>
      <Typography variant="h3" sx={{ pt: 1 }}>
        {t('pricingCatalog.positions.schema.heading')}
      </Typography>
      {visibleDefinitions.map(({ field, required }) => {
        const fieldError = errors.attributes?.[field.name];
        const errorMessage =
          fieldError && typeof fieldError === 'object' && 'message' in fieldError
            ? String(fieldError.message)
            : undefined;

        if (field.type === 'boolean') {
          return (
            <Controller
              key={field.name}
              name={`attributes.${field.name}`}
              control={control}
              rules={{
                validate: (value) =>
                  validateSchemaFieldValue(field, value as string | boolean, required, t),
              }}
              render={({ field: controllerField }) => (
                <FormControl error={!!errorMessage}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={controllerField.value === true}
                        onChange={(event) => controllerField.onChange(event.target.checked)}
                      />
                    }
                    label={schemaFieldLabel(field)}
                  />
                  {errorMessage ? <FormHelperText>{errorMessage}</FormHelperText> : null}
                </FormControl>
              )}
            />
          );
        }

        if (field.type === 'enum') {
          return (
            <Controller
              key={field.name}
              name={`attributes.${field.name}`}
              control={control}
              rules={{
                validate: (value) =>
                  validateSchemaFieldValue(field, value as string | boolean, required, t),
              }}
              render={({ field: controllerField }) => (
                <TextField
                  {...controllerField}
                  value={controllerField.value ?? ''}
                  select
                  label={schemaFieldLabel(field)}
                  fullWidth
                  error={!!errorMessage}
                  helperText={errorMessage}
                >
                  {(field.values ?? []).map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          );
        }

        return (
          <TextField
            key={field.name}
            label={schemaFieldLabel(field)}
            fullWidth
            inputMode={field.type === 'number' ? 'decimal' : 'text'}
            {...register(`attributes.${field.name}`, {
              validate: (value) =>
                validateSchemaFieldValue(field, value as string | boolean, required, t),
            })}
            error={!!errorMessage}
            helperText={
              errorMessage ??
              (field.type === 'number' && (field.min !== undefined || field.max !== undefined)
                ? t('pricingCatalog.positions.schema.rangeHint', {
                    min: field.min ?? '—',
                    max: field.max ?? '—',
                  })
                : undefined)
            }
          />
        );
      })}
    </>
  );
}
