import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { TradeCode } from '@sandbox/types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../services/api.service';
import {
  CatalogPositionInput,
  getCatalogVersion,
  PricingCatalogVersionResponse,
  publishCatalogVersion,
  updateCatalogVersion,
} from '../services/pricing-catalogs.service';
import { versionPositionsToInputs } from '../utils/catalog-positions.utils';
import {
  dateInputToIso,
  isoToDateInput,
  toDiscountInput,
} from '../utils/pricing-catalog.utils';
import { CatalogPositionsTable } from './CatalogPositionsTable';
import { CatalogPublishDialog } from './CatalogPublishDialog';
import { PositionDeleteDialog } from './PositionDeleteDialog';
import { PositionFormDialog } from './PositionFormDialog';

interface CatalogDraftPanelProps {
  versionId: string;
  trade: TradeCode;
  onPublished: () => void;
}

type FormDialogState =
  | { mode: 'closed' }
  | { mode: 'add' }
  | { mode: 'edit'; key: string };

type DeleteDialogState =
  | { open: false }
  | { open: true; key: string; label: string };

function positionsEqual(a: CatalogPositionInput[], b: CatalogPositionInput[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function CatalogDraftPanel({
  versionId,
  trade,
  onPublished,
}: CatalogDraftPanelProps): JSX.Element {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<PricingCatalogVersionResponse | null>(null);
  const [positions, setPositions] = useState<CatalogPositionInput[]>([]);
  const [savedPositions, setSavedPositions] = useState<CatalogPositionInput[]>([]);
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [savedEffectiveFrom, setSavedEffectiveFrom] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [formDialog, setFormDialog] = useState<FormDialogState>({ mode: 'closed' });
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({ open: false });
  const [snack, setSnack] = useState<{ severity: 'success' | 'error'; message: string } | null>(
    null,
  );

  const loadDraft = useCallback(() => {
    setLoading(true);
    setError(null);

    return getCatalogVersion(versionId)
      .then((version) => {
        const nextPositions = versionPositionsToInputs(version.positions);
        const nextEffectiveFrom = isoToDateInput(version.effectiveFrom);
        setDraft(version);
        setPositions(nextPositions);
        setSavedPositions(nextPositions);
        setEffectiveFrom(nextEffectiveFrom);
        setSavedEffectiveFrom(nextEffectiveFrom);
      })
      .catch((err: unknown) => {
        const message =
          err instanceof ApiError ? err.message : t('pricingCatalog.draft.loadFailed');
        setError(message);
        setDraft(null);
        setPositions([]);
        setSavedPositions([]);
        setEffectiveFrom('');
        setSavedEffectiveFrom('');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [versionId, t]);

  useEffect(() => {
    void loadDraft();
  }, [loadDraft]);

  const isDirty = useMemo(() => {
    if (!positionsEqual(positions, savedPositions)) {
      return true;
    }
    return effectiveFrom !== savedEffectiveFrom;
  }, [positions, savedPositions, effectiveFrom, savedEffectiveFrom]);

  const buildUpdatePayload = (): {
    positions: CatalogPositionInput[];
    discounts: ReturnType<typeof toDiscountInput>[];
    effectiveFrom: string | null;
  } => ({
    positions,
    discounts: draft?.discounts.map(toDiscountInput) ?? [],
    effectiveFrom: effectiveFrom ? dateInputToIso(effectiveFrom) : null,
  });

  const handleSave = async (): Promise<void> => {
    if (!draft) {
      return;
    }
    setSaving(true);
    try {
      const updated = await updateCatalogVersion(versionId, buildUpdatePayload());
      const nextPositions = versionPositionsToInputs(updated.positions);
      const nextEffectiveFrom = isoToDateInput(updated.effectiveFrom);
      setDraft(updated);
      setPositions(nextPositions);
      setSavedPositions(nextPositions);
      setEffectiveFrom(nextEffectiveFrom);
      setSavedEffectiveFrom(nextEffectiveFrom);
      setSnack({ severity: 'success', message: t('pricingCatalog.positions.saved') });
    } catch (err: unknown) {
      const message =
        err instanceof ApiError ? err.message : t('pricingCatalog.positions.saveFailed');
      setSnack({ severity: 'error', message });
    } finally {
      setSaving(false);
    }
  };

  const handlePublishConfirm = async (): Promise<void> => {
    if (!draft || !effectiveFrom) {
      return;
    }
    setPublishing(true);
    try {
      if (isDirty) {
        await updateCatalogVersion(versionId, buildUpdatePayload());
      }
      await publishCatalogVersion(versionId);
      setPublishDialogOpen(false);
      setSnack({ severity: 'success', message: t('pricingCatalog.publish.success') });
      onPublished();
    } catch (err: unknown) {
      const message =
        err instanceof ApiError ? err.message : t('pricingCatalog.publish.failed');
      setSnack({ severity: 'error', message });
    } finally {
      setPublishing(false);
    }
  };

  const handlePositionSave = (position: CatalogPositionInput): void => {
    if (formDialog.mode === 'add') {
      setPositions((current) => [...current, position]);
      return;
    }
    if (formDialog.mode === 'edit') {
      setPositions((current) =>
        current.map((item) => (item.key === formDialog.key ? position : item)),
      );
    }
  };

  const handleDeleteConfirm = (): void => {
    if (!deleteDialog.open) {
      return;
    }
    setPositions((current) => current.filter((position) => position.key !== deleteDialog.key));
    setDeleteDialog({ open: false });
  };

  const editingPosition =
    formDialog.mode === 'edit'
      ? positions.find((position) => position.key === formDialog.key)
      : undefined;

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
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
      >
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Chip label={t('pricingCatalog.draft.status')} color="warning" size="small" />
          <Typography variant="body2" color="text.secondary">
            {trade}
          </Typography>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
          <TextField
            label={t('pricingCatalog.publish.effectiveFrom')}
            type="date"
            size="small"
            value={effectiveFrom}
            onChange={(event) => setEffectiveFrom(event.target.value)}
            disabled={saving || publishing}
            InputLabelProps={{ shrink: true }}
            error={!effectiveFrom}
            helperText={
              !effectiveFrom ? t('pricingCatalog.publish.effectiveFromRequired') : undefined
            }
            sx={{ minWidth: 180 }}
          />
          <Button
            variant="outlined"
            onClick={() => void handleSave()}
            disabled={saving || publishing || !isDirty}
            startIcon={saving ? <CircularProgress size={16} /> : undefined}
          >
            {saving ? t('pricingCatalog.positions.saving') : t('pricingCatalog.positions.save')}
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setPublishDialogOpen(true)}
            disabled={saving || publishing || !effectiveFrom}
          >
            {t('pricingCatalog.publish.button')}
          </Button>
        </Stack>
      </Stack>

      <CatalogPositionsTable
        positions={positions}
        disabled={saving || publishing}
        onAdd={() => setFormDialog({ mode: 'add' })}
        onEdit={(key) => setFormDialog({ mode: 'edit', key })}
        onDelete={(key) => {
          const position = positions.find((item) => item.key === key);
          if (!position) {
            return;
          }
          setDeleteDialog({ open: true, key, label: position.label });
        }}
      />

      <PositionFormDialog
        open={formDialog.mode !== 'closed'}
        mode={formDialog.mode === 'edit' ? 'edit' : 'add'}
        trade={trade}
        initial={editingPosition}
        existingKeys={positions.map((position) => position.key)}
        onSave={handlePositionSave}
        onClose={() => setFormDialog({ mode: 'closed' })}
      />

      <CatalogPublishDialog
        open={publishDialogOpen}
        effectiveFrom={effectiveFrom}
        publishing={publishing}
        onConfirm={() => void handlePublishConfirm()}
        onClose={() => setPublishDialogOpen(false)}
      />

      <PositionDeleteDialog
        open={deleteDialog.open}
        positionKey={deleteDialog.open ? deleteDialog.key : ''}
        positionLabel={deleteDialog.open ? deleteDialog.label : ''}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteDialog({ open: false })}
      />

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
    </Stack>
  );
}
