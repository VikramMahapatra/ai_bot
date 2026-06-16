import React, { useEffect, useMemo, useState } from "react";
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
  TableContainer,
  TablePagination,
  ToggleButton,
  ToggleButtonGroup,
  InputAdornment,
  Stack,
  Divider,
  Alert,
  CircularProgress,
  FormHelperText,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EditIcon from "@mui/icons-material/Edit";
import SearchIcon from "@mui/icons-material/Search";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import ViewListIcon from "@mui/icons-material/ViewList";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import SuperAdminLayout from "../components/Layout/SuperAdminLayout";
import { ConfirmDialog } from "../components/Common/ConfirmDialog";
import { superadminService } from "../services/superadminService";
import {
  OrganizationLimits,
  SuperAdminOrganization,
  Channel,
  OrganizationLimitKey,
  LimitToggleField,
  OrganizationCallingNumber,
} from "../types";
import SettingsPhoneIcon from "@mui/icons-material/SettingsPhone";
import DeleteIcon from "@mui/icons-material/Delete";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import HubIcon from "@mui/icons-material/Hub";
import ShareIcon from "@mui/icons-material/Share";
import LiveTvIcon from "@mui/icons-material/LiveTv";
import TvIcon from "@mui/icons-material/Tv";
import { StatusChip } from "../components/Common/StatusChips";
import OrganizationFormDialog from "../components/SuperAdmin/OrganizationFormDialog";
import { CallingNumber } from "../services/callingNumberService";


const limitToggleFields: LimitToggleField[] = [
  // Communication Channels
  {
    key: "whatsapp_enabled",
    label: "WhatsApp",
    visible: true,
    category: "Communication Channels",
  },
  {
    key: "instagram_chat_enabled",
    label: "Instagram Chatbot",
    visible: true,
    category: "Communication Channels",
  },
  {
    key: "facebook_messenger_enabled",
    label: "Facebook Messenger",
    visible: true,
    category: "Communication Channels",
  },

  // AI & Automation
  {
    key: "voice_chat_enabled",
    label: "Voice Chatbot",
    visible: true,
    category: "Communication Channels",
  },
  {
    key: "human_handoff_enabled",
    label: "Human Handoff",
    visible: true,
    category: "AI & Automation",
  },
  {
    key: "module_followup_workflow_enabled",
    label: "Follow-up Workflow",
    visible: true,
    category: "AI & Automation",
  },

  // Campaigns
  {
    key: "email_campaign_enabled",
    label: "Email Campaign",
    visible: true,
    category: "Campaigns",
  },
  {
    key: "sms_campaign_enabled",
    label: "SMS Campaign",
    visible: true,
    category: "Campaigns",
  },
  {
    key: "whatsapp_campaign_enabled",
    label: "WhatsApp Campaign",
    visible: true,
    category: "Campaigns",
  },
  {
    key: "ai_assistant_campaign_enabled",
    label: "AI Assistant Campaign",
    visible: true,
    category: "Campaigns",
  },

  // Voice Calling
  {
    key: "inbound_voice_enabled",
    label: "Inbound Calling",
    visible: true,
    category: "Voice Calling",
  },
  {
    key: "outbound_voice_enabled",
    label: "Outbound Calling",
    visible: true,
    category: "Voice Calling",
  },
  {
    key: "call_forwarding_enabled",
    label: "Call Forwarding",
    visible: true,
    category: "Voice Calling",
  },

  // Core Modules
  {
    key: "module_leads_enabled",
    label: "Leads",
    visible: true,
    category: "Core Modules",
  },
  {
    key: "module_appointments_enabled",
    label: "Appointments",
    visible: true,
    category: "Core Modules",
  },
  {
    key: "module_campaigns_enabled",
    label: "Campaigns",
    visible: true,
    category: "Core Modules",
  },
  {
    key: "module_products_enabled",
    label: "Products",
    visible: true,
    category: "Core Modules",
  },
  {
    key: "module_knowledge_enabled",
    label: "Knowledge",
    visible: true,
    category: "Core Modules",
  },

  // Analytics
  {
    key: "module_analytics_enabled",
    label: "Analytics",
    visible: true,
    category: "Analytics",
  },
  {
    key: "module_advanced_analytics_enabled",
    label: "Advanced Analytics",
    visible: true,
    category: "Analytics",
  },
  {
    key: "module_reports_enabled",
    label: "Reports",
    visible: true,
    category: "Analytics",
  },

  // Hidden / Legacy
  {
    key: "lead_generation_enabled",
    label: "Lead Generation",
    visible: false,
    category: "AI & Automation",
  },
  {
    key: "multilingual_text_enabled",
    label: "Multilingual Text",
    visible: false,
    category: "AI & Automation",
  },
  {
    key: "module_users_enabled",
    label: "Users",
    visible: true,
    category: "Core Modules",
  },
];
const organizationLimitKeys: Array<keyof OrganizationLimits> = [
  ...limitToggleFields.map((field) => field.key),

  "outbound_call_billing_model",
  "max_outbound_calls",
  "max_outbound_voice_agents",
  "max_inbound_voice_agents",
];

const defaultLimits: OrganizationLimits = {
  lead_generation_enabled: true,
  voice_chat_enabled: false,
  multilingual_text_enabled: false,
  instagram_chat_enabled: false,
  facebook_messenger_enabled: false,
  whatsapp_enabled: false,
  email_campaign_enabled: true,
  sms_campaign_enabled: true,
  whatsapp_campaign_enabled: true,
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
  call_forwarding_enabled: true,
  inbound_voice_enabled: true,
  outbound_voice_enabled: true,
  ai_assistant_campaign_enabled: false,
  outbound_call_billing_model: "per_attempt",
  max_outbound_calls: 0,
  max_outbound_voice_agents: 0,
  max_inbound_voice_agents: 0
};

