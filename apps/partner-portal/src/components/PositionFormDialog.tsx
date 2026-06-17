import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { TradeCode } from '@sandbox/types';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../services/api.service';
import {
  CatalogPositionInput,
  PositionUnit,
} from '../services/pricing-catalogs.service';
import {
  extractPricingSchema,
  getTrade,
  PricingSchema,
} from '../services/trades.service';
import {
  centsToEuroInput,
  parseEuroToCents,
  parseVatPercentToRate,
  vatRateToPercentInput,
} from '../utils/catalog-positions.utils';
import {
  attributesToFormValues,
  formValuesToAttributes,
} from '../utils/pricing-schema-form.utils';
import { PositionFormValues, SchemaAttributeFields } from './SchemaAttributeFields';

const POSITION_UNITS: PositionUnit[] = ['piece', 'm2', 'meter', 'hour', 'flat'];

interface PositionFormDialogProps {
  open: boolean;
  mode: 'add' | 'edit';
  trade: TradeCode;
  initial?: CatalogPositionInput;
  existingKeys: string[];
  onSave: (position: CatalogPositionInput) => void;
  onClose: () => void;
}

function toFormValues(
  position: CatalogPositionInput | undefined,
  schema: PricingSchema | null,
): PositionFormValues {
  return {
    key: position?.key ?? '',
    label: position?.label ?? '',
    unit: position?.unit ?? 'piece',
    netPriceEuro: position ? centsToEuroInput(position.netPrice) : '',
    vatPercent: position ? vatRateToPercentInput(position.vatRate) : '19',
    attributes: attributesToFormValues(schema, position?.attributes),
  };
}

export function PositionFormDialog({
  open,
  mode,
  trade,
  initial,
  existingKeys,
  onSave,
  onClose,
}: PositionFormDialogProps): JSX.Element {
  const { t } = useTranslation();
  const [schema, setSchema] = useState<PricingSchema | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PositionFormValues>({
    defaultValues: toFormValues(initial, null),
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setSchemaLoading(true);
    setSchemaError(null);

    getTrade(trade)
      .then((tradeConfig) => {
        if (cancelled) {
          return;
        }
        const nextSchema = extractPricingSchema(tradeConfig.metadata);
        setSchema(nextSchema);
        reset(toFormValues(initial, nextSchema));
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        const message =
          err instanceof ApiError
            ? err.message
            : t('pricingCatalog.positions.schema.loadFailed');
        setSchemaError(message);
        setSchema(null);
        reset(toFormValues(initial, null));
      })
      .finally(() => {
        if (!cancelled) {
          setSchemaLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, trade, initial, reset, t]);

  const onSubmit = (values: PositionFormValues): void => {
    const netPrice = parseEuroToCents(values.netPriceEuro);
    const vatRate = parseVatPercentToRate(values.vatPercent);
    if (netPrice === null || vatRate === null) {
      return;
    }

    const attributes =
      schema && schema.fields.length > 0
        ? formValuesToAttributes(schema, values.attributes)
        : initial?.attributes ?? {};

    onSave({
      key: values.key.trim(),
      label: values.label.trim(),
      unit: values.unit as PositionUnit,
      netPrice,
      vatRate,
      minQuantity: initial?.minQuantity ?? null,
      maxQuantity: initial?.maxQuantity ?? null,
      attributes,
      surcharges: initial?.surcharges ?? [],
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {mode === 'add'
          ? t('pricingCatalog.positions.addTitle')
          : t('pricingCatalog.positions.editTitle')}
      </DialogTitle>
      <DialogContent>
        <Stack
          component="form"
          id="position-form"
          spacing={2}
          sx={{ pt: 1 }}
          onSubmit={handleSubmit(onSubmit)}
        >
          <TextField
            label={t('pricingCatalog.positions.columns.key')}
            fullWidth
            disabled={mode === 'edit'}
            {...register('key', {
              required: t('validation.required') ?? '',
              validate: (value) => {
                const trimmed = value.trim();
                if (mode === 'edit') {
                  return true;
                }
                if (existingKeys.includes(trimmed)) {
                  return t('pricingCatalog.positions.errors.duplicateKey');
                }
                return true;
              },
            })}
            error={!!errors.key}
            helperText={errors.key?.message}
          />
          <TextField
            label={t('pricingCatalog.positions.columns.label')}
            fullWidth
            {...register('label', { required: t('validation.required') ?? '' })}
            error={!!errors.label}
            helperText={errors.label?.message}
          />
          <Controller
            name="unit"
            control={control}
            rules={{ required: t('validation.required') ?? '' }}
            render={({ field }) => (
              <TextField
                {...field}
                select
                label={t('pricingCatalog.positions.columns.unit')}
                fullWidth
                error={!!errors.unit}
                helperText={errors.unit?.message}
              >
                {POSITION_UNITS.map((unit) => (
                  <MenuItem key={unit} value={unit}>
                    {t(`pricingCatalog.positions.units.${unit}`)}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
          <TextField
            label={t('pricingCatalog.positions.columns.netPrice')}
            fullWidth
            inputMode="decimal"
            {...register('netPriceEuro', {
              required: t('validation.required') ?? '',
              validate: (value) =>
                parseEuroToCents(value) !== null || t('pricingCatalog.positions.errors.invalidPrice'),
            })}
            error={!!errors.netPriceEuro}
            helperText={errors.netPriceEuro?.message}
          />
          <TextField
            label={t('pricingCatalog.positions.columns.vat')}
            fullWidth
            inputMode="decimal"
            {...register('vatPercent', {
              required: t('validation.required') ?? '',
              validate: (value) =>
                parseVatPercentToRate(value) !== null ||
                t('pricingCatalog.positions.errors.invalidVat'),
            })}
            error={!!errors.vatPercent}
            helperText={errors.vatPercent?.message}
          />

          {schemaLoading ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={18} />
              <Alert severity="info" sx={{ flex: 1 }}>
                {t('pricingCatalog.positions.schema.loading')}
              </Alert>
            </Stack>
          ) : null}

          {schemaError ? <Alert severity="warning">{schemaError}</Alert> : null}

          {schema && schema.fields.length > 0 ? (
            <SchemaAttributeFields
              schema={schema}
              control={control}
              register={register}
              errors={errors}
            />
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('pricingCatalog.positions.cancel')}</Button>
        <Button type="submit" form="position-form" variant="contained" disabled={schemaLoading}>
          {t('pricingCatalog.positions.savePosition')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
