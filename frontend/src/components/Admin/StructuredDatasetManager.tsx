import { useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControlLabel, LinearProgress, MenuItem, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TablePagination,
  TableRow, TextField, Typography,
} from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import PublishOutlinedIcon from '@mui/icons-material/PublishOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import TableViewOutlinedIcon from '@mui/icons-material/TableViewOutlined';
import { alpha, useTheme } from '@mui/material/styles';
import {
  structuredDatasetService as service,
  type DatasetCapabilities, type DatasetColumn, type DatasetInspection,
  type DatasetQueryPlan, type DatasetQueryResult, type DatasetRow,
  type DatasetValidation, type DatasetVersion, type StructuredDataset,
} from '../../services/structuredDatasetService';

interface Props { widgetId: string; compact?: boolean; onPublished?: (dataset: StructuredDataset) => void }
const PREVIEW_LIMIT = 2000;
const MANUAL_LIMIT = 50;
const newColumn = (index: number): DatasetColumn => ({
  key: `column_${index}`, label: `Column ${index}`, data_type: 'text',
  aliases: [], public: false, queryable: false,
});
const errorMessage = (error: unknown): string => {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map(item => typeof item?.msg === 'string' ? item.msg : 'Invalid dataset input').join(' ');
  if (detail && typeof detail === 'object' && 'errors' in detail && Array.isArray(detail.errors)) return detail.errors.join(' ');
  return error instanceof Error && !('response' in error) ? error.message : 'Dataset request failed. Please retry or contact your administrator.';
};
const draftOf = (dataset: StructuredDataset) => dataset.draft_version || dataset.versions?.filter(v => v.status === 'draft').sort((a, b) => b.version_number - a.version_number)[0];

function ValidationReport({ report }: { report: DatasetValidation }) {
  return <Stack spacing={1}>
    <Alert severity={report.valid ? 'success' : 'error'}>{report.valid ? 'Validation passed. Review warnings before publishing.' : 'Validation failed. Correct the draft before publishing.'}</Alert>
    {report.errors.map((message, index) => <Alert severity="error" key={`e${index}`}>{message}</Alert>)}
    {report.warnings.map((message, index) => <Alert severity="warning" key={`w${index}`}>{message}</Alert>)}
  </Stack>;
}

