import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../i18n/i18n';
import { PositionFormDialog } from './PositionFormDialog';

vi.mock('../services/trades.service', () => ({
  getTrade: vi.fn(),
  extractPricingSchema: vi.fn((metadata: Record<string, unknown>) => metadata.pricingSchema),
}));

import { getTrade } from '../services/trades.service';

const mockedGetTrade = vi.mocked(getTrade);

function renderDialog(): ReturnType<typeof render> {
  return render(
    <I18nextProvider i18n={i18n}>
      <PositionFormDialog
        open
        mode="add"
        trade="WINDOWS"
        existingKeys={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    </I18nextProvider>,
  );
}

describe('PositionFormDialog', () => {
  beforeEach(() => {
    mockedGetTrade.mockResolvedValue({
      id: 'trade-id',
      trade: 'WINDOWS',
      displayName: 'Windows',
      isActive: true,
      metadata: {
        pricingSchema: {
          fields: [
            { name: 'uValue', type: 'number', required: true, min: 0.1, max: 2.0 },
            {
              name: 'frameMaterial',
              type: 'enum',
              required: true,
              values: ['wood', 'aluminium', 'pvc'],
            },
          ],
        },
      },
    });
  });

  it('shows schema validation errors for required attribute fields', async () => {
    const user = userEvent.setup();
    renderDialog();

    await waitFor(() => {
      expect(screen.getByLabelText('uValue')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /übernehmen|apply/i }));

    await waitFor(() => {
      expect(screen.getByLabelText('uValue')).toHaveAttribute('aria-invalid', 'true');
    });
  });
});
