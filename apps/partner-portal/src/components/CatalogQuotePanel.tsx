import CalculateIcon from '@mui/icons-material/Calculate';
import {
  Button,
  CircularProgress,
  Divider,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutationSnack } from '../hooks/useMutationSnack';
import { ApiError } from '../services/api.service';
import {
  CatalogPositionResponse,
  getCatalogVersion,
  quoteCatalogVersion,
  QuoteResponse,
} from '../services/pricing-catalogs.service';
import { formatNetPriceEuro } from '../utils/catalog-positions.utils';
import { quoteResponseToBreakdown, QuoteBreakdownView } from '../utils/quote-breakdown.utils';
import { EmptyState } from './EmptyState';
import { ErrorAlert } from './ErrorAlert';
import { MutationSnackbar } from './MutationSnackbar';

interface CatalogQuotePanelProps {
  versionId: string;
}

export function CatalogQuotePanel({ versionId }: CatalogQuotePanelProps): JSX.Element {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith('de') ? 'de-DE' : 'en-US';

  const [positions, setPositions] = useState<CatalogPositionResponse[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [breakdown, setBreakdown] = useState<QuoteBreakdownView | null>(null);
  const { snack, showSuccess, showError, closeSnack } = useMutationSnack();

  const loadPositions = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    setBreakdown(null);

    return getCatalogVersion(versionId)
      .then((version) => {
        setPositions(version.positions);
        setQuantities(
          Object.fromEntries(version.positions.map((position) => [position.key, ''])),
        );
      })
      .catch((err: unknown) => {
        const message =
          err instanceof ApiError ? err.message : t('pricingCatalog.quote.loadFailed');
        setLoadError(message);
        setPositions([]);
        setQuantities({});
      })
      .finally(() => {
        setLoading(false);
      });
  }, [versionId, t]);

  useEffect(() => {
    void loadPositions();
  }, [loadPositions]);

  const hasSelectedLines = useMemo(
    () =>
      Object.values(quantities).some((value) => {
        const quantity = Number(value);
        return Number.isFinite(quantity) && quantity > 0;
      }),
    [quantities],
  );

  const handleCalculate = async (): Promise<void> => {
    const lines = Object.entries(quantities)
      .map(([positionKey, value]) => ({
        positionKey,
        quantity: Number(value),
      }))
      .filter((line) => Number.isFinite(line.quantity) && line.quantity > 0);

    if (lines.length === 0) {
      showError(t('pricingCatalog.quote.noLines'));
      return;
    }

    setCalculating(true);
    try {
      const response: QuoteResponse = await quoteCatalogVersion(versionId, { lines });
      setBreakdown(quoteResponseToBreakdown(response, locale, t('common.notAvailable')));
      showSuccess(t('pricingCatalog.quote.calculated'));
    } catch (err: unknown) {
      const message =
        err instanceof ApiError ? err.message : t('pricingCatalog.quote.calculateFailed');
      showError(message);
      setBreakdown(null);
    } finally {
      setCalculating(false);
    }
  };

  if (loading) {
    return (
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Skeleton variant="text" width={200} />
          <Skeleton variant="rounded" height={120} />
        </Stack>
      </Paper>
    );
  }

  if (loadError) {
    return (
      <Paper sx={{ p: 3 }}>
        <ErrorAlert message={loadError} onRetry={() => void loadPositions()} />
      </Paper>
    );
  }

  return (
    <>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Typography variant="h6">{t('pricingCatalog.quote.heading')}</Typography>

          {positions.length === 0 ? (
            <EmptyState icon={<CalculateIcon fontSize="large" />} message={t('pricingCatalog.quote.noPositions')} />
          ) : (
            <>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {t('pricingCatalog.quote.columns.position')}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {t('pricingCatalog.quote.columns.unit')}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">
                        {t('pricingCatalog.quote.columns.netPrice')}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right" width={140}>
                        {t('pricingCatalog.quote.columns.quantity')}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {positions.map((position) => (
                      <TableRow key={position.key}>
                        <TableCell>
                          <Typography variant="body2">{position.label}</Typography>
                          <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                            {position.key}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {t(`pricingCatalog.positions.units.${position.unit}`)}
                        </TableCell>
                        <TableCell align="right">
                          {formatNetPriceEuro(position.netPrice, locale)}
                        </TableCell>
                        <TableCell align="right">
                          <TextField
                            type="number"
                            size="small"
                            value={quantities[position.key] ?? ''}
                            onChange={(event) =>
                              setQuantities((current) => ({
                                ...current,
                                [position.key]: event.target.value,
                              }))
                            }
                            disabled={calculating}
                            inputProps={{ min: 0, step: 'any' }}
                            sx={{ width: 120 }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Stack direction="row" justifyContent="flex-end">
                <Button
                  variant="contained"
                  startIcon={calculating ? <CircularProgress size={16} /> : <CalculateIcon />}
                  onClick={() => void handleCalculate()}
                  disabled={calculating || !hasSelectedLines}
                >
                  {calculating
                    ? t('pricingCatalog.quote.calculating')
                    : t('pricingCatalog.quote.calculate')}
                </Button>
              </Stack>
            </>
          )}

          {breakdown ? (
            <Stack spacing={2}>
              <Divider />
              <Typography variant="subtitle1">{t('pricingCatalog.quote.breakdown.heading')}</Typography>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {t('pricingCatalog.quote.breakdown.columns.position')}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">
                        {t('pricingCatalog.quote.breakdown.columns.quantity')}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">
                        {t('pricingCatalog.quote.breakdown.columns.net')}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">
                        {t('pricingCatalog.quote.breakdown.columns.gross')}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {t('pricingCatalog.quote.breakdown.columns.surcharges')}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {t('pricingCatalog.quote.breakdown.columns.discounts')}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {breakdown.lines.map((line) => (
                      <TableRow key={line.positionKey}>
                        <TableCell>{line.positionKey}</TableCell>
                        <TableCell align="right">{line.quantity}</TableCell>
                        <TableCell align="right">{line.net}</TableCell>
                        <TableCell align="right">{line.gross}</TableCell>
                        <TableCell>{line.surchargesSummary}</TableCell>
                        <TableCell>{line.discountsSummary}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {breakdown.vatBreakdown.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>
                          {t('pricingCatalog.quote.breakdown.columns.vatRate')}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">
                          {t('pricingCatalog.quote.breakdown.columns.net')}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">
                          {t('pricingCatalog.quote.breakdown.columns.vat')}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">
                          {t('pricingCatalog.quote.breakdown.columns.gross')}
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {breakdown.vatBreakdown.map((row) => (
                        <TableRow key={row.vatRateLabel}>
                          <TableCell>{row.vatRateLabel}</TableCell>
                          <TableCell align="right">{row.netTotal}</TableCell>
                          <TableCell align="right">{row.vatAmount}</TableCell>
                          <TableCell align="right">{row.grossTotal}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : null}

              <Stack spacing={0.5} alignItems="flex-end">
                <Typography variant="body2">
                  {t('pricingCatalog.quote.breakdown.totals.net')}: {breakdown.totals.net}
                </Typography>
                <Typography variant="body2">
                  {t('pricingCatalog.quote.breakdown.totals.discount')}:{' '}
                  {breakdown.totals.totalDiscount}
                </Typography>
                <Typography variant="body2">
                  {t('pricingCatalog.quote.breakdown.totals.vat')}: {breakdown.totals.vat}
                </Typography>
                <Typography variant="subtitle1">
                  {t('pricingCatalog.quote.breakdown.totals.gross')}: {breakdown.totals.gross}
                </Typography>
              </Stack>
            </Stack>
          ) : null}
        </Stack>
      </Paper>

      <MutationSnackbar snack={snack} onClose={closeSnack} />
    </>
  );
}
