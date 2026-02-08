import React, { useEffect, useState } from 'react';
import {
  Box,
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
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import SuperAdminLayout from '../components/Layout/SuperAdminLayout';
import { superadminService } from '../services/superadminService';
import { Plan } from '../types';

const defaultPlan: Omit<Plan, 'id'> = {
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
};

const SuperAdminPlansPage: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState<Omit<Plan, 'id'>>(defaultPlan);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [editForm, setEditForm] = useState<Omit<Plan, 'id'>>(defaultPlan);

  const loadPlans = async () => {
    const data = await superadminService.listPlans();
    setPlans(data);
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const handleCreate = async () => {
    await superadminService.createPlan(form);
    setForm(defaultPlan);
    setCreateOpen(false);
    loadPlans();
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
    };

    try {
      await superadminService.createPlan(starter as Omit<Plan, 'id'>);
    } catch {}
    try {
      await superadminService.createPlan(growth as Omit<Plan, 'id'>);
    } catch {}
    loadPlans();
  };

  const handleToggleActive = async (plan: Plan) => {
    await superadminService.updatePlan(plan.id, { is_active: !plan.is_active });
    loadPlans();
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
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!activePlan) return;
    await superadminService.updatePlan(activePlan.id, editForm);
    setEditOpen(false);
    setActivePlan(null);
    loadPlans();
  };

  return (
    <SuperAdminLayout>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Plans
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage subscription plans and their limits.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button variant="outlined" onClick={handleSeedDefaults}>
            Seed Starter/Growth
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            New Plan
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {plans.map((plan) => (
          <Grid item xs={12} md={6} key={plan.id}>
            <Card sx={{
              border: '1px solid',
              borderColor: 'divider',
              background: 'linear-gradient(135deg, rgba(38,155,159,0.08) 0%, rgba(255,255,255,1) 60%)',
              transition: 'all 0.2s ease',
              '&:hover': { boxShadow: 3 },
            }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {plan.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  ₹{plan.price_inr} / {plan.billing_cycle}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {plan.description || 'No description'}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <Chip label={plan.is_active ? 'Active' : 'Inactive'} color={plan.is_active ? 'success' : 'default'} size="small" />
                  <Chip label={`${plan.monthly_conversation_limit} conv/mo`} size="small" variant="outlined" />
                </Box>
                <FormControlLabel
                  sx={{ mt: 1 }}
                  control={
                    <Switch
                      checked={plan.is_active}
                      onChange={() => handleToggleActive(plan)}
                    />
                  }
                  label={plan.is_active ? 'Active' : 'Inactive'}
                />
                <Grid container spacing={1} sx={{ mt: 1 }}>
                  <Grid item>
                    <Tooltip title="View">
                      <IconButton
                        onClick={() => handleOpenView(plan)}
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 2,
                          bgcolor: 'rgba(38,155,159,0.15)',
                          color: 'primary.main',
                          '&:hover': { bgcolor: 'rgba(38,155,159,0.25)' },
                        }}
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                  </Grid>
                  <Grid item>
                    <Tooltip title="Edit">
                      <IconButton
                        onClick={() => handleOpenEdit(plan)}
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 2,
                          bgcolor: 'rgba(124,58,237,0.15)',
                          color: '#7c3aed',
                          '&:hover': { bgcolor: 'rgba(124,58,237,0.25)' },
                        }}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Plan</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField label="Plan Name" fullWidth value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Price (INR)" type="number" fullWidth value={form.price_inr} onChange={(e) => setForm({ ...form, price_inr: Number(e.target.value) })} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Description" fullWidth value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={6}>
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
          </Grid>

          <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
            Limits
          </Typography>
          <Grid container spacing={2}>
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
                <TextField
                  label={label}
                  type="number"
                  fullWidth
                  value={form[key] as number}
                  onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
                />
              </Grid>
            ))}
            <Grid item xs={12} md={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.lead_generation_enabled}
                    onChange={(e) => setForm({ ...form, lead_generation_enabled: e.target.checked })}
                  />
                }
                label="Lead Generation Enabled"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.voice_chat_enabled}
                    onChange={(e) => setForm({ ...form, voice_chat_enabled: e.target.checked })}
                  />
                }
                label="Voice Chat Enabled"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.multilingual_text_enabled}
                    onChange={(e) => setForm({ ...form, multilingual_text_enabled: e.target.checked })}
                  />
                }
                label="Multilingual Text Enabled"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate}>Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} maxWidth="md" fullWidth>
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
              <Grid item xs={12} md={4}>
                <TextField label="Lead Generation Enabled" fullWidth value={activePlan.lead_generation_enabled ? 'Yes' : 'No'} InputProps={{ readOnly: true }} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField label="Voice Chat Enabled" fullWidth value={activePlan.voice_chat_enabled ? 'Yes' : 'No'} InputProps={{ readOnly: true }} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField label="Multilingual Text Enabled" fullWidth value={activePlan.multilingual_text_enabled ? 'Yes' : 'No'} InputProps={{ readOnly: true }} />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="md" fullWidth>
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
                <TextField
                  label={label}
                  type="number"
                  fullWidth
                  value={editForm[key] as number}
                  onChange={(e) => setEditForm({ ...editForm, [key]: Number(e.target.value) })}
                />
              </Grid>
            ))}
            <Grid item xs={12} md={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={editForm.lead_generation_enabled}
                    onChange={(e) => setEditForm({ ...editForm, lead_generation_enabled: e.target.checked })}
                  />
                }
                label="Lead Generation Enabled"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={editForm.voice_chat_enabled}
                    onChange={(e) => setEditForm({ ...editForm, voice_chat_enabled: e.target.checked })}
                  />
                }
                label="Voice Chat Enabled"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={editForm.multilingual_text_enabled}
                    onChange={(e) => setEditForm({ ...editForm, multilingual_text_enabled: e.target.checked })}
                  />
                }
                label="Multilingual Text Enabled"
              />
            </Grid>
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
          <Button variant="contained" onClick={handleSaveEdit}>Save</Button>
        </DialogActions>
      </Dialog>
    </SuperAdminLayout>
  );
};

export default SuperAdminPlansPage;
