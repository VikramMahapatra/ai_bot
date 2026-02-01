import React from 'react';
import { Box, Typography } from '@mui/material';
import AdminLayout from '../components/Layout/AdminLayout';
import KnowledgeManager from '../components/Admin/KnowledgeManager';

const KnowledgePage: React.FC = () => {
  return (
    <AdminLayout>
      <Box>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', mb: 1 }}>
            Knowledge Base
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Manage your knowledge sources, upload documents, and crawl websites to train your AI.
          </Typography>
        </Box>
        <KnowledgeManager />
      </Box>
    </AdminLayout>
  );
};

export default KnowledgePage;
