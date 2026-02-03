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
  Alert,
  CircularProgress,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import StorageIcon from '@mui/icons-material/Storage';
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
    const colors: { [key: string]: 'primary' | 'secondary' | 'success' | 'info' } = {
      PDF: 'error' as any,
      DOCX: 'primary',
      XLSX: 'success',
      WEB: 'info',
    };
    return colors[type] || 'default';
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <StorageIcon sx={{ mr: 1, fontSize: 28 }} />
        <Typography variant="h6">
          Vectorized Data (Embeddings)
        </Typography>
      </Box>

      {(externalLoading && !loading) && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Processing new embeddings... <CircularProgress size={16} sx={{ ml: 1 }} />
        </Alert>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : data ? (
        <>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Total embedded chunks in your knowledge base: <strong>{data.total_chunks}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Each chunk is a piece of text that has been vectorized and can be searched during conversations.
            </Typography>
          </Box>

          {data.total_chunks === 0 ? (
            <Alert severity="info">
              No vectorized data found. Upload documents or crawl websites to start building your knowledge base.
            </Alert>
          ) : (
            <TableContainer sx={{ maxHeight: 500 }}>
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
                  {data.documents.map((doc) => (
                    <TableRow key={doc.id} hover>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                          {doc.filename || doc.url || doc.title || 'Unknown'}
                        </Typography>
                        {doc.url && (
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 200, display: 'block' }}>
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
                      <TableCell>
                        <Accordion>
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="caption">
                              {doc.preview.substring(0, 50)}...
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem' }}>
                              {doc.preview}
                            </Typography>
                          </AccordionDetails>
                        </Accordion>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      ) : null}
    </Paper>
  );
};

export default VectorizedDataViewer;
