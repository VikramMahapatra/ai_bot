import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Avatar,
  TableContainer,
} from '@mui/material';
import SuperAdminLayout from '../components/Layout/SuperAdminLayout';
import { superadminService } from '../services/superadminService';
import BusinessIcon from '@mui/icons-material/Business';
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';
import TokenIcon from '@mui/icons-material/Token';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import DescriptionIcon from '@mui/icons-material/Description';
import PublicIcon from '@mui/icons-material/Public';

const SuperAdminAnalyticsPage: React.FC = () => {
  const [overview, setOverview] = useState<any>(null);
  const [byOrg, setByOrg] = useState<any[]>([]);

  useEffect(() => {
    const fetchOverview = async () => {
      const data = await superadminService.getAnalyticsOverview();
      setOverview(data);
    };
    const fetchByOrg = async () => {
      const data = await superadminService.getAnalyticsByOrg();
      setByOrg(data || []);
    };
    fetchOverview();
    fetchByOrg();
  }, []);

  return (
    <SuperAdminLayout>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        Analytics (All Organizations)
      </Typography>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        {[
          { label: 'Organizations', value: overview?.total_organizations || 0, icon: <BusinessIcon />, color: '#2563eb' },
          { label: 'Conversations', value: overview?.total_conversations || 0, icon: <ChatBubbleIcon />, color: '#0f766e' },
          { label: 'Tokens', value: overview?.total_tokens || 0, icon: <TokenIcon />, color: '#7c3aed' },
          { label: 'Leads', value: overview?.total_leads || 0, icon: <PeopleAltIcon />, color: '#b45309' },
          { label: 'Documents', value: overview?.total_documents || 0, icon: <DescriptionIcon />, color: '#1d4ed8' },
          { label: 'Crawl Pages', value: overview?.total_crawl_pages || 0, icon: <PublicIcon />, color: '#0f766e' },
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

      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Per-Organization Usage (Current Month)
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Organization</TableCell>
                  <TableCell>Conversations</TableCell>
                  <TableCell>Tokens</TableCell>
                  <TableCell>Leads</TableCell>
                  <TableCell>Documents</TableCell>
                  <TableCell>Crawl Pages</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {byOrg.map((row) => (
                  <TableRow key={row.organization?.id}>
                    <TableCell>{row.organization?.name}</TableCell>
                    <TableCell>{row.usage?.conversations_count || 0}</TableCell>
                    <TableCell>{row.usage?.tokens_used || 0}</TableCell>
                    <TableCell>{row.usage?.leads_count || 0}</TableCell>
                    <TableCell>{row.usage?.documents_count || 0}</TableCell>
                    <TableCell>{row.usage?.crawl_pages_count || 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </SuperAdminLayout>
  );
};

export default SuperAdminAnalyticsPage;
