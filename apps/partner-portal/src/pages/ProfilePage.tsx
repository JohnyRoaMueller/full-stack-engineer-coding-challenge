import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import PersonOffOutlinedIcon from '@mui/icons-material/PersonOffOutlined';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../components/EmptyState';
import { ErrorAlert } from '../components/ErrorAlert';
import { MutationSnackbar } from '../components/MutationSnackbar';
import { useAuth } from '../contexts/AuthContext';
import { useMutationSnack } from '../hooks/useMutationSnack';
import { ApiError } from '../services/api.service';
import {
  CraftsmanResponse,
  fetchCraftsman,
  updateCraftsman,
} from '../services/craftsmen.service';

interface ProfileForm {
  companyName: string;
  email: string;
  phone: string;
  vatNumber: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  country: string;
}

function toFormValues(c: CraftsmanResponse): ProfileForm {
  return {
    companyName: c.companyName,
    email: c.email ?? '',
    phone: c.phone ?? '',
    vatNumber: c.vatNumber ?? '',
    addressLine1: c.addressLine1 ?? '',
    addressLine2: c.addressLine2 ?? '',
    postalCode: c.postalCode ?? '',
    city: c.city ?? '',
    country: c.country ?? 'Germany',
  };
}

export function ProfilePage(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [craftsman, setCraftsman] = useState<CraftsmanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const { snack, showSuccess, showError, closeSnack } = useMutationSnack();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileForm>();

  const reloadProfile = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    if (!user?.craftsmanId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    fetchCraftsman(user.craftsmanId)
      .then((c) => {
        setCraftsman(c);
        reset(toFormValues(c));
      })
      .catch((err: unknown) => {
        const message = err instanceof ApiError ? err.message : t('profile.messages.loadFailed');
        setLoadError(message);
        setCraftsman(null);
      })
      .finally(() => setLoading(false));
  }, [user?.craftsmanId, reset, t, reloadToken]);

  const onSubmit = async (values: ProfileForm): Promise<void> => {
    if (!craftsman) return;
    setSubmitting(true);
    try {
      const updated = await updateCraftsman(craftsman.id, {
        companyName: values.companyName,
        email: values.email || null,
        phone: values.phone || null,
        vatNumber: values.vatNumber || null,
        addressLine1: values.addressLine1 || null,
        addressLine2: values.addressLine2 || null,
        postalCode: values.postalCode || null,
        city: values.city || null,
        country: values.country || null,
      });
      setCraftsman(updated);
      reset(toFormValues(updated));
      showSuccess(t('profile.messages.saved'));
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : t('profile.messages.saveFailed');
      showError(message);
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <Stack spacing={2}>
        <Skeleton variant="text" width={240} height={48} />
        <Skeleton variant="rounded" height={120} />
        <Skeleton variant="rounded" height={240} />
      </Stack>
    );
  }

  if (!user?.craftsmanId) {
    return (
      <Paper sx={{ p: 4 }}>
        <EmptyState
          icon={<PersonOffOutlinedIcon fontSize="large" />}
          message={t('profile.empty')}
        />
      </Paper>
    );
  }

  // Error state
  if (loadError || !craftsman) {
    return (
      <ErrorAlert
        message={loadError ?? t('profile.messages.loadFailed')}
        onRetry={reloadProfile}
      />
    );
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h1">{t('profile.heading')}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t('profile.subheading')}
        </Typography>
      </Stack>

      <Paper sx={{ p: 3 }} component="form" onSubmit={handleSubmit(onSubmit)}>
        <Stack spacing={3}>
          <Section title={t('profile.sections.company')}>
            <Stack spacing={2}>
              <TextField
                label={t('profile.fields.companyName')}
                fullWidth
                {...register('companyName', {
                  required: t('validation.required') ?? '',
                  maxLength: { value: 255, message: t('validation.maxLength', { n: 255 }) },
                })}
                error={!!errors.companyName}
                helperText={errors.companyName?.message}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label={t('profile.fields.email')}
                  type="email"
                  fullWidth
                  {...register('email', {
                    pattern: { value: /\S+@\S+\.\S+/, message: t('validation.email') },
                  })}
                  error={!!errors.email}
                  helperText={errors.email?.message}
                />
                <TextField label={t('profile.fields.phone')} fullWidth {...register('phone')} />
              </Stack>
              <TextField
                label={t('profile.fields.vatNumber')}
                fullWidth
                {...register('vatNumber')}
              />
            </Stack>
          </Section>

          <Divider />

          <Section title={t('profile.sections.address')}>
            <Stack spacing={2}>
              <TextField
                label={t('profile.fields.addressLine1')}
                fullWidth
                {...register('addressLine1')}
              />
              <TextField
                label={t('profile.fields.addressLine2')}
                fullWidth
                {...register('addressLine2')}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label={t('profile.fields.postalCode')}
                  sx={{ flex: '0 0 140px' }}
                  {...register('postalCode')}
                />
                <TextField label={t('profile.fields.city')} fullWidth {...register('city')} />
              </Stack>
              <TextField label={t('profile.fields.country')} fullWidth {...register('country')} />
            </Stack>
          </Section>

          <Divider />

          <Section title={t('profile.sections.trades')}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {craftsman.trades.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  —
                </Typography>
              ) : (
                craftsman.trades.map((trade) => <Chip key={trade} label={trade} />)
              )}
            </Stack>
          </Section>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="submit"
              variant="contained"
              disabled={submitting || !isDirty}
              startIcon={submitting ? <CircularProgress size={16} /> : undefined}
            >
              {submitting ? t('profile.saving') : t('profile.save')}
            </Button>
          </Box>
        </Stack>
      </Paper>

      <MutationSnackbar snack={snack} onClose={closeSnack} />
    </Stack>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <Stack spacing={2}>
      <Typography variant="h3">{title}</Typography>
      {children}
    </Stack>
  );
}
