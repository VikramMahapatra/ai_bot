import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useParams } from 'react-router-dom';
import { superadminService } from '../services/superadminService';
import { CreditEstimatorSharePublicResponse } from '../types';

const CreditEstimatorSharePage: React.FC = () => {
  const theme = useTheme();
  const { token = '' } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [payload, setPayload] = useState<CreditEstimatorSharePublicResponse | null>(null);

  useEffect(() => {
    const loadSharedEstimate = async () => {
      if (!token.trim()) {
        setErrorMessage('Share token is missing.');
        setLoading(false);
        return;
      }
      try {
        const data = await superadminService.getCreditEstimatorSharePublic(token);
        setPayload(data);
      } catch (error: any) {
        setErrorMessage(error?.response?.data?.detail || 'This link is invalid or expired.');
      } finally {
        setLoading(false);
      }
    };
    loadSharedEstimate();
  }, [token]);

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        p: { xs: 1.5, md: 3 },
        background: `linear-gradient(140deg, ${alpha('#dbeafe', 0.92)} 0%, ${alpha(theme.palette.background.default, 0.95)} 100%)`,
      }}
    >
      <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.2, md: 3 },
            mb: 2.4,
            borderRadius: '18px',
            border: `1px solid ${alpha(theme.palette.common.white, 0.62)}`,
            background: alpha('#ffffff', 0.84),
          }}
        >
          <Typography variant="overline" sx={{ letterSpacing: 1.2, fontWeight: 700, color: alpha(theme.palette.primary.dark, 0.74) }}>
            Shared Result
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Credit Estimate
          </Typography>
          {payload ? (
            <Typography variant="body1" sx={{ mt: 0.8, fontWeight: 600 }}>
              Company: {payload.company_name}
            </Typography>
          ) : null}
          <Typography variant="body2" sx={{ color: alpha(theme.palette.text.primary, 0.72), mt: 0.8 }}>
            Result-only view generated from the estimator.
          </Typography>
        </Paper>

        {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

        {payload && (
          <Card
            sx={{
              border: '1px solid',
              borderColor: alpha(theme.palette.primary.main, 0.2),
              borderRadius: '18px',
              background: alpha('#ffffff', 0.92),
            }}
          >
            <CardContent>
              <Grid container spacing={1.4} sx={{ mb: 1.6 }}>
                <Grid item xs={12} md={3}>
                  <Typography variant="caption" color="text.secondary">Subtotal</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>{payload.estimate.subtotal_credits}</Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="caption" color="text.secondary">Buffer</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>{payload.estimate.buffer_credits}</Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="caption" color="text.secondary">Discount</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>{payload.estimate.discount_credits}</Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="caption" color="text.secondary">Final Recommended</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main' }}>
                    {payload.estimate.final_recommended_credits_ceiling}
                  </Typography>
                </Grid>
              </Grid>

              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Shared: {new Date(payload.created_at).toLocaleString()} | Valid till: {new Date(payload.expires_at).toLocaleString()}
              </Typography>

              <TableContainer sx={{ mt: 1.2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Category</TableCell>
                      <TableCell>Module</TableCell>
                      <TableCell>Sub-Module</TableCell>
                      <TableCell>Credits/Unit</TableCell>
                      <TableCell>Quantity</TableCell>
                      <TableCell>Estimated Credits</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {payload.estimate.breakdown.map((line, index) => (
                      <TableRow key={`${line.price_matrix_item_id}-${index}`}>
                        <TableCell>{line.category}</TableCell>
                        <TableCell>{line.module}</TableCell>
                        <TableCell>{line.sub_module || '-'}</TableCell>
                        <TableCell>{line.credits_per_unit}</TableCell>
                        <TableCell>{line.quantity}</TableCell>
                        <TableCell>{line.estimated_credits}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        )}
      </Box>
    </Box>
  );
};

export default CreditEstimatorSharePage;
