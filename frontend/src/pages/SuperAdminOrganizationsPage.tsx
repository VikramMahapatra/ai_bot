import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Button,
  Card,
  CardContent,
  Grid,
  TextField,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Chip,
  IconButton,
  Tooltip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Stack,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  CircularProgress,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import SuperAdminLayout from '../components/Layout/SuperAdminLayout';
import { superadminService } from '../services/superadminService';
import { OrganizationLimits, SuperAdminOrganization, Plan } from '../types';
import SettingsPhoneIcon from "@mui/icons-material/SettingsPhone";
import DeleteIcon from "@mui/icons-material/Delete";

const limitNumberFields: Array<[keyof OrganizationLimits, string]> = [
  ['monthly_conversation_limit', 'Monthly Conversations'],
  ['monthly_crawl_pages_limit', 'Monthly Crawl Pages'],
  ['max_crawl_depth', 'Max Crawl Depth'],
  ['monthly_document_limit', 'Monthly Documents'],
  ['max_document_size_mb', 'Max Document Size (MB)'],
  ['monthly_token_limit', 'Monthly Token Limit'],
  ['max_query_words', 'Max Query Words'],
  ['max_agents', 'Max Agents'],
  ['max_campaigns', 'Max Campaigns'],
  ['max_calls', 'Max Calls'],
];

const limitToggleFields: Array<[keyof OrganizationLimits, string]> = [
  ['lead_generation_enabled', 'Lead Generation Enabled'],
  ['voice_chat_enabled', 'Voice Chat Enabled'],
  ['multilingual_text_enabled', 'Multilingual Text Enabled'],
  ['whatsapp_enabled', 'WhatsApp Enabled'],
  ['email_campaign_enabled', 'Email Campaign Enabled'],
  ['sms_campaign_enabled', 'SMS Campaign Enabled'],
  ['module_knowledge_enabled', 'Knowledge Module Enabled'],
  ['module_leads_enabled', 'Leads Module Enabled'],
  ['module_analytics_enabled', 'Analytics Module Enabled'],
  ['module_advanced_analytics_enabled', 'Advanced Analytics Module Enabled'],
  ['module_reports_enabled', 'Reports Module Enabled'],
  ['module_campaigns_enabled', 'Campaigns Module Enabled'],
  ['module_appointments_enabled', 'Appointments Module Enabled'],
  ['module_products_enabled', 'Products Module Enabled'],
  ['module_users_enabled', 'Users Module Enabled'],
  ['human_handoff_enabled', 'Human Handoff Enabled'],
];

const planReadableFieldLabel: Record<string, string> = {
  monthly_conversation_limit: 'Monthly Conversations',
  monthly_crawl_pages_limit: 'Monthly Crawl Pages',
  max_crawl_depth: 'Max Crawl Depth',
  monthly_document_limit: 'Monthly Documents',
  max_document_size_mb: 'Max Document Size (MB)',
  monthly_token_limit: 'Monthly Token Limit',
  max_query_words: 'Max Query Words',
  max_agents: 'Max Agents',
  max_campaigns: 'Max Campaigns',
  max_calls: 'Max Calls',
};

const defaultLimits: OrganizationLimits = {
  monthly_conversation_limit: 1000,
  monthly_crawl_pages_limit: 1000,
  max_crawl_depth: 3,
  monthly_document_limit: 100,
  max_document_size_mb: 20,
  monthly_token_limit: 200000,
  max_query_words: 200,
  lead_generation_enabled: true,
  voice_chat_enabled: false,
  multilingual_text_enabled: false,
  whatsapp_enabled: false,
  email_campaign_enabled: true,
  sms_campaign_enabled: true,
  module_knowledge_enabled: true,
  module_leads_enabled: true,
  module_analytics_enabled: true,
  module_advanced_analytics_enabled: true,
  module_reports_enabled: true,
  module_campaigns_enabled: true,
  module_appointments_enabled: true,
  module_products_enabled: true,
  module_users_enabled: true,
  human_handoff_enabled: false,
  max_agents: 0,
  max_campaigns: 0,
  max_calls: 0,
};

