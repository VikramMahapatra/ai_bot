import React, { useEffect, useState } from 'react';
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
  const [editingOrg, setEditingOrg] = useState<SuperAdminOrganization | null>(null);
  const [editLimits, setEditLimits] = useState<OrganizationLimits>(defaultLimits);
  const [editPlanId, setEditPlanId] = useState<number>(0);
  const [editBillingCycle, setEditBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [editTrialDays, setEditTrialDays] = useState<number>(0);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewOrg, setViewOrg] = useState<SuperAdminOrganization | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<any | null>(null)

  const [openCallingNumberDialog, setOpenCallingNumberDialog] = useState(false)
  const [openCallingNumberForm, setOpenCallingNumberForm] = useState(false)
  const [numbers, setNumbers] = useState<any[]>([])
  const [editing, setEditing] = useState(false)
  const [selectedRow, setSelectedRow] = useState<any | null>(null)
  const [callingform, setCallingForm] = useState({
    calling_number: "",
    is_default: false,
    is_active: true
  })

  const [callingFormError, setCallingFormError] = useState({
    calling_number: ""
  })

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
    if (!form.plan_id) {
      return;
    }
    await superadminService.createOrganization({
      ...form,
      limits,
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
    setCreateOpen(false);
    loadOrganizations();
  };

  const handleEditOpen = (org: SuperAdminOrganization) => {
    setEditingOrg(org);
    setEditLimits(org.limits || defaultLimits);
    setEditPlanId(org.plan?.id || plans[0]?.id || 0);
    setEditBillingCycle(org.subscription?.billing_cycle || 'monthly');
    setEditTrialDays(0);
    setOpen(true);
  };

  const handleViewOpen = (org: SuperAdminOrganization) => {
    setViewOrg(org);
    setViewOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingOrg) return;
    await superadminService.updateLimits(editingOrg.id, editLimits);
    if (editPlanId) {
      await superadminService.assignSubscription(editingOrg.id, {
        plan_id: editPlanId,
        billing_cycle: editBillingCycle,
        trial_days: editTrialDays || 0,
      });
    }
    setOpen(false);
    setEditingOrg(null);
    loadOrganizations();
  };

  return (
    <SuperAdminLayout>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 2.3 },
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
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Organization Management
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create organizations, assign plans, and override limits.
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            New Organization
          </Button>
        </Box>
      </Paper>

      <Grid container spacing={3}>
        {organizations.map((org) => (
          <Grid item xs={12} md={6} key={org.id}>
            <Card sx={{
              border: '1px solid',
              borderColor: alpha(theme.palette.primary.main, 0.18),
              borderRadius: 3,
              background: 'linear-gradient(135deg, rgba(53,108,255,0.1) 0%, rgba(255,255,255,1) 60%)',
              transition: 'all 0.2s ease',
              '&:hover': { boxShadow: 3, transform: 'translateY(-2px)' },
            }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {org.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Admin: {org.admin_username || 'N/A'} ({org.admin_email || '-'})
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                  <Chip label={org.plan?.name || 'Unassigned'} size="small" variant="outlined" />
                  <Chip label={`Days left: ${org.subscription?.days_left ?? 0}`} size="small" />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {org.subscription
                    ? `Start: ${new Date(org.subscription.start_date).toLocaleDateString()} | End: ${new Date(org.subscription.end_date).toLocaleDateString()}`
                    : 'No active subscription'}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
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
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} maxWidth="md" fullWidth>
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

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="md" fullWidth>
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
                  onChange={(e) => setForm({ ...form, plan_id: Number(e.target.value) })}
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

          <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
            Default Limits (Overrides)
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
            ] as [keyof OrganizationLimits, string][]).map(([key, label]) => (
              <Grid item xs={12} md={4} key={key}>
                <TextField
                  label={label}
                  type="number"
                  fullWidth
                  value={limits[key] as number}
                  onChange={(e) => setLimits({ ...limits, [key]: Number(e.target.value) })}
                />
              </Grid>
            ))}
            <Grid item xs={12} md={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={limits.lead_generation_enabled}
                    onChange={(e) => setLimits({ ...limits, lead_generation_enabled: e.target.checked })}
                  />
                }
                label="Lead Generation Enabled"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={!!limits.voice_chat_enabled}
                    onChange={(e) => setLimits({ ...limits, voice_chat_enabled: e.target.checked })}
                  />
                }
                label="Voice Chat Enabled"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={!!limits.multilingual_text_enabled}
                    onChange={(e) => setLimits({ ...limits, multilingual_text_enabled: e.target.checked })}
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

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Limits</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Plan</InputLabel>
                <Select
                  label="Plan"
                  value={editPlanId}
                  onChange={(e) => setEditPlanId(Number(e.target.value))}
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
            {([
              ['monthly_conversation_limit', 'Monthly Conversations'],
              ['monthly_crawl_pages_limit', 'Monthly Crawl Pages'],
              ['max_crawl_depth', 'Max Crawl Depth'],
              ['monthly_document_limit', 'Monthly Documents'],
              ['max_document_size_mb', 'Max Document Size (MB)'],
              ['monthly_token_limit', 'Monthly Token Limit'],
              ['max_query_words', 'Max Query Words'],
            ] as [keyof OrganizationLimits, string][]).map(([key, label]) => (
              <Grid item xs={12} md={6} key={key}>
                <TextField
                  label={label}
                  type="number"
                  fullWidth
                  value={editLimits[key] as number}
                  onChange={(e) => setEditLimits({ ...editLimits, [key]: Number(e.target.value) })}
                />
              </Grid>
            ))}
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={editLimits.lead_generation_enabled}
                    onChange={(e) => setEditLimits({ ...editLimits, lead_generation_enabled: e.target.checked })}
                  />
                }
                label="Lead Generation Enabled"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={!!editLimits.voice_chat_enabled}
                    onChange={(e) => setEditLimits({ ...editLimits, voice_chat_enabled: e.target.checked })}
                  />
                }
                label="Voice Chat Enabled"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={!!editLimits.multilingual_text_enabled}
                    onChange={(e) => setEditLimits({ ...editLimits, multilingual_text_enabled: e.target.checked })}
                  />
                }
                label="Multilingual Text Enabled"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleEditSave}>Save</Button>
        </DialogActions>
      </Dialog>


      <Dialog
        open={openCallingNumberDialog}
        onClose={handleCloseCallingDialog}
        fullWidth
        maxWidth="md"
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

      <Dialog open={openCallingNumberForm} onClose={(handleCloseCallingForm)}>
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


