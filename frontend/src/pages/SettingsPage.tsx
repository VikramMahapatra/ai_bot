import React from 'react';
import { Box, Typography, Card, CardContent, Grid, Switch, FormControlLabel, TextField, Divider } from '@mui/material';
import AdminLayout from '../components/Layout/AdminLayout';

const SettingsPage: React.FC = () => {
  return (
    <AdminLayout>
      <Box>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', mb: 1 }}>
            Settings
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Configure your AI platform preferences and system settings.
          </Typography>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card sx={{ boxShadow: 2 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  General Settings
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <FormControlLabel 
                    control={<Switch defaultChecked />} 
                    label="Enable email notifications" 
                  />
                  <FormControlLabel 
                    control={<Switch defaultChecked />} 
                    label="Auto-save conversations" 
                  />
                  <FormControlLabel 
                    control={<Switch />} 
                    label="Dark mode" 
                  />
                  <FormControlLabel 
                    control={<Switch defaultChecked />} 
                    label="Show analytics dashboard" 
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ boxShadow: 2 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  AI Configuration
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <FormControlLabel 
                    control={<Switch defaultChecked />} 
                    label="Enable RAG (Retrieval-Augmented Generation)" 
                  />
                  <FormControlLabel 
                    control={<Switch defaultChecked />} 
                    label="Use semantic search" 
                  />
                  <FormControlLabel 
                    control={<Switch defaultChecked />} 
                    label="Auto-vectorize documents" 
                  />
                  <FormControlLabel 
                    control={<Switch />} 
                    label="Enable debugging mode" 
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card sx={{ boxShadow: 2 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Lead Capture Settings
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <FormControlLabel 
                    control={<Switch defaultChecked />} 
                    label="Automatically capture leads after 3 messages" 
                  />
                  <FormControlLabel 
                    control={<Switch defaultChecked />} 
                    label="Require email for lead capture" 
                  />
                  <FormControlLabel 
                    control={<Switch />} 
                    label="Send lead notifications to admin" 
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card sx={{ boxShadow: 2 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Email SMTP Configuration
                </Typography>
                <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
                  Configure SMTP settings for sending conversation transcripts via email
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="SMTP Host"
                      defaultValue="smtp.office365.com"
                      size="small"
                      helperText="e.g., smtp.gmail.com, smtp.office365.com"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="SMTP Port"
                      defaultValue="25"
                      size="small"
                      type="number"
                      helperText="Common: 25, 587, 465"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="SMTP Username"
                      defaultValue="smtp@sales-arm.com"
                      size="small"
                      helperText="Your SMTP authentication username"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="SMTP Password"
                      defaultValue="••••••••••"
                      size="small"
                      type="password"
                      helperText="App password or SMTP password"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Email Sender"
                      defaultValue="noreply@sales-arm.com"
                      size="small"
                      helperText="From email address"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ pt: 1 }}>
                      <FormControlLabel 
                        control={<Switch />} 
                        label="Use SSL/TLS" 
                      />
                    </Box>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 2 }} />

                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  Note: These settings are configured in the backend .env file. Changes here are for display only.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </AdminLayout>
  );
};

export default SettingsPage;
