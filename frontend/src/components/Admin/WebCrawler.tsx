import React, { useState } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import { knowledgeService } from '../../services/knowledgeService';

interface WebCrawlerProps {
  onStarted?: () => void;
  onCompleted?: () => void;
}

const WebCrawler: React.FC<WebCrawlerProps> = ({ onStarted, onCompleted }) => {
  const [url, setUrl] = useState('');
  const [maxPages, setMaxPages] = useState(10);
  const [maxDepth, setMaxDepth] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleCrawl = async () => {
    if (!url) {
      setError('Please enter a URL');
      return;
    }

    setLoading(true);
    onStarted && onStarted();
    setError('');
    setSuccess('');

    try {
      await knowledgeService.crawlWebsite({ url, max_pages: maxPages, max_depth: maxDepth });
      setSuccess('Website crawled successfully!');
      setUrl('');
      onCompleted && onCompleted();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to crawl website');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Web Crawler
      </Typography>
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Website URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          fullWidth
        />
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="Max Pages"
            type="number"
            value={maxPages}
            onChange={(e) => setMaxPages(parseInt(e.target.value))}
            sx={{ flex: 1 }}
          />
          <TextField
            label="Max Depth"
            type="number"
            value={maxDepth}
            onChange={(e) => setMaxDepth(parseInt(e.target.value))}
            sx={{ flex: 1 }}
          />
        </Box>

        <Button
          variant="contained"
          onClick={handleCrawl}
          disabled={loading}
          startIcon={loading && <CircularProgress size={20} />}
        >
          {loading ? 'Crawling...' : 'Start Crawling'}
        </Button>
      </Box>
    </Paper>
  );
};

export default WebCrawler;