const SuperAdminOrganizationsPage: React.FC = () => {
  const theme = useTheme();
  const [organizations, setOrganizations] = useState<SuperAdminOrganization[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState({
    organization_name: '',
    description: '',
    admin_username: '',
    admin_email: '',
    admin_password: '',
    plan_id: 0,
    billing_cycle: 'monthly' as 'monthly' | 'yearly',
    trial_days: 7,
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [limits, setLimits] = useState<OrganizationLimits>(defaultLimits);
  const [createOverrideLimits, setCreateOverrideLimits] = useState<Partial<OrganizationLimits>>({});
  const [editingOrg, setEditingOrg] = useState<SuperAdminOrganization | null>(null);
  const [editPlanId, setEditPlanId] = useState<number>(0);
  const [editBillingCycle, setEditBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [editTrialDays, setEditTrialDays] = useState<number>(0);
  const [editAdminUsername, setEditAdminUsername] = useState('');
  const [editAdminEmail, setEditAdminEmail] = useState('');
  const [editAdminPassword, setEditAdminPassword] = useState('');
  const [editOverrideLimits, setEditOverrideLimits] = useState<Partial<OrganizationLimits>>({});
  const [viewOpen, setViewOpen] = useState(false);
  const [viewOrg, setViewOrg] = useState<SuperAdminOrganization | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<any | null>(null)

  const [openCallingNumberDialog, setOpenCallingNumberDialog] = useState(false)
  const [openCallingNumberForm, setOpenCallingNumberForm] = useState(false)
  const [numbers, setNumbers] = useState<any[]>([])
  const [editing, setEditing] = useState(false)
  const [selectedRow, setSelectedRow] = useState<any | null>(null)
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [isSavingOrg, setIsSavingOrg] = useState(false);
  const [deletingOrgId, setDeletingOrgId] = useState<number | null>(null);
  const [callingform, setCallingForm] = useState({
    calling_number: "",
    is_default: false,
    is_active: true
  })

  const [callingFormError, setCallingFormError] = useState({
    calling_number: ""
  })

  const selectedPlan = useMemo(
    () => plans.find((item) => item.id === form.plan_id) || null,
    [plans, form.plan_id]
  );

  const getPlanDefaultValue = (key: keyof OrganizationLimits): number | boolean | null => {
    if (!selectedPlan) return null;
    if (key in selectedPlan) {
      return (selectedPlan as unknown as Record<string, number | boolean | null>)[key as string] ?? null;
    }
    return null;
  };

  const isOverridden = (key: keyof OrganizationLimits) => Object.prototype.hasOwnProperty.call(createOverrideLimits, key);

  const setCreateNumericOverride = (key: keyof OrganizationLimits, value: number) => {
    setCreateOverrideLimits((prev) => ({ ...prev, [key]: value }));
  };

  const toggleCreateOverride = (key: keyof OrganizationLimits, enabled: boolean) => {
    if (enabled) {
      const planValue = getPlanDefaultValue(key);
      const fallback = (defaultLimits as unknown as Record<string, number | boolean>)[key as string];
      const initialValue = typeof planValue !== 'undefined' && planValue !== null ? planValue : fallback;
      setCreateOverrideLimits((prev) => ({ ...prev, [key]: initialValue }));
      return;
    }

    setCreateOverrideLimits((prev) => {
      const next = { ...prev };
      delete (next as Record<string, unknown>)[key as string];
      return next;
    });
  };

  const orgStats = useMemo(() => {
    const total = organizations.length;
    const withSubscription = organizations.filter((org) => org.subscription?.status === 'active').length;
    const expiringSoon = organizations.filter((org) => {
      const days = Number(org.subscription?.days_left ?? 0);
      return org.subscription?.status === 'active' && days >= 0 && days <= 7;
    }).length;
    const withoutPlan = organizations.filter((org) => !org.plan).length;
    return { total, withSubscription, expiringSoon, withoutPlan };
  }, [organizations]);

  useEffect(() => {
    if (openCallingNumberDialog) {
      fetchCallingNumbers()
    }
  }, [openCallingNumberDialog])

  const handleOpenCallingNumberDialog = (org: any) => {
    setSelectedOrg(org)
    setOpenCallingNumberDialog(true)
  }

  const fetchCallingNumbers = async () => {
    if (!selectedOrg) return

    try {
      const res = await superadminService.getCallingNumbers(selectedOrg.id)
      setNumbers(res)
    } catch (error) {
      console.error("Failed to fetch calling numbers", error)
    }
  }

  const validateCallingForm = () => {
    let valid = true
    let errors: any = {}

    if (!callingform.calling_number?.trim()) {
      errors.calling_number = "Calling number is required"
      valid = false
    }

    setCallingFormError(errors)
    return valid
  }

  const handleAddCallingNumber = () => {
    setEditing(false)

    setCallingForm({
      calling_number: "",
      is_default: false,
      is_active: true
    })

    setOpenCallingNumberForm(true)
  }

  const handleCallingEdit = (row: any) => {
    setEditing(true)
    setSelectedRow(row)

    setCallingForm({
      calling_number: row.calling_number,
      is_default: row.is_default,
      is_active: row.is_active
    })

    setOpenCallingNumberForm(true)
  }


  const handleCloseCallingDialog = () => {
    setOpenCallingNumberDialog(false)
    setOpenCallingNumberForm(false)
    setSelectedRow(null)
  }

  const handleCloseCallingForm = () => {
    setOpenCallingNumberForm(false)
    setSelectedRow(null)
  }

  const handleCallingSave = async () => {
    if (!validateCallingForm()) return

    try {

      if (editing) {
        // update api
        await superadminService.updateCallingNumber(selectedRow.id, callingform)
      } else {
        // create api
        await superadminService.createCallingNumber(selectedOrg.id, callingform)
      }

      fetchCallingNumbers()
      handleCloseCallingForm()

    } catch (error) {
      console.error(error)
    }
  }

  const handleDefault = async (row: any) => {
    await superadminService.setDefaultCallingNumber(row.id)
    fetchCallingNumbers()
  }

  const handleActive = async (row: any) => {
    await superadminService.toggleActiveCallingNumber(row.id)
    fetchCallingNumbers()
  }

  const handleDelete = async (row: any) => {
    if (!window.confirm("Delete this calling number?")) return

    await superadminService.deleteCallingNumber(row.id)
    fetchCallingNumbers()
  }

  const loadOrganizations = async () => {
    const data = await superadminService.listOrganizations();
    setOrganizations(data);
  };

  const loadPlans = async () => {
    const data = await superadminService.listPlans();
    setPlans(data);
    if (data.length > 0 && form.plan_id === 0) {
      setForm((prev) => ({ ...prev, plan_id: data[0].id }));
    }
  };

  useEffect(() => {
    loadOrganizations();
    loadPlans();
  }, []);

  const handleCreate = async () => {
    try {
      setIsCreatingOrg(true);
      setActionError('');
      setActionSuccess('');

      if (!form.plan_id) {
        setActionError('Please create/select a plan before creating organization.');
        return;
      }

      const payloadLimits = Object.entries(createOverrideLimits).reduce<Partial<OrganizationLimits>>((acc, [key, value]) => {
        if (value !== undefined) {
          (acc as Record<string, unknown>)[key] = value;
        }
        return acc;
      }, {});

      await superadminService.createOrganization({
        ...form,
        limits: payloadLimits,
      });
      setForm({
        organization_name: '',
        description: '',
        admin_username: '',
        admin_email: '',
        admin_password: '',
        plan_id: plans[0]?.id || 0,
        billing_cycle: 'monthly',
        trial_days: 7,
      });
      setLimits(defaultLimits);
      setCreateOverrideLimits({});
      setCreateOpen(false);
      setActionSuccess('Organization created successfully.');
      loadOrganizations();
    } catch (error: any) {
      setActionError(error?.response?.data?.detail || 'Failed to create organization');
    } finally {
      setIsCreatingOrg(false);
    }
  };

  const handleEditOpen = (org: SuperAdminOrganization) => {
    setEditingOrg(org);
    setEditPlanId(org.plan?.id || plans[0]?.id || 0);
    setEditBillingCycle(org.subscription?.billing_cycle || 'monthly');
    setEditTrialDays(0);
    setEditAdminUsername(org.admin_username || '');
    setEditAdminEmail(org.admin_email || '');
    setEditAdminPassword('');
    setEditOverrideLimits({ ...(org.limits || {}) });
    setOpen(true);
  };

  const handleViewOpen = (org: SuperAdminOrganization) => {
    setViewOrg(org);
    setViewOpen(true);
  };

  const handleEditSave = async () => {
    try {
      setIsSavingOrg(true);
      setActionError('');
      setActionSuccess('');
      if (!editingOrg) return;
      const trimmedAdminUsername = editAdminUsername.trim();
      const trimmedAdminEmail = editAdminEmail.trim();
      const trimmedAdminPassword = editAdminPassword.trim();
      const missingAdmin = !editingOrg.admin_username;

      if (!trimmedAdminUsername) {
        setActionError('Admin username is required.');
        return;
      }
      if (!trimmedAdminEmail) {
        setActionError('Admin email is required.');
        return;
      }
      if (missingAdmin && !trimmedAdminPassword) {
        setActionError('Admin password is required to create missing admin.');
        return;
      }

      await superadminService.updateOrganization(editingOrg.id, {
        admin_username: trimmedAdminUsername,
        admin_email: trimmedAdminEmail,
        admin_password: trimmedAdminPassword || undefined,
      });

      // Only send true overrides
      const payloadLimits = Object.entries(editOverrideLimits).reduce<Partial<OrganizationLimits>>((acc, [key, value]) => {
        if (value !== undefined) {
          (acc as Record<string, unknown>)[key] = value;
        }
        return acc;
      }, {});
      await superadminService.updateLimits(editingOrg.id, payloadLimits);
      if (editPlanId) {
        await superadminService.assignSubscription(editingOrg.id, {
          plan_id: editPlanId,
          billing_cycle: editBillingCycle,
          trial_days: editTrialDays || 0,
        });
      }
      setOpen(false);
      setEditingOrg(null);
      setActionSuccess('Organization updated successfully.');
      loadOrganizations();
    } catch (error: any) {
      setActionError(error?.response?.data?.detail || 'Failed to update organization');
    } finally {
      setIsSavingOrg(false);
    }
  };

  const handleDeleteOrganization = async (org: SuperAdminOrganization) => {
    const confirmDelete = window.confirm(
      `Delete organization "${org.name}"? This cannot be undone.`
    );
    if (!confirmDelete) return;

    try {
      setDeletingOrgId(org.id);
      setActionError('');
      setActionSuccess('');
      await superadminService.deleteOrganization(org.id);
      if (editingOrg?.id === org.id) {
        setOpen(false);
        setEditingOrg(null);
      }
      if (viewOrg?.id === org.id) {
        setViewOpen(false);
        setViewOrg(null);
      }
      setActionSuccess(`Organization "${org.name}" deleted successfully.`);
      await loadOrganizations();
    } catch (error: any) {
      setActionError(error?.response?.data?.detail || 'Failed to delete organization');
    } finally {
      setDeletingOrgId(null);
    }
  };

  return (
    <SuperAdminLayout>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.2, md: 3 },
          mb: 3,
          borderRadius: '22px',
          border: `1px solid ${alpha(theme.palette.common.white, 0.65)}`,
          background: `linear-gradient(132deg, ${alpha('#cbe7e8', 0.94)} 0%, ${alpha(
            theme.palette.background.paper,
            0.84
          )} 66%, ${alpha('#9ed7d8', 0.96)} 100%)`,
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
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2}>
          <Box>
            <Typography variant="overline" sx={{ letterSpacing: 1.4, fontWeight: 700, color: alpha(theme.palette.primary.dark, 0.75) }}>
              Tenant Control Center
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.15 }}>
              Organization Management
            </Typography>
            <Typography variant="body2" sx={{ color: alpha(theme.palette.text.primary, 0.75), mt: 0.75 }}>
              Create tenants, assign subscriptions, and manage feature governance across teams.
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            New Organization
          </Button>
        </Stack>
      </Paper>

      {actionError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError('')}>
          {actionError}
        </Alert>
      )}
      {actionSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setActionSuccess('')}>
          {actionSuccess}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total Organizations', value: orgStats.total },
          { label: 'Active Subscriptions', value: orgStats.withSubscription },
          { label: 'Expiring in 7 Days', value: orgStats.expiringSoon },
          { label: 'Without Plan', value: orgStats.withoutPlan },
        ].map((item) => (
          <Grid item xs={12} sm={6} md={3} key={item.label}>
            <Paper
              elevation={0}
              sx={{
                p: 1.8,
                borderRadius: '16px',
                border: `1px solid ${alpha(theme.palette.secondary.main, 0.18)}`,
                background: `linear-gradient(155deg, ${alpha('#ecfbf8', 0.92)} 0%, ${alpha('#ffffff', 1)} 86%)`,
              }}
            >
              <Typography variant="caption" sx={{ color: alpha(theme.palette.text.primary, 0.65), fontWeight: 600 }}>
                {item.label}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, mt: 0.4 }}>
                {item.value}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {organizations.map((org) => (
          <Grid item xs={12} md={6} key={org.id}>
            <Card sx={{
              border: '1px solid',
              borderColor: alpha(theme.palette.secondary.main, 0.2),
              borderRadius: '18px',
              background: `linear-gradient(145deg, ${alpha('#ebfaf7', 0.92)} 0%, rgba(255,255,255,1) 62%)`,
              transition: 'all 0.24s ease',
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                background: `linear-gradient(90deg, ${theme.palette.secondary.main} 0%, ${theme.palette.primary.main} 100%)`,
              },
              '&:hover': { boxShadow: `0 12px 24px ${alpha(theme.palette.secondary.main, 0.18)}`, transform: 'translateY(-3px)' },
            }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                      {org.name}
                    </Typography>
                    <Typography variant="body2" sx={{ color: alpha(theme.palette.text.primary, 0.68) }}>
                      Admin: {org.admin_username || 'N/A'} ({org.admin_email || '-'})
                    </Typography>
                  </Box>
                  <Chip
                    label={org.subscription?.status || 'inactive'}
                    size="small"
                    color={org.subscription?.status === 'active' ? 'success' : 'default'}
                  />
                </Stack>

                <Stack direction="row" spacing={1} sx={{ mt: 1.2, flexWrap: 'wrap', useFlexGap: true }}>
                  <Chip label={org.plan?.name || 'Unassigned'} size="small" variant="outlined" />
                  <Chip label={`Days left: ${org.subscription?.days_left ?? 0}`} size="small" />
                </Stack>

                <Typography variant="body2" sx={{ color: alpha(theme.palette.text.primary, 0.68), mt: 1.15 }}>
                  {org.subscription
                    ? `Start: ${new Date(org.subscription.start_date).toLocaleDateString()} | End: ${new Date(org.subscription.end_date).toLocaleDateString()}`
                    : 'No active subscription'}
                </Typography>

                <Divider sx={{ my: 1.45, borderColor: alpha(theme.palette.secondary.main, 0.18) }} />

                <Stack direction="row" spacing={1.5}>
                  <Tooltip title="View">
                    <IconButton
                      onClick={() => handleViewOpen(org)}
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.primary.main, 0.15),
                        color: 'primary.main',
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.25) },
                      }}
                    >
                      <VisibilityIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Edit">
                    <IconButton
                      onClick={() => handleEditOpen(org)}
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.secondary.main, 0.16),
                        color: 'secondary.main',
                        '&:hover': { bgcolor: alpha(theme.palette.secondary.main, 0.26) },
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Calling Numbers">
                    <IconButton
                      onClick={() => handleOpenCallingNumberDialog(org)}
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.secondary.main, 0.16),
                        color: 'secondary.main',
                        '&:hover': { bgcolor: alpha(theme.palette.secondary.main, 0.26) },
                      }}
                    >
                      <SettingsPhoneIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete Organization">
                    <IconButton
                      onClick={() => handleDeleteOrganization(org)}
                      disabled={deletingOrgId === org.id}
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.error.main, 0.14),
                        color: 'error.main',
                        '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.24) },
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: '18px' } }}
      >
        <DialogTitle>Organization Details</DialogTitle>
        <DialogContent>
          {viewOrg && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <TextField label="Organization" fullWidth value={viewOrg.name} InputProps={{ readOnly: true }} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField label="Admin Username" fullWidth value={viewOrg.admin_username || ''} InputProps={{ readOnly: true }} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField label="Admin Email" fullWidth value={viewOrg.admin_email || ''} InputProps={{ readOnly: true }} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField label="Plan" fullWidth value={viewOrg.plan?.name || 'Unassigned'} InputProps={{ readOnly: true }} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField label="Subscription Status" fullWidth value={viewOrg.subscription?.status || 'none'} InputProps={{ readOnly: true }} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField label="Days Left" fullWidth value={viewOrg.subscription?.days_left ?? 0} InputProps={{ readOnly: true }} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField label="Start Date" fullWidth value={viewOrg.subscription ? new Date(viewOrg.subscription.start_date).toLocaleDateString() : ''} InputProps={{ readOnly: true }} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField label="End Date" fullWidth value={viewOrg.subscription ? new Date(viewOrg.subscription.end_date).toLocaleDateString() : ''} InputProps={{ readOnly: true }} />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: '18px' } }}
      >
        <DialogTitle>Create Organization + Admin</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField label="Organization Name" fullWidth value={form.organization_name} onChange={(e) => setForm({ ...form, organization_name: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Description" fullWidth value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField label="Admin Username" fullWidth value={form.admin_username} onChange={(e) => setForm({ ...form, admin_username: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField label="Admin Email" fullWidth value={form.admin_email} onChange={(e) => setForm({ ...form, admin_email: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField label="Admin Password" type="password" fullWidth value={form.admin_password} onChange={(e) => setForm({ ...form, admin_password: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Plan</InputLabel>
                <Select
                  label="Plan"
                  value={form.plan_id}
                  onChange={(e) => {
                    setForm({ ...form, plan_id: Number(e.target.value) });
                    setCreateOverrideLimits({});
                  }}
                >
                  {plans.map((plan) => (
                    <MenuItem key={plan.id} value={plan.id}>{plan.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Billing Cycle</InputLabel>
                <Select
                  label="Billing Cycle"
                  value={form.billing_cycle}
                  onChange={(e) => setForm({ ...form, billing_cycle: e.target.value as 'monthly' | 'yearly' })}
                >
                  <MenuItem value="monthly">Monthly</MenuItem>
                  <MenuItem value="yearly">Yearly</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Trial Days"
                type="number"
                fullWidth
                value={form.trial_days}
                onChange={(e) => setForm({ ...form, trial_days: Number(e.target.value) })}
              />
            </Grid>
          </Grid>

          <Paper
            elevation={0}
            sx={{
              mt: 3,
              p: 2,
              borderRadius: '14px',
              border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
              background: `linear-gradient(150deg, ${alpha('#eef6ff', 0.9)} 0%, ${alpha('#ffffff', 1)} 88%)`,
            }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Plan Baseline
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Selected plan values are inherited by default. Override only what this org needs.
                </Typography>
              </Box>
              {selectedPlan && (
                <Stack direction="row" spacing={1}>
                  <Chip label={selectedPlan.name} variant="outlined" size="small" />
                  <Chip label={`INR ${selectedPlan.price_inr}/${selectedPlan.billing_cycle}`} size="small" />
                </Stack>
              )}
            </Stack>

            <Grid container spacing={2} sx={{ mt: 0.4 }}>
              {limitNumberFields.map(([key, label]) => {
                const overridden = isOverridden(key);
                const baseValue = getPlanDefaultValue(key);
                const currentValue = overridden
                  ? (createOverrideLimits[key] as number | undefined)
                  : (typeof baseValue === 'number' ? baseValue : undefined);

                return (
                  <Grid item xs={12} md={6} key={`create-num-${String(key)}`}>
                    <Paper
                      variant="outlined"
                      sx={{ p: 1.25, borderRadius: '12px', borderColor: alpha(theme.palette.primary.main, 0.18) }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.8 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{label}</Typography>
                        <Chip
                          size="small"
                          label={overridden ? 'Override' : 'Inherit'}
                          color={overridden ? 'primary' : 'default'}
                          variant={overridden ? 'filled' : 'outlined'}
                        />
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.8 }}>
                        Plan: {typeof baseValue === 'number' ? Number(baseValue).toLocaleString() : 'Not defined at plan level'}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Switch
                          checked={overridden}
                          onChange={(e) => toggleCreateOverride(key, e.target.checked)}
                        />
                        <TextField
                          size="small"
                          type="number"
                          fullWidth
                          value={currentValue ?? ''}
                          disabled={!overridden}
                          onChange={(e) => setCreateNumericOverride(key, Number(e.target.value))}
                          placeholder={typeof baseValue === 'number' ? String(baseValue) : 'Enter value'}
                        />
                      </Stack>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>

            <Typography variant="subtitle2" sx={{ mt: 2.4, mb: 1, fontWeight: 700 }}>
              Feature Entitlements
            </Typography>
            <Grid container spacing={1.4}>
              {limitToggleFields.map(([key, label]) => {
                const overridden = isOverridden(key);
                const baseValue = getPlanDefaultValue(key);
                const overrideValue = createOverrideLimits[key] as boolean | undefined;
                const effective = overridden ? Boolean(overrideValue) : Boolean(baseValue);

                return (
                  <Grid item xs={12} md={6} key={`create-flag-${String(key)}`}>
                    <Paper
                      variant="outlined"
                      sx={{ p: 1.25, borderRadius: '12px', borderColor: alpha(theme.palette.secondary.main, 0.24) }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.8 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{label}</Typography>
                        <Chip
                          size="small"
                          label={effective ? 'Enabled' : 'Disabled'}
                          color={effective ? 'success' : 'default'}
                          variant="outlined"
                        />
                      </Stack>
                      <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={overridden ? (overrideValue ? 'enabled' : 'disabled') : 'inherit'}
                        onChange={(_, value) => {
                          if (!value) return;
                          if (value === 'inherit') {
                            toggleCreateOverride(key, false);
                            return;
                          }
                          setCreateOverrideLimits((prev) => ({ ...prev, [key]: value === 'enabled' }));
                        }}
                      >
                        <ToggleButton value="inherit">Inherit</ToggleButton>
                        <ToggleButton value="enabled">Enable</ToggleButton>
                        <ToggleButton value="disabled">Disable</ToggleButton>
                      </ToggleButtonGroup>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Overrides to be stored for this org: {Object.keys(createOverrideLimits).length}
              </Typography>
              <Button variant="text" onClick={() => setCreateOverrideLimits({})}>
                Reset All Overrides
              </Button>
            </Stack>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={isCreatingOrg} sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
            {isCreatingOrg ? <CircularProgress size={18} color="inherit" /> : null}
            {isCreatingOrg ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: '18px' } }}
      >
      <DialogTitle>Edit Organization</DialogTitle>
        <DialogContent>
          {editingOrg && !editingOrg.admin_username && (
            <Alert severity="warning" sx={{ mt: 1, mb: 2 }}>
              No admin attached to this organization. Provide username, email, and password to create admin access.
            </Alert>
          )}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Admin Username"
                fullWidth
                value={editAdminUsername}
                onChange={(e) => setEditAdminUsername(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Admin Email"
                type="email"
                fullWidth
                value={editAdminEmail}
                onChange={(e) => setEditAdminEmail(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Admin Password"
                type="password"
                fullWidth
                value={editAdminPassword}
                onChange={(e) => setEditAdminPassword(e.target.value)}
                helperText={
                  editingOrg && !editingOrg.admin_username
                    ? 'Required to create missing admin user.'
                    : 'Leave blank to keep the current password.'
                }
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Plan</InputLabel>
                <Select
                  label="Plan"
                  value={editPlanId}
                  onChange={(e) => {
                    setEditPlanId(Number(e.target.value));
                    setEditOverrideLimits({});
                  }}
                >
                  {plans.map((plan) => (
                    <MenuItem key={plan.id} value={plan.id}>{plan.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Billing Cycle</InputLabel>
                <Select
                  label="Billing Cycle"
                  value={editBillingCycle}
                  onChange={(e) => setEditBillingCycle(e.target.value as 'monthly' | 'yearly')}
                >
                  <MenuItem value="monthly">Monthly</MenuItem>
                  <MenuItem value="yearly">Yearly</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Trial Days"
                type="number"
                fullWidth
                value={editTrialDays}
                onChange={(e) => setEditTrialDays(Number(e.target.value))}
              />
            </Grid>
          </Grid>

          <Paper
            elevation={0}
            sx={{ mt: 3, p: 2, borderRadius: '14px', border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`, background: `linear-gradient(150deg, ${alpha('#eef6ff', 0.9)} 0%, ${alpha('#ffffff', 1)} 88%)` }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Plan Baseline
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Selected plan values are inherited by default. Override only what this org needs.
                </Typography>
              </Box>
              {(() => {
                const plan = plans.find((p) => p.id === editPlanId);
                return plan ? (
                  <Stack direction="row" spacing={1}>
                    <Chip label={plan.name} variant="outlined" size="small" />
                    <Chip label={`INR ${plan.price_inr}/${plan.billing_cycle}`} size="small" />
                  </Stack>
                ) : null;
              })()}
            </Stack>

            <Grid container spacing={2} sx={{ mt: 0.4 }}>
              {limitNumberFields.map(([key, label]) => {
                const plan = plans.find((p) => p.id === editPlanId);
                const overridden = Object.prototype.hasOwnProperty.call(editOverrideLimits, key);
                const baseValue = plan && key in plan ? (plan as any)[key] : (defaultLimits as any)[key];
                const currentValue = overridden
                  ? (editOverrideLimits[key] as number | undefined)
                  : (typeof baseValue === 'number' ? baseValue : undefined);
                return (
                  <Grid item xs={12} md={6} key={`edit-num-${String(key)}`}>
                    <Paper
                      variant="outlined"
                      sx={{ p: 1.25, borderRadius: '12px', borderColor: alpha(theme.palette.primary.main, 0.18) }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.8 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{label}</Typography>
                        <Chip
                          size="small"
                          label={overridden ? 'Override' : 'Inherit'}
                          color={overridden ? 'primary' : 'default'}
                          variant={overridden ? 'filled' : 'outlined'}
                        />
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.8 }}>
                        Plan: {typeof baseValue === 'number' ? Number(baseValue).toLocaleString() : 'Not defined at plan level'}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Switch
                          checked={overridden}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditOverrideLimits((prev) => ({ ...prev, [key]: baseValue }));
                            } else {
                              setEditOverrideLimits((prev) => {
                                const next = { ...prev };
                                delete (next as any)[key];
                                return next;
                              });
                            }
                          }}
                        />
                        <TextField
                          size="small"
                          type="number"
                          fullWidth
                          value={currentValue ?? ''}
                          disabled={!overridden}
                          onChange={(e) => setEditOverrideLimits((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                          placeholder={typeof baseValue === 'number' ? String(baseValue) : 'Enter value'}
                        />
                      </Stack>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>

            <Typography variant="subtitle2" sx={{ mt: 2.4, mb: 1, fontWeight: 700 }}>
              Feature Entitlements
            </Typography>
            <Grid container spacing={1.4}>
              {limitToggleFields.map(([key, label]) => {
                const plan = plans.find((p) => p.id === editPlanId);
                const overridden = Object.prototype.hasOwnProperty.call(editOverrideLimits, key);
                const baseValue = plan && key in plan ? (plan as any)[key] : (defaultLimits as any)[key];
                const overrideValue = editOverrideLimits[key] as boolean | undefined;
                const effective = overridden ? Boolean(overrideValue) : Boolean(baseValue);
                return (
                  <Grid item xs={12} md={6} key={`edit-flag-${String(key)}`}>
                    <Paper
                      variant="outlined"
                      sx={{ p: 1.25, borderRadius: '12px', borderColor: alpha(theme.palette.secondary.main, 0.24) }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.8 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{label}</Typography>
                        <Chip
                          size="small"
                          label={effective ? 'Enabled' : 'Disabled'}
                          color={effective ? 'success' : 'default'}
                          variant="outlined"
                        />
                      </Stack>
                      <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={overridden ? (overrideValue ? 'enabled' : 'disabled') : 'inherit'}
                        onChange={(_, value) => {
                          if (!value) return;
                          if (value === 'inherit') {
                            setEditOverrideLimits((prev) => {
                              const next = { ...prev };
                              delete (next as any)[key];
                              return next;
                            });
                            return;
                          }
                          setEditOverrideLimits((prev) => ({ ...prev, [key]: value === 'enabled' }));
                        }}
                      >
                        <ToggleButton value="inherit">Inherit</ToggleButton>
                        <ToggleButton value="enabled">Enable</ToggleButton>
                        <ToggleButton value="disabled">Disable</ToggleButton>
                      </ToggleButtonGroup>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Overrides to be stored for this org: {Object.keys(editOverrideLimits).length}
              </Typography>
              <Button variant="text" onClick={() => setEditOverrideLimits({})}>
                Reset All Overrides
              </Button>
            </Stack>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleEditSave} disabled={isSavingOrg} sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
            {isSavingOrg ? <CircularProgress size={18} color="inherit" /> : null}
            {isSavingOrg ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>


      <Dialog
        open={openCallingNumberDialog}
        onClose={handleCloseCallingDialog}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: { borderRadius: '18px' } }}
      >
        <DialogTitle>
          Organization Calling Numbers
        </DialogTitle>

        <DialogContent>

          <Box display="flex" justifyContent="flex-end" mb={2}>
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              onClick={handleAddCallingNumber}
            >
              Add Calling Number
            </Button>
          </Box>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Calling Number</TableCell>
                <TableCell>Default</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {numbers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    No contacts added
                  </TableCell>
                </TableRow>
              ) : (
                numbers.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {row.calling_number}
                    </TableCell>

                    <TableCell>
                      <Switch
                        checked={row.is_default}
                        onChange={() =>
                          handleDefault(row)
                        }
                      />
                    </TableCell>

                    <TableCell>
                      <Switch
                        checked={row.is_active}
                        onChange={() =>
                          handleActive(row)
                        }
                      />
                    </TableCell>

                    <TableCell align="right">
                      <IconButton
                        onClick={() =>
                          handleCallingEdit(row)
                        }
                      >
                        <EditIcon />
                      </IconButton>

                      <IconButton
                        color="error"
                        onClick={() =>
                          handleDelete(row)
                        }
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseCallingDialog}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openCallingNumberForm} onClose={(handleCloseCallingForm)} PaperProps={{ sx: { borderRadius: '18px' } }}>
        <DialogTitle>
          {editing ? "Edit" : "Add"} Calling Number
        </DialogTitle>

        <DialogContent>

          <TextField
            required
            fullWidth
            label="Calling Number"
            placeholder="+1234567890"
            value={callingform.calling_number}
            error={!!callingFormError.calling_number}
            helperText={callingFormError.calling_number}
            onChange={(e) =>
              setCallingForm({
                ...callingform,
                calling_number: e.target.value
              })
            }
            sx={{ mt: 1 }}
          />

        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseCallingForm}>
            Cancel
          </Button>

          <Button
            variant="contained"
            onClick={handleCallingSave}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </SuperAdminLayout>
  );
};

export default SuperAdminOrganizationsPage;


