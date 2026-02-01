import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Alert,
  Chip,
  Grid,
  Card,
  CardContent,
  Avatar,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import BusinessIcon from '@mui/icons-material/Business';
import { leadService } from '../../services/leadService';
import { Lead } from '../../types';

const LeadManager: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLeads = async () => {
    try {
      const data = await leadService.listLeads();
      setLeads(data);
    } catch (err) {
      setError('Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, []);

  const handleExport = async () => {
    try {
      const blob = await leadService.exportLeads();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'leads.csv';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to export leads');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
            Total Leads: {leads.length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage and export your captured leads
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={handleExport}
          disabled={leads.length === 0}
          size="large"
        >
          Export to CSV
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Lead Cards for Recent/Featured Leads */}
      {leads.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {leads.slice(0, 3).map((lead) => (
            <Grid item xs={12} md={4} key={lead.id}>
              <Card sx={{ boxShadow: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                      <PersonIcon />
                    </Avatar>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {lead.name || 'Anonymous'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {lead.email && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <EmailIcon fontSize="small" color="action" />
                        <Typography variant="body2">{lead.email}</Typography>
                      </Box>
                    )}
                    {lead.phone && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PhoneIcon fontSize="small" color="action" />
                        <Typography variant="body2">{lead.phone}</Typography>
                      </Box>
                    )}
                    {lead.company && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <BusinessIcon fontSize="small" color="action" />
                        <Typography variant="body2">{lead.company}</Typography>
                      </Box>
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                      {new Date(lead.created_at).toLocaleString()}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* All Leads Table */}
      <Paper sx={{ p: 3, boxShadow: 2 }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          All Leads
        </Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Phone</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Company</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Session ID</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id} hover>
                  <TableCell>{lead.name || '-'}</TableCell>
                  <TableCell>{lead.email || '-'}</TableCell>
                  <TableCell>{lead.phone || '-'}</TableCell>
                  <TableCell>{lead.company || '-'}</TableCell>
                  <TableCell>
                    <Chip label={lead.session_id.substring(0, 10) + '...'} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    {new Date(lead.created_at).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
              {leads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="text.secondary">No leads found</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default LeadManager;
