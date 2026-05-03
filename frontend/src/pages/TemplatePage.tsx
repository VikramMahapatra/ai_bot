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
} from "@mui/material";

import { alpha, useTheme } from "@mui/material/styles";
import { Add, Edit, Visibility } from "@mui/icons-material";
import AdminLayout from "../components/Layout/AdminLayout";
import {
  messageTemplateService,
  Template,
  TemplateType,
} from "../services/messageTemplateService";
import SearchIcon from "@mui/icons-material/Search";
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useDateFormatter } from "../hooks/useDateFormatter";
import { SourceChip, StatusChip } from "../components/Common/StatusChips";
import { ConfirmDialog } from "../components/Common/ConfirmDialog";

type WhatsAppCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";

const emptyTemplateForm = {
  name: "",
  type: "whatsapp",
  category: "MARKETING" as WhatsAppCategory,
  language: "en",
  subject: "",
  content: "",
}

function TemplateList() {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<Template | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [errors, setErrors] = useState({
    name: "",
    type: "",
    subject: "",
    content: "",
  });
  const [templateStatusToUpdate, setTemplateStatusToUpdate] = useState<Template | null>(null);

  const formatDisplayDate = useDateFormatter();


  const [form, setForm] = useState(emptyTemplateForm);
  const [type, setType] = useState("all");

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
        category: "MARKETING" as WhatsAppCategory,
        language: "en",
        subject: item.subject || "",
        content: item.content,
      });
    } else {
      setEditItem(null);
      setForm(emptyTemplateForm);
    }
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

  const handleCloseDialog = () => {
    setOpen(false);
    setEditItem(null);
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

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
    }
  };

  const handleUpdate = async () => {
    if (!editItem) return;

    if (!validateForm()) return;

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
    }

    setErrors(newErrors);
    return valid;
  };

  const isActive = templateStatusToUpdate?.status === "Active";
  const actionLabel = isActive ? "Deactivate" : "Activate";

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

            <Box display="flex" alignItems="center" gap={2}>
              <TextField
                size="small"
                label="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                sx={{ width: 260 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                select
                label="Type"
                size="small"
                value={type}
                onChange={(e) => setType(e.target.value)}
                sx={{ width: 200 }}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="sms">SMS</MenuItem>
                <MenuItem value="whatsapp">WhatsApp</MenuItem>
                <MenuItem value="email">Email</MenuItem>
              </TextField>

              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => handleOpen()}
              >
                Create Template
              </Button>
            </Box>
          </Box>
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading && (
          <Box mb={3}>
            <LinearProgress sx={{ borderRadius: 1.2 }} />
          </Box>
        )}

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
                    <TableCell sx={{ fontWeight: 600 }}>{t.name}</TableCell>
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
        </TableContainer>

        {/* CREATE / EDIT MODAL */}
        <Dialog open={open} fullWidth maxWidth="sm">
          <DialogTitle>
            {editItem ? "Edit Template" : "Create Template"}
          </DialogTitle>

          <DialogContent>
            <Stack spacing={2} mt={1}>
              <TextField
                label="Template Name"
                fullWidth
                value={form.name}
                error={!!errors.name}
                helperText={errors.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
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
                    />
                  </Stack>
                </Stack>
              )}

              <TextField
                label="Message Content"
                multiline
                rows={4}
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
                onChange={(e) => setForm({ ...form, content: e.target.value })}
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
          </DialogContent>

          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={editItem ? handleUpdate : handleCreate}
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
