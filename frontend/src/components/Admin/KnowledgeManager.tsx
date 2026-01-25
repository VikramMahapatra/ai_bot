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
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { knowledgeService } from '../../services/knowledgeService';
import { KnowledgeSource } from '../../types';
import WebCrawler from './WebCrawler';
import DocumentUpload from './DocumentUpload';

const KnowledgeManager: React.FC = () => {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      <Typography variant="h4" gutterBottom>
        Knowledge Management
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ mb: 3 }}>
        <WebCrawler />
      </Box>

      <Box sx={{ mb: 3 }}>
        <DocumentUpload />
      </Box>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Knowledge Sources
        </Typography>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created At</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sources.map((source) => (
                <TableRow key={source.id}>
                  <TableCell>{source.name}</TableCell>
                  <TableCell>{source.source_type}</TableCell>
                  <TableCell>{source.url || source.file_path || '-'}</TableCell>
                  <TableCell>{source.status}</TableCell>
                  <TableCell>
                    {new Date(source.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <IconButton onClick={() => handleDelete(source.id)} color="error">
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {sources.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No knowledge sources found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default KnowledgeManager;
