import React, { useEffect, useState } from 'react';
import { Box, Grid, Card, CardContent, Typography, CircularProgress, Avatar } from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';
import TokenIcon from '@mui/icons-material/Token';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import DescriptionIcon from '@mui/icons-material/Description';
import PublicIcon from '@mui/icons-material/Public';
import SuperAdminLayout from '../components/Layout/SuperAdminLayout';
import { superadminService } from '../services/superadminService';

const SuperAdminDashboardPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const data = await superadminService.getAnalyticsOverview();
        setOverview(data);
      } finally {
        setLoading(false);
      }
    };
    fetchOverview();
  }, []);

  return (
    <SuperAdminLayout>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        Super Admin Overview
      </Typography>

      {loading ? (
        <CircularProgress />
      ) : (
        <Grid container spacing={3}>
          {[
            { label: 'Organizations', value: overview?.total_organizations || 0, icon: <BusinessIcon />, color: '#2563eb' },
            { label: 'Conversations', value: overview?.total_conversations || 0, icon: <ChatBubbleIcon />, color: '#0f766e' },
            { label: 'Tokens Used', value: overview?.total_tokens || 0, icon: <TokenIcon />, color: '#7c3aed' },
            { label: 'Leads Captured', value: overview?.total_leads || 0, icon: <PeopleAltIcon />, color: '#b45309' },
            { label: 'Documents Crawled', value: overview?.total_documents || 0, icon: <DescriptionIcon />, color: '#1d4ed8' },
            { label: 'Pages Crawled', value: overview?.total_crawl_pages || 0, icon: <PublicIcon />, color: '#0f766e' },
          ].map((item) => (
            <Grid item xs={12} sm={6} md={4} key={item.label}>
              <Card sx={{
                border: '1px solid',
                borderColor: 'divider',
                background: 'linear-gradient(135deg, rgba(38,155,159,0.08) 0%, rgba(255,255,255,1) 60%)',
                '&:hover': { boxShadow: 3 },
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {item.label}
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>
                        {item.value}
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: item.color, width: 44, height: 44 }}>
                      {item.icon}
                    </Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </SuperAdminLayout>
  );
};

export default SuperAdminDashboardPage;
