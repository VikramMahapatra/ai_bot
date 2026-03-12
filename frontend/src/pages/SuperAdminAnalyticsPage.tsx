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
  Paper,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import SuperAdminLayout from '../components/Layout/SuperAdminLayout';
import { superadminService } from '../services/superadminService';
import BusinessIcon from '@mui/icons-material/Business';
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';
import TokenIcon from '@mui/icons-material/Token';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import DescriptionIcon from '@mui/icons-material/Description';
import PublicIcon from '@mui/icons-material/Public';

const SuperAdminAnalyticsPage: React.FC = () => {
  const theme = useTheme();
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
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 2.6 },
          mb: 3,
          borderRadius: '22px',
          border: `1px solid ${alpha(theme.palette.common.white, 0.65)}`,
          background: `linear-gradient(125deg, ${alpha('#deebfb', 0.92)} 0%, ${alpha(
            theme.palette.background.paper,
            0.84
          )} 72%, ${alpha('#a9bfdc', 0.98)} 100%)`,
          boxShadow: `0 18px 36px ${alpha(theme.palette.primary.dark, 0.24)}`,
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(115deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.06) 34%, rgba(255,255,255,0) 62%)',
              pointerEvents: 'none',
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              top: '-24%',
              right: '-6%',
              width: '42%',
              height: '150%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0) 72%)',
              pointerEvents: 'none',
            },
            '& > *': {
              position: 'relative',
              zIndex: 1,
            },
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 800, color: 'primary.main' }}>
          Analytics (All Organizations)
        </Typography>
      </Paper>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        {[
          { label: 'Organizations', value: overview?.total_organizations || 0, icon: <BusinessIcon />, color: '#2f6bff' },
          { label: 'Conversations', value: overview?.total_conversations || 0, icon: <ChatBubbleIcon />, color: '#2d8ef0' },
          { label: 'Tokens', value: overview?.total_tokens || 0, icon: <TokenIcon />, color: '#5e72ff' },
          { label: 'Leads', value: overview?.total_leads || 0, icon: <PeopleAltIcon />, color: '#369fff' },
          { label: 'Documents', value: overview?.total_documents || 0, icon: <DescriptionIcon />, color: '#2458d8' },
          { label: 'Crawl Pages', value: overview?.total_crawl_pages || 0, icon: <PublicIcon />, color: '#2d8ef0' },
        ].map((item) => (
          <Grid item xs={12} sm={6} md={4} key={item.label}>
            <Card sx={{
              border: '1px solid',
              borderColor: alpha(theme.palette.primary.main, 0.16),
              borderRadius: 3,
              background: 'linear-gradient(135deg, rgba(53,108,255,0.1) 0%, rgba(255,255,255,1) 60%)',
              '&:hover': { boxShadow: 3, transform: 'translateY(-2px)' },
              transition: 'all 0.2s ease',
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

      <Card sx={{ mt: 2, borderRadius: 3, border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}` }}>
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


