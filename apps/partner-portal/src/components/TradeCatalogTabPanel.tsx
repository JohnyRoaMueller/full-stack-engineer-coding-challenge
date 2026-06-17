import { Alert, Box, Skeleton, Stack } from '@mui/material';
import { TradeCode } from '@sandbox/types';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  findActivePublishedVersion,
  findDraftVersion,
} from '../utils/pricing-catalog.utils';
import { ApiError } from '../services/api.service';
import {
  listCatalogVersions,
  PricingCatalogVersionListItem,
} from '../services/pricing-catalogs.service';
import { CatalogDraftPanel } from './CatalogDraftPanel';
import { CatalogDraftStartPanel } from './CatalogDraftStartPanel';

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
  const [reloadToken, setReloadToken] = useState(0);

  const reloadVersions = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

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
  }, [craftsmanId, trade, t, reloadToken]);

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

  const draft = findDraftVersion(versions ?? []);
  const activePublished = findActivePublishedVersion(versions ?? []);

  return (
    <Stack spacing={2} sx={{ pt: 2 }}>
      {draft ? (
        <CatalogDraftPanel
          versionId={draft.id}
          trade={trade}
          onPublished={reloadVersions}
        />
      ) : (
        <CatalogDraftStartPanel
          craftsmanId={craftsmanId}
          trade={trade}
          activePublished={activePublished}
          onDraftCreated={reloadVersions}
        />
      )}
    </Stack>
  );
}