function RowPreview({ rows, columns, onChange, onRemove }: {
  rows: DatasetRow[]; columns: DatasetColumn[];
  onChange?: (index: number, key: string, value: string) => void;
  onRemove?: (index: number) => void;
}) {
  const [page, setPage] = useState(0);
  const bounded = rows.slice(0, PREVIEW_LIMIT);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(bounded.length / 20) - 1));
  return <Box sx={{ minWidth: 0, overflow: 'hidden', border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
    <TableContainer sx={{
      maxHeight: 320,
      overflowX: 'auto',
      overflowY: 'auto',
      display: 'block',
      borderRadius: 0,
      '& .MuiTable-root': { minWidth: 560 },
      '& .MuiTableCell-stickyHeader': { zIndex: 2, bgcolor: '#e7f0fc' },
    }}>
      <Table size="small" stickyHeader><TableHead><TableRow>{columns.map(c => <TableCell key={c.key}>{c.label}</TableCell>)}{onRemove && <TableCell />}</TableRow></TableHead>
        <TableBody>{bounded.slice(currentPage * 20, currentPage * 20 + 20).map((row, i) => {
          const index = currentPage * 20 + i;
          return <TableRow key={index}>{columns.map(c => <TableCell key={c.key} sx={{ maxWidth: 240, overflowWrap: 'anywhere' }}>{onChange
            ? <TextField size="small" inputProps={{ 'aria-label': `Row ${index + 1}, ${c.label}` }} value={String(row[c.key] ?? '')} onChange={e => onChange(index, c.key, e.target.value)} sx={{ minWidth: 140 }} />
            : String(row[c.key] ?? '')}</TableCell>)}{onRemove && <TableCell><Button color="error" onClick={() => onRemove(index)}>Remove</Button></TableCell>}</TableRow>;
        })}</TableBody>
      </Table>
    </TableContainer>
    <Box sx={{
      position: 'relative',
      zIndex: 3,
      minHeight: 52,
      bgcolor: 'background.paper',
      borderTop: 1,
      borderColor: 'divider',
      '& .MuiTablePagination-root': { overflow: 'visible', bgcolor: 'background.paper' },
      '& .MuiTablePagination-toolbar': { minHeight: 52, px: { xs: 0.5, sm: 2 } },
    }}>
      <TablePagination component="div" count={bounded.length} page={currentPage} rowsPerPage={20} rowsPerPageOptions={[20]} onPageChange={(_, value) => setPage(value)} />
    </Box>
  </Box>;
}

function QueryTester({ dataset, version, busy, execute }: {
  dataset: StructuredDataset; version: DatasetVersion; busy: boolean;
  execute: (plan: DatasetQueryPlan, done: (result: DatasetQueryResult) => void) => void;
}) {
  const theme = useTheme();
  const output = version.columns.filter(c => c.public);
  const allowed = output.filter(c => c.queryable);
  const [operation, setOperation] = useState<DatasetQueryPlan['operation']>('lookup');
  const [filters, setFilters] = useState<DatasetQueryPlan['filters']>(version.required_filters.map(column => ({ column, operator: 'eq', value: '' })));
  const [select, setSelect] = useState<string[]>(output.map(c => c.key));
  const [aggregate, setAggregate] = useState('');
  const [limit, setLimit] = useState(10);
  const [result, setResult] = useState<DatasetQueryResult | null>(null);
  const resultColumns: DatasetColumn[] = result
    ? Object.keys(result.rows[0] || {}).map(key => output.find(column => column.key === key) || {
      key, label: key.charAt(0).toUpperCase() + key.slice(1), data_type: 'text',
      aliases: [], public: true, queryable: false,
    })
    : [];
  const aggregateNeeded = ['sum', 'min', 'max'].includes(operation);
  const invalid = filters.some(f => !allowed.some(c => c.key === f.column) || f.value === '') ||
    version.required_filters.some(key => !filters.some(f => f.column === key && f.value !== '')) ||
    (aggregateNeeded && !aggregate) || (operation === 'lookup' && !select.length);
  return <Paper variant="outlined" sx={{ p: { xs: 1.7, md: 2.2 }, borderRadius: '18px', overflow: 'hidden',
    borderColor: alpha(theme.palette.primary.main, 0.17) }}>
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1}>
        <Stack direction="row" spacing={1.2} alignItems="center">
          <Box sx={{ width: 40, height: 40, borderRadius: '13px', display: 'grid', placeItems: 'center', color: 'primary.main', bgcolor: theme => alpha(theme.palette.primary.main, 0.09) }}>
            <FactCheckOutlinedIcon />
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Test a published query</Typography>
            <Typography variant="caption" color="text.secondary">Admin preview · published version v{version.version_number}</Typography>
          </Box>
        </Stack>
        <Chip size="small" variant="outlined" color="primary" label={`${dataset.name} · v${version.version_number}`} />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
        Preview exact results using approved public fields. This admin test does not guarantee natural-language chat interpretation; monetary and decimal values remain exact.
      </Typography>

      <Box sx={{ p: { xs: 1.3, md: 1.7 }, borderRadius: '15px', bgcolor: theme => alpha(theme.palette.primary.main, 0.035), border: 1, borderColor: 'divider' }}>
        <Stack spacing={1.4}>
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 750, letterSpacing: '0.1em' }}>01 · DEFINE THE RESULT</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) 160px' }, gap: 1.2 }}>
            <TextField select label="What should this query do?" value={operation} onChange={e => { setOperation(e.target.value as DatasetQueryPlan['operation']); setResult(null); }} fullWidth>
              {['lookup', 'count', 'sum', 'min', 'max'].map(op => <MenuItem key={op} value={op}>{op === 'lookup' ? 'Find matching records' : op === 'count' ? 'Count matching records' : `${op.charAt(0).toUpperCase()}${op.slice(1)} values`}</MenuItem>)}
            </TextField>
            <TextField label="Maximum results" type="number" value={limit} inputProps={{ min: 1, max: 20 }} onChange={e => setLimit(Math.min(20, Math.max(1, Number(e.target.value) || 1)))} helperText="1–20 rows" />
          </Box>
          {operation === 'lookup' && <TextField select label="Fields to return" value={select} SelectProps={{ multiple: true }} onChange={e => setSelect(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)} helperText="Choose customer-visible fields for this preview.">
            {output.map(c => <MenuItem key={c.key} value={c.key}>{c.label}</MenuItem>)}
          </TextField>}
          {aggregateNeeded && <TextField select label="Numeric field" value={aggregate} onChange={e => setAggregate(e.target.value)}>
            {allowed.filter(c => c.data_type === 'integer' || c.data_type === 'decimal').map(c => <MenuItem key={c.key} value={c.key}>{c.label}</MenuItem>)}
          </TextField>}
        </Stack>
      </Box>

      <Box sx={{ p: { xs: 1.3, md: 1.7 }, borderRadius: '15px', bgcolor: 'rgba(255,255,255,0.72)', border: 1, borderColor: 'divider' }}>
        <Stack spacing={1.3}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={0.6}>
            <Box>
              <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 750, letterSpacing: '0.1em' }}>02 · NARROW THE SEARCH</Typography>
              <Typography variant="body2" color="text.secondary">Required filters must be supplied before a result can be returned.</Typography>
            </Box>
            <Button size="small" disabled={busy || !allowed.length || filters.length >= 20}
              onClick={() => setFilters(prev => [...prev, { column: allowed[0].key, operator: 'eq', value: '' }])}>+ Add filter</Button>
          </Stack>
          {!!version.required_filters.length && <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
            {version.required_filters.map(key => <Chip key={key} size="small" variant="outlined" color="warning" label={`Required · ${output.find(c => c.key === key)?.label || key}`} />)}
          </Stack>}
          {filters.map((filter, i) => <Box key={i} sx={{ p: 1.2, borderRadius: '13px', border: 1, borderColor: 'divider', bgcolor: theme => alpha(theme.palette.background.paper, 0.78) }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
              <TextField select fullWidth label="Field" value={filter.column} onChange={e => { setResult(null); setFilters(prev => prev.map((f, j) => j === i ? { ...f, column: e.target.value } : f)); }}>
                {allowed.map(c => <MenuItem key={c.key} value={c.key}>{c.label}</MenuItem>)}
              </TextField>
              <TextField select label="Condition" value={filter.operator} sx={{ minWidth: { xs: '100%', md: 170 } }} onChange={e => setFilters(prev => prev.map((f, j) => j === i ? { ...f, operator: e.target.value as typeof f.operator } : f))}>
                {[['eq', 'Equals'], ['lt', 'Less than'], ['lte', 'At most'], ['gt', 'Greater than'], ['gte', 'At least']].map(([op, label]) => <MenuItem key={op} value={op}>{label}</MenuItem>)}
              </TextField>
              <TextField fullWidth label="Exact value" value={filter.value ?? ''} onChange={e => setFilters(prev => prev.map((f, j) => j === i ? { ...f, value: e.target.value } : f))} />
              <Button color="error" size="small" onClick={() => setFilters(prev => prev.filter((_, j) => j !== i))}>Remove</Button>
            </Stack>
          </Box>)}
          {!filters.length && <Alert severity="info" sx={{ borderRadius: 2 }}>No filters added. Add filters to narrow the published records.</Alert>}
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1}>
            <Typography variant="caption" color="text.secondary">Only public, queryable fields are available here.</Typography>
            <Button variant="contained" startIcon={<FactCheckOutlinedIcon />} disabled={busy || invalid || !output.length}
              onClick={() => { setResult(null); execute({ dataset_id: dataset.id, version_id: version.id, operation, filters, select: operation === 'lookup' ? select : [], aggregate_column: aggregateNeeded ? aggregate : undefined, limit }, setResult); }}>
              Run preview
            </Button>
          </Stack>
        </Stack>
      </Box>

      {result && <Paper elevation={0} sx={{ p: { xs: 1.4, md: 1.8 }, borderRadius: '15px', border: 1,
        borderColor: result.status === 'matched' ? alpha(theme.palette.success.main, 0.3) : 'divider',
        bgcolor: result.status === 'matched' ? theme => alpha(theme.palette.success.main, 0.035) : 'background.default' }}>
        <Stack spacing={1.4}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={0.7}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Preview result</Typography>
              <Typography variant="body2" color="text.secondary">{result.response}</Typography>
            </Box>
            <Chip size="small" color={result.status === 'matched' ? 'success' : result.status === 'no_match' ? 'default' : 'warning'}
              label={result.status === 'matched' ? `${result.total_matches.toLocaleString()} matching records` : result.status === 'no_match' ? 'No matches' : 'More information needed'} />
          </Stack>
          {result.rows.length > 0 && <RowPreview key={JSON.stringify(result.rows)} rows={result.rows} columns={resultColumns} />}
          {!!result.citations.length && <Stack direction="row" spacing={0.7} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>Source</Typography>
            {result.citations.map((citation, index) => {
              const label = [citation.name, citation.sheet_name, Array.isArray(citation.row_numbers) && citation.row_numbers.length
                ? `${citation.row_numbers.length} source row${citation.row_numbers.length === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ');
              return <Chip key={`${String(citation.dataset_id)}-${index}`} size="small" variant="outlined" label={label || 'Published dataset'} />;
            })}
          </Stack>}
        </Stack>
      </Paper>}
    </Stack>
  </Paper>;
}

// Remount on scope changes: old requests are aborted and cannot update the new agent.
export default function StructuredDatasetManager(props: Props) {
  return <ScopedDatasetManager key={props.widgetId} {...props} />;
}

function ScopedDatasetManager({ widgetId, compact = false, onPublished }: Props) {
  const theme = useTheme();
  const [capabilities, setCapabilities] = useState<DatasetCapabilities | null>(null);
  const [unavailable, setUnavailable] = useState('');
  const [items, setItems] = useState<StructuredDataset[]>([]);
  const [selected, setSelected] = useState<StructuredDataset | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(0);
  const [editor, setEditor] = useState(false);
  const [replacementId, setReplacementId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [headerRow, setHeaderRow] = useState(1);
  const [inspection, setInspection] = useState<DatasetInspection | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [sheet, setSheet] = useState('Manual');
  const [columns, setColumns] = useState<DatasetColumn[]>([newColumn(1)]);
  const [rows, setRows] = useState<DatasetRow[]>([{ column_1: '' }]);
  const [requiredFilters, setRequiredFilters] = useState<string[]>([]);
  const [approved, setApproved] = useState(false);
  const [manual, setManual] = useState(true);
  const [editingRows, setEditingRows] = useState(true);
  const [incompletePreview, setIncompletePreview] = useState(false);
  const [report, setReport] = useState<DatasetValidation | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: 'publish' | 'delete'; datasetId: number; versionId?: number } | null>(null);
  const scope = useRef<{ alive: boolean; controller: AbortController }>({ alive: true, controller: new AbortController() });
  const actionLock = useRef(false);
  const selectionRequest = useRef(0);

  useEffect(() => {
    const current = { alive: true, controller: new AbortController() };
    scope.current = current;
    if (widgetId.trim()) {
      setLoading(true);
      service.capabilities(widgetId, current.controller.signal).then(async caps => {
        if (!current.alive) return;
        setCapabilities(caps);
        if (caps.enabled) {
          const datasets = await service.list(widgetId, current.controller.signal);
          if (current.alive) setItems(datasets);
        }
      }).catch(() => {
        if (current.alive) setUnavailable('Structured Datasets is not available for this agent yet. The rollout requires server support, organization opt-in, and admin permission. Existing document knowledge remains available.');
      }).finally(() => { if (current.alive) setLoading(false); });
    }
    return () => { current.alive = false; current.controller.abort(); };
  }, [widgetId]);

  const run = async (action: (signal: AbortSignal) => Promise<void>) => {
    const current = scope.current;
    if (!widgetId.trim() || !capabilities?.enabled || actionLock.current || !current.alive) return;
    actionLock.current = true;
    setBusy(true); setError(''); setNotice('');
    try { await action(current.controller.signal); }
    catch (err) { if (current.alive) setError(errorMessage(err)); }
    finally { actionLock.current = false; if (current.alive) setBusy(false); }
  };
  const updateDataset = (dataset: StructuredDataset) => {
    if (!scope.current.alive) return;
    if (dataset.widget_id !== widgetId) throw new Error('Dataset scope mismatch');
    setItems(prev => [...prev.filter(d => d.id !== dataset.id), dataset]);
    setSelected(dataset);
    const version = draftOf(dataset) || dataset.versions?.find(v => v.id === dataset.active_version_id);
    setSelectedVersionId(version?.id ?? null);
    setReport(version?.validation || null);
  };
  const openDataset = (id: number) => {
    const request = ++selectionRequest.current;
    void run(async signal => {
      const detail = await service.detail(id, signal);
      if (scope.current.alive && request === selectionRequest.current) { updateDataset(detail); setEditor(false); }
    });
  };
  const startEditor = (replacement?: StructuredDataset, version?: DatasetVersion) => {
    setReplacementId(replacement?.id ?? null);
    setName(replacement?.name || ''); setDescription(replacement?.description || '');
    setFile(null); setInspection(null); setHeaderRow(1); setSheet(version?.sheet_name || 'Manual'); setManual(!version); setEditingRows(true);
    setSheetNames([]); setSelectedSheet('');
    setColumns(version ? version.columns.map(c => ({ ...c, aliases: [...c.aliases] })) : [newColumn(1)]);
    setRows(version ? version.rows.slice(0, PREVIEW_LIMIT).map(row => ({ ...row })) : [{ column_1: '' }]);
    setRequiredFilters(version ? [...version.required_filters] : []);
    setApproved(false); setIncompletePreview(!!version && version.row_count > Math.min(version.rows.length, PREVIEW_LIMIT)); setEditor(true); setError(''); setNotice('');
  };
  const chooseTable = (table: DatasetInspection['tables'][number]) => {
    setSheet(table.sheet_name);
    setColumns(table.columns.map(c => ({ ...c, aliases: c.aliases || [], public: false, queryable: false })));
    setRows(table.rows.slice(0, PREVIEW_LIMIT));
    setIncompletePreview(table.row_count > Math.min(table.rows.length, PREVIEW_LIMIT));
    setRequiredFilters([]); setApproved(false); setManual(false); setEditingRows(false);
  };
  const resetInspection = () => {
    setInspection(null); setApproved(false); setRows([]); setColumns([]);
    setRequiredFilters([]); setIncompletePreview(false); setManual(false); setEditingRows(false);
  };
  const discoverSheets = () => void run(async signal => {
    if (!file) return;
    resetInspection(); setSheetNames([]); setSelectedSheet('');
    if (!capabilities?.supported_formats.some(format => file.name.toLowerCase().endsWith(`.${format}`))) throw new Error('Unsupported format');
    const result = await service.inspect(file, widgetId, headerRow, signal, undefined, true);
    if (!scope.current.alive) return;
    setSheetNames(result.sheet_names); setSelectedSheet(result.sheet_names[0] || '');
    if (!result.sheet_names.length) setError('No sheets found in the selected file.');
  });
  const inspectSelectedSheet = () => void run(async signal => {
    if (!file || !selectedSheet) return;
    resetInspection();
    const result = await service.inspect(file, widgetId, headerRow, signal, selectedSheet);
    if (!scope.current.alive) return;
    if (result.tables.length !== 1 || result.tables[0].sheet_name !== selectedSheet) throw new Error('Selected sheet inspection mismatch. Please inspect again.');
    setInspection(result); chooseTable(result.tables[0]);
  });
  const editColumn = (index: number, patch: Partial<DatasetColumn>) => {
    setApproved(false);
    const next = columns.map((c, i) => i === index ? { ...c, ...patch } : c);
    setColumns(next);
    setRequiredFilters(prev => prev.filter(key => next.some(c => c.key === key && c.public && c.queryable)));
  };
  const rowLimit = Math.min(PREVIEW_LIMIT, capabilities?.max_rows ?? PREVIEW_LIMIT);
  const columnLimit = Math.min(50, capabilities?.max_columns ?? 50);
  const localIssues = (): string[] => {
    const issues: string[] = [];
    if (!name.trim()) issues.push('Enter a dataset name.');
    if (name.trim().length > 200 || description.trim().length > 4000) issues.push('Name/description exceeds server limits (200/4,000 characters).');
    if (!columns.length || columns.length > columnLimit) issues.push(`Define 1–${columnLimit} columns.`);
    if (columns.some(c => !c.key.trim() || !c.label.trim()) || new Set(columns.map(c => c.key)).size !== columns.length) issues.push('Column keys must be unique and keys/labels cannot be blank.');
    if (columns.some(c => !/^[a-z][a-z0-9_]{0,63}$/.test(c.key))) issues.push('Keys must start with a lowercase letter and use only lowercase letters, digits and underscores (up to 64 characters).');
    if (columns.some(c => c.label.length > 200 || c.aliases.filter(Boolean).length > 20 || c.aliases.some(a => a.length > 200) || (c.unit?.trim().length ?? 0) > 32)) issues.push('Column labels, aliases or units exceed server limits.');
    if (columns.some(c => c.currency?.trim() && !/^[A-Z]{3}$/.test(c.currency.trim().toUpperCase()))) issues.push('Currency must be a three-letter code, such as USD, or blank.');
    if (!rows.length || rows.length > rowLimit) issues.push(`Provide 1–${rowLimit} rows.`);
    if (incompletePreview) issues.push('Inspection returned only a partial preview. Saving this would lose rows. Import a smaller complete table (up to 2,000 rows).');
    if (file && (!inspection || inspection.tables.length !== 1 || inspection.tables[0].sheet_name !== selectedSheet)) issues.push('Inspect the selected sheet/header row before saving.');
    if (columns.some(c => (c.currency || c.data_type === 'decimal') && rows.some(row => typeof row[c.key] === 'number'))) issues.push('Decimal/money values must be exact strings, not JavaScript numbers. Re-import as text or enter exact string values manually.');
    if (!approved) issues.push('Approve the mapping and visibility before saving.');
    return issues;
  };
  const saveDraft = () => {
    const issues = localIssues();
    if (issues.length) { setError(issues.join(' ')); return; }
    void run(async signal => {
      const body = { sheet_name: sheet, columns: columns.map(c => ({ ...c, aliases: c.aliases.filter(Boolean) })), rows, required_filters: requiredFilters };
      const dataset = replacementId == null
        ? await service.create({ ...body, widget_id: widgetId, name: name.trim(), description: description.trim() }, signal)
        : await service.replace(replacementId, body, signal);
      if (!scope.current.alive) return;
      updateDataset(dataset); setEditor(false); setNotice('Draft saved. Validate and explicitly publish when ready. The active version is unchanged.');
    });
  };
  const activeVersion = selected?.versions?.find(v => v.id === selected.active_version_id);
  const versionHistory = selected?.versions ? [...selected.versions] : [];
  const latestDraft = selected ? draftOf(selected) : undefined;
  if (latestDraft && !versionHistory.some(v => v.id === latestDraft.id)) versionHistory.push(latestDraft);
  const previewVersion = versionHistory.find(v => v.id === selectedVersionId);
  const draft = previewVersion?.status === 'draft' ? previewVersion : undefined;
  const confirmAction = () => {
    if (!selected || !confirmation || selected.id !== confirmation.datasetId) return;
    const target = confirmation;
    setConfirmation(null);
    void run(async signal => {
      if (target.action === 'delete') {
        await service.remove(target.datasetId, signal);
        if (!scope.current.alive) return;
        setItems(prev => prev.filter(d => d.id !== target.datasetId)); setSelected(null); setSelectedVersionId(null); setReport(null); setPage(0); setNotice('Dataset deleted.');
      } else if (target.action === 'publish' && draft && draft.id === target.versionId && report?.valid) {
        const published = await service.publish(target.datasetId, draft.id, signal);
        if (!scope.current.alive) return;
        updateDataset(published); setNotice('Version published.'); onPublished?.(published);
      }
    });
  };

  return <Paper variant="outlined" sx={{ p: compact ? 2 : { xs: 2, md: 3 }, borderRadius: 3, bgcolor: theme => alpha(theme.palette.primary.main, 0.025) }}>
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
        <Box><Stack direction="row" spacing={1} alignItems="center"><StorageIcon color="primary" /><Typography variant="h6" fontWeight={800}>Structured Datasets</Typography><Chip size="small" label="Optional" /></Stack>
          <Typography variant="body2" color="text.secondary">Approved tables for exact lookups and aggregates, separate from document embeddings.</Typography></Box>
        {capabilities?.enabled && <Button variant="contained" disabled={busy} onClick={() => startEditor()}>Create dataset</Button>}
      </Stack>
      {!widgetId.trim() && <Alert severity="info">Save the agent profile first to create or manage datasets. This optional step does not block agent completion.</Alert>}
      {loading && <LinearProgress />}
      {unavailable && <Alert severity="info">{unavailable}</Alert>}
      {capabilities && !capabilities.enabled && <Alert severity="info">Structured Datasets is disabled for this agent. Ask your administrator to enable the rollout and organization opt-in. Document knowledge continues to work; you can skip this optional step.</Alert>}
      {capabilities?.enabled && <>
        {!capabilities.chat_enabled && <Alert severity="info">Dataset management and admin testing are enabled; structured answers in customer chat are not enabled yet.</Alert>}
        <Typography variant="caption" color="text.secondary">Server limits: {capabilities.max_rows} rows / {capabilities.max_columns} columns. This editor is bounded to {rowLimit} imported rows or {Math.min(MANUAL_LIMIT, rowLimit)} manual rows.</Typography>
        {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
        {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}
        {busy && <LinearProgress />}
        <Stack direction="row" spacing={1}><Button disabled={busy} onClick={() => void run(async signal => { const result = await service.list(widgetId, signal); if (scope.current.alive) { setItems(result); setPage(0); } })}>Refresh datasets</Button><Chip size="small" label={`${items.filter(d => d.status === 'active' && d.active_version_id != null).length} active published datasets`} color="success" variant="outlined" /></Stack>
        {!items.length && !loading && <Alert severity="info">No datasets yet. Upload CSV/XLSX or define a small table manually. Existing uploads are not automatically converted.</Alert>}
        <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Dataset</TableCell><TableCell>Status</TableCell><TableCell>Version / rows</TableCell><TableCell /></TableRow></TableHead>
          <TableBody>{items.slice(page * 10, page * 10 + 10).map(dataset => {
            const version = draftOf(dataset) || dataset.versions?.find(v => v.id === dataset.active_version_id);
            return <TableRow key={dataset.id} selected={selected?.id === dataset.id}><TableCell><Typography fontWeight={700}>{dataset.name}</Typography><Typography variant="caption">{dataset.description}</Typography></TableCell><TableCell><Chip size="small" label={dataset.status} color={dataset.status === 'active' ? 'success' : 'default'} /></TableCell><TableCell>{version ? `v${version.version_number} · ${version.status} · ${version.row_count} rows` : `Published version: ${dataset.active_version_id ?? 'none'} · open for rows`}</TableCell><TableCell><Button disabled={busy} onClick={() => openDataset(dataset.id)}>Manage</Button></TableCell></TableRow>;
          })}</TableBody></Table></TableContainer>
        <TablePagination component="div" count={items.length} page={Math.min(page, Math.max(0, Math.ceil(items.length / 10) - 1))} rowsPerPage={10} rowsPerPageOptions={[10]} onPageChange={(_, value) => setPage(value)} />

        {editor && <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}><Stack spacing={2}>
          <Typography variant="h6">{replacementId == null ? 'Create a draft' : 'Create replacement version'}</Typography>
          {replacementId != null && <Alert severity="info">A replacement is a new draft, not an automatic publication. The current published version remains unchanged.</Alert>}
          <TextField label="Dataset name" value={name} disabled={busy || replacementId != null} onChange={e => setName(e.target.value)} required />
          <TextField label="Purpose / description" value={description} disabled={busy || replacementId != null} onChange={e => setDescription(e.target.value)} multiline minRows={2} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button variant="outlined" component="label" disabled={busy}>Choose CSV/XLSX<input hidden type="file" accept={capabilities.supported_formats.map(format => `.${format}`).join(',')} onChange={e => { setFile(e.target.files?.[0] || null); resetInspection(); setSheetNames([]); setSelectedSheet(''); e.target.value = ''; }} /></Button>
            <Button disabled={busy || !file} onClick={discoverSheets}>Discover sheets {file?.name || ''}</Button>
            <Button disabled={busy} onClick={() => { setFile(null); setInspection(null); setSheetNames([]); setSelectedSheet(''); setManual(true); setEditingRows(true); setSheet('Manual'); setColumns([newColumn(1)]); setRows([{ column_1: '' }]); setRequiredFilters([]); setApproved(false); setIncompletePreview(false); }}>Manual table</Button>
          </Stack>
          {sheetNames.length > 0 && <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField select fullWidth label="Sheet / table" value={selectedSheet} disabled={busy} onChange={e => { setSelectedSheet(e.target.value); resetInspection(); }}>{sheetNames.map(sheetName => <MenuItem key={sheetName} value={sheetName}>{sheetName}</MenuItem>)}</TextField>
            <TextField disabled={busy} size="small" label="Header row (1-based)" type="number" value={headerRow} inputProps={{ min: 1, max: 100 }} onChange={e => { setHeaderRow(Math.min(100, Math.max(1, Math.floor(Number(e.target.value) || 1)))); resetInspection(); }} helperText="Use this sheet's exact header row; no automatic guessing." />
            <Button disabled={busy || !file || !selectedSheet} onClick={inspectSelectedSheet}>Inspect selected sheet</Button>
          </Stack>}
          {inspection?.warnings.map((warning, i) => <Alert severity="warning" key={i}>{warning}</Alert>)}
          {incompletePreview && <Alert severity="warning">Only a partial preview was returned. Save is disabled to prevent silent row loss; split the table into complete bounded imports.</Alert>}
          <Alert severity="info">Approve labels, types, aliases, units and visibility. Uploaded columns start private. Only public/queryable fields can be required lookup filters. Money/decimal values must be strings; incorrect source data or interpretation can still produce incorrect answers.</Alert>
          <Box component="fieldset" disabled={busy} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
            <Typography variant="body2">{columns.filter(c => c.public).length} public / {columns.filter(c => !c.public).length} hidden fields. Hidden fields are excluded from customer answers. All-public visibility requires explicit approval below.</Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <Button onClick={() => { setColumns(prev => prev.map(c => ({ ...c, public: true }))); setApproved(false); }}>Make all fields public</Button>
              <Button onClick={() => { setColumns(prev => prev.map(c => ({ ...c, public: false, queryable: false }))); setRequiredFilters([]); setApproved(false); }}>Hide all fields</Button>
            </Stack>
            <Stack spacing={2}>{columns.map((column, index) => <Paper variant="outlined" key={index} sx={{ p: 2, borderRadius: 2 }}><Stack spacing={1}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                <TextField size="small" label="Stable key" value={column.key} disabled={!manual} onChange={e => {
                  const key = e.target.value;
                  setRows(prev => prev.map(row => { const { [column.key]: value, ...rest } = row; return { ...rest, [key]: value ?? '' }; }));
                  editColumn(index, { key });
                }} />
                <TextField size="small" label="Label" value={column.label} onChange={e => editColumn(index, { label: e.target.value })} />
                <TextField size="small" select label="Data type" value={column.data_type} sx={{ minWidth: 130 }} onChange={e => editColumn(index, { data_type: e.target.value as DatasetColumn['data_type'] })}>{['text', 'integer', 'decimal', 'boolean', 'date'].map(type => <MenuItem key={type} value={type}>{type}</MenuItem>)}</TextField>
              </Stack>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                <TextField size="small" label="Aliases (comma separated)" value={column.aliases.join(', ')} onChange={e => editColumn(index, { aliases: e.target.value.split(',').map(s => s.trim()) })} />
                <TextField size="small" label="Unit" value={column.unit || ''} onChange={e => editColumn(index, { unit: e.target.value })} />
                <TextField size="small" label="Currency (e.g. USD)" value={column.currency || ''} onChange={e => editColumn(index, { currency: e.target.value })} />
              </Stack>
              <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
                <FormControlLabel label="Public (unchecked = hidden)" control={<Checkbox checked={column.public} onChange={e => editColumn(index, { public: e.target.checked, ...(!e.target.checked ? { queryable: false } : {}) })} />} />
                <FormControlLabel label="Queryable" control={<Checkbox disabled={!column.public} checked={column.queryable} onChange={e => editColumn(index, { queryable: e.target.checked })} />} />
                {manual && <Button color="error" onClick={() => { setColumns(prev => prev.filter((_, i) => i !== index)); setRows(prev => prev.map(row => { const { [column.key]: _removed, ...rest } = row; return rest; })); setRequiredFilters(prev => prev.filter(key => key !== column.key)); setApproved(false); }}>Remove column</Button>}
              </Stack>
            </Stack></Paper>)}</Stack>
            {manual && <Button disabled={columns.length >= columnLimit} onClick={() => { let index = columns.length + 1; while (columns.some(c => c.key === `column_${index}`)) index++; const column = newColumn(index); setColumns(prev => [...prev, column]); setRows(prev => prev.map(row => ({ ...row, [column.key]: '' }))); setApproved(false); }}>Add column</Button>}
            <TextField fullWidth select label="Required lookup fields" sx={{ mt: 2 }} value={requiredFilters} SelectProps={{ multiple: true }} onChange={e => { setRequiredFilters(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value); setApproved(false); }} helperText="Optional: require these public/queryable fields before a lookup can be answered.">{columns.filter(c => c.public && c.queryable).map(c => <MenuItem key={c.key} value={c.key}>{c.label}</MenuItem>)}</TextField>
            <Typography variant="subtitle2" sx={{ mt: 2 }}>Rows ({rows.length}) {editingRows ? '· untouched nulls and exact values are preserved; edited cells are strings' : '· imported preview'}</Typography>
            {!manual && <Button onClick={() => setEditingRows(prev => !prev)}>{editingRows ? 'Preview rows' : 'Correct rows'}</Button>}
            <RowPreview key={sheet} rows={rows} columns={columns}
              onChange={editingRows ? (index, key, value) => { setRows(prev => prev.map((row, i) => i === index ? { ...row, [key]: value } : row)); setApproved(false); } : undefined}
              onRemove={editingRows ? index => { setRows(prev => prev.filter((_, i) => i !== index)); setApproved(false); } : undefined} />
            {editingRows && <Button disabled={!columns.length || rows.length >= (manual ? Math.min(MANUAL_LIMIT, rowLimit) : rowLimit)} onClick={() => { setRows(prev => [...prev, Object.fromEntries(columns.map(c => [c.key, '']))]); setApproved(false); }}>Add row</Button>}
            <FormControlLabel label="I approve this mapping, lookup rules and public field visibility." control={<Checkbox checked={approved} onChange={e => setApproved(e.target.checked)} />} />
          </Box>
          <Stack direction="row" spacing={1}><Button variant="contained" disabled={busy || !approved || incompletePreview || (!!file && !inspection)} onClick={saveDraft}>Save Draft</Button><Button disabled={busy} onClick={() => setEditor(false)}>Cancel</Button></Stack>
        </Stack></Paper>}

        {selected && !editor && <Stack spacing={{ xs: 2, md: 2.5 }}>
          <Paper elevation={0} sx={{
            p: { xs: 2, md: 2.8 }, borderRadius: '22px', overflow: 'hidden', position: 'relative',
            isolation: 'isolate', zIndex: 1,
            color: '#17324f',
            background: '#f4f8fe',
            border: `1px solid ${alpha(theme.palette.primary.main, 0.22)}`,
            boxShadow: `0 12px 28px ${alpha(theme.palette.primary.dark, 0.12)}`,
            '& > *': { position: 'relative', zIndex: 1 },
          }}>
            <Stack spacing={2.2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'flex-start' }} spacing={2}>
                <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ minWidth: 0 }}>
                  <Box sx={{ flex: '0 0 auto', width: 48, height: 48, borderRadius: '15px', display: 'grid', placeItems: 'center',
                    color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.1), border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}` }}>
                    <StorageIcon sx={{ fontSize: 26, color: 'primary.main' }} />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="overline" sx={{ letterSpacing: '0.13em', color: '#315b83', fontWeight: 800 }}>
                      DATASET WORKSPACE · ID {selected.id}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 850, letterSpacing: '-0.03em', overflowWrap: 'anywhere' }}>
                      {selected.name}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, maxWidth: 740, color: '#425b73', lineHeight: 1.65 }}>
                      {selected.description || 'Manage versions, visibility, and published records for this agent.'}
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                  <Chip size="small" label={selected.status === 'active' ? 'Active' : selected.status}
                    sx={{ color: selected.status === 'active' ? '#126b4d' : '#44566a', fontWeight: 800, textTransform: 'capitalize',
                      bgcolor: selected.status === 'active' ? '#d7f4e8' : '#e5ebf2',
                      border: `1px solid ${selected.status === 'active' ? '#9cdec0' : '#c8d3df'}` }} />
                  {activeVersion && <Chip size="small" icon={<CheckCircleOutlineIcon />}
                    label={`Published v${activeVersion.version_number}`}
                    sx={{ color: '#315274', bgcolor: '#e5effb', border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                      '& .MuiChip-icon': { color: '#16805d' } }} />}
                </Stack>
              </Stack>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }, gap: 1 }}>
                {[
                  { label: 'Versions', value: versionHistory.length, icon: <RefreshOutlinedIcon /> },
                  { label: 'Published rows', value: activeVersion?.row_count ?? 0, icon: <TableViewOutlinedIcon /> },
                  { label: 'Customer-visible fields', value: activeVersion?.columns.filter(column => column.public).length ?? 0, icon: <CheckCircleOutlineIcon /> },
                  { label: 'Required lookup fields', value: activeVersion?.required_filters.length ?? 0, icon: <FactCheckOutlinedIcon /> },
                ].map(metric => (
                  <Box key={metric.label} sx={{ p: 1.25, borderRadius: '14px', bgcolor: '#ffffff', border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}` }}>
                    <Stack direction="row" spacing={0.8} alignItems="center" sx={{ color: '#526a82' }}>
                      {metric.icon}
                      <Typography variant="caption" sx={{ lineHeight: 1.25, color: '#526a82', fontWeight: 650 }}>{metric.label}</Typography>
                    </Stack>
                    <Typography variant="h5" sx={{ mt: 0.55, fontWeight: 850, lineHeight: 1, color: '#17324f' }}>{metric.value}</Typography>
                  </Box>
                ))}
              </Box>

              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.4}>
                <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
                  <Button size="small" variant="contained" startIcon={<EditOutlinedIcon />} disabled={busy || !previewVersion}
                    onClick={() => startEditor(selected, previewVersion)}
                    sx={{ bgcolor: 'primary.main', color: 'common.white', fontWeight: 750, '&:hover': { bgcolor: 'primary.dark' } }}>
                    Edit as draft
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<AddCircleOutlineIcon />} disabled={busy}
                    onClick={() => startEditor(selected)}
                    sx={{ color: '#285078', borderColor: alpha(theme.palette.primary.main, 0.36), '&:hover': { borderColor: 'primary.main', bgcolor: '#e9f2fc' } }}>
                    Replace from table
                  </Button>
                  <Button size="small" variant="outlined" disabled={busy || selected.active_version_id == null}
                    onClick={() => void run(async signal => { updateDataset(await service.setStatus(selected.id, selected.status === 'inactive' ? 'active' : 'inactive', signal)); })}
                    sx={{ color: '#285078', borderColor: alpha(theme.palette.primary.main, 0.36), '&:hover': { borderColor: 'primary.main', bgcolor: '#e9f2fc' } }}>
                    {selected.status === 'inactive' ? 'Activate dataset' : 'Deactivate'}
                  </Button>
                  <Button size="small" color="inherit" startIcon={<DeleteOutlineIcon />} disabled={busy}
                    onClick={() => setConfirmation({ action: 'delete', datasetId: selected.id })}
                    sx={{ color: '#a23434', '&:hover': { bgcolor: '#fff0f0' } }}>
                    Delete
                  </Button>
                </Stack>
                <Button size="small" startIcon={<ArrowBackIcon />} disabled={busy}
                  onClick={() => { setSelected(null); setReport(null); }}
                  sx={{ alignSelf: { xs: 'flex-start', md: 'center' }, color: '#49647e' }}>
                  Back to datasets
                </Button>
              </Stack>
            </Stack>
          </Paper>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(260px, 0.34fr) minmax(0, 1fr)' }, gap: 2 }}>
            <Paper variant="outlined" sx={{ p: { xs: 1.8, md: 2.2 }, borderRadius: '18px', borderColor: alpha(theme.palette.primary.main, 0.15),
              background: `linear-gradient(150deg, ${alpha('#ffffff', 0.9)} 0%, ${alpha('#edf4ff', 0.72)} 100%)` }}>
              <Stack spacing={1.6}>
                <Box>
                  <Typography variant="overline" color="primary.main" sx={{ fontWeight: 750, letterSpacing: '0.12em' }}>VERSION CONTROL</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>History & preview</Typography>
                  <Typography variant="body2" color="text.secondary">Choose a version to inspect its published or draft snapshot.</Typography>
                </Box>
                <TextField select size="small" label="Preview version" value={selectedVersionId ?? ''} disabled={busy}
                  onChange={e => {
                    const id = Number(e.target.value);
                    setSelectedVersionId(id); setReport(versionHistory.find(v => v.id === id)?.validation || null);
                  }}>
                  {versionHistory.map(v => <MenuItem key={v.id} value={v.id}>v{v.version_number} · {v.status}{v.id === selected.active_version_id ? ' · live' : ''}</MenuItem>)}
                </TextField>
                <Stack spacing={0.8}>
                  {versionHistory.map(v => {
                    const isActive = v.id === selected.active_version_id;
                    const isSelected = v.id === selectedVersionId;
                    return <Box key={v.id} component="button" type="button"
                      onClick={() => { setSelectedVersionId(v.id); setReport(v.validation || null); }}
                      sx={{ width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit', p: 1.2,
                        borderRadius: '13px', border: `1px solid ${isSelected ? alpha(theme.palette.primary.main, 0.42) : alpha(theme.palette.divider, 0.85)}`,
                        bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.07) : 'rgba(255,255,255,0.66)',
                        transition: 'all 160ms ease', '&:hover': { borderColor: alpha(theme.palette.primary.main, 0.42), transform: 'translateY(-1px)' } }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Version {v.version_number}</Typography>
                        <Chip size="small" label={isActive ? 'Live' : v.status}
                          color={isActive ? 'success' : v.status === 'draft' ? 'warning' : 'default'} />
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.55 }}>
                        {v.row_count.toLocaleString()} rows · {v.columns.length} fields
                      </Typography>
                      <Typography variant="caption" color="text.secondary">{v.sheet_name}</Typography>
                    </Box>;
                  })}
                </Stack>
              </Stack>
            </Paper>

            <Stack spacing={2} sx={{ minWidth: 0 }}>
              {draft && <Paper variant="outlined" sx={{ p: { xs: 1.8, md: 2.2 }, borderRadius: '18px',
                borderColor: alpha(theme.palette.warning.main, 0.34),
                background: `linear-gradient(140deg, ${alpha(theme.palette.warning.light, 0.2)} 0%, ${alpha('#ffffff', 0.9)} 100%)` }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1.5}>
                  <Stack direction="row" spacing={1.2} alignItems="flex-start">
                    <Box sx={{ width: 38, height: 38, flex: '0 0 auto', borderRadius: '12px', display: 'grid', placeItems: 'center',
                      color: 'warning.dark', bgcolor: alpha(theme.palette.warning.main, 0.13) }}><FactCheckOutlinedIcon /></Box>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Draft v{draft.version_number} · not live yet</Typography>
                      <Typography variant="body2" color="text.secondary">Validate the draft before publishing. The current live version stays active until you publish.</Typography>
                    </Box>
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <Button variant="outlined" startIcon={<FactCheckOutlinedIcon />} disabled={busy}
                      onClick={() => void run(async signal => { const validation = await service.validate(selected.id, draft.id, signal); if (scope.current.alive) setReport(validation); })}>
                      Validate draft
                    </Button>
                    <Button variant="contained" startIcon={<PublishOutlinedIcon />} disabled={busy || !report?.valid}
                      onClick={() => setConfirmation({ action: 'publish', datasetId: selected.id, versionId: draft.id })}>
                      Publish version
                    </Button>
                  </Stack>
                </Stack>
                {report && <Box sx={{ mt: 1.6 }}><ValidationReport report={report} /></Box>}
              </Paper>}
              {draft && <Alert severity="info" sx={{ borderRadius: '13px' }}>
                This test area always uses the current active published version—not the selected draft. Publish the draft only after reviewing validation.
              </Alert>}
              {previewVersion && <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, borderRadius: '18px', borderColor: alpha(theme.palette.primary.main, 0.14), minWidth: 0 }}>
                <Stack spacing={1.3}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Data preview</Typography>
                      <Typography variant="body2" color="text.secondary">Snapshot of version {previewVersion.version_number} · {previewVersion.row_count.toLocaleString()} rows · {previewVersion.columns.length} fields</Typography>
                    </Box>
                    <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
                      <Chip size="small" variant="outlined" label={`${previewVersion.columns.filter(column => column.public).length} public`} color="success" />
                      <Chip size="small" variant="outlined" label={`${previewVersion.columns.filter(column => !column.public).length} hidden`} />
                    </Stack>
                  </Stack>
                  <RowPreview key={`${selected.id}-${previewVersion.id}`} rows={previewVersion.rows || []} columns={previewVersion.columns} />
                </Stack>
              </Paper>}
              {activeVersion && selected.status === 'active' && <QueryTester key={`${selected.id}-${activeVersion.id}`}
                dataset={selected} version={activeVersion} busy={busy}
                execute={(plan, done) => void run(async signal => { const result = await service.testQuery(selected.id, plan, signal); if (scope.current.alive) done(result); })} />}
            </Stack>
          </Box>
        </Stack>}
      </>}
    </Stack>
    <Dialog open={confirmation != null} onClose={() => setConfirmation(null)} maxWidth="sm" fullWidth>
      <DialogTitle>{confirmation?.action === 'delete' ? 'Delete this dataset?' : 'Publish this version?'}</DialogTitle>
      <DialogContent>{confirmation?.action === 'delete' ? 'This removes dataset access for this agent. Backend retention policies govern historical records.' : `This activates selected version ${confirmation?.versionId} and replaces the current published version. Approved public/queryable fields may become available to chat when the rollout is enabled.`}</DialogContent>
      <DialogActions><Button onClick={() => setConfirmation(null)}>Cancel</Button><Button variant="contained" color={confirmation?.action === 'delete' ? 'error' : 'primary'} onClick={confirmAction} disabled={busy}>Confirm {confirmation?.action}</Button></DialogActions>
    </Dialog>
  </Paper>;
}