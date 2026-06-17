import {
  Alert,
  Box,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { TRADE_CODES, TradeCode } from '@sandbox/types';
import { ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TradeCatalogTabPanel } from '../components/TradeCatalogTabPanel';
import { useAuth } from '../contexts/AuthContext';
import { ApiError } from '../services/api.service';
import { CraftsmanResponse, fetchCraftsman } from '../services/craftsmen.service';

function isTradeCode(value: string): value is TradeCode {
  return (TRADE_CODES as readonly string[]).includes(value);
}

interface TabPanelProps {
  children: ReactNode;
  value: number;
  index: number;
}

function TabPanel({ children, value, index }: TabPanelProps): JSX.Element {
  return (
    <div role="tabpanel" hidden={value !== index} id={`pricing-catalog-tabpanel-${index}`}>
      {value === index ? <Box>{children}</Box> : null}
    </div>
  );
}

export function PricingCatalogPage(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [craftsman, setCraftsman] = useState<CraftsmanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (!user?.craftsmanId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    fetchCraftsman(user.craftsmanId)
      .then((data) => {
        if (!cancelled) {
          setCraftsman(data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message =
            err instanceof ApiError ? err.message : t('pricingCatalog.messages.loadFailed');
          setLoadError(message);
          setCraftsman(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.craftsmanId, t]);

  if (!user?.craftsmanId) {
    return (
      <Paper sx={{ p: 4 }}>
        <Stack spacing={1} alignItems="center" textAlign="center">
          <Typography variant="h2">{t('pricingCatalog.heading')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('pricingCatalog.empty')}
          </Typography>
        </Stack>
      </Paper>
    );
  }

  if (loading) {
    return (
      <Stack spacing={3}>
        <Skeleton variant="text" width={280} height={48} />
        <Skeleton variant="rounded" height={48} />
        <Skeleton variant="rounded" height={240} />
      </Stack>
    );
  }

  if (loadError || !craftsman) {
    return <Alert severity="error">{loadError ?? t('pricingCatalog.messages.loadFailed')}</Alert>;
  }

  const trades = craftsman.trades.filter(isTradeCode);

  if (trades.length === 0) {
    return (
      <Stack spacing={3}>
        <Stack spacing={1}>
          <Typography variant="h1">{t('pricingCatalog.heading')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('pricingCatalog.subheading')}
          </Typography>
        </Stack>
        <Paper sx={{ p: 4 }}>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            {t('pricingCatalog.noTrades')}
          </Typography>
        </Paper>
      </Stack>
    );
  }

  const safeTab = activeTab < trades.length ? activeTab : 0;

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h1">{t('pricingCatalog.heading')}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t('pricingCatalog.subheading')}
        </Typography>
      </Stack>

      <Paper sx={{ px: { xs: 1, sm: 2 }, pt: 1 }}>
        <Tabs
          value={safeTab}
          onChange={(_event, next: number) => setActiveTab(next)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label={t('pricingCatalog.tabsLabel')}
        >
          {trades.map((trade) => (
            <Tab key={trade} label={trade} id={`pricing-catalog-tab-${trade}`} />
          ))}
        </Tabs>

        {trades.map((trade, index) => (
          <TabPanel key={trade} value={safeTab} index={index}>
            <TradeCatalogTabPanel craftsmanId={craftsman.id} trade={trade} />
          </TabPanel>
        ))}
      </Paper>
    </Stack>
  );
}
