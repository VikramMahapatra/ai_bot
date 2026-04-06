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
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Chip,
  Stack,
  Divider,
  Alert,
  CircularProgress,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SuperAdminLayout from '../components/Layout/SuperAdminLayout';
import { ConfirmDialog } from '../components/Common/ConfirmDialog';
import { superadminService } from '../services/superadminService';
import { Plan } from '../types';

type PlanForm = Omit<Plan, 'id'>;
type PlanNumericKey =
  | 'monthly_conversation_limit'
  | 'monthly_crawl_pages_limit'
  | 'max_crawl_depth'
  | 'monthly_document_limit'
  | 'max_document_size_mb'
  | 'monthly_token_limit'
  | 'max_query_words';

const numericLimitFields: Array<[PlanNumericKey, string]> = [
  ['monthly_conversation_limit', 'Monthly Conversations'],
  ['monthly_crawl_pages_limit', 'Monthly Crawl Pages'],
  ['max_crawl_depth', 'Max Crawl Depth'],
  ['monthly_document_limit', 'Monthly Documents'],
  ['max_document_size_mb', 'Max Document Size (MB)'],
  ['monthly_token_limit', 'Monthly Token Limit'],
  ['max_query_words', 'Max Query Words'],
];

const featureToggleFields: Array<[keyof PlanForm, string]> = [
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

const defaultPlan: PlanForm = {
  name: '',
  description: '',
  price_inr: 0,
  billing_cycle: 'monthly',
  is_active: true,
  monthly_conversation_limit: 0,
  monthly_crawl_pages_limit: 0,
  max_crawl_depth: 0,
  monthly_document_limit: 0,
  max_document_size_mb: 0,
  monthly_token_limit: 0,
  max_query_words: 0,
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
};

const SuperAdminPlansPage: React.FC = () => {
  const theme = useTheme();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState<PlanForm>(defaultPlan);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [editForm, setEditForm] = useState<PlanForm>(defaultPlan);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [isSeedingPlans, setIsSeedingPlans] = useState(false);
  const [togglingPlanId, setTogglingPlanId] = useState<number | null>(null);
  const [deletingPlanId, setDeletingPlanId] = useState<number | null>(null);
  const [planToDelete, setPlanToDelete] = useState<Plan | null>(null);

  const planStats = useMemo(() => {
    const total = plans.length;
    const active = plans.filter((plan) => plan.is_active).length;
    const avgPrice = total > 0 ? Math.round(plans.reduce((sum, plan) => sum + Number(plan.price_inr || 0), 0) / total) : 0;
    const yearly = plans.filter((plan) => plan.billing_cycle === 'yearly').length;
    return { total, active, avgPrice, yearly };
  }, [plans]);

  const loadPlans = async () => {
    const data = await superadminService.listPlans();
    setPlans(data);
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const handleCreate = async () => {
    try {
      setIsCreatingPlan(true);
      setActionError('');
      setActionSuccess('');
      await superadminService.createPlan(form);
      setForm(defaultPlan);
      setCreateOpen(false);
      await loadPlans();
      setActionSuccess('Plan created successfully.');
    } catch (error: any) {
      setActionError(error?.response?.data?.detail || 'Failed to create plan');
    } finally {
      setIsCreatingPlan(false);
    }
  };

  const handleSeedDefaults = async () => {
    const starter = {
      name: 'Starter Plan',
      description: 'Website chatbot only',
      price_inr: 1999,
      billing_cycle: 'monthly' as const,
      is_active: true,
      monthly_conversation_limit: 6000,
      monthly_crawl_pages_limit: 20,
      max_crawl_depth: 3,
      monthly_document_limit: 5,
      max_document_size_mb: 100,
      monthly_token_limit: 200000,
      max_query_words: 200,
      lead_generation_enabled: true,
      voice_chat_enabled: true,
      multilingual_text_enabled: true,
      whatsapp_enabled: true,
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
      human_handoff_enabled: true,
    };

    const growth = {
      name: 'Growth Plan',
      description: 'Website chatbot only',
      price_inr: 3999,
      billing_cycle: 'monthly' as const,
      is_active: true,
      monthly_conversation_limit: 12000,
      monthly_crawl_pages_limit: 50,
      max_crawl_depth: 3,
      monthly_document_limit: 10,
      max_document_size_mb: 200,
      monthly_token_limit: 400000,
      max_query_words: 400,
      lead_generation_enabled: true,
      voice_chat_enabled: true,
      multilingual_text_enabled: true,
      whatsapp_enabled: true,
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
      human_handoff_enabled: true,
    };

    try {
      setIsSeedingPlans(true);
      setActionError('');
      setActionSuccess('');
      try {
        await superadminService.createPlan(starter as Omit<Plan, 'id'>);
      } catch {}
      try {
        await superadminService.createPlan(growth as Omit<Plan, 'id'>);
      } catch {}
      await loadPlans();
      setActionSuccess('Seed process completed.');
    } catch (error: any) {
      setActionError(error?.response?.data?.detail || 'Failed to seed default plans');
    } finally {
      setIsSeedingPlans(false);
    }
  };

  const handleToggleActive = async (plan: Plan) => {
    try {
      setTogglingPlanId(plan.id);
      setActionError('');
      setActionSuccess('');
      await superadminService.updatePlan(plan.id, { is_active: !plan.is_active });
      await loadPlans();
      setActionSuccess(`Plan "${plan.name}" updated successfully.`);
    } catch (error: any) {
      setActionError(error?.response?.data?.detail || 'Failed to update plan status');
    } finally {
      setTogglingPlanId(null);
    }
  };

  const handleOpenView = (plan: Plan) => {
    setActivePlan(plan);
    setViewOpen(true);
  };

  const handleOpenEdit = (plan: Plan) => {
    setActivePlan(plan);
    setEditForm({
      name: plan.name,
      description: plan.description || '',
      price_inr: plan.price_inr,
      billing_cycle: plan.billing_cycle,
      is_active: plan.is_active,
      monthly_conversation_limit: plan.monthly_conversation_limit,
      monthly_crawl_pages_limit: plan.monthly_crawl_pages_limit,
      max_crawl_depth: plan.max_crawl_depth,
      monthly_document_limit: plan.monthly_document_limit,
      max_document_size_mb: plan.max_document_size_mb,
      monthly_token_limit: plan.monthly_token_limit,
      max_query_words: plan.max_query_words,
      lead_generation_enabled: plan.lead_generation_enabled,
      voice_chat_enabled: plan.voice_chat_enabled,
      multilingual_text_enabled: plan.multilingual_text_enabled,
      whatsapp_enabled: !!plan.whatsapp_enabled,
      email_campaign_enabled: !!plan.email_campaign_enabled,
      sms_campaign_enabled: !!plan.sms_campaign_enabled,
      module_knowledge_enabled: !!plan.module_knowledge_enabled,
      module_leads_enabled: !!plan.module_leads_enabled,
      module_analytics_enabled: !!plan.module_analytics_enabled,
      module_advanced_analytics_enabled: !!plan.module_advanced_analytics_enabled,
      module_reports_enabled: !!plan.module_reports_enabled,
      module_campaigns_enabled: !!plan.module_campaigns_enabled,
      module_appointments_enabled: !!plan.module_appointments_enabled,
      module_products_enabled: !!plan.module_products_enabled,
      module_users_enabled: !!plan.module_users_enabled,
      human_handoff_enabled: !!plan.human_handoff_enabled,
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!activePlan) return;
    try {
      setIsSavingPlan(true);
      setActionError('');
      setActionSuccess('');
      await superadminService.updatePlan(activePlan.id, editForm);
      setEditOpen(false);
      setActivePlan(null);
      await loadPlans();
      setActionSuccess('Plan updated successfully.');
    } catch (error: any) {
      setActionError(error?.response?.data?.detail || 'Failed to update plan');
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleConfirmDeletePlan = async () => {
    if (!planToDelete) return;

    try {
      setDeletingPlanId(planToDelete.id);
      setActionError('');
      setActionSuccess('');
      const deletedName = planToDelete.name;
      await superadminService.deletePlan(planToDelete.id);
      if (activePlan?.id === planToDelete.id) {
        setActivePlan(null);
        setViewOpen(false);
        setEditOpen(false);
      }
      setPlanToDelete(null);
      await loadPlans();
      setActionSuccess(`Plan "${deletedName}" deleted successfully.`);
    } catch (error: any) {
      setActionError(error?.response?.data?.detail || 'Failed to delete plan');
    } finally {
      setDeletingPlanId(null);
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
          border: `1px solid ${alpha(theme.palette.common.white, 0.62)}`,
          background: `linear-gradient(132deg, ${alpha('#c8dbf8', 0.95)} 0%, ${alpha(
            theme.palette.background.paper,
            0.82
          )} 68%, ${alpha('#8cb4e8', 0.94)} 100%)`,
          boxShadow: `0 20px 36px ${alpha(theme.palette.primary.dark, 0.24)}`,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(118deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.08) 38%, rgba(255,255,255,0) 64%)',
            pointerEvents: 'none',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: '-42%',
            right: '-8%',
            width: '45%',
            height: '160%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0) 72%)',
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
            Subscription Studio
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.15 }}>
            Super Admin Plans
          </Typography>
          <Typography variant="body2" sx={{ color: alpha(theme.palette.text.primary, 0.75), mt: 0.75 }}>
            Configure pricing, usage limits, and product entitlements from one control surface.
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
          <Button
            variant="outlined"
            onClick={handleSeedDefaults}
            disabled={isSeedingPlans}
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}
          >
            {isSeedingPlans ? <CircularProgress size={18} color="inherit" /> : null}
            {isSeedingPlans ? 'Seeding...' : 'Seed Starter/Growth'}
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            New Plan
          </Button>
        </Stack>
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
          { label: 'Total Plans', value: planStats.total },
          { label: 'Active Plans', value: planStats.active },
          { label: 'Average Price', value: `INR ${planStats.avgPrice}` },
          { label: 'Yearly Billing', value: planStats.yearly },
        ].map((item) => (
          <Grid item xs={12} sm={6} md={3} key={item.label}>
            <Paper
              elevation={0}
              sx={{
                p: 1.8,
                borderRadius: '16px',
                border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                background: `linear-gradient(155deg, ${alpha('#eff5ff', 0.9)} 0%, ${alpha('#ffffff', 1)} 85%)`,
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
        {plans.map((plan) => (
          <Grid item xs={12} md={6} key={plan.id}>
            <Card sx={{
              border: '1px solid',
              borderColor: alpha(theme.palette.primary.main, 0.16),
              borderRadius: '18px',
              background: `linear-gradient(145deg, ${alpha('#edf3ff', 0.9)} 0%, rgba(255,255,255,1) 63%)`,
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
                background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
              },
              '&:hover': { boxShadow: `0 12px 24px ${alpha(theme.palette.primary.main, 0.16)}`, transform: 'translateY(-3px)' },
            }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                      {plan.name}
                    </Typography>
                    <Typography variant="body2" sx={{ color: alpha(theme.palette.text.primary, 0.68) }}>
                      INR {plan.price_inr} / {plan.billing_cycle}
                    </Typography>
                  </Box>
                  <FormControlLabel
                    sx={{ mr: 0 }}
                    control={
                      <Switch
                        checked={plan.is_active}
                        disabled={togglingPlanId === plan.id}
                        onChange={() => handleToggleActive(plan)}
                      />
                    }
                    label={plan.is_active ? 'Live' : 'Off'}
                  />
                </Stack>

                <Typography variant="body2" sx={{ color: alpha(theme.palette.text.primary, 0.66), mt: 1.2, minHeight: 40 }}>
                  {plan.description || 'No description provided for this plan yet.'}
                </Typography>

                <Stack direction="row" spacing={1} sx={{ mt: 1.2, flexWrap: 'wrap', useFlexGap: true }}>
                  <Chip label={plan.is_active ? 'Active' : 'Inactive'} color={plan.is_active ? 'success' : 'default'} size="small" />
                  <Chip label={`${Number(plan.monthly_conversation_limit || 0).toLocaleString()} conv/mo`} size="small" variant="outlined" />
                  <Chip label={`${Number(plan.monthly_token_limit || 0).toLocaleString()} tokens`} size="small" variant="outlined" />
                </Stack>

                <Divider sx={{ my: 1.4, borderColor: alpha(theme.palette.primary.main, 0.16) }} />

                <Stack direction="row" spacing={1}>
                  <Tooltip title="View">
                    <IconButton
                      onClick={() => handleOpenView(plan)}
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
                      onClick={() => handleOpenEdit(plan)}
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
                  <Tooltip title="Delete Plan">
                    <IconButton
                      onClick={() => setPlanToDelete(plan)}
                      disabled={deletingPlanId === plan.id}
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
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: '18px' } }}
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box flex={1}>
              <Typography variant="h5" fontWeight={700}>Create New Plan</Typography>
              <Typography variant="body2" color="text.secondary">
                Define a new subscription plan, its pricing, limits, and feature entitlements. All organizations on this plan will inherit these values unless overridden.
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: '14px', border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`, background: `linear-gradient(150deg, ${alpha('#eef6ff', 0.9)} 0%, ${alpha('#ffffff', 1)} 88%)` }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField label="Plan Name" fullWidth value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField label="Price (INR)" type="number" fullWidth value={form.price_inr} onChange={(e) => setForm({ ...form, price_inr: Number(e.target.value) })} />
              </Grid>
              <Grid item xs={12} md={3}>
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
              <Grid item xs={12}>
                <TextField label="Description" fullWidth value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Grid>
            </Grid>
          </Paper>

          <Typography variant="subtitle1" sx={{ mt: 2, mb: 1.2, fontWeight: 700 }}>Limits</Typography>
          <Grid container spacing={2}>
            {numericLimitFields.map(([key, label]) => (
              <Grid item xs={12} md={4} key={key}>
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: '12px', borderColor: alpha(theme.palette.primary.main, 0.18) }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{label}</Typography>
                  <TextField
                    size="small"
                    type="number"
                    fullWidth
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
                    sx={{ mt: 1 }}
                  />
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Typography variant="subtitle1" sx={{ mt: 3, mb: 1.2, fontWeight: 700 }}>Feature Entitlements</Typography>
          <Grid container spacing={2}>
            {featureToggleFields.map(([key, label]) => (
              <Grid item xs={12} md={4} key={String(key)}>
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: '12px', borderColor: alpha(theme.palette.secondary.main, 0.24) }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{label}</Typography>
                    <Switch
                      checked={Boolean(form[key])}
                      onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                    />
                  </Stack>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={isCreatingPlan}
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}
          >
            {isCreatingPlan ? <CircularProgress size={18} color="inherit" /> : null}
            {isCreatingPlan ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: '18px' } }}
      >
        <DialogTitle>Plan Details</DialogTitle>
        <DialogContent>
          {activePlan && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <TextField label="Plan Name" fullWidth value={activePlan.name} InputProps={{ readOnly: true }} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField label="Price (INR)" fullWidth value={activePlan.price_inr} InputProps={{ readOnly: true }} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField label="Description" fullWidth value={activePlan.description || ''} InputProps={{ readOnly: true }} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField label="Billing Cycle" fullWidth value={activePlan.billing_cycle} InputProps={{ readOnly: true }} />
              </Grid>
              {([
                ['monthly_conversation_limit', 'Monthly Conversations'],
                ['monthly_crawl_pages_limit', 'Monthly Crawl Pages'],
                ['max_crawl_depth', 'Max Crawl Depth'],
                ['monthly_document_limit', 'Monthly Documents'],
                ['max_document_size_mb', 'Max Document Size (MB)'],
                ['monthly_token_limit', 'Monthly Token Limit'],
                ['max_query_words', 'Max Query Words'],
              ] as [keyof Plan, string][]).map(([key, label]) => (
                <Grid item xs={12} md={4} key={key}>
                  <TextField label={label} fullWidth value={activePlan[key] as number} InputProps={{ readOnly: true }} />
                </Grid>
              ))}
              {featureToggleFields.map(([key, label]) => (
                <Grid item xs={12} md={4} key={String(key)}>
                  <TextField label={label} fullWidth value={activePlan[key] ? 'Yes' : 'No'} InputProps={{ readOnly: true }} />
                </Grid>
              ))}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: '18px' } }}
      >
        <DialogTitle>Edit Plan</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField label="Plan Name" fullWidth value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Price (INR)" type="number" fullWidth value={editForm.price_inr} onChange={(e) => setEditForm({ ...editForm, price_inr: Number(e.target.value) })} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Description" fullWidth value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Billing Cycle</InputLabel>
                <Select
                  label="Billing Cycle"
                  value={editForm.billing_cycle}
                  onChange={(e) => setEditForm({ ...editForm, billing_cycle: e.target.value as 'monthly' | 'yearly' })}
                >
                  <MenuItem value="monthly">Monthly</MenuItem>
                  <MenuItem value="yearly">Yearly</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
            Limits
          </Typography>
          <Grid container spacing={2}>
            {numericLimitFields.map(([key, label]) => (
              <Grid item xs={12} md={4} key={key}>
                <TextField
                  label={label}
                  type="number"
                  fullWidth
                  value={editForm[key]}
                  onChange={(e) => setEditForm({ ...editForm, [key]: Number(e.target.value) })}
                />
              </Grid>
            ))}
            {featureToggleFields.map(([key, label]) => (
              <Grid item xs={12} md={4} key={String(key)}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(editForm[key])}
                      onChange={(e) => setEditForm({ ...editForm, [key]: e.target.checked })}
                    />
                  }
                  label={label}
                />
              </Grid>
            ))}
          </Grid>

          <FormControlLabel
            sx={{ mt: 2 }}
            control={
              <Switch
                checked={editForm.is_active}
                onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
              />
            }
            label={editForm.is_active ? 'Active' : 'Inactive'}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveEdit}
            disabled={isSavingPlan}
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}
          >
            {isSavingPlan ? <CircularProgress size={18} color="inherit" /> : null}
            {isSavingPlan ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={planToDelete !== null}
        title="Delete plan?"
        description={
          planToDelete
            ? `This will permanently remove "${planToDelete.name}". This action cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmColor="error"
        loading={deletingPlanId !== null}
        onCancel={() => !deletingPlanId && setPlanToDelete(null)}
        onConfirm={handleConfirmDeletePlan}
      />
    </SuperAdminLayout>
  );
};

export default SuperAdminPlansPage;