const SuperAdminOrganizationsPage: React.FC = () => {
  const theme = useTheme();
  const [organizations, setOrganizations] = useState<SuperAdminOrganization[]>(
    [],
  );
  const [form, setForm] = useState({
    organization_name: "",
    description: "",
    joining_date: "",
    effective_joining_date: "",
    admin_username: "",
    admin_email: "",
    admin_password: "",
    status: "trial",
    trial_end_date: "",
    echoleads_api_key: "",
    industry: "",
    commercial_notes: "",
    timezone: ""
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [createOverrideLimits, setCreateOverrideLimits] = useState<
    Partial<OrganizationLimits>
  >({ ...defaultLimits });
  const [editingOrg, setEditingOrg] = useState<SuperAdminOrganization | null>(
    null,
  );
  const [editAdminUsername, setEditAdminUsername] = useState("");
  const [editAdminEmail, setEditAdminEmail] = useState("");
  const [editAdminPassword, setEditAdminPassword] = useState("");
  const [editJoiningDate, setEditJoiningDate] = useState("");
  const [editEffectiveJoiningDate, setEditEffectiveJoiningDate] = useState("");
  const [editOverrideLimits, setEditOverrideLimits] = useState<
    Partial<OrganizationLimits>
  >({ ...defaultLimits });
  const [viewOpen, setViewOpen] = useState(false);
  const [viewOrg, setViewOrg] = useState<SuperAdminOrganization | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<any | null>(null);

  const [openCallingNumberDialog, setOpenCallingNumberDialog] = useState(false);
  const [openCallingNumberForm, setOpenCallingNumberForm] = useState(false);
  const [openChannelDialog, setOpenChannelDialog] = useState(false);
  const [openChannelForm, setOpenChannelForm] = useState(false);
  const [numbers, setNumbers] = useState<any[]>([]);
  const [editing, setEditing] = useState(false);
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [isSavingOrg, setIsSavingOrg] = useState(false);
  const [deletingOrgId, setDeletingOrgId] = useState<number | null>(null);
  const [callingNumberToDelete, setCallingNumberToDelete] = useState<{
    id: number;
    number: string;
  } | null>(null);
  const [callingNumberDeleteSubmitting, setCallingNumberDeleteSubmitting] =
    useState(false);
  const [orgToDelete, setOrgToDelete] = useState<SuperAdminOrganization | null>(
    null,
  );
  const [orgSearch, setOrgSearch] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(8);
  const [createResultDialog, setCreateResultDialog] = useState<{
    open: boolean;
    success: boolean;
    title: string;
    message: string;
  }>({
    open: false,
    success: true,
    title: "",
    message: "",
  });

  const [callingform, setCallingForm] = useState<Partial<OrganizationCallingNumber>>({
    calling_number_id: "",
    is_default: false,
    is_active: true,
    type: "outbound",
  });

  const [callingFormError, setCallingFormError] = useState({
    calling_number_id: "",
  });
  const [channelForm, setChannelForm] = useState({
    channel_id: 0,
    name: "",
  });
  const [channelFormError, setChannelFormError] = useState({
    name: "",
  });
  const [masterChannels, setMasterChannels] = useState<any[]>([]);
  const [orgChannels, setOrgChannels] = useState<any[]>([]);
  const [channelToDelete, setChannelToDelete] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [channelDeleteSubmitting, setChannelDeleteSubmitting] = useState(false);

  const [editEchoLeadsAPIKey, setEditEchoLeadsAPIKey] = useState("");
  const [callingNumberDefault, setCallingNumberDefault] = useState(false);
  const [callingNumbers, setCallingNumbers] = useState<CallingNumber[]>([]);
  const [callingNumberError, setCallingNumberError] = useState("");

  const orgStats = useMemo(() => {
    const total = organizations.length;
    const leadGenerationEnabled = organizations.filter((org) =>
      Boolean(org.limits?.lead_generation_enabled),
    ).length;
    const whatsappEnabled = organizations.filter((org) =>
      Boolean(org.limits?.whatsapp_enabled),
    ).length;
    const humanHandoffEnabled = organizations.filter((org) =>
      Boolean(org.limits?.human_handoff_enabled),
    ).length;
    return {
      total,
      leadGenerationEnabled,
      whatsappEnabled,
      humanHandoffEnabled,
    };
  }, [organizations]);

  const filteredOrganizations = useMemo(() => {
    const term = orgSearch.trim().toLowerCase();
    const sorted = [...organizations].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    if (!term) return sorted;
    return sorted.filter((org) =>
      [
        org.name,
        org.description || "",
        org.admin_username || "",
        org.admin_email || "",
        org.joining_date || "",
        org.effective_joining_date || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [organizations, orgSearch]);

  const pagedOrganizations = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredOrganizations.slice(start, start + rowsPerPage);
  }, [filteredOrganizations, page, rowsPerPage]);

  const formatDate = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString();
  };

  const normalizeErrorDetail = (detail: unknown): string => {
    if (typeof detail === "string") return detail;
    if (detail && typeof detail === "object") return JSON.stringify(detail);
    return "Failed to create organization";
  };

  useEffect(() => {
    fetchMasterChannels();
  }, []);

  useEffect(() => {
    setPage(0);
  }, [orgSearch, rowsPerPage, viewMode]);

  useEffect(() => {
    if (openCallingNumberDialog) {
      fetchCallingNumbers();
      loadCallingNumbers();
    }
  }, [openCallingNumberDialog]);


  useEffect(() => {
    loadCallingNumbers();
  }, [callingform.type]);

  useEffect(() => {
    if (openChannelDialog) {
      fetchOrgChannels();
    }
  }, [openChannelDialog]);

  const fetchCallingNumbers = async () => {
    if (!selectedOrg) return;

    try {
      const res = await superadminService.getCallingNumbers(selectedOrg.id);
      setNumbers(res);
    } catch (error) {
      console.error("Failed to fetch calling numbers", error);
    }
  };

  const fetchMasterChannels = async () => {
    try {
      const res = await superadminService.getMasterChanels();
      setMasterChannels(res);
    } catch (error) {
      console.error("Failed to fetch master channels", error);
    }
  };

  const fetchOrgChannels = async () => {
    if (!selectedOrg) return;

    try {
      const res = await superadminService.getOrganizationChanels(
        selectedOrg.id,
      );
      setOrgChannels(res);
    } catch (error) {
      console.error("Failed to fetch organization channels", error);
    }
  };

  const loadCallingNumbers = async () => {
    if (!selectedOrg) return;

    try {
      const data = await superadminService.getMasterCallingNumbers(callingform.type);
      setCallingNumbers(data);
    } catch (error) {
      console.error("Failed to fetch organization channels", error);
    }
  };

  const validateCallingForm = () => {
    let valid = true;
    let errors: any = {};

    if (!callingform.calling_number_id) {
      errors.calling_number_id = "Calling number is required";
      valid = false;
    }

    if (!callingform.type) {
      errors.type = "Type is required";
      valid = false;
    }

    console.log(errors);

    setCallingFormError(errors);
    return valid;
  };

  const handleAddCallingNumber = () => {
    setEditing(false);

    setCallingForm({
      calling_number: "",
      is_default: false,
      is_active: true,
      type: "outbound",
    });

    setOpenCallingNumberForm(true);
  };

  const handleCallingEdit = (row: any) => {
    setEditing(true);
    setSelectedRow(row);

    setCallingForm({
      calling_number: row.calling_number,
      is_default: row.is_default,
      is_active: row.is_active,
      type: row.type,
    });

    setOpenCallingNumberForm(true);
  };

  const handleCloseCallingDialog = () => {
    setOpenCallingNumberDialog(false);
    setOpenCallingNumberForm(false);
    setSelectedRow(null);
  };

  const handleCloseCallingForm = () => {
    setOpenCallingNumberForm(false);
    setSelectedRow(null);
  };

  //#### Channel ########

  const validateChannelForm = () => {
    let valid = true;
    let errors: any = {};

    if (!channelForm.name) {
      errors.name = "Select channel before save";
      valid = false;
    }

    console.log(errors);

    setChannelFormError(errors);
    return valid;
  };

  const handleOpenChannelDialog = (org: any) => {
    setSelectedOrg(org);
    setOpenChannelDialog(true);
  };

  const handleCloseChannelDialog = () => {
    setOpenChannelDialog(false);
    setSelectedRow(null);
  };

  const handleCloseChannelForm = () => {
    setOpenChannelForm(false);
    setSelectedRow(null);
  };

  const handleAddChannel = () => {
    setEditing(false);
    setChannelFormError({
      name: "",
    });
    setChannelForm({
      channel_id: 0,
      name: "",
    });
    setOpenChannelForm(true);
  };

  const handleChannelEdit = (row: any) => {
    setEditing(true);
    setSelectedRow(row);

    setChannelFormError({
      name: "",
    });

    setChannelForm({
      channel_id: row.channel_id,
      name: row.name,
    });

    setOpenChannelForm(true);
  };

  const handleOrgChannelSave = async () => {
    if (!validateChannelForm()) return;

    try {
      if (editing) {
        // update api
        await superadminService.updateOrgChannel(
          selectedRow.id,
          channelForm.channel_id,
        );
      } else {
        // create api
        await superadminService.createOrgChannel(
          selectedOrg.id,
          channelForm.channel_id,
        );
      }

      fetchOrgChannels();
      handleCloseChannelForm();
    } catch (error) {
      console.error(error);
    }
  };

  const handleConfirmDeleteOrgChannel = async () => {
    if (!channelToDelete) return;

    setChannelDeleteSubmitting(true);
    try {
      await superadminService.deleteOrgChannel(channelToDelete.id);
      setChannelToDelete(null);
      fetchOrgChannels();
    } catch (error) {
      console.error(error);
    } finally {
      setChannelDeleteSubmitting(false);
    }
  };

  const handleCallingSave = async () => {
    if (!validateCallingForm()) return;

    try {
      if (editing) {
        // update api
        await superadminService.updateCallingNumber(
          selectedRow.id,
          callingform,
        );
      } else {
        // create api
        await superadminService.createCallingNumber(
          selectedOrg.id,
          callingform,
        );
      }

      fetchCallingNumbers();
      handleCloseCallingForm();
    } catch (error: any) {
      setCallingNumberError(
        error?.response?.data?.detail ||
        error?.detail ||
        "Failed to save calling number",
      );
    }
  };


  const handleDefault = async (row: any) => {
    await superadminService.setDefaultCallingNumber(row.id);
    fetchCallingNumbers();
  };

  const handleActive = async (row: any) => {
    await superadminService.toggleActiveCallingNumber(row.id);
    fetchCallingNumbers();
  };

  const handleConfirmDeleteCallingNumber = async () => {
    if (!callingNumberToDelete) return;

    setCallingNumberDeleteSubmitting(true);
    try {
      await superadminService.deleteCallingNumber(callingNumberToDelete.id);
      setCallingNumberToDelete(null);
      fetchCallingNumbers();
    } catch (error) {
      console.error(error);
    } finally {
      setCallingNumberDeleteSubmitting(false);
    }
  };

  const handleOpenCallingNumberDialog = (org: any) => {
    setSelectedOrg(org);
    setOpenCallingNumberDialog(true);
  };

  const loadOrganizations = async () => {
    const data = await superadminService.listOrganizations();
    setOrganizations(data);
  };

  useEffect(() => {
    loadOrganizations();
  }, []);

  const handleCreate = async () => {
    try {
      setIsCreatingOrg(true);
      setActionError("");

      const trimmedAdminUsername = form.admin_username.trim();
      const trimmedAdminEmail = form.admin_email.trim();
      const trimmedAdminPassword = form.admin_password.trim();
      const trimmedOrgName = form.organization_name.trim();
      const trimmedAPIKey = form.echoleads_api_key.trim();

      // Validation
      if (!trimmedOrgName) {
        setActionError("Organization name is required.");
        return;
      }

      if (!trimmedAdminUsername) {
        setActionError("Admin username is required.");
        return;
      }

      if (!trimmedAdminEmail) {
        setActionError("Admin email is required.");
        return;
      }

      if (!trimmedAdminPassword) {
        setActionError("Admin password is required.");
        return;
      }

      if (form.status === "trial" && !form.trial_end_date) {
        setActionError("Trial end date is required for organizations in trial status.");
        return;
      }

      const payloadLimits = organizationLimitKeys.reduce<
        Partial<OrganizationLimits>
      >((acc, key) => {
        const value = createOverrideLimits[key];
        if (value !== undefined) {
          (acc as Record<string, unknown>)[key as string] = value;
        }
        return acc;
      }, {});

      await superadminService.createOrganization({
        organization_name: trimmedOrgName,
        description: form.description?.trim() || undefined,
        joining_date: form.joining_date || undefined,
        effective_joining_date: form.effective_joining_date || undefined,
        admin_username: trimmedAdminUsername,
        admin_email: trimmedAdminEmail,
        admin_password: trimmedAdminPassword,
        limits: payloadLimits,
        echoleads_api_key: trimmedAPIKey || undefined,
        status: form.status,
        trial_end_date: form.status === "trial" ? form.trial_end_date || undefined : undefined,
        industry: form.industry?.trim() || undefined,
        commercial_notes: form.commercial_notes?.trim() || undefined,
      });

      setCreateResultDialog({
        open: true,
        success: true,
        title: "Organization Created",
        message: "Organization and admin user were created successfully.",
      });
    } catch (error: any) {
      setCreateResultDialog({
        open: true,
        success: false,
        title: "Creation Failed",
        message: normalizeErrorDetail(error?.response?.data?.detail),
      });
    } finally {
      setIsCreatingOrg(false);
    }
  };

  const handleCreateResultOk = async () => {
    setCreateResultDialog((prev) => ({ ...prev, open: false }));
    setCreateOpen(false);
    setForm({
      organization_name: "",
      description: "",
      joining_date: "",
      effective_joining_date: "",
      admin_username: "",
      admin_email: "",
      admin_password: "",
      echoleads_api_key: "",
      status: "trial",
      trial_end_date: "",
      industry: "",
      commercial_notes: "",
      timezone: ""
    });
    setCreateOverrideLimits({ ...defaultLimits });
    await loadOrganizations();
  };

  const handleEditOpen = (org: SuperAdminOrganization) => {
    setEditingOrg(org);
    setEditAdminUsername(org.admin_username || "");
    setEditAdminEmail(org.admin_email || "");
    setEditAdminPassword("");
    setEditJoiningDate(org.joining_date || "");
    setEditEffectiveJoiningDate(org.effective_joining_date || "");
    setEditOverrideLimits({ ...defaultLimits, ...(org.limits || {}) });
    setEditEchoLeadsAPIKey(org.echoleads_api_key || "");
    setOpen(true);
  };

  const handleViewOpen = (org: SuperAdminOrganization) => {
    setViewOrg(org);
    setViewOpen(true);
  };

  const handleEditSave = async () => {
    try {
      setIsSavingOrg(true);
      setActionError("");
      setActionSuccess("");
      if (!editingOrg) return;
      const trimmedAdminUsername = editAdminUsername.trim();
      const trimmedAdminEmail = editAdminEmail.trim();
      const trimmedAdminPassword = editAdminPassword.trim();
      const missingAdmin = !editingOrg.admin_username;
      const trimmedAPIKey = editEchoLeadsAPIKey.trim();

      if (!trimmedAdminUsername) {
        setActionError("Admin username is required.");
        return;
      }
      if (!trimmedAdminEmail) {
        setActionError("Admin email is required.");
        return;
      }
      if (missingAdmin && !trimmedAdminPassword) {
        setActionError("Admin password is required to create missing admin.");
        return;
      }

      if (editingOrg.status === "trial" && !editingOrg.trial_end_date) {
        setActionError("Trial end date is required for organizations in trial status.");
        return;
      }

      await superadminService.updateOrganization(editingOrg.id, {
        joining_date: editJoiningDate || undefined,
        effective_joining_date: editEffectiveJoiningDate || undefined,
        admin_username: trimmedAdminUsername,
        admin_email: trimmedAdminEmail,
        admin_password: trimmedAdminPassword || undefined,
        echoleads_api_key: trimmedAPIKey || undefined,
        status: editingOrg.status,
        trial_end_date: editingOrg.trial_end_date || undefined,
        industry: editingOrg.industry || undefined,
        commercial_notes: editingOrg.commercial_notes || undefined,
        organization_name: editingOrg.name,
        description: editingOrg.description || undefined,
        timezone: editingOrg.timezone || undefined,
      });

      // Only send true overrides
      const payloadLimits = organizationLimitKeys.reduce<
        Partial<OrganizationLimits>
      >((acc, key) => {
        const value = editOverrideLimits[key];
        if (value !== undefined) {
          (acc as Record<string, unknown>)[key as string] = value;
        }
        return acc;
      }, {});
      await superadminService.updateLimits(editingOrg.id, payloadLimits);
      setOpen(false);
      setEditingOrg(null);
      setActionSuccess("Organization updated successfully.");
      loadOrganizations();
    } catch (error: any) {
      setActionError(
        error?.response?.data?.detail || "Failed to update organization",
      );
    } finally {
      setIsSavingOrg(false);
    }
  };

  const handleConfirmDeleteOrganization = async () => {
    if (!orgToDelete) return;

    try {
      setDeletingOrgId(orgToDelete.id);
      setActionError("");
      setActionSuccess("");
      await superadminService.deleteOrganization(orgToDelete.id);
      const deletedName = orgToDelete.name;
      if (editingOrg?.id === orgToDelete.id) {
        setOpen(false);
        setEditingOrg(null);
      }
      if (viewOrg?.id === orgToDelete.id) {
        setViewOpen(false);
        setViewOrg(null);
      }
      setOrgToDelete(null);
      setActionSuccess(`Organization "${deletedName}" deleted successfully.`);
      await loadOrganizations();
    } catch (error: any) {
      setActionError(
        error?.response?.data?.detail || "Failed to delete organization",
      );
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
          borderRadius: "22px",
          border: `1px solid ${alpha(theme.palette.common.white, 0.65)}`,
          background: `linear-gradient(132deg, ${alpha("#cbe7e8", 0.94)} 0%, ${alpha(
            theme.palette.background.paper,
            0.84,
          )} 66%, ${alpha("#9ed7d8", 0.96)} 100%)`,
          boxShadow: `0 18px 36px ${alpha(theme.palette.primary.dark, 0.24)}`,
          position: "relative",
          overflow: "hidden",
          "&::before": {
            content: '""',
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(115deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.06) 34%, rgba(255,255,255,0) 62%)",
            pointerEvents: "none",
          },
          "&::after": {
            content: '""',
            position: "absolute",
            top: "-24%",
            right: "-6%",
            width: "42%",
            height: "150%",
            background:
              "radial-gradient(circle, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0) 72%)",
            pointerEvents: "none",
          },
          "& > *": {
            position: "relative",
            zIndex: 1,
          },
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
          spacing={2}
        >
          <Box>
            <Typography
              variant="overline"
              sx={{
                letterSpacing: 1.4,
                fontWeight: 700,
                color: alpha(theme.palette.primary.dark, 0.75),
              }}
            >
              Tenant Control Center
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.15 }}>
              Organization Management
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: alpha(theme.palette.text.primary, 0.75), mt: 0.75 }}
            >
              Create tenants and manage feature governance directly per
              organization.
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
          >
            New Organization
          </Button>
        </Stack>
      </Paper>

      {actionError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => setActionError("")}
        >
          {actionError}
        </Alert>
      )}
      {actionSuccess && (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
          onClose={() => setActionSuccess("")}
        >
          {actionSuccess}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: "Total Organizations", value: orgStats.total },
          {
            label: "Lead Generation On",
            value: orgStats.leadGenerationEnabled,
          },
          { label: "WhatsApp On", value: orgStats.whatsappEnabled },
          { label: "Human Handoff On", value: orgStats.humanHandoffEnabled },
        ].map((item) => (
          <Grid item xs={12} sm={6} md={3} key={item.label}>
            <Paper
              elevation={0}
              sx={{
                p: 1.8,
                borderRadius: "16px",
                border: `1px solid ${alpha(theme.palette.secondary.main, 0.18)}`,
                background: `linear-gradient(155deg, ${alpha("#ecfbf8", 0.92)} 0%, ${alpha("#ffffff", 1)} 86%)`,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: alpha(theme.palette.text.primary, 0.65),
                  fontWeight: 600,
                }}
              >
                {item.label}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, mt: 0.4 }}>
                {item.value}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Paper
        elevation={0}
        sx={{
          p: 1.6,
          mb: 2,
          borderRadius: "16px",
          border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
          background: `linear-gradient(150deg, ${alpha("#eef6ff", 0.85)} 0%, ${alpha("#ffffff", 1)} 88%)`,
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.3}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", md: "center" }}
        >
          <TextField
            size="small"
            label="Search organizations"
            placeholder="Name, admin, email, description, joining date..."
            value={orgSearch}
            onChange={(event) => setOrgSearch(event.target.value)}
            sx={{ minWidth: { xs: "100%", md: 360 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <ToggleButtonGroup
            exclusive
            size="small"
            value={viewMode}
            onChange={(_, value) => value && setViewMode(value)}
          >
            <ToggleButton value="cards">
              <ViewModuleIcon fontSize="small" sx={{ mr: 0.7 }} />
              Cards
            </ToggleButton>
            <ToggleButton value="table">
              <ViewListIcon fontSize="small" sx={{ mr: 0.7 }} />
              Table
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Paper>

      {viewMode === "cards" ? (
        <Grid container spacing={3}>
          {pagedOrganizations.map((org) => (
            <Grid item xs={12} md={6} key={org.id}>
              <Card
                sx={{
                  border: "1px solid",
                  borderColor: alpha(theme.palette.secondary.main, 0.2),
                  borderRadius: "18px",
                  background: `linear-gradient(145deg, ${alpha("#ebfaf7", 0.92)} 0%, rgba(255,255,255,1) 62%)`,
                  transition: "all 0.24s ease",
                  position: "relative",
                  overflow: "hidden",
                  "&::before": {
                    content: '""',
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 4,
                    background: `linear-gradient(90deg, ${theme.palette.secondary.main} 0%, ${theme.palette.primary.main} 100%)`,
                  },
                  "&:hover": {
                    boxShadow: `0 12px 24px ${alpha(theme.palette.secondary.main, 0.18)}`,
                    transform: "translateY(-3px)",
                  },
                }}
              >
                <CardContent>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="flex-start"
                    spacing={1.5}
                  >
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 800 }}>
                        {org.name}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: alpha(theme.palette.text.primary, 0.68) }}
                      >
                        Admin: {org.admin_username || "N/A"} (
                        {org.admin_email || "-"})
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          display: "block",
                          mt: 0.5,
                          color: alpha(theme.palette.text.primary, 0.7),
                        }}
                      >
                        Joining: {formatDate(org.joining_date)} | Effective:{" "}
                        {formatDate(org.effective_joining_date)}
                      </Typography>
                    </Box>

                    <StatusChip
                      value={org.status}
                    />
                  </Stack>

                  <Stack
                    direction="row"
                    spacing={1}
                    flexWrap="wrap"
                    useFlexGap={true}
                    sx={{ mt: 1.2 }}
                  >
                    <Chip
                      label={`Voice: ${org.limits?.voice_chat_enabled ? "On" : "Off"}`}
                      size="small"
                      variant="outlined"
                    />
                    <Chip
                      label={`WhatsApp: ${org.limits?.whatsapp_enabled ? "On" : "Off"}`}
                      size="small"
                      variant="outlined"
                    />
                    <Chip
                      label={`Handoff: ${org.limits?.human_handoff_enabled ? "On" : "Off"}`}
                      size="small"
                      variant="outlined"
                    />
                  </Stack>

                  <Divider
                    sx={{
                      my: 1.45,
                      borderColor: alpha(theme.palette.secondary.main, 0.18),
                    }}
                  />

                  <Stack direction="row" spacing={1.5}>
                    <Tooltip title="View">
                      <IconButton
                        onClick={() => handleViewOpen(org)}
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 2,
                          bgcolor: alpha(theme.palette.primary.main, 0.15),
                          color: "primary.main",
                          "&:hover": {
                            bgcolor: alpha(theme.palette.primary.main, 0.25),
                          },
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
                          color: "secondary.main",
                          "&:hover": {
                            bgcolor: alpha(theme.palette.secondary.main, 0.26),
                          },
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
                          bgcolor: alpha(theme.palette.primary.main, 0.15),
                          color: "secondary.main",
                          "&:hover": {
                            bgcolor: alpha(theme.palette.secondary.main, 0.26),
                          },
                        }}
                      >
                        <SettingsPhoneIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Channel">
                      <IconButton
                        onClick={() => handleOpenChannelDialog(org)}
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 2,
                          bgcolor: alpha(theme.palette.primary.main, 0.2),
                          color: "#0284C7",
                          "&:hover": { bgcolor: "#E0F2FE" },
                        }}
                      >
                        <HubIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Organization">
                      <IconButton
                        onClick={() => setOrgToDelete(org)}
                        disabled={deletingOrgId === org.id}
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 2,
                          bgcolor: alpha(theme.palette.error.main, 0.14),
                          color: "error.main",
                          "&:hover": {
                            bgcolor: alpha(theme.palette.error.main, 0.24),
                          },
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
          {pagedOrganizations.length === 0 && (
            <Grid item xs={12}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: "14px",
                  border: `1px dashed ${alpha(theme.palette.primary.main, 0.3)}`,
                }}
              >
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  No organizations match your filter.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Try another search term or clear the filter.
                </Typography>
              </Paper>
            </Grid>
          )}
        </Grid>
      ) : (
        <Paper
          elevation={0}
          sx={{
            borderRadius: "16px",
            border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
          }}
        >
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Organization</TableCell>
                  <TableCell>Admin</TableCell>
                  <TableCell>Joining Date</TableCell>
                  <TableCell>Effective Start Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pagedOrganizations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No organizations found.
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedOrganizations.map((org) => (
                    <TableRow key={`org-table-${org.id}`} hover>
                      <TableCell sx={{ maxWidth: 250, width: 250 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {org.name}
                        </Typography>

                        <Tooltip title={org.description || "-"} arrow>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              display: "block",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth: 200,
                              cursor: "pointer",
                            }}
                          >
                            {org.description || "-"}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {org.admin_username || "N/A"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {org.admin_email || "-"}
                        </Typography>
                      </TableCell>
                      <TableCell>{formatDate(org.joining_date)}</TableCell>
                      <TableCell>
                        {formatDate(org.effective_joining_date)}
                      </TableCell>
                      <TableCell>
                        <StatusChip
                          value={org.status}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="View">
                          <IconButton
                            onClick={() => handleViewOpen(org)}
                            size="small"
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton
                            onClick={() => handleEditOpen(org)}
                            size="small"
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Calling Numbers">
                          <IconButton
                            onClick={() => handleOpenCallingNumberDialog(org)}
                            size="small"
                          >
                            <SettingsPhoneIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Channel">
                          <IconButton
                            onClick={() => handleOpenChannelDialog(org)}
                            size="small"
                          >
                            <HubIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            onClick={() => setOrgToDelete(org)}
                            size="small"
                            disabled={deletingOrgId === org.id}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <TablePagination
        component="div"
        count={filteredOrganizations.length}
        page={page}
        onPageChange={(_, nextPage) => setPage(nextPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(event) => {
          setRowsPerPage(parseInt(event.target.value, 10));
          setPage(0);
        }}
        rowsPerPageOptions={[8, 16, 24, 48]}
      />

      <Dialog
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: "18px" } }}
      >
        <DialogTitle>Organization Details</DialogTitle>
        <DialogContent>
          {viewOrg && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Organization"
                  fullWidth
                  value={viewOrg.name}
                  InputProps={{ readOnly: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Admin Username"
                  fullWidth
                  value={viewOrg.admin_username || ""}
                  InputProps={{ readOnly: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Admin Email"
                  fullWidth
                  value={viewOrg.admin_email || ""}
                  InputProps={{ readOnly: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Joining Date"
                  fullWidth
                  value={formatDate(viewOrg.joining_date)}
                  InputProps={{ readOnly: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Effective Start Date"
                  fullWidth
                  value={formatDate(viewOrg.effective_joining_date)}
                  InputProps={{ readOnly: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Lead Generation"
                  fullWidth
                  value={
                    viewOrg.limits?.lead_generation_enabled
                      ? "Enabled"
                      : "Disabled"
                  }
                  InputProps={{ readOnly: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Voice Chat"
                  fullWidth
                  value={
                    viewOrg.limits?.voice_chat_enabled ? "Enabled" : "Disabled"
                  }
                  InputProps={{ readOnly: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="WhatsApp"
                  fullWidth
                  value={
                    viewOrg.limits?.whatsapp_enabled ? "Enabled" : "Disabled"
                  }
                  InputProps={{ readOnly: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Human Handoff"
                  fullWidth
                  value={
                    viewOrg.limits?.human_handoff_enabled
                      ? "Enabled"
                      : "Disabled"
                  }
                  InputProps={{ readOnly: true }}
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <OrganizationFormDialog
        mode="create"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        form={form}
        setForm={setForm}
        limits={createOverrideLimits}
        setLimits={setCreateOverrideLimits}
        defaultLimits={defaultLimits}
        limitToggleFields={limitToggleFields}
        loading={isCreatingOrg}
        onSubmit={handleCreate}
        actionError={actionError}
        setActionError={setActionError}
      />
      {editingOrg && (
        <OrganizationFormDialog
          mode="edit"
          open={open}
          onClose={() => setOpen(false)}
          form={editingOrg}
          setForm={setEditingOrg}
          limits={editOverrideLimits}
          setLimits={setEditOverrideLimits}
          defaultLimits={defaultLimits}
          limitToggleFields={limitToggleFields}
          loading={isSavingOrg}
          onSubmit={handleEditSave}
          editingOrg={editingOrg}
          actionError={actionError}
          setActionError={setActionError}
        />
      )}
      <Dialog
        open={createResultDialog.open}
        onClose={handleCreateResultOk}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "18px",
            border: `1px solid ${alpha(
              createResultDialog.success
                ? theme.palette.success.main
                : theme.palette.error.main,
              0.28,
            )}`,
            background: `linear-gradient(160deg, ${alpha(
              createResultDialog.success ? "#eaf9ef" : "#feeef0",
              0.9,
            )} 0%, ${alpha("#ffffff", 1)} 88%)`,
          },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" spacing={1.2} alignItems="center">
            {createResultDialog.success ? (
              <CheckCircleOutlineIcon color="success" />
            ) : (
              <ErrorOutlineIcon color="error" />
            )}
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {createResultDialog.title}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography
            variant="body2"
            sx={{ color: alpha(theme.palette.text.primary, 0.78) }}
          >
            {createResultDialog.message}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={handleCreateResultOk}>
            OK
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openCallingNumberDialog}
        onClose={handleCloseCallingDialog}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: { borderRadius: "18px" } }}
      >
        <DialogTitle>Organization Calling Numbers</DialogTitle>

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
                <TableCell>Type</TableCell>
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
                    <TableCell>{row.calling_number}</TableCell>

                    <TableCell>
                      <Chip
                        label={row.type.replace(/^./, (c: any) => c.toUpperCase())}
                        size="small"
                        color={
                          row.type === "inbound"
                            ? "success"
                            : "primary"
                        }
                        variant="outlined"
                      />
                    </TableCell>

                    <TableCell>
                      {row.is_default && row.type == "outbound" ? (
                        <Chip
                          label="Default"
                          color="primary"
                          size="small"
                          sx={{
                            fontWeight: 600,
                            borderRadius: "20px",
                          }}
                        />
                      ) : (
                        "--"
                      )}
                    </TableCell>

                    <TableCell>
                      <Switch
                        checked={row.is_active}
                        onChange={() => handleActive(row)}
                      />
                    </TableCell>

                    <TableCell align="right">
                      <IconButton onClick={() => handleCallingEdit(row)}>
                        <EditIcon />
                      </IconButton>

                      <IconButton
                        color="error"
                        onClick={() =>
                          setCallingNumberToDelete({
                            id: row.id,
                            number: String(row.calling_number ?? row.id),
                          })
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

      <Dialog
        maxWidth="sm"
        fullWidth
        open={openCallingNumberForm}
        onClose={handleCloseCallingForm}
        PaperProps={{ sx: { borderRadius: "18px" } }}
      >
        <DialogTitle>{editing ? "Edit" : "Add"} Calling Number</DialogTitle>

        <DialogContent>

          {callingNumberError && (
            <Alert
              severity="error"
              sx={{ mb: 2 }}
              onClose={() => setCallingNumberError("")}
            >
              {callingNumberError}
            </Alert>
          )}

          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel id="calling-type-label">Type</InputLabel>
            <Select
              labelId="calling-type-label"
              value={callingform.type || "outbound"}
              label="Type"
              onChange={(e) => {
                setCallingForm({
                  ...callingform,
                  type: e.target.value as "inbound" | "outbound",
                });
              }}
            >
              <MenuItem value="inbound">Inbound</MenuItem>
              <MenuItem value="outbound">Outbound</MenuItem>
            </Select>
          </FormControl>

          <FormControl
            fullWidth
            required
            error={!!callingFormError.calling_number_id}
            sx={{ mt: 2 }}
          >
            <InputLabel>Calling Number</InputLabel>

            <Select
              value={callingform.calling_number_id || ""}
              label="Calling Number"
              onChange={(e) =>
                setCallingForm({
                  ...callingform,
                  calling_number_id: Number(e.target.value),
                })
              }
            >
              {callingNumbers.map((number) => (
                <MenuItem
                  key={number.id}
                  value={number.id}
                >
                  {number.country_code}
                  {number.phone_number}
                </MenuItem>
              ))}
            </Select>

            {callingFormError.calling_number_id && (
              <FormHelperText>
                {callingFormError.calling_number_id}
              </FormHelperText>
            )}
          </FormControl>



          {callingform.type == "outbound" ? <Grid item xs={12}>
            <FormControlLabel
              sx={{ mt: 2 }}
              control={
                <Switch
                  checked={callingform.is_default}
                  onChange={(e) =>
                    setCallingForm({
                      ...callingform,
                      is_default: e.target.checked,
                    })
                  }
                />
              }
              label="Set as Default"
            />
          </Grid> : <></>}

        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseCallingForm}>Cancel</Button>

          <Button variant="contained" onClick={handleCallingSave}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Channel Dialog Add & List */}
      <Dialog
        open={openChannelDialog}
        onClose={handleCloseChannelDialog}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: { borderRadius: "18px" } }}
      >
        <DialogTitle>Organization Channel</DialogTitle>

        <DialogContent>
          <Box display="flex" justifyContent="flex-end" mb={2}>
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              onClick={handleAddChannel}
            >
              Add Channel
            </Button>
          </Box>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {orgChannels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    No channels added
                  </TableCell>
                </TableRow>
              ) : (
                orgChannels.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.name}</TableCell>

                    <TableCell align="right">
                      <IconButton onClick={() => handleChannelEdit(row)}>
                        <EditIcon />
                      </IconButton>

                      <IconButton
                        color="error"
                        onClick={() =>
                          setChannelToDelete({
                            id: row.id,
                            name: String(row.name ?? row.id),
                          })
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
          <Button onClick={handleCloseChannelDialog}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openChannelForm}
        onClose={handleCloseChannelForm}
        fullWidth
        maxWidth="md"
        sx={{
          "& .MuiDialog-paper": {
            width: "100%",
            maxWidth: 350, // soft control, not rigid
          },
        }}
        PaperProps={{ sx: { borderRadius: "18px" } }}
      >
        <DialogTitle>{editing ? "Edit" : "Add"} Channel</DialogTitle>

        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }} error={!!channelFormError.name}>
            <InputLabel id="channel-label">Select Channel Name</InputLabel>

            <Select
              labelId="channel-label"
              label="Select Channel Name"
              value={channelForm.channel_id || ""}
              onChange={(e) => {
                const selectedId = Number(e.target.value);

                const selectedChannel = masterChannels.find(
                  (ch) => ch.id === selectedId,
                );

                setChannelFormError((prev) => ({
                  ...prev,
                  name: "",
                }));

                setChannelForm((prev) => ({
                  ...prev,
                  channel_id: selectedId,
                  name: selectedChannel.name,
                }));
              }}
            >
              {masterChannels.map((channel) => (
                <MenuItem key={channel.id} value={channel.id}>
                  {channel.name}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>{channelFormError.name}</FormHelperText>
          </FormControl>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseChannelForm}>Cancel</Button>

          <Button variant="contained" onClick={handleOrgChannelSave}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={callingNumberToDelete !== null}
        title="Delete calling number?"
        description={
          callingNumberToDelete
            ? `This will permanently remove "${callingNumberToDelete.number}" from this organization. This action cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmColor="error"
        loading={callingNumberDeleteSubmitting}
        onCancel={() =>
          !callingNumberDeleteSubmitting && setCallingNumberToDelete(null)
        }
        onConfirm={handleConfirmDeleteCallingNumber}
      />

      <ConfirmDialog
        open={channelToDelete !== null}
        title="Delete orgnization channel?"
        description={
          channelToDelete
            ? `This will permanently remove "${channelToDelete.name}" from this organization. This action cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmColor="error"
        loading={channelDeleteSubmitting}
        onCancel={() => !channelDeleteSubmitting && setChannelToDelete(null)}
        onConfirm={handleConfirmDeleteOrgChannel}
      />

      <ConfirmDialog
        open={orgToDelete !== null}
        title="Delete organization?"
        description={
          orgToDelete
            ? `This will permanently remove "${orgToDelete.name}" and related data. This action cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmColor="error"
        loading={deletingOrgId !== null}
        onCancel={() => !deletingOrgId && setOrgToDelete(null)}
        onConfirm={handleConfirmDeleteOrganization}
      />
    </SuperAdminLayout>
  );
};

export default SuperAdminOrganizationsPage;
