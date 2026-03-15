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
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import EventIcon from '@mui/icons-material/Event';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TodayIcon from '@mui/icons-material/Today';
import ViewDayIcon from '@mui/icons-material/ViewDay';
import ViewWeekIcon from '@mui/icons-material/ViewWeek';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import PersonOffOutlinedIcon from '@mui/icons-material/PersonOffOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditCalendarOutlinedIcon from '@mui/icons-material/EditCalendarOutlined';
import AdminLayout from '../components/Layout/AdminLayout';
import { dashboardService } from '../services/dashboardService';
import { appointmentService, AppointmentItem } from '../services/appointmentService';
import { organizationService } from '../services/organizationService';

const DEFAULT_MEET_LINK = 'https://meet.google.com/new';

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

const toIsoDateKey = (value?: string | Date) => {
  if (!value) return '';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const startOfDay = (value: Date) => {
  const dt = new Date(value);
  dt.setHours(0, 0, 0, 0);
  return dt;
};

const addDays = (value: Date, delta: number) => {
  const dt = new Date(value);
  dt.setDate(dt.getDate() + delta);
  return dt;
};

const startOfWeek = (value: Date) => {
  const dt = startOfDay(value);
  const mondayOffset = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - mondayOffset);
  return dt;
};

const isSameDay = (a: Date, b: Date) => toIsoDateKey(a) === toIsoDateKey(b);

