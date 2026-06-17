import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

interface PositionDeleteDialogProps {
  open: boolean;
  positionKey: string;
  positionLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function PositionDeleteDialog({
  open,
  positionKey,
  positionLabel,
  onConfirm,
  onClose,
}: PositionDeleteDialogProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('pricingCatalog.positions.deleteTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {t('pricingCatalog.positions.deleteMessage', {
            key: positionKey,
            label: positionLabel,
          })}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('pricingCatalog.positions.cancel')}</Button>
        <Button onClick={onConfirm} color="error" variant="contained">
          {t('pricingCatalog.positions.deleteConfirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
