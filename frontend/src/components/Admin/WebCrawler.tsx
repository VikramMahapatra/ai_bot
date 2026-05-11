import React, { useState } from 'react';
import {
  Box,
  Stack,
  Chip,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import { knowledgeService } from '../../services/knowledgeService';

interface WebCrawlerProps {
  widgetId: string;
  onStarted?: () => void;
  onCompleted?: () => void;
}

const WebCrawler: React.FC<WebCrawlerProps> = ({ widgetId, onStarted, onCompleted }) => {
  const [url, setUrl] = useState('');
  const [maxPages, setMaxPages] = useState(10);
  const [maxDepth, setMaxDepth] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [errors,setErrors] = useState({
    url: "",
  })

  const handleCrawl = async () => {
    const newErrors = {
      url: ""
    }

    if (!url.trim()) {
      newErrors.url = 'Please enter a URL';
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    onStarted && onStarted();
    setError('');
    setSuccess('');

    try {
      const result = await knowledgeService.crawlWebsite({ widget_id: widgetId, url, max_pages: maxPages, max_depth: maxDepth });
      setSuccess(result.message || 'Website crawled successfully!');
      setUrl('');
      onCompleted && onCompleted();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to crawl website');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Stack spacing={2}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
            Website Crawl
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Crawl your website and convert key pages into searchable knowledge chunks.
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip label="Best for FAQs" size="small" variant="outlined" />
            <Chip label="Supports incremental updates" size="small" variant="outlined" />
          </Stack>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}
        {success && <Alert severity="success">{success}</Alert>}

        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            border: '1px solid rgba(148,163,184,0.25)',
            bgcolor: 'rgba(248,250,252,0.8)',
          }}
        >
          <Stack spacing={2}>
            <TextField
              required
              label="Website URL"
              value={url}
              error={!!errors.url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              fullWidth
              helperText={errors.url ? errors.url : "Use the main website or documentation URL you want the agent to learn from."}
            />

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
              <TextField
                label="Max Pages"
                type="number"
                value={maxPages}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setMaxPages(Number.isFinite(value) && value > 0 ? value : 1);
                }}
                inputProps={{ min: 1 }}
              />
              <TextField
                label="Max Depth"
                type="number"
                value={maxDepth}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setMaxDepth(Number.isFinite(value) && value > 0 ? value : 1);
                }}
                inputProps={{ min: 1 }}
              />
            </Box>

            <Button
              variant="contained"
              onClick={handleCrawl}
              disabled={loading || !widgetId}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : null}
              sx={{ alignSelf: 'flex-start', px: 2.5 }}
            >
              {loading ? 'Crawling...' : 'Start Crawl'}
            </Button>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
};

export default WebCrawler;
