import { Alert, Box, Chip, Paper, Skeleton, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../services/api.service';
import {
  getCatalogVersion,
  PricingCatalogVersionResponse,
} from '../services/pricing-catalogs.service';

interface CatalogDraftPanelProps {
  versionId: string;
}

export function CatalogDraftPanel({ versionId }: CatalogDraftPanelProps): JSX.Element {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<PricingCatalogVersionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getCatalogVersion(versionId)
      .then((version) => {
        if (!cancelled) {
          setDraft(version);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message =
            err instanceof ApiError ? err.message : t('pricingCatalog.draft.loadFailed');
          setError(message);
          setDraft(null);
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
  }, [versionId, t]);

  if (loading) {
    return (
      <Stack spacing={2}>
        <Skeleton variant="rounded" height={40} width={120} />
        <Skeleton variant="rounded" height={200} />
      </Stack>
    );
  }

  if (error || !draft) {
    return <Alert severity="error">{error ?? t('pricingCatalog.draft.loadFailed')}</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Chip label={t('pricingCatalog.draft.status')} color="warning" size="small" />
        <Typography variant="body2" color="text.secondary">
          {draft.positions.length > 0
            ? t('pricingCatalog.draft.positionCount', { count: draft.positions.length })
            : t('pricingCatalog.draft.noPositions')}
        </Typography>
      </Stack>

      <Paper sx={{ p: 3 }}>
        <Box>
          <Typography variant="body2" color="text.secondary">
            {t('pricingCatalog.draft.tablePlaceholder')}
          </Typography>
        </Box>
      </Paper>
    </Stack>
  );
}
