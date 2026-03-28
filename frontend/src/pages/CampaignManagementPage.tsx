import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
  TablePagination,
  TableRow,
  TextField,
  Typography,
  LinearProgress,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import VisibilityIcon from '@mui/icons-material/Visibility';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ListAltIcon from '@mui/icons-material/ListAlt';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CodeIcon from '@mui/icons-material/Code';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp';
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import AdminLayout from '../components/Layout/AdminLayout';
import {
  campaignService,
  CampaignItem,
  ContactItem,
  ContactListItem,
  DashboardStats,
} from '../services/campaignService';
import { Product, productService } from '../services/productService';

const formatDate = (value?: string) => {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString();
};

const statusColor = (status: string) => {
  if (status === 'completed') return 'success';
  if (status === 'running') return 'primary';
  if (status === 'scheduled') return 'warning';
  if (status === 'failed') return 'error';
  if (status === 'paused') return 'default';
  return 'default';
};

const looksLikeHtml = (value: string) => /<\s*[a-zA-Z][^>]*>/.test(value || '');

const buildEmailStarterTemplate = (campaignName?: string) => `
<h2 style="margin:0 0 12px; color:#183153;">${campaignName?.trim() || 'Special Offer Just For You'}</h2>
<p style="margin:0 0 12px;">Hi {{first_name}},</p>
<p style="margin:0 0 14px;">We are excited to share this update from <strong>{{campaign_name}}</strong>.</p>

<div style="background:#f5f9ff; border:1px solid #d7e5fb; border-radius:10px; padding:14px; margin:0 0 14px;">
  <p style="margin:0 0 8px;"><strong>What you get:</strong></p>
  <ul style="margin:0; padding-left:20px;">
    <li>Priority support and faster onboarding</li>
    <li>Campaign setup guidance from our team</li>
    <li>Special promotional pricing this week</li>
  </ul>
</div>

<p style="margin:0 0 16px;">Reply to this email and our team will help you get started.</p>

<a href="https://example.com" style="display:inline-block; padding:10px 18px; border-radius:8px; text-decoration:none; background:#3b7ddd; color:#ffffff; font-weight:600;">
  Get Started
</a>

<p style="margin:16px 0 0; font-size:13px; color:#5d7194;">You are receiving this message because you are part of our outreach list.</p>
`.trim();

const CAMPAIGN_EMAIL_MERGE_TAG_HELP = 'Merge tags: {{name}}, {{first_name}}, {{campaign_name}}';

const ensureFive = (items: string[]) => {
  const next = [...items];
  while (next.length < 5) next.push('');
  return next.slice(0, 5);
};

const getContactListLabel = (list: ContactListItem) => {
  const autoTag = list.is_agent_auto_list ? ' • Auto' : '';
  return `${list.list_name}${autoTag} (${list.contact_count})`;
};

const getContactListDescription = (list: ContactListItem) => {
  if (list.description) return list.description;
  if (list.is_agent_auto_list) {
    const widgetSuffix = list.agent_widget_id ? ` for agent ${list.agent_widget_id}` : '';
    return `Auto-created from appointment bookings${widgetSuffix}`;
  }
  return '-';
};

type CreateCampaignFieldErrors = {
  campaignName: boolean;
  emailSubject: boolean;
  emailBody: boolean;
  promptContext: boolean;
  contactList: boolean;
  product: boolean;
};

const EMPTY_CREATE_CAMPAIGN_ERRORS: CreateCampaignFieldErrors = {
  campaignName: false,
  emailSubject: false,
  emailBody: false,
  promptContext: false,
  contactList: false,
  product: false,
};

