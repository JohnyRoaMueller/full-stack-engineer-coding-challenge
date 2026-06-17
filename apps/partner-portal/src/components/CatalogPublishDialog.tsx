import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { formatDateDisplay } from '../utils/pricing-catalog.utils';

interface CatalogPublishDialogProps {
  open: boolean;
  effectiveFrom: string;
  publishing: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function CatalogPublishDialog({
  open,
  effectiveFrom,
  publishing,
  onConfirm,
  onClose,
}: CatalogPublishDialogProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={publishing ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('pricingCatalog.publish.title')}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {t('pricingCatalog.publish.message', {
            date: formatDateDisplay(effectiveFrom),
          })}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={publishing}>
          {t('pricingCatalog.publish.cancel')}
        </Button>
        <Button onClick={onConfirm} color="primary" variant="contained" disabled={publishing}>
          {publishing ? t('pricingCatalog.publish.publishing') : t('pricingCatalog.publish.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
