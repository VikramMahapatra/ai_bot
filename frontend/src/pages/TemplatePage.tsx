import React, { useEffect, useState } from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  MenuItem,
  FormControl,
  Select,
  InputLabel,
  IconButton,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  LinearProgress,
  InputAdornment,
  Tooltip,
  Snackbar,
  TablePagination,
} from "@mui/material";

import { alpha, useTheme } from "@mui/material/styles";
import { Add, Edit, Visibility } from "@mui/icons-material";
import AdminLayout from "../components/Layout/AdminLayout";
import {
  messageTemplateService,
  MetaStatus,
  Template,
  TemplateForm,
  TemplateType,
  VariableMapping,
  WhatsAppCategory,
} from "../services/messageTemplateService";
import SearchIcon from "@mui/icons-material/Search";
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useDateFormatter } from "../hooks/useDateFormatter";
import { SourceChip, StatusChip, titleCase } from "../components/Common/StatusChips";
import { ConfirmDialog } from "../components/Common/ConfirmDialog";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";

const contactFieldOptions = [
  // Basic
  { value: "name", label: "Name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "whatsapp_number", label: "WhatsApp Number" },
  { value: "company", label: "Company" },
  { value: "designation", label: "Designation" },

  // Product
  { value: "item_name", label: "Item Name" },
  { value: "item_type", label: "Item Type" },
  { value: "interest_stage", label: "Interest Stage" },
  { value: "item_category", label: "Item Category" },

  // Other
  { value: "amount", label: "Amount" },
  { value: "offer_value", label: "Offer Value" },
  { value: "city", label: "City" },
  { value: "state", label: "State" },
  { value: "country", label: "Country" },
  { value: "source", label: "Source" },
  { value: "lifecycle_stage", label: "Lifecycle Stage" },
  { value: "tags", label: "Tags" },
];

export const generatePreview = (
  content: string,
  mappings: Record<string, VariableMapping>
) => {

  let preview = content;

  Object.entries(mappings).forEach(([key, value]) => {

    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");

    preview = preview.replace(
      regex,
      value.sample || `{{${key}}}`
    );

  });

  return preview;
};

const emptyTemplateForm: TemplateForm = {
  name: "",
  type: "whatsapp" as TemplateType,
  category: "MARKETING" as WhatsAppCategory,
  language: "en",
  subject: "",
  content: "",
  variable_mappings: {},
  meta_status: "DRAFT" as MetaStatus
}

interface TemplateErrors {
  name?: string;
  type?: string;
  subject?: string;
  content?: string;

  variable_mappings?: Record<
    string,
    {
      field?: string;
      sample?: string;
    }
  >;
}

function TemplateList() {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<Template | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [templateTotal, setTemplateTotal] = useState(0);
  const [templatePage, setTemplatePage] = useState(0);
  const [templateRowsPerPage, setTemplateRowsPerPage] = useState(10);

  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(
    null,
  );
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [errors, setErrors] = useState<TemplateErrors>({});
  const [templateStatusToUpdate, setTemplateStatusToUpdate] = useState<Template | null>(null);

  const formatDisplayDate = useDateFormatter();


  const [form, setForm] = useState<TemplateForm>(emptyTemplateForm);
  const [type, setType] = useState("all");
  const [syncing, setSyncing] = useState(false);

  const formatTemplateName = (name: string) => {
    return name
      .toLowerCase()
      .replace(/\s+/g, "_")       // spaces → _
      .replace(/[^a-z0-9_]/g, ""); // remove invalid chars
  };

  const handleOpen = (item?: Template) => {
    if (item) {
      setEditItem(item);
      setForm({
        name: item.name,
        type: item.type,
        category: item.category || "MARKETING" as WhatsAppCategory,
        language: item.language || "en",
        subject: item.subject || "",
        content: item.content,
        meta_status: item.meta_status || "PENDING" as any,
        variable_mappings: item.variable_mappings || {},
      });
    } else {
      setEditItem(null);
      setForm(emptyTemplateForm);
    }
    setTemplateError(null);
    setOpen(true);
  };

  useEffect(() => {
    fetchTemplates();
  }, [search, templatePage, templateRowsPerPage, type]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      setLoading(true);
      const data = await messageTemplateService.listTemplates({
        search: search || undefined,
        type: type,
        skip: templatePage * templateRowsPerPage,
        limit: templateRowsPerPage,
      });
      setTemplates(data.items || []);
      setTemplateTotal(data.pagination?.total || 0);
    } catch (err) {
      setError("Failed to load templates");
    } finally {
      setLoading(false);
    }
  };


  const handleSyncWhatsAppTemplates = async () => {
    try {
      setSyncing(true);

      const res = await messageTemplateService.syncWhatsAppTemplates();

      setSuccess(
        res.message || "WhatsApp templates synced",
      );

      fetchTemplates();

    } catch (error: any) {
      setError(
        error?.response?.data?.detail || "Sync failed"
      );

    } finally {
      setSyncing(false);
    }
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditItem(null);
  };

  const handleCreate = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      const response = await messageTemplateService.createTemplate(form);
      if (response.success) {
        fetchTemplates();
        handleCloseDialog();
      } else {
        setTemplateError(response.message);
      }
    } catch {
      setTemplateError("Failed to create template");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editItem) return;

    if (!validateForm()) return;

    setLoading(true);
    try {
      const response = await messageTemplateService.updateTemplate(
        editItem.id,
        form,
      );
      if (response.success) {
        fetchTemplates();
        handleCloseDialog();
      } else {
        setTemplateError(response.message);
      }
    } catch {
      setTemplateError("Failed to update template");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDeleteTemplate = async () => {
    if (!templateToDelete?.id) return;

    setDeleteSubmitting(true);
    setError(null);
    await messageTemplateService.deleteTemplate(templateToDelete.id);
    setTemplateToDelete(null);
    await fetchTemplates();
    setDeleteSubmitting(false);
  };

  const handleToggleStatus = async () => {
    if (!templateStatusToUpdate?.id) return;
    setError('');
    setDeleteSubmitting(true);
    setLoading(true);
    try {

      const newStatus = templateStatusToUpdate.status === "Active" ? "Inactive" : "Active";
      // call API
      const response = await messageTemplateService.updateTemplateStatus(templateStatusToUpdate.id, newStatus.toLowerCase() as any)

      if (response.success) {
        // update UI locally (important for instant feedback)
        setTemplates((prev) =>
          prev.map((t) =>
            t.id === templateStatusToUpdate.id ? { ...t, status: newStatus } : t
          )
        );

      }
      else {
        setError(response.message);
      }

      setTemplateStatusToUpdate(null);

    } catch (err) {
      console.error("Failed to update status", err);
      setError("Failed to update status");
    } finally {
      setDeleteSubmitting(false);
      setLoading(false);
    }
  };

  const validateForm = () => {
    let valid = true;

    const newErrors = {
      name: "",
      type: "",
      subject: "",
      content: "",
      variable_mappings: {} as Record<string, { field?: string; sample?: string }>,
    };

    // 🔹 Basic validations (existing)
    if (!form.name.trim()) {
      newErrors.name = "Template name is required";
      valid = false;
    }

    if (!form.type) {
      newErrors.type = "Type is required";
      valid = false;
    }

    if (form.type === "email" && !form.subject.trim()) {
      newErrors.subject = "Subject is required for email";
      valid = false;
    }

    if (!form.content.trim()) {
      newErrors.content = "Message content is required";
      valid = false;
    }

    // WhatsApp-specific validation
    if (form.type === "whatsapp") {
      const mappingErrors: Record<
        string,
        {
          field?: string;
          sample?: string;
        }
      > = {};

      const content = form.content;

      //Extract variables like {{1}}, {{2}}
      const matches = content.match(/{{\d+}}/g) || [];
      const variables = matches.map((v) =>
        parseInt(v.replace(/[{}]/g, ""))
      );

      //Check named variables (invalid)
      if (/{{[a-zA-Z]+}}/.test(content)) {
        newErrors.content =
          "Use numbered variables like {{1}}, {{2}} only.";
        valid = false;
      }

      //Max 10 variables
      if (variables.length > 10) {
        newErrors.content =
          "Maximum 10 variables allowed ({{1}} to {{10}})";
        valid = false;
      }

      //Sequential check
      const uniqueSorted = [...new Set(variables)].sort((a, b) => a - b);

      for (let i = 0; i < uniqueSorted.length; i++) {
        if (uniqueSorted[i] !== i + 1) {
          newErrors.content =
            "Variables must be sequential like {{1}}, {{2}}, {{3}}";
          valid = false;
          break;
        }
      }

      uniqueSorted.forEach((variableNumber) => {

        const key = String(variableNumber);

        const mapping =
          form.variable_mappings?.[key];

        if (!mapping?.field) {

          if (!mappingErrors[key]) {
            mappingErrors[key] = {};
          }

          mappingErrors[key].field =
            `Please map {{${key}}} to a contact field`;

          valid = false;
        }

        if (!mapping?.sample?.trim()) {

          if (!mappingErrors[key]) {
            mappingErrors[key] = {};
          }

          mappingErrors[key].sample =
            `Please enter sample value for {{${key}}}`;

          valid = false;
        }

      });

      //Spam keyword check
      const spamWords = [
        "buy now",
        "free!!!",
        "guaranteed",
        "click here",
        "urgent",
      ];

      const hasSpam = spamWords.some((word) =>
        content.toLowerCase().includes(word)
      );

      if (hasSpam) {
        newErrors.content =
          "Message contains restricted or spam keywords.";
        valid = false;
      }

      //Category alignment (only if you added category field)
      if (form.category === "AUTHENTICATION") {
        if (!/otp|code|password/i.test(content)) {
          newErrors.content =
            "Authentication templates must include OTP or verification context.";
          valid = false;
        }
      }

      if (form.category === "UTILITY") {
        if (!/order|invoice|payment|delivery|update/i.test(content)) {
          newErrors.content =
            "Utility templates should relate to transaction updates.";
          valid = false;
        }
      }

      if (form.category === "MARKETING") {
        if (!/offer|discount|sale|promotion/i.test(content)) {
          newErrors.content =
            "Marketing templates should include promotional context.";
          valid = false;
        }
      }

      if (Object.keys(mappingErrors).length > 0) {
        newErrors.variable_mappings = mappingErrors;
      }
    }

    setErrors(newErrors);
    return valid;
  };

  const extractWhatsAppVariables = (content: string) => {
    const matches = content.match(/{{\d+}}/g) || [];

    return [
      ...new Set(
        matches.map((m) => m.replace(/[{}]/g, ""))
      ),
    ];
  };



  const isActive = templateStatusToUpdate?.status === "Active";
  const actionLabel = isActive ? "Deactivate" : "Activate";
  const whatsappVariables = extractWhatsAppVariables(form.content);

  const isWhatsAppEditLocked =
    form.type === "whatsapp" &&
    (form.meta_status === "APPROVED" || form.meta_status === "PENDING");

  return (
    <AdminLayout>
      <Box sx={{ p: 3 }}>
        {/* HEADER */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box display="flex" justifyContent="space-between">
            <Box>
              <Typography variant="h4" fontWeight={700}>
                Message Templates
              </Typography>
              <Typography variant="body2">
                Manage SMS, WhatsApp & Email templates
              </Typography>
            </Box>
          </Box>
        </Paper>
        <Paper sx={{ p: 2, mb: 2, borderRadius: 3 }}>
          <Grid container spacing={2} alignItems="center">
            {/* SEARCH */}
            <Grid item xs={12} md={5}>
              <TextField
                fullWidth
                size="small"
                label="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton>
                        <SearchIcon />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                select
                fullWidth
                label="Type"
                size="small"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="sms">SMS</MenuItem>
                <MenuItem value="whatsapp">WhatsApp</MenuItem>
                <MenuItem value="email">Email</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={5}>
              <Stack direction="row" spacing={2}>

                <Button
                  variant="outlined"
                  onClick={handleSyncWhatsAppTemplates}
                  disabled={syncing}
                >
                  {syncing ? "Syncing..." : "Sync WhatsApp"}
                </Button>

                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => handleOpen()}
                >
                  Create Template
                </Button>

              </Stack>
            </Grid>
          </Grid>
        </Paper>

        <Snackbar
          open={Boolean(success || error)}
          autoHideDuration={4000}
          onClose={() => {
            setError("");
            setSuccess("");
          }}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Alert
            severity={error ? "error" : "success"}
            onClose={() => {
              setError("");
              setSuccess("");
            }}
            sx={{
              borderRadius: "14px",
              boxShadow: (theme) =>
                `0 10px 18px ${error ? theme.palette.error.dark : theme.palette.success.dark
                }20`,
            }}
          >
            {error || success}
          </Alert>
        </Snackbar>

        {/* TABLE */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Meta Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ py: 8, textAlign: "center" }}>
                    <SearchIcon
                      sx={{ fontSize: 40, color: "text.secondary" }}
                    />
                    <Typography>No templates found</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((t) => (
                  <TableRow key={t.id} hover>
                    <TableCell>
                      <Stack spacing={0.3}>
                        <Typography fontWeight={600}>
                          {t.name}
                        </Typography>

                        {t.type === "whatsapp" && t.category && (
                          <Stack
                            direction="row"
                            spacing={0.5}
                            alignItems="center"
                          >
                            <WhatsAppIcon
                              sx={{
                                fontSize: 14,
                                color:
                                  t.category === "MARKETING"
                                    ? "warning.main"
                                    : t.category === "UTILITY"
                                      ? "info.main"
                                      : "success.main",
                              }}
                            />

                            <Typography
                              variant="caption"
                              sx={{
                                fontWeight: 600,
                                color: "text.secondary",
                                fontSize: 11,
                              }}
                            >
                              Category:
                            </Typography>

                            <Typography
                              variant="caption"
                              sx={{
                                fontWeight: 700,
                                color:
                                  t.category === "MARKETING"
                                    ? "warning.main"
                                    : t.category === "UTILITY"
                                      ? "info.main"
                                      : "success.main",
                                fontSize: 11,
                              }}
                            >
                              {titleCase(t.category)}
                            </Typography>
                          </Stack>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <SourceChip
                        value={t.type}
                      />
                    </TableCell>
                    <TableCell>{t.subject || "-"}</TableCell>
                    <TableCell>
                      <Tooltip title="Click to toggle status">
                        <span>
                          <StatusChip
                            value={t.status}
                            onClick={() => setTemplateStatusToUpdate(t)}
                          />
                        </span>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      {t.type === "whatsapp" ? (
                        t.meta_status ? (
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip
                              label={t.meta_status}
                              size="small"
                              color={
                                t.meta_status === "APPROVED"
                                  ? "success"
                                  : t.meta_status === "REJECTED" || t.meta_status === "FAILED"
                                    ? "error"
                                    : "warning"
                              }
                            />

                            {/* 🔥 Tooltip for BOTH REJECTED and FAILED */}
                            {(t.meta_status === "REJECTED" || t.meta_status === "FAILED") &&
                              t.rejection_reason && (
                                <Tooltip title={t.rejection_reason}>
                                  <ErrorOutlineIcon color="error" fontSize="small" />
                                </Tooltip>
                              )}
                          </Stack>
                        ) : (
                          <Chip label="NOT SUBMITTED" size="small" color="default" />
                        )
                      ) : (
                        "-"
                      )}
                    </TableCell>

                    <TableCell>{formatDisplayDate(t.created_at)}</TableCell>

                    <TableCell align="right">
                      <IconButton onClick={() => handleOpen(t)}>
                        <Edit />
                      </IconButton>
                      {/* <IconButton>
                        <Visibility />
                      </IconButton> */}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={templateTotal}
            page={templatePage}
            onPageChange={(_, value) => setTemplatePage(value)}
            rowsPerPage={templateRowsPerPage}
            onRowsPerPageChange={(event) => {
              setTemplateRowsPerPage(parseInt(event.target.value, 10));
              setTemplatePage(0);
            }}
            rowsPerPageOptions={[10, 25, 50]}
          />
        </TableContainer>

        {/* CREATE / EDIT MODAL */}
        <Dialog open={open} fullWidth maxWidth="md">
          <DialogTitle>
            {editItem ? "Edit Template" : "Create Template"}
          </DialogTitle>

          <DialogContent>
            {templateError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {templateError}
              </Alert>
            )}
            {isWhatsAppEditLocked && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                This template cannot be edited because it is {form.meta_status}.
              </Alert>
            )}
            <Stack spacing={2} mt={1}>
              <TextField
                required
                label="Template Name"
                fullWidth
                value={form.name}
                error={!!errors.name}
                helperText={errors.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                disabled={isWhatsAppEditLocked}
              />
              {form.type === "whatsapp" && (
                <TextField
                  label="WhatsApp Template Name"
                  value={formatTemplateName(form.name || "")}
                  fullWidth
                  InputProps={{
                    readOnly: true,
                  }}
                  helperText="Auto-generated from Template Name (lowercase, underscores only)"
                />
              )}
              <TextField
                select
                label="Type"
                value={form.type}
                error={!!errors.type}
                helperText={errors.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as TemplateType })
                }
                InputProps={{
                  readOnly: isWhatsAppEditLocked,
                }}
              >
                <MenuItem value="sms">SMS</MenuItem>
                <MenuItem value="whatsapp">WhatsApp</MenuItem>
                <MenuItem value="email">Email</MenuItem>
              </TextField>

              {form.type === "email" && (
                <TextField
                  label="Subject"
                  fullWidth
                  value={form.subject}
                  error={!!errors.subject}
                  helperText={errors.subject}
                  onChange={(e) =>
                    setForm({ ...form, subject: e.target.value })
                  }
                  disabled={isWhatsAppEditLocked}
                />
              )}
              {form.type === "whatsapp" && (
                <Stack spacing={1}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <TextField
                      select
                      label="Category"
                      value={form.category || "MARKETING"}
                      onChange={(e) =>
                        setForm({ ...form, category: e.target.value as any })
                      }
                      fullWidth
                      InputProps={{
                        readOnly: isWhatsAppEditLocked,
                      }}
                    >
                      <MenuItem value="MARKETING">Marketing</MenuItem>
                      <MenuItem value="UTILITY">Utility</MenuItem>
                      <MenuItem value="AUTHENTICATION">Authentication</MenuItem>
                    </TextField>

                    <TextField
                      label="Language"
                      value={form.language || "en"}
                      onChange={(e) =>
                        setForm({ ...form, language: e.target.value })
                      }
                      fullWidth
                      helperText="e.g. en, en_US"
                      InputProps={{
                        readOnly: isWhatsAppEditLocked,
                      }}
                    />
                  </Stack>
                </Stack>
              )}

              <TextField
                required
                label="Message Content"
                multiline
                rows={12}
                fullWidth
                InputLabelProps={{ shrink: true }}
                placeholder={
                  form.type === "whatsapp"
                    ? "Hello {{1}}, your order {{2}} is confirmed."
                    : form.type === "email"
                      ? "Hi {{name}},\nThanks for your interest. We’ll contact you on {{phone}}.\n— Team"
                      : "Hi {{name}}, your request has been received."
                }
                value={form.content}
                error={!!errors.content}
                helperText={errors.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                disabled={isWhatsAppEditLocked}
              />
              <Alert severity="info">
                In <b>Message Content</b>,
                {form.type === "whatsapp" ? (
                  <>
                    Use numbered variables like <b>{"{{1}}, {{2}}"}</b> as required by WhatsApp.
                  </>
                ) : (
                  <>
                    Use dynamic placeholders like <b>{"{{name}}, {{phone}}"}</b>.  The key name should match the contact
                    data columns
                  </>
                )}
              </Alert>


            </Stack>
            {form.type === "whatsapp" && whatsappVariables.length > 0 &&
              <Grid container spacing={2} mt={1}>
                <Grid item xs={12}>
                  <Stack >

                    <Typography
                      variant="h6"
                      fontWeight={700}
                    >
                      Variable Configuration
                    </Typography>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                    >
                      Map WhatsApp variables to contact fields
                      and preview the final message.
                    </Typography>

                  </Stack>

                </Grid>

                {/* LEFT */}
                <Grid item xs={12} md={6}>

                  <Box
                    sx={{
                      p: 3,
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: "divider",
                      bgcolor: "background.paper",
                      height: "100%",
                    }}
                  >

                    <Typography
                      variant="subtitle1"
                      fontWeight={700}
                      mb={2}
                    >
                      Variable Mapping
                    </Typography>

                    <Stack spacing={2}>
                      {extractWhatsAppVariables(form.content).map((variable) => (

                        <Box
                          key={variable}
                          sx={{
                            p: 2,
                            borderRadius: 2,
                            bgcolor: "grey.50",
                            border: "1px solid",
                            borderColor: "divider",
                          }}
                        >

                          <Stack spacing={2}>

                            <Chip
                              label={`{{${variable}}}`}
                              color={
                                form.variable_mappings?.[variable]?.field
                                  ? "success"
                                  : "default"
                              }
                              size="small"
                              sx={{
                                width: "fit-content",
                                fontWeight: 700,
                              }}
                            />

                            <TextField
                              select
                              fullWidth
                              size="small"
                              label="Contact Field"
                              value={
                                form.variable_mappings?.[variable]?.field || ""
                              }
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,

                                  variable_mappings: {
                                    ...prev.variable_mappings,

                                    [variable]: {
                                      ...prev.variable_mappings?.[variable],

                                      field: e.target.value,
                                    },
                                  },
                                }))
                              }
                              error={
                                !!errors.variable_mappings?.[variable]?.field
                              }
                              helperText={
                                errors.variable_mappings?.[variable]?.field
                              }
                            >
                              {contactFieldOptions.map((field) => (
                                <MenuItem
                                  key={field.value}
                                  value={field.value}
                                >
                                  {field.label}
                                </MenuItem>
                              ))}
                            </TextField>

                            <TextField
                              fullWidth
                              size="small"
                              label="Sample Value"
                              value={
                                form.variable_mappings?.[variable]?.sample || ""
                              }
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,

                                  variable_mappings: {
                                    ...prev.variable_mappings,

                                    [variable]: {
                                      ...prev.variable_mappings?.[variable],

                                      sample: e.target.value,
                                    },
                                  },
                                }))
                              }
                              error={
                                !!errors.variable_mappings?.[variable]?.sample
                              }

                              helperText={
                                errors.variable_mappings?.[variable]?.sample
                              }
                            />

                          </Stack>

                        </Box>

                      ))}
                    </Stack>

                  </Box>

                </Grid>

                {/* RIGHT */}
                <Grid item xs={12} md={6}>

                  <Box
                    sx={{
                      p: 3,
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: "divider",
                      bgcolor: "#efeae2",
                      minHeight: 320,
                    }}
                  >

                    <Typography
                      variant="subtitle1"
                      fontWeight={700}
                      mb={2}
                    >
                      WhatsApp Preview
                    </Typography>

                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "flex-end",
                      }}
                    >

                      <Box
                        sx={{
                          maxWidth: "85%",
                          bgcolor: "#d9fdd3",
                          px: 2,
                          py: 1.5,
                          borderRadius: "18px",
                          boxShadow: 1,
                          whiteSpace: "pre-wrap",
                          fontSize: 14,
                          lineHeight: 1.6,
                        }}
                      >
                        {generatePreview(
                          form.content,
                          form.variable_mappings || {}
                        )}
                      </Box>

                    </Box>

                  </Box>

                </Grid>

              </Grid>
            }
          </DialogContent>

          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={editItem ? handleUpdate : handleCreate}
              disabled={loading}
            >
              {editItem ? "Update" : "Create"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>

      <ConfirmDialog
        open={Boolean(templateStatusToUpdate)}
        title={`${actionLabel} template?`}
        description={
          templateStatusToUpdate
            ? `Are you sure you want to ${actionLabel.toLowerCase()} "${templateStatusToUpdate.name}"? 
              This will mark it as ${isActive ? "inactive" : "active"} and you can change it anytime.`
            : undefined
        }
        confirmLabel={actionLabel}
        cancelLabel="Cancel"
        confirmColor={isActive ? "warning" : "success"}
        loading={deleteSubmitting}
        onCancel={() => !deleteSubmitting && setTemplateStatusToUpdate(null)}
        onConfirm={handleToggleStatus}
      />
    </AdminLayout>
  );
}

export default TemplateList;
