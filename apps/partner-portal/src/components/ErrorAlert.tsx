import RefreshIcon from '@mui/icons-material/Refresh';
import { Alert, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface ErrorAlertProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorAlert({ message, onRetry }: ErrorAlertProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <Alert
      severity="error"
      action={
        onRetry ? (
          <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={onRetry}>
            {t('common.retry')}
          </Button>
        ) : undefined
      }
    >
      {message}
    </Alert>
  );
}
