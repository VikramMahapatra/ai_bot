import React, { useState } from 'react';
import {
  Box,
  Paper,
  Button,
  Typography,
  Alert,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { knowledgeService } from '../../services/knowledgeService';

interface DocumentUploadProps {
  widgetId: string;
  onStarted?: () => void;
  onCompleted?: () => void;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({ widgetId, onStarted, onCompleted }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    onStarted && onStarted();
    setError('');
    setSuccess('');

    try {
      const uploadPromises = Array.from(files).map((file) =>
        knowledgeService.uploadDocument(file, widgetId)
      );
      
      await Promise.all(uploadPromises);
      
      setSuccess(`Successfully uploaded ${files.length} file(s)`);
      setUploadedFiles(Array.from(files).map((f) => f.name));
      onCompleted && onCompleted();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to upload documents');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Document Upload
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Box sx={{ mb: 2 }}>
        <Button
          variant="contained"
          component="label"
          startIcon={<CloudUploadIcon />}
          disabled={uploading || !widgetId}
        >
          Upload Documents
          <input
            type="file"
            hidden
            multiple
            accept=".pdf,.docx,.doc,.xlsx,.xls"
            onChange={handleFileUpload}
          />
        </Button>
        {uploading && <LinearProgress sx={{ mt: 2 }} />}
      </Box>

      <Typography variant="body2" color="text.secondary" gutterBottom>
        Supported formats: PDF, DOCX, XLSX
      </Typography>

      {uploadedFiles.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2">Recently uploaded:</Typography>
          <List dense>
            {uploadedFiles.map((file, index) => (
              <ListItem key={index}>
                <ListItemText primary={file} />
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Paper>
  );
};

export default DocumentUpload;