const CampaignManagementPage: React.FC = () => {
  const theme = useTheme();
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [dashboard, setDashboard] = useState<DashboardStats>({
    campaign_count: 0,
    total_sent: 0,
    total_failed: 0,
    status_counts: {},
    recent_campaigns: [],
  });

  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [campaignTotal, setCampaignTotal] = useState(0);
  const [campaignPage, setCampaignPage] = useState(0);
  const [campaignRowsPerPage, setCampaignRowsPerPage] = useState(10);
  const [campaignSearch, setCampaignSearch] = useState('');
  const [campaignTypeFilter, setCampaignTypeFilter] = useState('');
  const [campaignStatusFilter, setCampaignStatusFilter] = useState('');
  const [campaignProductFilter, setCampaignProductFilter] = useState<number | ''>('');

  const [contactLists, setContactLists] = useState<ContactListItem[]>([]);
  const [contactListSearch, setContactListSearch] = useState('');
  const [contactListPage, setContactListPage] = useState(0);
  const [contactListRowsPerPage, setContactListRowsPerPage] = useState(10);
  const [contactListTotal, setContactListTotal] = useState(0);

  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');

  const [selectedListId, setSelectedListId] = useState<number | ''>('');
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [contactTotal, setContactTotal] = useState(0);
  const [contactPage, setContactPage] = useState(0);
  const [contactRowsPerPage, setContactRowsPerPage] = useState(10);
  const [contactSearch, setContactSearch] = useState('');

  const [uploadListId, setUploadListId] = useState<number | ''>('');
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualCompany, setManualCompany] = useState('');
  const [manualContacts, setManualContacts] = useState<Array<{ name?: string; email?: string; phone?: string; company?: string }>>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const [createCampaignName, setCreateCampaignName] = useState('');
  const [createCampaignType, setCreateCampaignType] = useState<'email' | 'whatsapp' | 'sms'>('email');
  const [products, setProducts] = useState<Product[]>([]);
  const [createProductId, setCreateProductId] = useState<number | ''>('');
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductCode, setNewProductCode] = useState('');
  const [newProductDescription, setNewProductDescription] = useState('');
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [emailContentMode, setEmailContentMode] = useState<'manual' | 'prompt'>('manual');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailPromptContext, setEmailPromptContext] = useState('');
  const [generatedSubjects, setGeneratedSubjects] = useState<string[]>([]);
  const [generatedBodies, setGeneratedBodies] = useState<string[]>([]);
  const [generatingEmailVariants, setGeneratingEmailVariants] = useState(false);
  const [spamScoreLoading, setSpamScoreLoading] = useState(false);
  const [spamScoreResult, setSpamScoreResult] = useState<{
    overall: {
      average_spam_score: number;
      highest_spam_score: number;
      high_risk_count: number;
    };
    combinations: Array<{
      combo_index: number;
      subject_index: number;
      body_index: number;
      spam_score: number;
      risk_level: 'low' | 'medium' | 'high';
      reasons: string[];
      suggestions: string[];
    }>;
    fallback_used?: boolean;
  } | null>(null);
  const [createMessageTemplate, setCreateMessageTemplate] = useState('');
  const [emailEditorMode, setEmailEditorMode] = useState<'plain' | 'html'>('plain');
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [createScheduledTime, setCreateScheduledTime] = useState('');
  const [createContactListId, setCreateContactListId] = useState<number | ''>('');
  const [createCampaignErrors, setCreateCampaignErrors] = useState<CreateCampaignFieldErrors>(EMPTY_CREATE_CAMPAIGN_ERRORS);
  const spamTableContainerRef = useRef<HTMLDivElement | null>(null);
  const [spamVisibleStart, setSpamVisibleStart] = useState(0);
  const spamRowsPerView = 7;

  const [previewContacts, setPreviewContacts] = useState<ContactItem[]>([]);
  const [previewSearch, setPreviewSearch] = useState('');

  const [selectedCampaignId, setSelectedCampaignId] = useState<number | ''>('');
  const [logStatusFilter, setLogStatusFilter] = useState('');
  const [logs, setLogs] = useState<any[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logPage, setLogPage] = useState(0);
  const [logRowsPerPage, setLogRowsPerPage] = useState(10);

  const statusSummary = useMemo(() => {
    const ordered = ['draft', 'scheduled', 'running', 'completed', 'failed', 'paused'];
    return ordered.map((key) => ({ key, value: dashboard.status_counts?.[key] || 0 }));
  }, [dashboard.status_counts]);

  const pageContainerSx = {
    maxWidth: 1380,
    mx: 'auto',
    px: { xs: 0, md: 0.5 },
    position: 'relative',
  } as const;

  const sectionPanelSx = {
    borderRadius: '18px',
    border: `1px solid ${alpha(theme.palette.common.white, 0.62)}`,
    background: `linear-gradient(150deg, ${alpha(theme.palette.common.white, 0.7)} 0%, ${alpha(
      theme.palette.background.paper,
      0.82
    )} 68%, ${alpha('#dce8f8', 0.78)} 100%)`,
    boxShadow: `0 14px 30px ${alpha(theme.palette.primary.dark, 0.14)}`,
    backdropFilter: 'blur(10px)',
    position: 'relative',
    overflow: 'hidden',
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      background:
        'linear-gradient(138deg, rgba(255,255,255,0.22) 8%, transparent 24%), linear-gradient(28deg, transparent 56%, rgba(78,137,213,0.14) 57%, transparent 80%)',
    },
    '& > *': {
      position: 'relative',
      zIndex: 1,
    },
  } as const;

  const compactInputSx = {
    '& .MuiInputBase-root': {
      minHeight: 40,
    },
  } as const;

  const compactButtonSx = {
    minHeight: 40,
    px: 1.8,
    whiteSpace: 'nowrap',
  } as const;

  const campaignKpis = [
    {
      label: 'Total Campaigns',
      value: dashboard.campaign_count.toLocaleString(),
      hint: 'All created campaigns',
      icon: <ListAltIcon sx={{ color: theme.palette.primary.dark }} />,
      gradient: `linear-gradient(130deg, ${alpha('#9cc3f3', 0.64)} 0%, ${alpha('#dce9ff', 0.76)} 100%)`,
      wave: theme.palette.primary.main,
    },
    {
      label: 'Messages Sent',
      value: dashboard.total_sent.toLocaleString(),
      hint: 'Delivered across runs',
      icon: <SendRoundedIcon sx={{ color: theme.palette.primary.dark }} />,
      gradient: `linear-gradient(130deg, ${alpha('#9fcbf6', 0.64)} 0%, ${alpha('#deedff', 0.76)} 100%)`,
      wave: theme.palette.success.main,
    },
    {
      label: 'Messages Failed',
      value: dashboard.total_failed.toLocaleString(),
      hint: 'Needs retry or review',
      icon: <ErrorOutlineIcon sx={{ color: theme.palette.primary.dark }} />,
      gradient: `linear-gradient(130deg, ${alpha('#a9d2fb', 0.64)} 0%, ${alpha('#e3f0ff', 0.78)} 100%)`,
      wave: theme.palette.error.main,
    },
  ];

  const showError = (message: string) => {
    setSuccess('');
    setError(message);
  };

  const showSuccess = (message: string) => {
    setError('');
    setSuccess(message);
  };

  const loadDashboard = async () => {
    const data = await campaignService.getDashboardStats();
    setDashboard(data);
  };

  const loadCampaigns = async () => {
    const data = await campaignService.listCampaigns({
      search: campaignSearch || undefined,
      campaign_type: (campaignTypeFilter || undefined) as any,
      status: (campaignStatusFilter || undefined) as any,
      product_id: campaignProductFilter ? Number(campaignProductFilter) : undefined,
      skip: campaignPage * campaignRowsPerPage,
      limit: campaignRowsPerPage,
    });
    setCampaigns(data.items || []);
    setCampaignTotal(data.pagination?.total || 0);
  };

  const loadContactLists = async () => {
    const data = await campaignService.listContactLists({
      search: contactListSearch || undefined,
      skip: contactListPage * contactListRowsPerPage,
      limit: contactListRowsPerPage,
    });
    setContactLists(data.items || []);
    setContactListTotal(data.pagination?.total || 0);
  };

  const loadProducts = async () => {
    const data = await productService.productLookup();
    setProducts(data || []);
  };

  const loadContacts = async (contactListId: number) => {
    const data = await campaignService.listContacts(contactListId, {
      search: contactSearch || undefined,
      skip: contactPage * contactRowsPerPage,
      limit: contactRowsPerPage,
    });
    setContacts(data.items || []);
    setContactTotal(data.pagination?.total || 0);
  };

  const loadPreviewContacts = async (contactListId: number) => {
    const data = await campaignService.listContacts(contactListId, {
      search: previewSearch || undefined,
      skip: 0,
      limit: 8,
    });
    setPreviewContacts(data.items || []);
  };

  const loadLogs = async (campaignId: number) => {
    const data = await campaignService.listCampaignLogs(campaignId, {
      status: logStatusFilter || undefined,
      skip: logPage * logRowsPerPage,
      limit: logRowsPerPage,
    });
    setLogs(data.items || []);
    setLogTotal(data.pagination?.total || 0);
  };

  const refreshAll = async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadDashboard(), loadCampaigns(), loadContactLists(), loadProducts()]);
    } catch (err: any) {
      showError(err?.response?.data?.detail || 'Failed to load campaign module data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        await loadCampaigns();
      } catch (err: any) {
        showError(err?.response?.data?.detail || 'Failed to load campaigns');
      }
    };
    run();
  }, [campaignPage, campaignRowsPerPage]);

  useEffect(() => {
    const run = async () => {
      try {
        await loadContactLists();
      } catch (err: any) {
        showError(err?.response?.data?.detail || 'Failed to load contact lists');
      }
    };
    run();
  }, [contactListPage, contactListRowsPerPage]);

  useEffect(() => {
    if (!selectedListId) return;
    const run = async () => {
      try {
        await loadContacts(Number(selectedListId));
      } catch (err: any) {
        showError(err?.response?.data?.detail || 'Failed to load contacts');
      }
    };
    run();
  }, [selectedListId, contactPage, contactRowsPerPage]);

  useEffect(() => {
    if (!selectedCampaignId) return;
    const run = async () => {
      try {
        await loadLogs(Number(selectedCampaignId));
      } catch (err: any) {
        showError(err?.response?.data?.detail || 'Failed to load campaign logs');
      }
    };
    run();
  }, [selectedCampaignId, logPage, logRowsPerPage]);

  useEffect(() => {
    if (!createContactListId) {
      setPreviewContacts([]);
      return;
    }

    const run = async () => {
      try {
        await loadPreviewContacts(Number(createContactListId));
      } catch {
        setPreviewContacts([]);
      }
    };
    run();
  }, [createContactListId]);

  const handleApplyCampaignFilters = async () => {
    setCampaignPage(0);
    setLoading(true);
    try {
      await loadCampaigns();
    } catch (err: any) {
      showError(err?.response?.data?.detail || 'Failed to filter campaigns');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      showError('Contact list name is required');
      return;
    }

    setLoading(true);
    try {
      await campaignService.createContactList({
        list_name: newListName,
        description: newListDescription || undefined,
      });
      setNewListName('');
      setNewListDescription('');
      showSuccess('Contact list created successfully');
      await loadContactLists();
    } catch (err: any) {
      showError(err?.response?.data?.detail || 'Failed to create contact list');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteList = async (id: number) => {
    if (!window.confirm('Delete this contact list?')) return;

    setLoading(true);
    try {
      await campaignService.deleteContactList(id);
      if (selectedListId === id) {
        setSelectedListId('');
        setContacts([]);
      }
      if (uploadListId === id) {
        setUploadListId('');
      }
      if (createContactListId === id) {
        setCreateContactListId('');
      }
      showSuccess('Contact list deleted');
      await loadContactLists();
    } catch (err: any) {
      showError(err?.response?.data?.detail || 'Failed to delete contact list');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectListForContacts = async (id: number) => {
    setSelectedListId(id);
    setContactPage(0);
    setContactSearch('');
    setLoading(true);
    try {
      await loadContacts(id);
    } catch (err: any) {
      showError(err?.response?.data?.detail || 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterContacts = async () => {
    if (!selectedListId) return;
    setContactPage(0);
    setLoading(true);
    try {
      await loadContacts(Number(selectedListId));
    } catch (err: any) {
      showError(err?.response?.data?.detail || 'Failed to filter contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContact = async (id: number) => {
    if (!selectedListId) return;
    setLoading(true);
    try {
      await campaignService.deleteContact(id);
      showSuccess('Contact deleted');
      await loadContacts(Number(selectedListId));
      await loadContactLists();
    } catch (err: any) {
      showError(err?.response?.data?.detail || 'Failed to delete contact');
    } finally {
      setLoading(false);
    }
  };

  const handleAddManualContact = () => {
    if (!manualEmail.trim() && !manualPhone.trim()) {
      showError('Manual entry requires email or phone');
      return;
    }

    setManualContacts((prev) => [
      ...prev,
      {
        name: manualName.trim() || undefined,
        email: manualEmail.trim() || undefined,
        phone: manualPhone.trim() || undefined,
        company: manualCompany.trim() || undefined,
      },
    ]);
    setManualName('');
    setManualEmail('');
    setManualPhone('');
    setManualCompany('');
    setError('');
  };

  const handleDownloadCsvTemplate = () => {
    const template = 'name,email,phone,company\nJohn Doe,john@example.com,+15551234567,Acme Corp\n';
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'contacts_template.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateProductFromCampaign = async () => {
    if (!newProductName.trim()) {
      showError('Product name is required');
      return;
    }
    if (!newProductCode.trim()) {
      showError('Product code is required');
      return;
    }

    setCreatingProduct(true);
    try {
      const response = await productService.createProduct({
        name: newProductName.trim(),
        code: newProductCode.trim(),
        description: newProductDescription.trim(),
      });

      if (!response.success) {
        showError(response.message || 'Failed to create product');
        return;
      }

      const refreshed = await productService.productLookup();
      setProducts(refreshed || []);

      const selected = (refreshed || []).find((item) => item.code.toLowerCase() === newProductCode.trim().toLowerCase());
      if (selected?.id) {
        setCreateProductId(selected.id);
      }

      setNewProductName('');
      setNewProductCode('');
      setNewProductDescription('');
      setProductDialogOpen(false);
      showSuccess('Product added successfully');
    } catch (err: any) {
      showError(err?.response?.data?.detail || 'Failed to create product');
    } finally {
      setCreatingProduct(false);
    }
  };

  const handleManualUpload = async () => {
    if (!uploadListId) {
      showError('Select a contact list before manual upload');
      return;
    }
    if (!manualContacts.length) {
      showError('Add at least one contact for manual upload');
      return;
    }

    setLoading(true);
    try {
      const result = await campaignService.uploadContactsManual(Number(uploadListId), { contacts: manualContacts });
      setManualContacts([]);
      showSuccess(`Manual upload complete: ${result.created} created, ${result.failed} failed`);
      await loadContactLists();
      if (selectedListId === uploadListId) {
        await loadContacts(Number(uploadListId));
      }
    } catch (err: any) {
      showError(err?.response?.data?.detail || 'Failed to upload manual contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleCsvUpload = async () => {
    if (!uploadListId) {
      showError('Select a contact list before CSV upload');
      return;
    }
    if (!csvFile) {
      showError('Choose a CSV file first');
      return;
    }

    setLoading(true);
    try {
      const result = await campaignService.uploadContactsCsv(Number(uploadListId), csvFile);
      setCsvFile(null);
      showSuccess(`CSV upload complete: ${result.created} created, ${result.failed} failed`);
      await loadContactLists();
      if (selectedListId === uploadListId) {
        await loadContacts(Number(uploadListId));
      }
    } catch (err: any) {
      showError(err?.response?.data?.detail || 'Failed to upload CSV contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateFileUpload = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      setCreateMessageTemplate(content);
      if (looksLikeHtml(content)) {
        setEmailEditorMode('html');
      }
      showSuccess('Template loaded from file');
    };
    reader.readAsText(file);
  };

  const handleLoadHtmlStarter = () => {
    setEmailEditorMode('html');
    setCreateMessageTemplate(buildEmailStarterTemplate(createCampaignName));
    setShowEmailPreview(true);
    setSuccess('HTML starter template loaded');
  };

  const handleGeneratePromptEmailVariants = async () => {
    if (!emailPromptContext.trim()) {
      showError('Prompt context is required to generate email variants');
      return;
    }

    setGeneratingEmailVariants(true);
    setError('');
    try {
      const result = await campaignService.generateEmailVariants({
        campaign_name: createCampaignName || 'Campaign',
        prompt_context: emailPromptContext,
      });

      setGeneratedSubjects(result.subjects || []);
      setGeneratedBodies(result.bodies || []);
      setSpamScoreResult(null);
      setSpamVisibleStart(0);
      setCreateCampaignErrors((prev) => ({
        ...prev,
        promptContext: false,
        emailSubject: false,
      }));

      if ((result.bodies || []).length > 0) {
        setCreateMessageTemplate(result.bodies[0]);
      }
      if ((result.subjects || []).length > 0) {
        setEmailSubject(result.subjects[0]);
      }

      setShowEmailPreview(true);
      showSuccess(`Generated ${result.subjects?.length || 0} subjects and ${result.bodies?.length || 0} bodies.`);
    } catch (err: any) {
      showError(err?.response?.data?.detail || 'Failed to generate prompt-based email content');
    } finally {
      setGeneratingEmailVariants(false);
    }
  };

  const handleScorePromptEmailSpam = async () => {
    if (!emailPromptContext.trim()) {
      setCreateCampaignErrors((prev) => ({ ...prev, promptContext: true }));
      showError('Prompt context is required before spam scoring');
      return;
    }

    const subjects = ensureFive(generatedSubjects).map((item) => item.trim()).filter(Boolean);
    const bodies = ensureFive(generatedBodies).map((item) => item.trim()).filter(Boolean);

    if (subjects.length < 5 || bodies.length < 5) {
      showError('Generate 5x5 variants first, then run spam score');
      return;
    }

    setSpamScoreLoading(true);
    setError('');
    try {
      const result = await campaignService.scoreEmailSpamRisk({
        campaign_name: createCampaignName || 'Campaign',
        prompt_context: emailPromptContext,
        subjects: ensureFive(generatedSubjects),
        bodies: ensureFive(generatedBodies),
      });
      setSpamScoreResult(result);
      setSpamVisibleStart(0);
      showSuccess(
        `Spam score complete. Avg: ${result.overall.average_spam_score}, Highest: ${result.overall.highest_spam_score}, High risk combos: ${result.overall.high_risk_count}.`
      );
    } catch (err: any) {
      showError(err?.response?.data?.detail || 'Failed to evaluate spam score');
    } finally {
      setSpamScoreLoading(false);
    }
  };

  const handleScrollSpamTable = (direction: 'up' | 'down' | 'top' | 'bottom') => {
    const total = spamScoreResult?.combinations?.length || 0;
    const maxStart = Math.max(0, total - spamRowsPerView);

    if (direction === 'top') {
      setSpamVisibleStart(0);
      return;
    }
    if (direction === 'bottom') {
      setSpamVisibleStart(maxStart);
      return;
    }
    if (direction === 'up') {
      setSpamVisibleStart((prev) => Math.max(0, prev - spamRowsPerView));
      return;
    }
    setSpamVisibleStart((prev) => Math.min(maxStart, prev + spamRowsPerView));
  };

  const handleEditGeneratedSubject = (index: number, value: string) => {
    setGeneratedSubjects((prev) => {
      const next = ensureFive(prev);
      next[index] = value;
      if (index === 0) {
        setEmailSubject(value);
      }
      return next;
    });
  };

  const handleEditGeneratedBody = (index: number, value: string) => {
    setGeneratedBodies((prev) => {
      const next = ensureFive(prev);
      next[index] = value;
      if (index === 0) {
        setCreateMessageTemplate(value);
      }
      return next;
    });
  };

  const handleCreateCampaign = async () => {
    const nextErrors: CreateCampaignFieldErrors = {
      campaignName: !createCampaignName.trim(),
      emailSubject: createCampaignType === 'email' ? !emailSubject.trim() : false,
      emailBody:
        createCampaignType === 'email' && emailContentMode === 'manual'
          ? !createMessageTemplate.trim()
          : createCampaignType !== 'email'
            ? !createMessageTemplate.trim()
            : false,
      promptContext: createCampaignType === 'email' && emailContentMode === 'prompt' ? !emailPromptContext.trim() : false,
      contactList: !createContactListId,
      product: !createProductId,
    };

    setCreateCampaignErrors(nextErrors);

    const missing: string[] = [];
    if (nextErrors.campaignName) missing.push('Campaign Name');
    if (nextErrors.emailSubject) missing.push('Email Subject');
    if (nextErrors.contactList) missing.push('Contact List');
    if (nextErrors.product) missing.push('Product');
    if (nextErrors.emailBody) missing.push(createCampaignType === 'email' ? 'Email Body' : 'Message Template');
    if (nextErrors.promptContext) missing.push('Prompt Context');

    if (missing.length > 0) {
      showError(`Please fill required fields: ${missing.join(', ')}`);
      return;
    }

    if (createCampaignType === 'email' && emailContentMode === 'prompt') {
      const subjects = ensureFive(generatedSubjects).map((item) => item.trim()).filter(Boolean);
      const bodies = ensureFive(generatedBodies).map((item) => item.trim()).filter(Boolean);
      if (subjects.length < 5 || bodies.length < 5) {
        showError('Generate all 5 subjects and 5 bodies in prompt mode before creating campaign');
        return;
      }
    }

    setLoading(true);
    try {
      await campaignService.createCampaign({
        campaign_name: createCampaignName,
        campaign_type: createCampaignType,
        message_template: createCampaignType === 'email'
          ? (emailContentMode === 'prompt' ? (generatedBodies[0] || createMessageTemplate || 'Generated campaign body') : createMessageTemplate)
          : createMessageTemplate,
        scheduled_time: createScheduledTime || undefined,
        contact_list_id: Number(createContactListId),
        product_id: createProductId ? Number(createProductId) : undefined,
        status: createScheduledTime ? 'scheduled' : 'draft',
        email_content_mode: createCampaignType === 'email' ? emailContentMode : undefined,
        email_subject: createCampaignType === 'email' ? (emailSubject || createCampaignName) : undefined,
        email_prompt_context: createCampaignType === 'email' && emailContentMode === 'prompt' ? emailPromptContext : undefined,
        email_subject_variants: createCampaignType === 'email' && emailContentMode === 'prompt' ? generatedSubjects : undefined,
        email_body_variants: createCampaignType === 'email' && emailContentMode === 'prompt' ? generatedBodies : undefined,
      });
      setCreateCampaignName('');
      setCreateMessageTemplate('');
      setEmailSubject('');
      setEmailPromptContext('');
      setGeneratedSubjects([]);
      setGeneratedBodies([]);
      setEmailContentMode('manual');
      setCreateScheduledTime('');
      setCreateProductId('');
      setSpamScoreResult(null);
      setCreateCampaignErrors(EMPTY_CREATE_CAMPAIGN_ERRORS);
      showSuccess('Campaign created');
      await Promise.all([loadCampaigns(), loadDashboard()]);
      setTab(0);
    } catch (err: any) {
      showError(err?.response?.data?.detail || 'Failed to create campaign');
    } finally {
      setLoading(false);
    }
  };

  const handleRunCampaign = async (campaignId: number) => {
    setLoading(true);
    try {
      const result = await campaignService.runCampaign(campaignId);
      showSuccess(`Campaign run complete: sent ${result.number_sent}, failed ${result.number_failed}`);
      await Promise.all([loadCampaigns(), loadDashboard()]);
    } catch (err: any) {
      showError(err?.response?.data?.detail || 'Failed to run campaign');
    } finally {
      setLoading(false);
    }
  };

  const handlePauseCampaign = async (campaignId: number) => {
    setLoading(true);
    try {
      await campaignService.pauseCampaign(campaignId);
      showSuccess('Campaign paused');
      await Promise.all([loadCampaigns(), loadDashboard()]);
    } catch (err: any) {
      showError(err?.response?.data?.detail || 'Failed to pause campaign');
    } finally {
      setLoading(false);
    }
  };

  const handleRunDueCampaigns = async () => {
    setLoading(true);
    try {
      const result = await campaignService.runDueCampaigns();
      showSuccess(
        `Due scheduler run complete: ${result.executed_count} executed, ${result.skipped_count} skipped (due: ${result.due_count}).`
      );
      await Promise.all([loadCampaigns(), loadDashboard()]);
    } catch (err: any) {
      showError(err?.response?.data?.detail || 'Failed to run scheduled campaigns');
    } finally {
      setLoading(false);
    }
  };

  const handleViewLogs = async (campaignId: number) => {
    setSelectedCampaignId(campaignId);
    setLogPage(0);
    setTab(4);
    setLoading(true);
    try {
      await loadLogs(campaignId);
    } catch (err: any) {
      showError(err?.response?.data?.detail || 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyLogsFilter = async () => {
    if (!selectedCampaignId) {
      showError('Select a campaign to view logs');
      return;
    }

    setLogPage(0);
    setLoading(true);
    try {
      await loadLogs(Number(selectedCampaignId));
    } catch (err: any) {
      showError(err?.response?.data?.detail || 'Failed to filter logs');
    } finally {
      setLoading(false);
    }
  };

  const campaignOptions = useMemo(
    () => campaigns.map((item) => ({ id: item.id, label: `${item.campaign_name} (#${item.id})` })),
    [campaigns]
  );

  useEffect(() => {
    if (createCampaignType !== 'email') {
      setEmailEditorMode('plain');
      setShowEmailPreview(false);
      setEmailContentMode('manual');
      setEmailSubject('');
      setEmailPromptContext('');
      setGeneratedSubjects([]);
      setGeneratedBodies([]);
      setSpamScoreResult(null);
      setSpamVisibleStart(0);
    }
  }, [createCampaignType]);

  return (
    <AdminLayout>
      <Box sx={pageContainerSx}>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 0,
            background:
              'linear-gradient(132deg, transparent 16%, rgba(132,172,228,0.2) 17%, transparent 34%), linear-gradient(36deg, transparent 52%, rgba(111,165,229,0.16) 53%, transparent 72%)',
          }}
        />

      <Stack spacing={3} sx={{ position: 'relative', zIndex: 1 }}>
        <Paper
          sx={{
            p: { xs: 2, md: 2.6 },
            borderRadius: '24px',
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
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', mb: 0.8, letterSpacing: '-0.02em' }}>
            Campaign Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Run non-AI promotional campaigns via Email, WhatsApp, or SMS.
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1.4 }} flexWrap="wrap" useFlexGap>
            <Chip size="small" icon={<ListAltIcon />} label="Build Audience" variant="outlined" />
            <Chip size="small" icon={<UploadFileIcon />} label="Upload Contacts" variant="outlined" />
            <Chip size="small" icon={<PlayArrowIcon />} label="Launch Campaigns" variant="outlined" />
          </Stack>
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button size="small" sx={compactButtonSx} variant="outlined" onClick={() => setTab(3)} startIcon={<UploadFileIcon />}>
            Upload Contacts
          </Button>
          <Button size="small" sx={compactButtonSx} variant="contained" onClick={() => setTab(1)} startIcon={<AddIcon />}>
            New Campaign
          </Button>
        </Stack>
        </Stack>
        </Paper>

        {error && (
          <Alert severity="error" sx={{ borderRadius: '14px', boxShadow: `0 10px 18px ${alpha(theme.palette.error.dark, 0.12)}` }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ borderRadius: '14px', boxShadow: `0 10px 18px ${alpha(theme.palette.success.dark, 0.12)}` }}>
            {success}
          </Alert>
        )}

        <Paper sx={{ ...sectionPanelSx, borderRadius: '16px' }}>
          <Tabs
            value={tab}
            onChange={(_, value) => setTab(value)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.16)}` }}
          >
            <Tab label="Campaign Dashboard" icon={<ListAltIcon />} iconPosition="start" />
            <Tab label="Create Campaign" icon={<AddIcon />} iconPosition="start" />
            <Tab label="Contact Lists" icon={<ListAltIcon />} iconPosition="start" />
            <Tab label="Upload Contacts" icon={<UploadFileIcon />} iconPosition="start" />
            <Tab label="Campaign Logs" icon={<VisibilityIcon />} iconPosition="start" />
          </Tabs>
        </Paper>

        {loading && <LinearProgress sx={{ borderRadius: 1.2 }} />}

        {tab === 0 && (
          <Stack spacing={2.5}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  lg: 'repeat(3, minmax(0, 1fr))',
                },
                gap: 2.5,
              }}
            >
              {campaignKpis.map((kpi) => (
                <Box key={kpi.label}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: '18px',
                      background: kpi.gradient,
                      minHeight: 142,
                      border: `1px solid ${alpha(theme.palette.common.white, 0.6)}`,
                      boxShadow: `0 12px 26px ${alpha(theme.palette.primary.dark, 0.16)}`,
                      position: 'relative',
                      overflow: 'hidden',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        inset: 0,
                        pointerEvents: 'none',
                        background:
                          'linear-gradient(140deg, rgba(255,255,255,0.18) 6%, transparent 22%), linear-gradient(28deg, transparent 58%, rgba(74,137,213,0.14) 59%, transparent 82%)',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                          {kpi.label}
                        </Typography>
                        <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.35, color: 'text.primary' }}>
                          {kpi.value}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.2 }}>
                          {kpi.hint}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: 3,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: alpha(theme.palette.primary.main, 0.14),
                          border: `1px solid ${alpha(theme.palette.common.white, 0.48)}`,
                        }}
                      >
                        {kpi.icon}
                      </Box>
                    </Box>
                    <Box
                      sx={{
                        position: 'absolute',
                        left: 14,
                        right: 14,
                        bottom: 12,
                        height: 30,
                        opacity: 0.95,
                      }}
                    >
                      <svg width="100%" height="100%" viewBox="0 0 220 30" preserveAspectRatio="none" aria-hidden="true">
                        <path
                          d="M0,22 C18,8 34,28 52,18 C70,8 86,28 104,16 C124,4 142,28 160,14 C178,3 196,20 220,10"
                          fill="none"
                          stroke={alpha(kpi.wave, 0.9)}
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                      </svg>
                    </Box>
                  </Paper>
                </Box>
              ))}
            </Box>

            <Paper sx={{ ...sectionPanelSx, p: 2.5 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
                Status Overview
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {statusSummary.map((item) => (
                  <Chip key={item.key} label={`${item.key}: ${item.value}`} color={statusColor(item.key) as any} variant="outlined" />
                ))}
              </Stack>
            </Paper>

            <Paper sx={{ ...sectionPanelSx, p: 2.5 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Campaign List</Typography>
                  <Typography variant="body2" color="text.secondary">Filter, run, pause, and inspect campaign executions.</Typography>
                </Box>
                <Button size="small" sx={compactButtonSx} variant="contained" onClick={handleRunDueCampaigns} startIcon={<PlayArrowIcon />}>
                  Run Due Scheduled
                </Button>
              </Stack>

              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} md={3}>
                  <TextField
                    size="small"
                    fullWidth
                    label="Search Campaign"
                    value={campaignSearch}
                    onChange={(e) => setCampaignSearch(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={campaignTypeFilter}
                      label="Type"
                      onChange={(e) => setCampaignTypeFilter(e.target.value)}
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="email">Email</MenuItem>
                      <MenuItem value="whatsapp">WhatsApp</MenuItem>
                      <MenuItem value="sms">SMS</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={campaignStatusFilter}
                      label="Status"
                      onChange={(e) => setCampaignStatusFilter(e.target.value)}
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="draft">Draft</MenuItem>
                      <MenuItem value="scheduled">Scheduled</MenuItem>
                      <MenuItem value="running">Running</MenuItem>
                      <MenuItem value="completed">Completed</MenuItem>
                      <MenuItem value="failed">Failed</MenuItem>
                      <MenuItem value="paused">Paused</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Product</InputLabel>
                    <Select
                      value={campaignProductFilter}
                      label="Product"
                      onChange={(e) => setCampaignProductFilter(e.target.value === '' ? '' : Number(e.target.value))}
                    >
                      <MenuItem value="">All</MenuItem>
                      {products.map((item) => (
                        <MenuItem key={item.id} value={item.id}>
                          {item.name} ({item.code})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" sx={compactButtonSx} fullWidth variant="outlined" onClick={handleApplyCampaignFilters}>Apply</Button>
                  </Stack>
                </Grid>
              </Grid>

              <TableContainer sx={{ borderRadius: '12px', border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}` }}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ background: `linear-gradient(110deg, ${alpha('#e7f0ff', 0.8)} 0%, ${alpha('#d8e9ff', 0.68)} 100%)` }}>
                      <TableCell>Campaign Name</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Product</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {campaigns.length > 0 ? (
                      campaigns.map((item) => (
                        <TableRow key={item.id} hover sx={{ '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.05) } }}>
                          <TableCell>
                            <Typography sx={{ fontWeight: 600 }}>{item.campaign_name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              List: {item.contact_list_name || item.contact_list_id}
                            </Typography>
                          </TableCell>
                          <TableCell>{item.campaign_type}</TableCell>
                          <TableCell>{item.product_name || '-'}</TableCell>
                          <TableCell>
                            <Chip size="small" label={item.status} color={statusColor(item.status) as any} variant="outlined" />
                          </TableCell>
                          <TableCell>{formatDate(item.created_at)}</TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1}>
                              <Button size="small" startIcon={<PlayArrowIcon />} onClick={() => handleRunCampaign(item.id)}>
                                Run
                              </Button>
                              <Button
                                size="small"
                                color="inherit"
                                startIcon={<PauseIcon />}
                                onClick={() => handlePauseCampaign(item.id)}
                                disabled={item.status === 'completed'}
                              >
                                Pause
                              </Button>
                              <Button size="small" startIcon={<VisibilityIcon />} onClick={() => handleViewLogs(item.id)}>
                                View
                              </Button>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} align="center">No campaigns found.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={campaignTotal}
                page={campaignPage}
                onPageChange={(_, pageValue) => setCampaignPage(pageValue)}
                rowsPerPage={campaignRowsPerPage}
                onRowsPerPageChange={(event) => {
                  setCampaignRowsPerPage(parseInt(event.target.value, 10));
                  setCampaignPage(0);
                }}
                rowsPerPageOptions={[10, 25, 50]}
              />
            </Paper>
          </Stack>
        )}

        {tab === 1 && (
          <Paper sx={{ ...sectionPanelSx, p: 2.5 }}>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
              <Chip size="small" label="1. Configure Basics" variant="outlined" />
              <Chip size="small" label="2. Choose Audience" variant="outlined" />
              <Chip size="small" label="3. Write Template" variant="outlined" />
              <Chip size="small" label="4. Launch or Schedule" variant="outlined" />
            </Stack>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField
                  size="small"
                  sx={compactInputSx}
                  fullWidth
                  label="Campaign Name"
                  value={createCampaignName}
                  onChange={(e) => {
                    setCreateCampaignName(e.target.value);
                    if (createCampaignErrors.campaignName) {
                      setCreateCampaignErrors((prev) => ({ ...prev, campaignName: false }));
                    }
                  }}
                  error={createCampaignErrors.campaignName}
                  helperText={createCampaignErrors.campaignName ? 'Campaign name is required' : ' '}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <FormControl fullWidth size="small" sx={compactInputSx}>
                  <InputLabel>Campaign Type</InputLabel>
                  <Select
                    value={createCampaignType}
                    label="Campaign Type"
                    onChange={(e) => setCreateCampaignType(e.target.value as 'email' | 'whatsapp' | 'sms')}
                  >
                    <MenuItem value="email">Email</MenuItem>
                    <MenuItem value="whatsapp">WhatsApp</MenuItem>
                    <MenuItem value="sms">SMS</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small" sx={compactInputSx} error={createCampaignErrors.contactList}>
                  <InputLabel>Contact List</InputLabel>
                  <Select
                    value={createContactListId}
                    label="Contact List"
                    onChange={(e) => {
                      setCreateContactListId(e.target.value === '' ? '' : Number(e.target.value));
                      if (createCampaignErrors.contactList) {
                        setCreateCampaignErrors((prev) => ({ ...prev, contactList: false }));
                      }
                    }}
                    error={createCampaignErrors.contactList}
                  >
                    <MenuItem value="">
                      <em>Select Contact List</em>
                    </MenuItem>
                    {contactLists.map((list) => (
                      <MenuItem key={list.id} value={list.id}>
                        {getContactListLabel(list)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <FormControl fullWidth size="small" sx={compactInputSx} error={createCampaignErrors.product}>
                  <InputLabel>Product</InputLabel>
                  <Select
                    value={createProductId}
                    label="Product"
                    onChange={(e) => {
                      setCreateProductId(e.target.value === '' ? '' : Number(e.target.value));
                      if (createCampaignErrors.product) {
                        setCreateCampaignErrors((prev) => ({ ...prev, product: false }));
                      }
                    }}
                  >
                    <MenuItem value="">
                      <em>Select Product</em>
                    </MenuItem>
                    {products.map((item) => (
                      <MenuItem key={item.id} value={item.id}>
                        {item.name} ({item.code})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={1}>
                <Button
                  size="small"
                  fullWidth
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => setProductDialogOpen(true)}
                  sx={compactButtonSx}
                >
                  Add
                </Button>
              </Grid>

              <Grid item xs={12}>
                {createCampaignType === 'email' && (
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.8,
                      mb: 1.2,
                      borderRadius: '12px',
                      borderColor: alpha(theme.palette.primary.main, 0.2),
                      background: `linear-gradient(135deg, ${alpha(theme.palette.common.white, 0.72)} 0%, ${alpha('#deebfb', 0.6)} 100%)`,
                    }}
                  >
                    <Stack spacing={1.5}>
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            Email Content Setup
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {CAMPAIGN_EMAIL_MERGE_TAG_HELP}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1}>
                          <Button
                            size="small"
                            startIcon={<TextFieldsIcon />}
                            variant={emailContentMode === 'manual' ? 'contained' : 'outlined'}
                            onClick={() => setEmailContentMode('manual')}
                          >
                            Manual
                          </Button>
                          <Button
                            size="small"
                            startIcon={<AutoAwesomeIcon />}
                            variant={emailContentMode === 'prompt' ? 'contained' : 'outlined'}
                            onClick={() => setEmailContentMode('prompt')}
                          >
                            Prompt + AI Variants
                          </Button>
                        </Stack>
                      </Stack>

                      <TextField
                        size="small"
                        sx={compactInputSx}
                        fullWidth
                        label="Email Subject"
                        value={emailSubject}
                        onChange={(e) => {
                          setEmailSubject(e.target.value);
                          if (createCampaignErrors.emailSubject) {
                            setCreateCampaignErrors((prev) => ({ ...prev, emailSubject: false }));
                          }
                        }}
                        error={createCampaignErrors.emailSubject}
                        helperText={createCampaignErrors.emailSubject ? 'Email subject is required' : ' '}
                        placeholder="Leave blank to use campaign name"
                      />

                      {emailContentMode === 'manual' ? (
                        <>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                            <Button
                              size="small"
                              startIcon={<TextFieldsIcon />}
                              variant={emailEditorMode === 'plain' ? 'contained' : 'outlined'}
                              onClick={() => setEmailEditorMode('plain')}
                            >
                              Plain Text
                            </Button>
                            <Button
                              size="small"
                              startIcon={<CodeIcon />}
                              variant={emailEditorMode === 'html' ? 'contained' : 'outlined'}
                              onClick={() => setEmailEditorMode('html')}
                            >
                              HTML
                            </Button>
                            <Button size="small" variant="outlined" onClick={handleLoadHtmlStarter}>
                              Load HTML Starter
                            </Button>
                            <Button size="small" variant="outlined" onClick={() => setShowEmailPreview((prev) => !prev)}>
                              {showEmailPreview ? 'Hide Preview' : 'Show Preview'}
                            </Button>
                          </Stack>
                        </>
                      ) : (
                        <>
                          <TextField
                            size="small"
                            sx={compactInputSx}
                            fullWidth
                            multiline
                            minRows={4}
                            label="Prompt Context"
                            value={emailPromptContext}
                            onChange={(e) => {
                              setEmailPromptContext(e.target.value);
                              if (createCampaignErrors.promptContext) {
                                setCreateCampaignErrors((prev) => ({ ...prev, promptContext: false }));
                              }
                            }}
                            error={createCampaignErrors.promptContext}
                            helperText={createCampaignErrors.promptContext ? 'Prompt context is required for prompt mode' : ' '}
                            placeholder="Describe campaign intent, audience, offer, tone, CTA, and constraints..."
                          />
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                            <Button
                              variant="contained"
                              startIcon={<AutoAwesomeIcon />}
                              onClick={handleGeneratePromptEmailVariants}
                              disabled={generatingEmailVariants}
                            >
                              {generatingEmailVariants ? 'Generating...' : 'Generate 5x5 Variants'}
                            </Button>
                            <Chip
                              variant="outlined"
                              label={`Subjects: ${generatedSubjects.length} | Bodies: ${generatedBodies.length} | Combos: ${generatedSubjects.length * generatedBodies.length}`}
                            />
                            <Button size="small" variant="outlined" onClick={() => setShowEmailPreview((prev) => !prev)}>
                              {showEmailPreview ? 'Hide Preview' : 'Show Preview'}
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="warning"
                              startIcon={<ErrorOutlineIcon />}
                              onClick={handleScorePromptEmailSpam}
                              disabled={spamScoreLoading || generatedSubjects.length < 5 || generatedBodies.length < 5}
                            >
                              {spamScoreLoading ? 'Scoring...' : 'Spam Score (5x5)'}
                            </Button>
                          </Stack>

                          {(generatingEmailVariants || spamScoreLoading) && (
                            <Box sx={{ mt: 0.5 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.6 }}>
                                {generatingEmailVariants
                                  ? 'Generating 5x5 variants. Please wait...'
                                  : 'Running spam score across 25 combinations. Please wait...'}
                              </Typography>
                              <LinearProgress sx={{ borderRadius: 999 }} />
                            </Box>
                          )}

                          {spamScoreResult && (
                            <Paper variant="outlined" sx={{ p: 1.2, borderRadius: '10px', borderColor: alpha(theme.palette.warning.main, 0.36) }}>
                              {(() => {
                                const total = spamScoreResult.combinations.length;
                                const fromRow = total > 0 ? spamVisibleStart + 1 : 0;
                                const toRow = Math.min(total, spamVisibleStart + spamRowsPerView);
                                const maxStart = Math.max(0, total - spamRowsPerView);
                                const canUp = spamVisibleStart > 0;
                                const canDown = spamVisibleStart < maxStart;
                                return (
                                  <>
                              {spamScoreResult.fallback_used && (
                                <Alert severity="info" sx={{ mb: 1 }}>
                                  Spam score used fallback heuristic due to model timeout/availability. You can retry for model-based scoring.
                                </Alert>
                              )}
                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1 }}>
                                <Chip color="warning" variant="outlined" label={`Avg Spam Score: ${spamScoreResult.overall.average_spam_score}`} />
                                <Chip color="warning" variant="outlined" label={`Highest: ${spamScoreResult.overall.highest_spam_score}`} />
                                <Chip color={spamScoreResult.overall.high_risk_count > 0 ? 'error' : 'success'} variant="outlined" label={`High Risk Combos: ${spamScoreResult.overall.high_risk_count}`} />
                              </Stack>
                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1 }}>
                                <Button size="small" variant="outlined" startIcon={<KeyboardDoubleArrowUpIcon />} onClick={() => handleScrollSpamTable('top')} disabled={!canUp}>
                                  Top
                                </Button>
                                <Button size="small" variant="outlined" startIcon={<ArrowUpwardIcon />} onClick={() => handleScrollSpamTable('up')} disabled={!canUp}>
                                  Up
                                </Button>
                                <Button size="small" variant="outlined" startIcon={<ArrowDownwardIcon />} onClick={() => handleScrollSpamTable('down')} disabled={!canDown}>
                                  Down
                                </Button>
                                <Button size="small" variant="outlined" startIcon={<KeyboardDoubleArrowDownIcon />} onClick={() => handleScrollSpamTable('bottom')} disabled={!canDown}>
                                  Bottom
                                </Button>
                                <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                                  Showing {fromRow}-{toRow} of {total} combinations
                                </Typography>
                              </Stack>
                              <TableContainer
                                id="spam-score-table-scroll"
                                ref={spamTableContainerRef}
                                sx={{ maxHeight: 280, overflowY: 'auto', overflowX: 'auto' }}
                              >
                                <Table size="small" stickyHeader>
                                  <TableHead>
                                    <TableRow>
                                      <TableCell>Combo</TableCell>
                                      <TableCell>Subject</TableCell>
                                      <TableCell>Body</TableCell>
                                      <TableCell>Score</TableCell>
                                      <TableCell>Risk</TableCell>
                                      <TableCell>Notes</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {spamScoreResult.combinations.slice(spamVisibleStart, spamVisibleStart + spamRowsPerView).map((row) => (
                                      <TableRow key={`spam-score-${row.combo_index}`}>
                                        <TableCell>{row.combo_index}</TableCell>
                                        <TableCell>{row.subject_index}</TableCell>
                                        <TableCell>{row.body_index}</TableCell>
                                        <TableCell>{row.spam_score}</TableCell>
                                        <TableCell>
                                          <Chip
                                            size="small"
                                            label={row.risk_level}
                                            color={row.risk_level === 'high' ? 'error' : row.risk_level === 'medium' ? 'warning' : 'success'}
                                            variant="outlined"
                                          />
                                        </TableCell>
                                        <TableCell>{(row.reasons || []).slice(0, 1).join('; ') || '-'}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </TableContainer>
                                  </>
                                );
                              })()}
                            </Paper>
                          )}

                          {(generatedSubjects.length > 0 || generatedBodies.length > 0) && (
                            <Paper variant="outlined" sx={{ p: 1.2, borderRadius: '10px', borderColor: alpha(theme.palette.primary.main, 0.2) }}>
                              <Grid container spacing={1.5}>
                                <Grid item xs={12} md={6}>
                                  <Typography variant="caption" color="text.secondary">Generated Subjects (Editable)</Typography>
                                  <Stack spacing={0.9} sx={{ mt: 0.6 }}>
                                    {ensureFive(generatedSubjects).map((subject, idx) => (
                                      <TextField
                                        key={`subject-edit-${idx}`}
                                        size="small"
                                        label={`Subject ${idx + 1}`}
                                        value={subject}
                                        onChange={(event) => handleEditGeneratedSubject(idx, event.target.value)}
                                      />
                                    ))}
                                  </Stack>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                  <Typography variant="caption" color="text.secondary">Generated Bodies (Editable)</Typography>
                                  <Stack spacing={0.9} sx={{ mt: 0.6 }}>
                                    {ensureFive(generatedBodies).map((body, idx) => (
                                      <Accordion
                                        key={`body-edit-${idx}`}
                                        disableGutters
                                        defaultExpanded={idx === 0}
                                        sx={{
                                          borderRadius: '8px',
                                          border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                                          boxShadow: 'none',
                                          '&:before': { display: 'none' },
                                        }}
                                      >
                                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            {`Body ${idx + 1}`}
                                          </Typography>
                                          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                            {(body || '').slice(0, 70)}{(body || '').length > 70 ? '...' : ''}
                                          </Typography>
                                        </AccordionSummary>
                                        <AccordionDetails sx={{ pt: 0.5 }}>
                                          <TextField
                                            fullWidth
                                            size="small"
                                            multiline
                                            minRows={4}
                                            value={body}
                                            onChange={(event) => handleEditGeneratedBody(idx, event.target.value)}
                                          />
                                        </AccordionDetails>
                                      </Accordion>
                                    ))}
                                  </Stack>
                                </Grid>
                              </Grid>
                            </Paper>
                          )}
                        </>
                      )}
                    </Stack>
                  </Paper>
                )}

                {(createCampaignType !== 'email' || emailContentMode === 'manual') && (
                  <TextField
                    size="small"
                    sx={{
                      ...compactInputSx,
                      ...(emailEditorMode === 'html'
                        ? { '& .MuiInputBase-input': { fontFamily: 'Consolas, Menlo, monospace' } }
                        : {}),
                    }}
                    fullWidth
                    multiline
                    minRows={emailEditorMode === 'html' ? 9 : 6}
                    label={createCampaignType === 'email' ? `Email Template (${emailEditorMode.toUpperCase()})` : 'Message Template'}
                    value={createMessageTemplate}
                    onChange={(e) => {
                      setCreateMessageTemplate(e.target.value);
                      if (createCampaignErrors.emailBody) {
                        setCreateCampaignErrors((prev) => ({ ...prev, emailBody: false }));
                      }
                    }}
                    error={createCampaignErrors.emailBody}
                    helperText={createCampaignErrors.emailBody ? (createCampaignType === 'email' ? 'Email body is required' : 'Message template is required') : ' '}
                    placeholder={
                      createCampaignType === 'email' && emailEditorMode === 'html'
                        ? '<h2>Hello {{first_name}}</h2><p>Write your HTML campaign body here...</p>'
                        : 'Write your campaign message here...'
                    }
                  />
                )}

                {(createCampaignErrors.contactList || createCampaignErrors.product) && (
                  <Alert severity="error" sx={{ mt: 1 }}>
                    {createCampaignErrors.contactList && createCampaignErrors.product
                      ? 'Contact List and Product are required.'
                      : createCampaignErrors.contactList
                        ? 'Contact List is required.'
                        : 'Product is required.'}
                  </Alert>
                )}

                {createCampaignType === 'email' && emailContentMode === 'prompt' && (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    Prompt mode sends using permutation and combination of generated variants across recipients (5 subjects x 5 bodies = 25 combinations).
                  </Alert>
                )}
              </Grid>

              {createCampaignType === 'email' && showEmailPreview && (
                <Grid item xs={12}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.6,
                      borderRadius: '12px',
                      borderColor: alpha(theme.palette.primary.main, 0.2),
                    }}
                  >
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                      Email Body Preview
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1.2, color: 'text.secondary' }}>
                      <strong>Subject:</strong> {emailSubject || createCampaignName || 'Campaign Update'}
                    </Typography>
                    <Divider sx={{ mb: 1.4 }} />
                    <Box
                      sx={{
                        borderRadius: '10px',
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
                        p: 1.8,
                        bgcolor: alpha(theme.palette.common.white, 0.82),
                      }}
                    >
                      {emailEditorMode === 'html' || looksLikeHtml(createMessageTemplate) ? (
                        <Box
                          sx={{ '& h1, & h2, & h3': { mt: 0 } }}
                          dangerouslySetInnerHTML={{
                            __html:
                              (emailContentMode === 'prompt' ? generatedBodies[0] : createMessageTemplate) ||
                              '<p style="color:#64748b;">No HTML content yet.</p>',
                          }}
                        />
                      ) : (
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.primary' }}>
                          {(emailContentMode === 'prompt' ? generatedBodies[0] : createMessageTemplate) || 'No message content yet.'}
                        </Typography>
                      )}
                    </Box>
                  </Paper>
                </Grid>
              )}

              <Grid item xs={12} md={4}>
                <TextField
                  size="small"
                  sx={compactInputSx}
                  fullWidth
                  type="datetime-local"
                  label="Schedule Time (optional)"
                  value={createScheduledTime}
                  onChange={(e) => setCreateScheduledTime(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} md={8}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button size="small" sx={compactButtonSx} variant="outlined" component="label" startIcon={<UploadFileIcon />}>
                    Upload Template File
                    <input
                      hidden
                      type="file"
                      accept=".txt,.md,.html"
                      onChange={(e) => handleTemplateFileUpload(e.target.files?.[0] || null)}
                    />
                  </Button>
                  <Button size="small" sx={compactButtonSx} variant="contained" onClick={handleCreateCampaign} startIcon={<AddIcon />}>
                    Create Campaign
                  </Button>
                </Stack>
              </Grid>

              <Grid item xs={12}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: '12px', borderColor: alpha(theme.palette.primary.main, 0.2) }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                    Recipient Preview
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1.5 }}>
                    <TextField
                      size="small"
                      sx={compactInputSx}
                      label="Filter Contacts"
                      value={previewSearch}
                      onChange={(e) => setPreviewSearch(e.target.value)}
                    />
                    <Button
                      size="small"
                      sx={compactButtonSx}
                      variant="outlined"
                      onClick={() => createContactListId && loadPreviewContacts(Number(createContactListId))}
                    >
                      Apply
                    </Button>
                  </Stack>
                  {previewContacts.length ? (
                    <Stack spacing={0.75}>
                      {previewContacts.map((contact) => (
                        <Typography key={contact.id} variant="body2">
                          {(contact.name || 'Unnamed')} - {contact.email || '-'} {contact.phone ? `| ${contact.phone}` : ''} {contact.company ? `| ${contact.company}` : ''}
                        </Typography>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">No contacts to preview.</Typography>
                  )}
                </Paper>
              </Grid>
            </Grid>
          </Paper>
        )}

        {tab === 2 && (
          <Stack spacing={2.5}>
            <Paper sx={{ ...sectionPanelSx, p: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Create Contact List</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    size="small"
                    sx={compactInputSx}
                    fullWidth
                    label="List Name"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    size="small"
                    sx={compactInputSx}
                    fullWidth
                    label="Description"
                    value={newListDescription}
                    onChange={(e) => setNewListDescription(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <Button size="small" sx={compactButtonSx} fullWidth variant="contained" onClick={handleCreateList}>Create</Button>
                </Grid>
              </Grid>
            </Paper>

            <Paper sx={{ ...sectionPanelSx, p: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Contact Lists</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
                <TextField
                  size="small"
                  sx={compactInputSx}
                  label="Filter Lists"
                  value={contactListSearch}
                  onChange={(e) => setContactListSearch(e.target.value)}
                />
                <Button size="small" sx={compactButtonSx} variant="outlined" onClick={() => { setContactListPage(0); loadContactLists(); }}>
                  Apply
                </Button>
              </Stack>

              <TableContainer sx={{ borderRadius: '12px', border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}` }}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ background: `linear-gradient(110deg, ${alpha('#e7f0ff', 0.8)} 0%, ${alpha('#d8e9ff', 0.68)} 100%)` }}>
                      <TableCell>List Name</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Contacts</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {contactLists.length ? (
                      contactLists.map((list) => (
                        <TableRow key={list.id} hover sx={{ '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.05) } }}>
                          <TableCell>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                              <Typography>{list.list_name}</Typography>
                              {list.is_agent_auto_list && (
                                <Chip size="small" color="info" variant="outlined" label="Auto-created" />
                              )}
                            </Stack>
                          </TableCell>
                          <TableCell>{getContactListDescription(list)}</TableCell>
                          <TableCell>{list.contact_count}</TableCell>
                          <TableCell>{formatDate(list.created_at)}</TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1}>
                              <Button size="small" startIcon={<ListAltIcon />} onClick={() => handleSelectListForContacts(list.id)}>
                                View Contacts
                              </Button>
                              <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => handleDeleteList(list.id)}>
                                Delete
                              </Button>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} align="center">No contact lists found.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                component="div"
                count={contactListTotal}
                page={contactListPage}
                onPageChange={(_, value) => setContactListPage(value)}
                rowsPerPage={contactListRowsPerPage}
                onRowsPerPageChange={(event) => {
                  setContactListRowsPerPage(parseInt(event.target.value, 10));
                  setContactListPage(0);
                }}
                rowsPerPageOptions={[10, 25, 50]}
              />
            </Paper>

            {selectedListId && (
              <Paper sx={{ ...sectionPanelSx, p: 2.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                  Uploaded Contacts (List #{selectedListId})
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
                  <TextField
                    size="small"
                    sx={compactInputSx}
                    label="Filter Contacts"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                  />
                  <Button size="small" sx={compactButtonSx} variant="outlined" onClick={handleFilterContacts}>Apply</Button>
                </Stack>
                <TableContainer sx={{ borderRadius: '12px', border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}` }}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ background: `linear-gradient(110deg, ${alpha('#e7f0ff', 0.8)} 0%, ${alpha('#d8e9ff', 0.68)} 100%)` }}>
                        <TableCell>Name</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell>Phone</TableCell>
                        <TableCell>Company</TableCell>
                        <TableCell>Created</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {contacts.length ? (
                        contacts.map((contact) => (
                          <TableRow key={contact.id} hover sx={{ '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.05) } }}>
                            <TableCell>{contact.name || '-'}</TableCell>
                            <TableCell>{contact.email || '-'}</TableCell>
                            <TableCell>{contact.phone || '-'}</TableCell>
                            <TableCell>{contact.company || '-'}</TableCell>
                            <TableCell>{formatDate(contact.created_at)}</TableCell>
                            <TableCell>
                              <Button size="small" color="error" onClick={() => handleDeleteContact(contact.id)}>
                                Delete
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} align="center">No contacts found.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  component="div"
                  count={contactTotal}
                  page={contactPage}
                  onPageChange={(_, value) => setContactPage(value)}
                  rowsPerPage={contactRowsPerPage}
                  onRowsPerPageChange={(event) => {
                    setContactRowsPerPage(parseInt(event.target.value, 10));
                    setContactPage(0);
                  }}
                  rowsPerPageOptions={[10, 25, 50, 100]}
                />
              </Paper>
            )}
          </Stack>
        )}

        {tab === 3 && (
          <Stack spacing={2.5}>
            <Paper sx={{ ...sectionPanelSx, p: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Upload Contacts</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth size="small" sx={compactInputSx}>
                    <InputLabel>Target Contact List</InputLabel>
                    <Select
                      value={uploadListId}
                      label="Target Contact List"
                      onChange={(e) => setUploadListId(Number(e.target.value))}
                    >
                      {contactLists.map((list) => (
                        <MenuItem key={list.id} value={list.id}>{getContactListLabel(list)}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Alert severity="info">CSV/Excel format: name,email,phone,company</Alert>
                </Grid>
              </Grid>
            </Paper>

            <Paper sx={{ ...sectionPanelSx, p: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Manual Entry (Optional)</Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} flexWrap="wrap" useFlexGap>
                <TextField
                  size="small"
                  sx={{ ...compactInputSx, minWidth: 160, flex: '1 1 180px' }}
                  label="Name"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                />
                <TextField
                  size="small"
                  sx={{ ...compactInputSx, minWidth: 200, flex: '1 1 220px' }}
                  label="Email"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                />
                <TextField
                  size="small"
                  sx={{ ...compactInputSx, minWidth: 170, flex: '1 1 200px' }}
                  label="Phone"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                />
                <TextField
                  size="small"
                  sx={{ ...compactInputSx, minWidth: 170, flex: '1 1 200px' }}
                  label="Company"
                  value={manualCompany}
                  onChange={(e) => setManualCompany(e.target.value)}
                />
                <Button size="small" sx={{ ...compactButtonSx, minWidth: 90 }} variant="outlined" onClick={handleAddManualContact}>
                  Add
                </Button>
                <Button size="small" sx={{ ...compactButtonSx, minWidth: 95 }} variant="contained" onClick={handleManualUpload}>
                  Upload
                </Button>
              </Stack>

              {manualContacts.length > 0 && (
                <TableContainer sx={{ mt: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell>Phone</TableCell>
                        <TableCell>Company</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {manualContacts.map((item, idx) => (
                        <TableRow key={`${item.email}-${item.phone}-${idx}`}>
                          <TableCell>{item.name || '-'}</TableCell>
                          <TableCell>{item.email || '-'}</TableCell>
                          <TableCell>{item.phone || '-'}</TableCell>
                          <TableCell>{item.company || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>

            <Paper sx={{ ...sectionPanelSx, p: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>CSV Upload</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button size="small" sx={compactButtonSx} variant="outlined" startIcon={<FileDownloadIcon />} onClick={handleDownloadCsvTemplate}>
                  Download CSV Template
                </Button>
                <Button size="small" sx={compactButtonSx} component="label" variant="outlined" startIcon={<UploadFileIcon />}>
                  Choose CSV/Excel
                  <input
                    hidden
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  />
                </Button>
                <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
                  {csvFile ? csvFile.name : 'No file selected'}
                </Typography>
                <Button size="small" sx={compactButtonSx} variant="contained" onClick={handleCsvUpload}>Upload File</Button>
              </Stack>
            </Paper>
          </Stack>
        )}

        {tab === 4 && (
          <Paper sx={{ ...sectionPanelSx, p: 2.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Campaign Logs</Typography>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} md={5}>
                <FormControl fullWidth size="small">
                  <InputLabel>Campaign</InputLabel>
                  <Select
                    value={selectedCampaignId}
                    label="Campaign"
                    onChange={(e) => setSelectedCampaignId(Number(e.target.value))}
                  >
                    {campaignOptions.map((campaign) => (
                      <MenuItem key={campaign.id} value={campaign.id}>{campaign.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select value={logStatusFilter} label="Status" onChange={(e) => setLogStatusFilter(e.target.value)}>
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="sent">Sent</MenuItem>
                    <MenuItem value="failed">Failed</MenuItem>
                    <MenuItem value="pending">Pending</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <Button variant="outlined" fullWidth onClick={handleApplyLogsFilter}>Apply</Button>
              </Grid>
              <Grid item xs={12} md={2}>
                {selectedCampaignId && (
                  <Button variant="contained" fullWidth onClick={() => loadLogs(Number(selectedCampaignId))}>Refresh</Button>
                )}
              </Grid>
            </Grid>

            <TableContainer sx={{ borderRadius: '12px', border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}` }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ background: `linear-gradient(110deg, ${alpha('#e7f0ff', 0.8)} 0%, ${alpha('#d8e9ff', 0.68)} 100%)` }}>
                    <TableCell>Contact</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Sent At</TableCell>
                    <TableCell>Error</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.length ? (
                    logs.map((item) => (
                      <TableRow key={item.id} hover sx={{ '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.05) } }}>
                        <TableCell>{item.contact_name || '-'}</TableCell>
                        <TableCell>{item.email || '-'}</TableCell>
                        <TableCell>{item.phone || '-'}</TableCell>
                        <TableCell>
                          <Chip size="small" label={item.status} color={item.status === 'sent' ? 'success' : item.status === 'failed' ? 'error' : 'default'} variant="outlined" />
                        </TableCell>
                        <TableCell>{formatDate(item.sent_at || item.created_at)}</TableCell>
                        <TableCell>{item.error_message || '-'}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} align="center">No logs found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={logTotal}
              page={logPage}
              onPageChange={(_, value) => setLogPage(value)}
              rowsPerPage={logRowsPerPage}
              onRowsPerPageChange={(event) => {
                setLogRowsPerPage(parseInt(event.target.value, 10));
                setLogPage(0);
              }}
              rowsPerPageOptions={[10, 25, 50]}
            />
          </Paper>
        )}

        <Dialog open={productDialogOpen} onClose={() => setProductDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Add Product</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ pt: 0.5 }}>
              <TextField
                fullWidth
                label="Product Name"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
              />
              <TextField
                fullWidth
                label="Product Code"
                value={newProductCode}
                onChange={(e) => setNewProductCode(e.target.value)}
              />
              <TextField
                fullWidth
                label="Description"
                multiline
                minRows={3}
                value={newProductDescription}
                onChange={(e) => setNewProductDescription(e.target.value)}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setProductDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleCreateProductFromCampaign} disabled={creatingProduct}>
              {creatingProduct ? 'Saving...' : 'Save Product'}
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
      </Box>
    </AdminLayout>
  );
};

export default CampaignManagementPage;