const formatTime = (value?: string) => {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const toDateTimeLocalValue = (value?: string | Date) => {
  if (!value) return '';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  const hours = String(dt.getHours()).padStart(2, '0');
  const minutes = String(dt.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const combineDateWithSourceTime = (targetDate: Date, sourceDateValue?: string) => {
  const next = new Date(targetDate);
  const source = sourceDateValue ? new Date(sourceDateValue) : new Date();
  if (!Number.isNaN(source.getTime())) {
    next.setHours(source.getHours(), source.getMinutes(), 0, 0);
  }
  return next;
};

type CalendarViewMode = 'day' | 'week' | 'month';

const statusLegend: Array<{ value: AppointmentItem['status']; label: string }> = [
  { value: 'booked', label: 'Booked' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No Show' },
];

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
  const [calendarView, setCalendarView] = useState<CalendarViewMode>('month');
  const [calendarCursor, setCalendarCursor] = useState<Date>(startOfDay(new Date()));
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentItem | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentItem | null>(null);
  const [rescheduleDateTime, setRescheduleDateTime] = useState('');
  const [rescheduleTimezone, setRescheduleTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [rescheduleMeetLink, setRescheduleMeetLink] = useState('https://meet.google.com/new');
  const [rescheduleNotes, setRescheduleNotes] = useState('');
  const [rescheduling, setRescheduling] = useState(false);
  const [draggedAppointmentId, setDraggedAppointmentId] = useState<number | null>(null);
  const [defaultMeetLink, setDefaultMeetLink] = useState(DEFAULT_MEET_LINK);
  const [savingDefaultMeetLink, setSavingDefaultMeetLink] = useState(false);

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

  const loadMeetingSettings = async () => {
    try {
      const meetingSettings = await organizationService.getMeetingSettings();
      const nextDefault = (meetingSettings?.default_meet_link || '').trim() || DEFAULT_MEET_LINK;
      setDefaultMeetLink(nextDefault);
    } catch {
      setDefaultMeetLink(DEFAULT_MEET_LINK);
    }
  };

  useEffect(() => {
    loadWidgets();
  }, []);

  useEffect(() => {
    loadAppointments();
  }, []);

  useEffect(() => {
    loadMeetingSettings();
  }, []);

  const updateStatus = async (id: number, nextStatus: AppointmentItem['status']) => {
    try {
      setSuccess('');
      await appointmentService.updateStatus(id, nextStatus);
      setSuccess('Appointment status updated successfully.');
      setAppointments((prev) => prev.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)));
      setSelectedAppointment((prev) => (prev && prev.id === id ? { ...prev, status: nextStatus } : prev));
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to update appointment status');
    }
  };

  const openRescheduleDialog = (item: AppointmentItem, presetDate?: Date) => {
    const targetDate = presetDate || new Date(item.appointment_at);
    setSelectedAppointment(null);
    setRescheduleTarget(item);
    setRescheduleDateTime(toDateTimeLocalValue(targetDate));
    setRescheduleTimezone(item.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    setRescheduleMeetLink(defaultMeetLink || DEFAULT_MEET_LINK);
    setRescheduleNotes(item.notes || '');
  };

  const closeRescheduleDialog = () => {
    setRescheduleTarget(null);
    setRescheduleDateTime('');
    setRescheduleNotes('');
    setRescheduleMeetLink(defaultMeetLink || DEFAULT_MEET_LINK);
  };

  const saveDefaultMeetLink = async () => {
    const nextLink = (defaultMeetLink || '').trim();
    if (!nextLink) {
      setError('Default Meet URL cannot be empty.');
      return;
    }

    try {
      setSavingDefaultMeetLink(true);
      setError('');
      const response = await organizationService.updateMeetingSettings(nextLink);
      const savedLink = (response?.default_meet_link || '').trim() || DEFAULT_MEET_LINK;
      setDefaultMeetLink(savedLink);
      setSuccess('Organization default Meet URL updated.');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to update organization default Meet URL');
    } finally {
      setSavingDefaultMeetLink(false);
    }
  };

  const submitReschedule = async () => {
    if (!rescheduleTarget) return;
    if (!rescheduleDateTime) {
      setError('Please select a valid date and time to reschedule.');
      return;
    }

    try {
      setRescheduling(true);
      setError('');
      const nextDate = new Date(rescheduleDateTime);
      if (Number.isNaN(nextDate.getTime())) {
        setError('Invalid date/time selected for reschedule.');
        return;
      }

      const response = await appointmentService.reschedule(rescheduleTarget.id, {
        appointment_at: nextDate.toISOString(),
        timezone: rescheduleTimezone || undefined,
        notes: rescheduleNotes || undefined,
        meeting_link: (rescheduleMeetLink || '').trim() || defaultMeetLink || DEFAULT_MEET_LINK,
      });

      setAppointments((prev) =>
        prev.map((item) =>
          item.id === rescheduleTarget.id
            ? {
                ...item,
                appointment_at: response.appointment_at,
                timezone: response.timezone || item.timezone,
                status: response.status,
                notes: rescheduleNotes || item.notes,
              }
            : item
        )
      );

      setSelectedAppointment((prev) =>
        prev && prev.id === rescheduleTarget.id
          ? {
              ...prev,
              appointment_at: response.appointment_at,
              timezone: response.timezone || prev.timezone,
              status: response.status,
              notes: rescheduleNotes || prev.notes,
            }
          : prev
      );

      if (response?.notification?.sent) {
        setSuccess(
          `Appointment rescheduled and notifications sent to ${response.notification.recipient_count} recipient(s).`
        );
      } else if (Array.isArray(response?.notification?.errors) && response.notification.errors.length) {
        setSuccess('Appointment rescheduled, but some notification emails failed to send.');
      } else {
        setSuccess('Appointment rescheduled successfully.');
      }

      closeRescheduleDialog();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to reschedule appointment');
    } finally {
      setRescheduling(false);
    }
  };

  const handleCalendarDrop = (dropDate: Date) => {
    if (!draggedAppointmentId) return;
    const dragged = appointments.find((item) => item.id === draggedAppointmentId);
    setDraggedAppointmentId(null);
    if (!dragged) return;

    const nextDate = combineDateWithSourceTime(dropDate, dragged.appointment_at);
    openRescheduleDialog(dragged, nextDate);
  };

  const sortedAppointments = useMemo(() => {
    return [...appointments].sort((a, b) => new Date(a.appointment_at).getTime() - new Date(b.appointment_at).getTime());
  }, [appointments]);

  const appointmentsByDay = useMemo(() => {
    const grouped = new Map<string, AppointmentItem[]>();
    sortedAppointments.forEach((item) => {
      const key = toIsoDateKey(item.appointment_at);
      if (!key) return;
      const existing = grouped.get(key) || [];
      existing.push(item);
      grouped.set(key, existing);
    });
    return grouped;
  }, [sortedAppointments]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(calendarCursor);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [calendarCursor]);

  const monthGridDays = useMemo(() => {
    const firstOfMonth = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1);
    const gridStart = startOfWeek(firstOfMonth);
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }, [calendarCursor]);

  const currentDayItems = useMemo(() => {
    return appointmentsByDay.get(toIsoDateKey(calendarCursor)) || [];
  }, [appointmentsByDay, calendarCursor]);

  const calendarTitle = useMemo(() => {
    if (calendarView === 'day') {
      return calendarCursor.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }

    if (calendarView === 'week') {
      const start = weekDays[0];
      const end = weekDays[6];
      const startText = start.toLocaleDateString([], { month: 'short', day: 'numeric' });
      const endText = end.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      return `${startText} - ${endText}`;
    }

    return calendarCursor.toLocaleDateString([], { month: 'long', year: 'numeric' });
  }, [calendarCursor, calendarView, weekDays]);

  const handleCalendarMove = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setCalendarCursor(startOfDay(new Date()));
      return;
    }

    const multiplier = direction === 'next' ? 1 : -1;
    setCalendarCursor((prev) => {
      if (calendarView === 'day') return addDays(prev, multiplier);
      if (calendarView === 'week') return addDays(prev, 7 * multiplier);

      const next = new Date(prev);
      next.setMonth(next.getMonth() + multiplier);
      return next;
    });
  };

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

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            alignItems={{ xs: 'stretch', md: 'center' }}
            sx={{ mt: 2 }}
          >
            <TextField
              label="Org Default Meet URL"
              size="small"
              value={defaultMeetLink}
              onChange={(event) => setDefaultMeetLink(event.target.value)}
              fullWidth
            />
            <Button
              variant="outlined"
              onClick={saveDefaultMeetLink}
              disabled={savingDefaultMeetLink}
              sx={{ whiteSpace: 'nowrap' }}
            >
              {savingDefaultMeetLink ? 'Saving...' : 'Save Default URL'}
            </Button>
          </Stack>
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
                  {sortedAppointments.length ? (
                    sortedAppointments.map((item) => (
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
                          <Stack direction="row" spacing={0.8} flexWrap="nowrap" sx={{ whiteSpace: 'nowrap' }}>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<VisibilityOutlinedIcon fontSize="small" />}
                              onClick={() => setSelectedAppointment(item)}
                              sx={{ whiteSpace: 'nowrap', minWidth: 0 }}
                            >
                              View
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<EditCalendarOutlinedIcon fontSize="small" />}
                              onClick={() => openRescheduleDialog(item)}
                              sx={{ whiteSpace: 'nowrap', minWidth: 0 }}
                            >
                              Reschedule
                            </Button>
                            <Button
                              size="small"
                              onClick={() => updateStatus(item.id, 'completed')}
                              disabled={item.status === 'completed'}
                              sx={{ whiteSpace: 'nowrap', minWidth: 0 }}
                            >
                              Complete
                            </Button>
                            <Button
                              size="small"
                              color="inherit"
                              onClick={() => updateStatus(item.id, 'cancelled')}
                              disabled={item.status === 'cancelled'}
                              sx={{ whiteSpace: 'nowrap', minWidth: 0 }}
                            >
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
              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2.5 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between" spacing={1.5}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <IconButton onClick={() => handleCalendarMove('prev')} size="small" aria-label="Previous period">
                      <ChevronLeftIcon />
                    </IconButton>
                    <Button size="small" variant="outlined" startIcon={<TodayIcon />} onClick={() => handleCalendarMove('today')}>
                      Today
                    </Button>
                    <IconButton onClick={() => handleCalendarMove('next')} size="small" aria-label="Next period">
                      <ChevronRightIcon />
                    </IconButton>
                    <Typography sx={{ ml: 1, fontWeight: 700 }}>{calendarTitle}</Typography>
                  </Stack>

                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={calendarView}
                    onChange={(_, nextValue: CalendarViewMode | null) => {
                      if (nextValue) setCalendarView(nextValue);
                    }}
                  >
                    <ToggleButton value="day" aria-label="Day view">
                      <ViewDayIcon fontSize="small" sx={{ mr: 0.8 }} /> Day
                    </ToggleButton>
                    <ToggleButton value="week" aria-label="Week view">
                      <ViewWeekIcon fontSize="small" sx={{ mr: 0.8 }} /> Week
                    </ToggleButton>
                    <ToggleButton value="month" aria-label="Month view">
                      <ViewModuleIcon fontSize="small" sx={{ mr: 0.8 }} /> Month
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Stack>

                <Stack direction="row" spacing={1} sx={{ mt: 1.2 }} flexWrap="wrap" useFlexGap>
                  {statusLegend.map((item) => (
                    <Chip
                      key={item.value}
                      size="small"
                      variant="outlined"
                      color={statusColor(item.value)}
                      label={item.label}
                    />
                  ))}
                </Stack>
              </Paper>

              {calendarView === 'day' && (
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5 }}>
                  {currentDayItems.length ? (
                    <Stack spacing={1.2}>
                      {currentDayItems.map((item) => (
                        <Box
                          key={item.id}
                          sx={{
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
                            borderRadius: 1.8,
                            p: 1.2,
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 1,
                            alignItems: 'center',
                            cursor: 'pointer',
                          }}
                          draggable
                          onDragStart={() => setDraggedAppointmentId(item.id)}
                          onDragEnd={() => setDraggedAppointmentId(null)}
                          onClick={() => setSelectedAppointment(item)}
                        >
                          <Box>
                            <Typography sx={{ fontWeight: 700 }}>{formatTime(item.appointment_at)} - {item.name}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {item.widget_name} {item.timezone ? `• ${item.timezone}` : ''}
                            </Typography>
                          </Box>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <Chip size="small" label={item.status} color={statusColor(item.status)} variant="outlined" />
                            <IconButton
                              size="small"
                              color="success"
                              title="Mark completed"
                              disabled={item.status === 'completed'}
                              onClick={(event) => {
                                event.stopPropagation();
                                updateStatus(item.id, 'completed');
                              }}
                            >
                              <CheckCircleOutlineIcon fontSize="inherit" />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="inherit"
                              title="Mark cancelled"
                              disabled={item.status === 'cancelled'}
                              onClick={(event) => {
                                event.stopPropagation();
                                updateStatus(item.id, 'cancelled');
                              }}
                            >
                              <CancelOutlinedIcon fontSize="inherit" />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="warning"
                              title="Mark no show"
                              disabled={item.status === 'no_show'}
                              onClick={(event) => {
                                event.stopPropagation();
                                updateStatus(item.id, 'no_show');
                              }}
                            >
                              <PersonOffOutlinedIcon fontSize="inherit" />
                            </IconButton>
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <Typography color="text.secondary">No appointments on this day.</Typography>
                  )}
                </Paper>
              )}

              {calendarView === 'week' && (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(7, minmax(0, 1fr))' },
                    gap: 1,
                  }}
                >
                  {weekDays.map((day) => {
                    const key = toIsoDateKey(day);
                    const dayItems = appointmentsByDay.get(key) || [];
                    return (
                      <Paper
                        key={key}
                        variant="outlined"
                        sx={{
                          p: 1.2,
                          minHeight: 170,
                          borderRadius: 2,
                          borderColor: draggedAppointmentId ? alpha(theme.palette.primary.main, 0.35) : undefined,
                          backgroundColor: draggedAppointmentId
                            ? alpha(theme.palette.primary.light, 0.08)
                            : undefined,
                        }}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          handleCalendarDrop(day);
                        }}
                      >
                        <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1 }}>
                          {day.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}
                        </Typography>
                        <Stack spacing={0.8}>
                          {dayItems.length ? (
                            dayItems.slice(0, 5).map((item) => (
                              <Box
                                key={item.id}
                                sx={{
                                  px: 0.8,
                                  py: 0.6,
                                  borderRadius: 1.2,
                                  backgroundColor: alpha(theme.palette.primary.main, 0.08),
                                  cursor: 'pointer',
                                }}
                                draggable
                                onDragStart={() => setDraggedAppointmentId(item.id)}
                                onDragEnd={() => setDraggedAppointmentId(null)}
                                onClick={() => setSelectedAppointment(item)}
                              >
                                <Typography sx={{ fontSize: 12, fontWeight: 600 }} noWrap>
                                  {formatTime(item.appointment_at)} {item.name}
                                </Typography>
                                <Typography sx={{ fontSize: 11, color: 'text.secondary' }} noWrap>
                                  {item.widget_name}
                                </Typography>
                                <Stack direction="row" spacing={0.4} sx={{ mt: 0.4 }}>
                                  <IconButton
                                    size="small"
                                    color="success"
                                    title="Mark completed"
                                    disabled={item.status === 'completed'}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      updateStatus(item.id, 'completed');
                                    }}
                                    sx={{ p: 0.35 }}
                                  >
                                    <CheckCircleOutlineIcon sx={{ fontSize: 15 }} />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    color="inherit"
                                    title="Mark cancelled"
                                    disabled={item.status === 'cancelled'}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      updateStatus(item.id, 'cancelled');
                                    }}
                                    sx={{ p: 0.35 }}
                                  >
                                    <CancelOutlinedIcon sx={{ fontSize: 15 }} />
                                  </IconButton>
                                </Stack>
                              </Box>
                            ))
                          ) : (
                            <Typography variant="caption" color="text.secondary">No items</Typography>
                          )}
                          {dayItems.length > 5 && (
                            <Button
                              variant="text"
                              size="small"
                              sx={{ alignSelf: 'flex-start', textTransform: 'none', px: 0 }}
                              onClick={() => {
                                setCalendarCursor(startOfDay(day));
                                setCalendarView('day');
                              }}
                            >
                              +{dayItems.length - 5} more
                            </Button>
                          )}
                        </Stack>
                      </Paper>
                    );
                  })}
                </Box>
              )}

              {calendarView === 'month' && (
                <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2.5, overflowX: 'auto' }}>
                  <Box sx={{ minWidth: 840 }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 1, mb: 1 }}>
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
                        <Typography key={label} variant="caption" sx={{ textTransform: 'uppercase', color: 'text.secondary', px: 0.6 }}>
                          {label}
                        </Typography>
                      ))}
                    </Box>

                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 1 }}>
                      {monthGridDays.map((day) => {
                        const key = toIsoDateKey(day);
                        const dayItems = appointmentsByDay.get(key) || [];
                        const inCurrentMonth = day.getMonth() === calendarCursor.getMonth();
                        const isToday = isSameDay(day, new Date());

                        return (
                          <Box
                            key={key}
                            sx={{
                              minHeight: 130,
                              borderRadius: 1.8,
                              border: `1px solid ${alpha(theme.palette.primary.main, isToday ? 0.38 : 0.14)}`,
                              backgroundColor: inCurrentMonth
                                ? alpha(theme.palette.background.paper, 0.7)
                                : alpha(theme.palette.action.disabledBackground, 0.35),
                              p: 0.8,
                              outline: draggedAppointmentId
                                ? `1px dashed ${alpha(theme.palette.primary.main, 0.3)}`
                                : 'none',
                            }}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => {
                              event.preventDefault();
                              handleCalendarDrop(day);
                            }}
                          >
                            <Typography sx={{ fontSize: 12, fontWeight: isToday ? 700 : 500, color: inCurrentMonth ? 'text.primary' : 'text.secondary', mb: 0.6 }}>
                              {day.getDate()}
                            </Typography>
                            <Stack spacing={0.4}>
                              {dayItems.slice(0, 3).map((item) => (
                                <Box
                                  key={item.id}
                                  sx={{ px: 0.6, py: 0.45, borderRadius: 1, backgroundColor: alpha(theme.palette.primary.main, 0.1), cursor: 'pointer' }}
                                  draggable
                                  onDragStart={() => setDraggedAppointmentId(item.id)}
                                  onDragEnd={() => setDraggedAppointmentId(null)}
                                  onClick={() => setSelectedAppointment(item)}
                                >
                                  <Typography sx={{ fontSize: 11, fontWeight: 600 }} noWrap>
                                    {formatTime(item.appointment_at)} {item.name}
                                  </Typography>
                                </Box>
                              ))}
                              {dayItems.length > 3 && (
                                <Button
                                  variant="text"
                                  size="small"
                                  sx={{ fontSize: 11, textTransform: 'none', justifyContent: 'flex-start', px: 0.2, minWidth: 0 }}
                                  onClick={() => {
                                    setCalendarCursor(startOfDay(day));
                                    setCalendarView('day');
                                  }}
                                >
                                  +{dayItems.length - 3} more
                                </Button>
                              )}
                            </Stack>
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                </Paper>
              )}
            </Stack>
          )}
        </Paper>

        <Dialog
          open={Boolean(selectedAppointment)}
          onClose={() => setSelectedAppointment(null)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Appointment Details</DialogTitle>
          <DialogContent sx={{ pt: 1.5 }}>
            {selectedAppointment && (
              <Stack spacing={1.5}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Name</Typography>
                  <Typography sx={{ fontWeight: 700 }}>{selectedAppointment.name}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Agent</Typography>
                  <Typography>{selectedAppointment.widget_name}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Date & Time</Typography>
                  <Typography>{formatDateTime(selectedAppointment.appointment_at)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Timezone</Typography>
                  <Typography>{selectedAppointment.timezone || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Contact</Typography>
                  <Typography>{selectedAppointment.email || selectedAppointment.phone || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Status</Typography>
                  <Box sx={{ mt: 0.6 }}>
                    <Chip size="small" label={selectedAppointment.status} color={statusColor(selectedAppointment.status)} variant="outlined" />
                  </Box>
                </Box>
                {selectedAppointment.notes && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Notes</Typography>
                    <Typography>{selectedAppointment.notes}</Typography>
                  </Box>
                )}
              </Stack>
            )}
          </DialogContent>
          <DialogActions sx={{ justifyContent: 'space-between' }}>
            <Button onClick={() => setSelectedAppointment(null)}>Close</Button>
            {selectedAppointment && (
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => openRescheduleDialog(selectedAppointment)}
                  startIcon={<EditCalendarOutlinedIcon fontSize="small" />}
                >
                  Reschedule
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="success"
                  onClick={() => updateStatus(selectedAppointment.id, 'completed')}
                  disabled={selectedAppointment.status === 'completed'}
                >
                  Complete
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  onClick={() => updateStatus(selectedAppointment.id, 'no_show')}
                  disabled={selectedAppointment.status === 'no_show'}
                >
                  No Show
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  onClick={() => updateStatus(selectedAppointment.id, 'cancelled')}
                  disabled={selectedAppointment.status === 'cancelled'}
                >
                  Cancel
                </Button>
              </Stack>
            )}
          </DialogActions>
        </Dialog>

        <Dialog
          open={Boolean(rescheduleTarget)}
          onClose={closeRescheduleDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Reschedule Appointment</DialogTitle>
          <DialogContent sx={{ pt: 1.5 }}>
            <Stack spacing={2}>
              <Alert severity="info" variant="outlined">
                Reschedule email will be sent to the participant and admin escalation contacts (L1 and L2) with the Google Meet link.
              </Alert>

              <TextField
                label="New Date & Time"
                type="datetime-local"
                value={rescheduleDateTime}
                onChange={(event) => setRescheduleDateTime(event.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />

              <TextField
                label="Timezone"
                value={rescheduleTimezone}
                onChange={(event) => setRescheduleTimezone(event.target.value)}
                fullWidth
              />

              <TextField
                label="Google Meet Link"
                value={rescheduleMeetLink}
                onChange={(event) => setRescheduleMeetLink(event.target.value)}
                placeholder="https://meet.google.com/new"
                fullWidth
              />

              <TextField
                label="Notes"
                multiline
                minRows={3}
                value={rescheduleNotes}
                onChange={(event) => setRescheduleNotes(event.target.value)}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeRescheduleDialog}>Cancel</Button>
            <Button
              variant="contained"
              onClick={submitReschedule}
              disabled={rescheduling || !rescheduleDateTime}
            >
              {rescheduling ? 'Rescheduling...' : 'Save & Send Emails'}
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </AdminLayout>
  );
};

export default AppointmentsPage;


