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
} from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import LayersIcon from '@mui/icons-material/Layers';
import { knowledgeService } from '../../services/knowledgeService';

interface VectorizedSourceSummary {
  source_id: string;
  source_type: string;
  name: string;
  url: string | null;
  chunks: number;
}

interface VectorizedData {
  user_id: number;
  total_chunks: number;
  total_sources: number;
  source_summary: VectorizedSourceSummary[];
  include_documents: boolean;
  documents: Array<unknown>;
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
      const result = await knowledgeService.getVectorizedData(widgetId, { includeDocuments: false });
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

  const uniqueSources = data?.total_sources || 0;

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0
      }}
    >
      <Stack spacing={2} sx={{ flex: 1, minHeight: 0 }}>

        {/* Optional info */}
        <Typography variant="body2" color="text.secondary">
          Showing vector index counts and source-level chunk totals.
        </Typography>

        {/* TABLE SECTION */}
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <TableContainer
            sx={{
              height: '100%',
              overflowY: 'auto',
              border: '1px solid #e2e8f0',
              borderRadius: 2
            }}
          >
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Source</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Chunks</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {data?.source_summary?.map((source) => (
                  <TableRow
                    key={`${source.source_id}-${source.source_type}`}
                    hover
                  >
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 220 }}>
                        {source.name || 'Unknown'}
                      </Typography>

                      {source.url && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          noWrap
                          sx={{ maxWidth: 220, display: 'block' }}
                        >
                          {source.url}
                        </Typography>
                      )}
                    </TableCell>

                    <TableCell>
                      <Chip
                        label={source.source_type}
                        size="small"
                        color={getSourceTypeColor(source.source_type)}
                      />
                    </TableCell>

                    <TableCell>{source.chunks}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Stack>
    </Box>
  );
};

export default VectorizedDataViewer;
