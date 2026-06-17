import { Alert, Box, Paper, Skeleton, Stack, Typography } from '@mui/material';
import { TradeCode } from '@sandbox/types';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../services/api.service';
import {
  listCatalogVersions,
  PricingCatalogVersionListItem,
} from '../services/pricing-catalogs.service';

interface TradeCatalogTabPanelProps {
  craftsmanId: string;
  trade: TradeCode;
}

export function TradeCatalogTabPanel({
  craftsmanId,
  trade,
}: TradeCatalogTabPanelProps): JSX.Element {
  const { t } = useTranslation();
  const [versions, setVersions] = useState<PricingCatalogVersionListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    listCatalogVersions(craftsmanId, trade)
      .then((items) => {
        if (!cancelled) {
          setVersions(items);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message =
            err instanceof ApiError ? err.message : t('pricingCatalog.tab.loadFailed');
          setError(message);
          setVersions(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [craftsmanId, trade, t]);

  if (loading) {
    return (
      <Stack spacing={2} sx={{ pt: 2 }}>
        <Skeleton variant="rounded" height={48} />
        <Skeleton variant="rounded" height={200} />
      </Stack>
    );
  }

  if (error) {
    return (
      <Box sx={{ pt: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  const draft = versions?.find((version) => version.status === 'DRAFT') ?? null;
  const publishedCount = versions?.filter((version) => version.status === 'PUBLISHED').length ?? 0;

  return (
    <Stack spacing={2} sx={{ pt: 2 }}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">
            {draft
              ? t('pricingCatalog.tab.draftExists')
              : t('pricingCatalog.tab.noDraft')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('pricingCatalog.tab.publishedCount', { count: publishedCount })}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('pricingCatalog.tab.placeholder')}
          </Typography>
        </Stack>
      </Paper>
    </Stack>
  );
}
