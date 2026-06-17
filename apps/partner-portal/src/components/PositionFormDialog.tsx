import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  CatalogPositionInput,
  PositionUnit,
} from '../services/pricing-catalogs.service';
import {
  centsToEuroInput,
  parseEuroToCents,
  parseVatPercentToRate,
  vatRateToPercentInput,
} from '../utils/catalog-positions.utils';

const POSITION_UNITS: PositionUnit[] = ['piece', 'm2', 'meter', 'hour', 'flat'];

interface PositionFormValues {
  key: string;
  label: string;
  unit: PositionUnit;
  netPriceEuro: string;
  vatPercent: string;
}

interface PositionFormDialogProps {
  open: boolean;
  mode: 'add' | 'edit';
  initial?: CatalogPositionInput;
  existingKeys: string[];
  onSave: (position: CatalogPositionInput) => void;
  onClose: () => void;
}

function toFormValues(position?: CatalogPositionInput): PositionFormValues {
  return {
    key: position?.key ?? '',
    label: position?.label ?? '',
    unit: position?.unit ?? 'piece',
    netPriceEuro: position ? centsToEuroInput(position.netPrice) : '',
    vatPercent: position ? vatRateToPercentInput(position.vatRate) : '19',
  };
}

export function PositionFormDialog({
  open,
  mode,
  initial,
  existingKeys,
  onSave,
  onClose,
}: PositionFormDialogProps): JSX.Element {
  const { t } = useTranslation();
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PositionFormValues>({
    defaultValues: toFormValues(initial),
  });

  useEffect(() => {
    if (open) {
      reset(toFormValues(initial));
    }
  }, [open, initial, reset]);

  const onSubmit = (values: PositionFormValues): void => {
    const netPrice = parseEuroToCents(values.netPriceEuro);
    const vatRate = parseVatPercentToRate(values.vatPercent);
    if (netPrice === null || vatRate === null) {
      return;
    }

    onSave({
      key: values.key.trim(),
      label: values.label.trim(),
      unit: values.unit,
      netPrice,
      vatRate,
      minQuantity: initial?.minQuantity ?? null,
      maxQuantity: initial?.maxQuantity ?? null,
      attributes: initial?.attributes ?? {},
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
                parseVatPercentToRate(value) !== null || t('pricingCatalog.positions.errors.invalidVat'),
            })}
            error={!!errors.vatPercent}
            helperText={errors.vatPercent?.message}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('pricingCatalog.positions.cancel')}</Button>
        <Button type="submit" form="position-form" variant="contained">
          {t('pricingCatalog.positions.savePosition')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
