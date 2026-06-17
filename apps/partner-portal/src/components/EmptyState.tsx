import { Box, Stack, Typography } from '@mui/material';
import { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  message: string;
  action?: ReactNode;
}

export function EmptyState({ icon, message, action }: EmptyStateProps): JSX.Element {
  return (
    <Stack spacing={2} alignItems="center" textAlign="center" sx={{ py: 2 }}>
      <Box sx={{ color: 'text.secondary', display: 'flex' }}>{icon}</Box>
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
      {action}
    </Stack>
  );
}
