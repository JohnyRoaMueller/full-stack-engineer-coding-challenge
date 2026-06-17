import { Alert, Snackbar } from '@mui/material';
import { MutationSnack } from '../hooks/useMutationSnack';

interface MutationSnackbarProps {
  snack: MutationSnack | null;
  onClose: () => void;
}

export function MutationSnackbar({ snack, onClose }: MutationSnackbarProps): JSX.Element {
  return (
    <Snackbar
      open={!!snack}
      autoHideDuration={3500}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      {snack ? (
        <Alert severity={snack.severity} onClose={onClose}>
          {snack.message}
        </Alert>
      ) : undefined}
    </Snackbar>
  );
}
