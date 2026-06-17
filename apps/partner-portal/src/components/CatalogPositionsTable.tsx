import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import {
  Button,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { CatalogPositionInput } from '../services/pricing-catalogs.service';
import { toPositionTableRow } from '../utils/catalog-positions.utils';
import { EmptyState } from './EmptyState';

interface CatalogPositionsTableProps {
  positions: CatalogPositionInput[];
  disabled?: boolean;
  onAdd: () => void;
  onEdit: (key: string) => void;
  onDelete: (key: string) => void;
}

export function CatalogPositionsTable({
  positions,
  disabled = false,
  onAdd,
  onEdit,
  onDelete,
}: CatalogPositionsTableProps): JSX.Element {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith('de') ? 'de-DE' : 'en-US';

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="flex-end">
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={onAdd}
          disabled={disabled}
        >
          {t('pricingCatalog.positions.add')}
        </Button>
      </Stack>

      {positions.length === 0 ? (
        <Paper sx={{ p: 4 }}>
          <EmptyState
            icon={<Inventory2OutlinedIcon fontSize="large" />}
            message={t('pricingCatalog.positions.empty')}
            action={
              <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd} disabled={disabled}>
                {t('pricingCatalog.positions.add')}
              </Button>
            }
          />
        </Paper>
      ) : (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {t('pricingCatalog.positions.columns.key')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {t('pricingCatalog.positions.columns.label')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {t('pricingCatalog.positions.columns.unit')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">
                    {t('pricingCatalog.positions.columns.netPrice')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">
                    {t('pricingCatalog.positions.columns.vat')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {t('pricingCatalog.positions.columns.attributes')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right" width={112}>
                    {t('pricingCatalog.positions.columns.actions')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {positions.map((position) => {
                  const row = toPositionTableRow(position, locale, t('common.notAvailable'));
                  return (
                    <TableRow key={position.key} hover>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {row.key}
                        </Typography>
                      </TableCell>
                      <TableCell>{row.label}</TableCell>
                      <TableCell>{t(`pricingCatalog.positions.units.${row.unit}`)}</TableCell>
                      <TableCell align="right">{row.netPriceEuro}</TableCell>
                      <TableCell align="right">{row.vatRateLabel}</TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          noWrap
                          sx={{ maxWidth: 280 }}
                        >
                          {row.attributesSummary}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          aria-label={t('pricingCatalog.positions.edit')}
                          onClick={() => onEdit(position.key)}
                          disabled={disabled}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          aria-label={t('pricingCatalog.positions.delete')}
                          onClick={() => onDelete(position.key)}
                          disabled={disabled}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Stack>
  );
}
