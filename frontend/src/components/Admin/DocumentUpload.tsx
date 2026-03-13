import React, { useState } from 'react';
import {
  Box,
  Stack,
  Button,
  Typography,
  Alert,
  LinearProgress,
  Chip,
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
    <Box>
      <Stack spacing={2}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
            Document Upload
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Add files that contain product policies, manuals, and FAQs.
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip label="PDF" size="small" variant="outlined" />
            <Chip label="DOCX" size="small" variant="outlined" />
            <Chip label="XLSX" size="small" variant="outlined" />
          </Stack>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}
        {success && <Alert severity="success">{success}</Alert>}

        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            border: '1px dashed rgba(71,85,105,0.35)',
            bgcolor: 'rgba(248,250,252,0.8)',
          }}
        >
          <Stack spacing={1.5}>
            <Button
              variant="contained"
              component="label"
              startIcon={<CloudUploadIcon />}
              disabled={uploading || !widgetId}
              sx={{ alignSelf: 'flex-start', px: 2.5 }}
            >
              Select Document Files
              <input
                type="file"
                hidden
                multiple
                accept=".pdf,.docx,.doc,.xlsx,.xls"
                onChange={handleFileUpload}
              />
            </Button>

            <Typography variant="caption" color="text.secondary">
              You can select multiple files in one go. Files are embedded automatically after upload.
            </Typography>

            {uploading && <LinearProgress sx={{ mt: 0.5, borderRadius: 1 }} />}
          </Stack>
        </Box>

        {uploadedFiles.length > 0 && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Recently Uploaded
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {uploadedFiles.map((file, index) => (
                <Chip key={`${file}-${index}`} label={file} variant="outlined" />
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    </Box>
  );
};

export default DocumentUpload;
