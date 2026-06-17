import {
  Alert,
  Button,
  CircularProgress,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import { TradeCode } from '@sandbox/types';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../services/api.service';
import {
  createDraftClonedFromVersion,
  createEmptyDraft,
  PricingCatalogVersionListItem,
} from '../services/pricing-catalogs.service';

interface CatalogDraftStartPanelProps {
  craftsmanId: string;
  trade: TradeCode;
  activePublished: PricingCatalogVersionListItem | null;
  onDraftCreated: () => void;
}

export function CatalogDraftStartPanel({
  craftsmanId,
  trade,
  activePublished,
  onDraftCreated,
}: CatalogDraftStartPanelProps): JSX.Element {
  const { t } = useTranslation();
  const [creating, setCreating] = useState(false);
  const [snack, setSnack] = useState<{ severity: 'success' | 'error'; message: string } | null>(
    null,
  );

  const handleCreate = async (): Promise<void> => {
    setCreating(true);
    try {
      if (activePublished) {
        await createDraftClonedFromVersion(craftsmanId, trade, activePublished.id);
      } else {
        await createEmptyDraft(craftsmanId, trade);
      }
      setSnack({ severity: 'success', message: t('pricingCatalog.draft.created') });
      onDraftCreated();
    } catch (err: unknown) {
      const message =
        err instanceof ApiError ? err.message : t('pricingCatalog.draft.createFailed');
      setSnack({ severity: 'error', message });
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2} alignItems="flex-start">
          <Typography variant="body2" color="text.secondary">
            {activePublished
              ? t('pricingCatalog.draft.fromActiveHint')
              : t('pricingCatalog.draft.emptyHint')}
          </Typography>
          <Button
            variant="contained"
            onClick={() => void handleCreate()}
            disabled={creating}
            startIcon={creating ? <CircularProgress size={16} /> : undefined}
          >
            {creating
              ? t('pricingCatalog.draft.starting')
              : activePublished
                ? t('pricingCatalog.draft.startFromActive')
                : t('pricingCatalog.draft.startEmpty')}
          </Button>
        </Stack>
      </Paper>

      <Snackbar
        open={!!snack}
        autoHideDuration={3500}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {snack ? (
          <Alert severity={snack.severity} onClose={() => setSnack(null)}>
            {snack.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </>
  );
}
