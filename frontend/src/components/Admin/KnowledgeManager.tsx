import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Divider,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { knowledgeService } from '../../services/knowledgeService';
import { dashboardService } from '../../services/dashboardService';
import { KnowledgeSource } from '../../types';
import WebCrawler from './WebCrawler';
import DocumentUpload from './DocumentUpload';
import VectorizedDataViewer from './VectorizedDataViewer';
import { analyticsService } from '../../services/analyticsService';

const KnowledgeManager: React.FC = () => {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [widgets, setWidgets] = useState<{ widget_id: string; name: string }[]>([]);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [vectorRefreshToken, setVectorRefreshToken] = useState<number>(0);
  const [vectorLoading, setVectorLoading] = useState<boolean>(false);
  const [lastTotalChunks, setLastTotalChunks] = useState<number>(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [pendingDeleteEmbeddings, setPendingDeleteEmbeddings] = useState<number>(0);
  const [gapSuggestions, setGapSuggestions] = useState<any[]>([]);
  const [gapLoading, setGapLoading] = useState(false);
  const [gapError, setGapError] = useState('');

  const loadSources = async (widgetId?: string) => {
    try {
      if (!widgetId) {
        setSources([]);
        return;
      }
      const data = await knowledgeService.listSources(widgetId);
      setSources(data);
    } catch (err) {
      setError('Failed to load knowledge sources');
    } finally {
      setLoading(false);
    }
  };

  const loadWidgets = async () => {
    try {
      const data = await dashboardService.getWidgets();
      const widgetItems = data?.widgets || [];
      setWidgets(widgetItems.map((w: any) => ({ widget_id: w.widget_id, name: w.name })));
      if (!selectedWidgetId && widgetItems.length > 0) {
        setSelectedWidgetId(widgetItems[0].widget_id);
      }
    } catch (err) {
      setError('Failed to load widgets');
    }
  };

  useEffect(() => {
    loadWidgets();
  }, []);

  useEffect(() => {
    if (!selectedWidgetId) return;
    loadSources(selectedWidgetId);
    const interval = setInterval(() => loadSources(selectedWidgetId), 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [selectedWidgetId]);

  useEffect(() => {
    const loadGaps = async () => {
      if (!selectedWidgetId) return;
      try {
        setGapLoading(true);
        setGapError('');
        const data = await analyticsService.getKnowledgeGaps(30, 6, selectedWidgetId);
        setGapSuggestions(data.gaps || []);
      } catch (err) {
        setGapError('Failed to load knowledge gaps');
      } finally {
        setGapLoading(false);
      }
    };

    loadGaps();
  }, [selectedWidgetId]);

  const handleDelete = async (id: number) => {
    if (!selectedWidgetId) return;

    try {
      const vectorData = await knowledgeService.getVectorizedData(selectedWidgetId);
      const embeddingsForSource = (vectorData?.documents || []).filter((doc: any) => {
        if (doc?.source_id === null || typeof doc?.source_id === 'undefined') return false;
        return String(doc.source_id) === String(id);
      }).length;

      setPendingDeleteId(id);
      setPendingDeleteEmbeddings(embeddingsForSource);
      setDeleteDialogOpen(true);
    } catch (err) {
      setError('Failed to delete source');
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedWidgetId || pendingDeleteId === null) return;

    try {
      setVectorLoading(true);
      await knowledgeService.deleteSource(pendingDeleteId);
      loadSources(selectedWidgetId);
      setVectorRefreshToken((t) => t + 1);
      setDeleteDialogOpen(false);
      setPendingDeleteId(null);
      setPendingDeleteEmbeddings(0);
    } catch (err) {
      setError('Failed to delete source');
      setVectorLoading(false);
    }
  };

  const buildGapTemplate = (title: string, questions: string[]) => {
    const lines = [
      `# ${title}`,
      '',
      '## Open Questions',
      ...questions.map((q) => `- ${q}`),
      '',
      '## Suggested Answers',
      ...questions.map((q) => `Q: ${q}\nA:`),
      '',
      '## Notes',
      'Add definitive answers and links. This document was auto-generated from unanswered chats.',
    ];
    return lines.join('\n');
  };

  const handleIngestGap = async (gap: any) => {
    if (!selectedWidgetId) return;
    try {
      setGapLoading(true);
      const content = buildGapTemplate(gap.suggested_title, gap.sample_questions || []);
      await knowledgeService.ingestText(selectedWidgetId, gap.suggested_title, content);
      await loadSources(selectedWidgetId);
      setVectorRefreshToken((t) => t + 1);
    } catch (err) {
      setGapError('Failed to ingest suggested gap');
    } finally {
      setGapLoading(false);
    }
  };

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {widgets.length === 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          No widgets found. Create a widget before adding knowledge sources.
        </Alert>
      )}

      <Box sx={{ mb: 3 }}>
        <FormControl fullWidth size="small">
          <InputLabel id="knowledge-widget-select-label">Widget</InputLabel>
          <Select
            labelId="knowledge-widget-select-label"
            value={selectedWidgetId}
            label="Widget"
            onChange={(e) => setSelectedWidgetId(e.target.value)}
          >
            {widgets.map((widget) => (
              <MenuItem key={widget.widget_id} value={widget.widget_id}>
                {widget.name} ({widget.widget_id})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Grid container spacing={3}>
        {/* Add New Source Accordions */}
        <Grid item xs={12} lg={6}>
          <Accordion sx={{ boxShadow: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AddCircleOutlineIcon color="primary" />
                <Typography sx={{ fontWeight: 600 }}>Web Crawler</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <WebCrawler 
                widgetId={selectedWidgetId}
                onStarted={() => setVectorLoading(true)}
                onCompleted={() => {
                  setVectorLoading(true);
                  setVectorRefreshToken((t) => t + 1);
                }}
              />
            </AccordionDetails>
          </Accordion>
        </Grid>

        <Grid item xs={12}>
          <Accordion sx={{ boxShadow: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AddCircleOutlineIcon color="primary" />
                <Typography sx={{ fontWeight: 600 }}>Suggested Knowledge Gaps</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {gapError && <Alert severity="error" sx={{ mb: 2 }}>{gapError}</Alert>}
              {gapLoading && <Typography variant="body2">Loading suggestions…</Typography>}
              {!gapLoading && gapSuggestions.length === 0 && (
                <Typography variant="body2" color="text.secondary">No gaps detected for this widget.</Typography>
              )}
              <Grid container spacing={2}>
                {gapSuggestions.map((gap: any) => (
                  <Grid item xs={12} md={6} key={gap.keyword}>
                    <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid rgba(148,163,184,0.2)' }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {gap.suggested_title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Mentions: {gap.count}
                      </Typography>
                      <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {(gap.sample_questions || []).map((q: string, idx: number) => (
                          <Typography key={`${gap.keyword}-${idx}`} variant="body2" color="text.secondary">
                            • {q}
                          </Typography>
                        ))}
                      </Box>
                      <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => handleIngestGap(gap)}
                          disabled={gapLoading}
                        >
                          One‑click ingest
                        </Button>
                      </Box>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Grid>

        <Grid item xs={12} lg={6}>
          <Accordion sx={{ boxShadow: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AddCircleOutlineIcon color="primary" />
                <Typography sx={{ fontWeight: 600 }}>Document Upload</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <DocumentUpload 
                widgetId={selectedWidgetId}
                onStarted={() => setVectorLoading(true)}
                onCompleted={() => {
                  setVectorLoading(true);
                  setVectorRefreshToken((t) => t + 1);
                }}
              />
            </AccordionDetails>
          </Accordion>
        </Grid>

        {/* Knowledge Sources Table */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, boxShadow: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Knowledge Sources
            </Typography>

            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Source</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Created At</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sources.map((source) => (
                    <TableRow key={source.id} hover>
                      <TableCell>{source.name}</TableCell>
                      <TableCell>
                        <Chip 
                          label={source.source_type} 
                          size="small" 
                          color="primary" 
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {source.url || source.file_path || '-'}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={source.status} 
                          size="small" 
                          color={source.status === 'completed' ? 'success' : source.status === 'failed' ? 'error' : 'warning'}
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(source.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <IconButton onClick={() => handleDelete(source.id)} color="error" size="small">
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {sources.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography color="text.secondary">No knowledge sources found</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Vectorized Data Viewer */}
        <Grid item xs={12}>
          <Accordion sx={{ boxShadow: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography sx={{ fontWeight: 600 }}>Vectorized Data</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <VectorizedDataViewer 
                widgetId={selectedWidgetId}
                refreshToken={vectorRefreshToken}
                externalLoading={vectorLoading}
                onLoaded={(data) => {
                  // Stop loading indicator only when total chunks increased or after a short grace period
                  if (data?.total_chunks && data.total_chunks > lastTotalChunks) {
                    setLastTotalChunks(data.total_chunks);
                    setVectorLoading(false);
                  } else {
                    setTimeout(() => setVectorLoading(false), 5000);
                  }
                }}
              />
            </AccordionDetails>
          </Accordion>
        </Grid>
      </Grid>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.98) 100%)',
            color: 'common.white',
            border: '1px solid rgba(148,163,184,0.2)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
            minWidth: 420,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Delete knowledge source?</DialogTitle>
        <Divider sx={{ borderColor: 'rgba(148,163,184,0.25)' }} />
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" sx={{ color: 'rgba(226,232,240,0.9)' }}>
            This will delete 1 knowledge source and <strong>{pendingDeleteEmbeddings}</strong> embeddings.
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'rgba(148,163,184,0.85)' }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            variant="outlined"
            sx={{
              borderColor: 'rgba(148,163,184,0.5)',
              color: 'rgba(226,232,240,0.9)',
              '&:hover': { borderColor: 'rgba(226,232,240,0.9)', background: 'rgba(148,163,184,0.1)' },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDelete}
            variant="contained"
            color="error"
            sx={{
              background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
              boxShadow: '0 12px 24px rgba(239,68,68,0.35)',
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default KnowledgeManager;
