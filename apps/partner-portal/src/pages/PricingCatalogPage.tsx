import { Alert, Paper, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

export function PricingCatalogPage(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();

  if (!user?.craftsmanId) {
    return (
      <Paper sx={{ p: 4 }}>
        <Stack spacing={1} alignItems="center" textAlign="center">
          <Typography variant="h2">{t('pricingCatalog.heading')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('pricingCatalog.empty')}
          </Typography>
        </Stack>
      </Paper>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h1">{t('pricingCatalog.heading')}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t('pricingCatalog.subheading')}
        </Typography>
      </Stack>

      <Alert severity="info">{t('pricingCatalog.placeholder')}</Alert>
    </Stack>
  );
}
