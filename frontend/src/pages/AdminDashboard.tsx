import React, { useState } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import AdminLayout from '../components/Layout/AdminLayout';
import KnowledgeManager from '../components/Admin/KnowledgeManager';
import LeadManager from '../components/Admin/LeadManager';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

const AdminDashboard: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);

  return (
    <AdminLayout>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab label="Knowledge Management" />
          <Tab label="Lead Management" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <KnowledgeManager />
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <LeadManager />
      </TabPanel>
    </AdminLayout>
  );
};

export default AdminDashboard;
