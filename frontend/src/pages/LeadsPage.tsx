import React from 'react';
import { Box, Typography } from '@mui/material';
import AdminLayout from '../components/Layout/AdminLayout';
import LeadManager from '../components/Admin/LeadManager';
import DashboardCards from '../components/Admin/DashboardCards';

const LeadsPage: React.FC = () => {
  return (
    <AdminLayout>
      <Box>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', mb: 1 }}>
            Lead Management
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            View and manage all captured leads from your AI conversations.
          </Typography>
        </Box>
        <LeadManager />
      </Box>
    </AdminLayout>
  );
};

export default LeadsPage;
