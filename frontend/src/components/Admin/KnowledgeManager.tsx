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
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { knowledgeService } from '../../services/knowledgeService';
import { KnowledgeSource } from '../../types';
import WebCrawler from './WebCrawler';
import DocumentUpload from './DocumentUpload';
import VectorizedDataViewer from './VectorizedDataViewer';

const KnowledgeManager: React.FC = () => {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [vectorRefreshToken, setVectorRefreshToken] = useState<number>(0);
  const [vectorLoading, setVectorLoading] = useState<boolean>(false);
  const [lastTotalChunks, setLastTotalChunks] = useState<number>(0);

  const loadSources = async () => {
    try {
      const data = await knowledgeService.listSources();
      setSources(data);
    } catch (err) {
      setError('Failed to load knowledge sources');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSources();
    const interval = setInterval(loadSources, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this source?')) return;

    try {
      await knowledgeService.deleteSource(id);
      loadSources();
    } catch (err) {
      setError('Failed to delete source');
    }
  };

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

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
                onStarted={() => setVectorLoading(true)}
                onCompleted={() => {
                  setVectorLoading(true);
                  setVectorRefreshToken((t) => t + 1);
                }}
              />
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
    </Box>
  );
};

export default KnowledgeManager;
