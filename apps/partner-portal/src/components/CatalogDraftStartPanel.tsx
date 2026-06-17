import EditNoteIcon from '@mui/icons-material/EditNote';
import { Button, CircularProgress, Paper } from '@mui/material';
import { TradeCode } from '@sandbox/types';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutationSnack } from '../hooks/useMutationSnack';
import { ApiError } from '../services/api.service';
import {
  createDraftClonedFromVersion,
  createEmptyDraft,
  PricingCatalogVersionListItem,
} from '../services/pricing-catalogs.service';
import { EmptyState } from './EmptyState';
import { MutationSnackbar } from './MutationSnackbar';

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
  const { snack, showSuccess, showError, closeSnack } = useMutationSnack();

  const handleCreate = async (): Promise<void> => {
    setCreating(true);
    try {
      if (activePublished) {
        await createDraftClonedFromVersion(craftsmanId, trade, activePublished.id);
      } else {
        await createEmptyDraft(craftsmanId, trade);
      }
      showSuccess(t('pricingCatalog.draft.created'));
      onDraftCreated();
    } catch (err: unknown) {
      const message =
        err instanceof ApiError ? err.message : t('pricingCatalog.draft.createFailed');
      showError(message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Paper sx={{ p: 3 }}>
        <EmptyState
          icon={<EditNoteIcon fontSize="large" />}
          message={
            activePublished
              ? t('pricingCatalog.draft.fromActiveHint')
              : t('pricingCatalog.draft.emptyHint')
          }
          action={
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
          }
        />
      </Paper>

      <MutationSnackbar snack={snack} onClose={closeSnack} />
    </>
  );
}
