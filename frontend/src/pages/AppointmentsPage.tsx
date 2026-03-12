import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import EventIcon from '@mui/icons-material/Event';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AdminLayout from '../components/Layout/AdminLayout';
import { dashboardService } from '../services/dashboardService';
import { appointmentService, AppointmentItem } from '../services/appointmentService';

const statusColor = (status: AppointmentItem['status']) => {
  if (status === 'booked') return 'primary';
  if (status === 'completed') return 'success';
  if (status === 'cancelled') return 'default';
  return 'warning';
};

const formatDateTime = (value?: string) => {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString();
};

const toDateKey = (value?: string) => {
  if (!value) return 'Unknown';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return 'Unknown';
  return dt.toLocaleDateString();
};

const AppointmentsPage: React.FC = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState(0);

  const [widgets, setWidgets] = useState<{ widget_id: string; name: string }[]>([]);
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);

  const [widgetId, setWidgetId] = useState('');
  const [status, setStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [upcomingOnly, setUpcomingOnly] = useState(true);

  const loadWidgets = async () => {
    try {
      const data = await dashboardService.getWidgets();
      const widgetItems = Array.isArray(data?.widgets) ? data.widgets : [];
      setWidgets(widgetItems.map((item: any) => ({ widget_id: item.widget_id, name: item.name })));
    } catch {
      setWidgets([]);
    }
  };

  const loadAppointments = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      const rows = await appointmentService.list({
        widget_id: widgetId || undefined,
        status: status || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        upcoming_only: upcomingOnly,
      });
      setAppointments(rows);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWidgets();
  }, []);

  useEffect(() => {
    loadAppointments();
  }, []);

  const updateStatus = async (id: number, nextStatus: AppointmentItem['status']) => {
    try {
      setSuccess('');
      await appointmentService.updateStatus(id, nextStatus);
      setSuccess('Appointment status updated successfully.');
      setAppointments((prev) => prev.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)));
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to update appointment status');
    }
  };

  const groupedByDate = useMemo(() => {
    const groups: Record<string, AppointmentItem[]> = {};
    appointments.forEach((item) => {
      const key = toDateKey(item.appointment_at);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    return Object.entries(groups)
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([date, rows]) => ({
        date,
        rows: rows.sort((x, y) => new Date(x.appointment_at).getTime() - new Date(y.appointment_at).getTime()),
      }));
  }, [appointments]);

  return (
    <AdminLayout>
      <Stack spacing={3}>
        <Paper
          sx={{
            p: { xs: 2, md: 2.6 },
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
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', mb: 1 }}>
            Appointments
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Track all booked appointments and manage their status.
          </Typography>
        </Box>
        </Paper>

        {error && <Alert severity="error">{error}</Alert>}
        {success && <Alert severity="success">{success}</Alert>}

        <Paper sx={{ p: 2.5, borderRadius: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Agent</InputLabel>
                <Select value={widgetId} label="Agent" onChange={(e) => setWidgetId(e.target.value)}>
                  <MenuItem value="">All</MenuItem>
                  {widgets.map((widget) => (
                    <MenuItem key={widget.widget_id} value={widget.widget_id}>
                      {widget.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select value={status} label="Status" onChange={(e) => setStatus(e.target.value)}>
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="booked">Booked</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                  <MenuItem value="no_show">No Show</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                label="Start"
                type="date"
                size="small"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                label="End"
                type="date"
                size="small"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Stack direction="row" spacing={1}>
                <Button variant={upcomingOnly ? 'contained' : 'outlined'} onClick={() => setUpcomingOnly((prev) => !prev)}>
                  {upcomingOnly ? 'Upcoming Only' : 'All Appointments'}
                </Button>
                <Button variant="outlined" onClick={loadAppointments} disabled={loading}>
                  {loading ? 'Loading...' : 'Apply'}
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        <Paper sx={{ p: 2.5, borderRadius: 3 }}>
          <Tabs value={tab} onChange={(_, value) => setTab(value)}>
            <Tab icon={<EventIcon />} iconPosition="start" label="List View" />
            <Tab icon={<CalendarMonthIcon />} iconPosition="start" label="Calendar View" />
          </Tabs>

          {tab === 0 && (
            <TableContainer sx={{ mt: 2 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Agent</TableCell>
                    <TableCell>Date/Time</TableCell>
                    <TableCell>Timezone</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {appointments.length ? (
                    appointments.map((item) => (
                      <TableRow key={item.id} hover>
                        <TableCell>
                          <Typography sx={{ fontWeight: 600 }}>{item.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{item.email || item.phone || '-'}</Typography>
                        </TableCell>
                        <TableCell>{item.widget_name}</TableCell>
                        <TableCell>{formatDateTime(item.appointment_at)}</TableCell>
                        <TableCell>{item.timezone || '-'}</TableCell>
                        <TableCell>
                          <Chip size="small" label={item.status} color={statusColor(item.status)} variant="outlined" />
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1}>
                            <Button size="small" onClick={() => updateStatus(item.id, 'completed')} disabled={item.status === 'completed'}>
                              Complete
                            </Button>
                            <Button size="small" color="inherit" onClick={() => updateStatus(item.id, 'cancelled')} disabled={item.status === 'cancelled'}>
                              Cancel
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} align="center">No appointments found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {tab === 1 && (
            <Stack spacing={2} sx={{ mt: 2 }}>
              {groupedByDate.length ? (
                groupedByDate.map((group) => (
                  <Paper key={group.date} variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>{group.date}</Typography>
                    <Stack spacing={1}>
                      {group.rows.map((item) => (
                        <Box key={item.id} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'center' }}>
                          <Box>
                            <Typography sx={{ fontWeight: 600 }}>{item.name}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {new Date(item.appointment_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {item.widget_name}
                            </Typography>
                          </Box>
                          <Chip size="small" label={item.status} color={statusColor(item.status)} variant="outlined" />
                        </Box>
                      ))}
                    </Stack>
                  </Paper>
                ))
              ) : (
                <Typography color="text.secondary">No appointments found for selected filters.</Typography>
              )}
            </Stack>
          )}
        </Paper>
      </Stack>
    </AdminLayout>
  );
};

export default AppointmentsPage;


