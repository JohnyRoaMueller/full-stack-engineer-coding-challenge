import { useCallback, useState } from 'react';

export type MutationSnackSeverity = 'success' | 'error' | 'info' | 'warning';

export interface MutationSnack {
  severity: MutationSnackSeverity;
  message: string;
}

export function useMutationSnack(): {
  snack: MutationSnack | null;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  closeSnack: () => void;
} {
  const [snack, setSnack] = useState<MutationSnack | null>(null);

  const showSuccess = useCallback((message: string) => {
    setSnack({ severity: 'success', message });
  }, []);

  const showError = useCallback((message: string) => {
    setSnack({ severity: 'error', message });
  }, []);

  const closeSnack = useCallback(() => {
    setSnack(null);
  }, []);

  return { snack, showSuccess, showError, closeSnack };
}
