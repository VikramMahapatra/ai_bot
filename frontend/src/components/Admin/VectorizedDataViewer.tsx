import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Stack,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  Chip,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import { knowledgeService } from '../../services/knowledgeService';

interface VectorizedDocument {
  id: string;
  source_id: string;
  source_type: string;
  filename: string | null;
  url: string | null;
  title: string | null;
  chunk_index: number;
  created_at: string;
  preview: string;
}

interface VectorizedData {
  user_id: number;
  total_chunks: number;
  documents: VectorizedDocument[];
}

interface VectorizedDataViewerProps {
  widgetId: string;
  refreshToken?: number;
  externalLoading?: boolean;
  onLoaded?: (data: VectorizedData) => void;
}

const VectorizedDataViewer: React.FC<VectorizedDataViewerProps> = ({ widgetId, refreshToken, externalLoading = false, onLoaded }) => {
  const [data, setData] = useState<VectorizedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadVectorizedData = async () => {
    try {
      setLoading(true);
      const result = await knowledgeService.getVectorizedData(widgetId);
      setData(result);
      setError('');
      onLoaded && onLoaded(result);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load vectorized data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!widgetId) return;
    loadVectorizedData();
  }, [widgetId]);

  useEffect(() => {
    if (typeof refreshToken !== 'undefined' && widgetId) {
      loadVectorizedData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  const getSourceTypeColor = (type: string) => {
    const colors: { [key: string]: 'default' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' } = {
      PDF: 'error',
      DOCX: 'primary',
      XLSX: 'success',
      WEB: 'info',
    };
    return colors[type] || 'default';
  };

  const uniqueSources = new Set((data?.documents || []).map((doc) => doc.source_id)).size;

  return (
    <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 2 }}>
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <StorageIcon sx={{ mr: 1, fontSize: 28 }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Vector Index
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Embedded chunks available for retrieval in chat.
              </Typography>
            </Box>
          </Box>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip icon={<TravelExploreIcon />} label={`${data?.total_chunks || 0} chunks`} size="small" variant="outlined" />
            <Chip label={`${uniqueSources} sources`} size="small" variant="outlined" />
          </Stack>
        </Box>

        {(externalLoading && !loading) && (
          <Box>
            <Alert severity="info" sx={{ mb: 1 }}>
              Processing new embeddings...
            </Alert>
            <LinearProgress sx={{ borderRadius: 1 }} />
          </Box>
        )}

        {error && <Alert severity="error">{error}</Alert>}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : data ? (
          <>
            <Typography variant="body2" color="text.secondary">
              Each chunk is a piece of text vectorized for semantic retrieval.
            </Typography>

            {data.total_chunks === 0 ? (
              <Alert severity="info">
                No vectorized data found. Upload documents or crawl websites to start building your knowledge base.
              </Alert>
            ) : (
              <TableContainer sx={{ maxHeight: 520, border: '1px solid #e2e8f0', borderRadius: 2 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Source</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Chunk #</TableCell>
                      <TableCell>Preview</TableCell>
                      <TableCell>Created</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.documents.map((doc) => {
                      const previewText = (doc.preview || '').trim();
                      const shortPreview = previewText.length > 90 ? `${previewText.slice(0, 90)}...` : previewText;
                      return (
                        <TableRow key={doc.id} hover>
                          <TableCell>
                            <Typography variant="body2" noWrap sx={{ maxWidth: 220 }}>
                              {doc.filename || doc.url || doc.title || 'Unknown'}
                            </Typography>
                            {doc.url && (
                              <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 220, display: 'block' }}>
                                {doc.url}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={doc.source_type}
                              size="small"
                              color={getSourceTypeColor(doc.source_type)}
                            />
                          </TableCell>
                          <TableCell>{doc.chunk_index}</TableCell>
                          <TableCell sx={{ maxWidth: 360 }}>
                            <Tooltip title={previewText || 'No preview available'} placement="top-start">
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                {shortPreview || 'No preview available'}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">
                              {new Date(doc.created_at).toLocaleDateString()}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        ) : null}
      </Stack>
    </Paper>
  );
};

export default VectorizedDataViewer;
