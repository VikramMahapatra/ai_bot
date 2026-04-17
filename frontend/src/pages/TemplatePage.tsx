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
} from "@mui/material";

import { alpha, useTheme } from "@mui/material/styles";
import { Add, Edit, Visibility } from "@mui/icons-material";
import AdminLayout from "../components/Layout/AdminLayout";
import { messageTemplateService, Template, TemplateType } from "../services/messageTemplateService";
import SearchIcon from "@mui/icons-material/Search";




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
    const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);
    const [errors, setErrors] = useState({
        name: "",
        type: "",
        subject: "",
        content: ""
    });


    const [form, setForm] = useState({
        name: "",
        type: "sms" as TemplateType,
        subject: "",
        content: "",
    });

    const handleOpen = (item?: Template) => {
        if (item) {
            setEditItem(item);
            setForm({
                name: item.name,
                type: item.type,
                subject: item.subject || "",
                content: item.content,
            });
        } else {
            setEditItem(null);
            setForm({ name: "", type: "sms", subject: "", content: "" });
        }
        setOpen(true);
    };

    useEffect(() => {
        fetchTemplates();
    }, [search, templatePage, templateRowsPerPage]);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            setLoading(true);
            const data = await messageTemplateService.listTemplates({
                search: search || undefined,
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
            }
            else {
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
            const response = await messageTemplateService.updateTemplate(editItem.id, form);
            if (response.success) {
                fetchTemplates();
                handleCloseDialog();
            }
            else {
                setTemplateError(response.message);
            }
        } catch {
            setTemplateError("Failed to update template");
        }
    };

    const handleConfirmDeleteProduct = async () => {
        if (!templateToDelete?.id) return;

        setDeleteSubmitting(true);
        setError(null);
        await messageTemplateService.deleteTemplate(templateToDelete.id);
        setTemplateToDelete(null);
        await fetchTemplates();
        setDeleteSubmitting(false);
    };

    const validateForm = () => {
        let valid = true;

        const newErrors = {
            name: "",
            type: "",
            subject: "",
            content: ""
        };

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

        setErrors(newErrors);
        return valid;
    };

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
                            <TextField select label="Type" size="small" sx={{ width: 200 }}>
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
                                <TableCell>Created</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>

                        <TableBody>
                            {
                                templates.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} sx={{ py: 8, textAlign: "center" }}>
                                            <SearchIcon sx={{ fontSize: 40, color: "text.secondary" }} />
                                            <Typography>No templates found</Typography>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    templates.map((t) => (
                                        <TableRow key={t.id} hover>
                                            <TableCell sx={{ fontWeight: 600 }}>{t.name}</TableCell>

                                            <TableCell>
                                                <Chip label={t.type.toUpperCase()} size="small" />
                                            </TableCell>

                                            <TableCell>{t.subject || "-"}</TableCell>

                                            <TableCell>
                                                <Chip
                                                    label={t.status}
                                                    color={t.status === "Active" ? "success" : "default"}
                                                    size="small"
                                                />
                                            </TableCell>

                                            <TableCell>{t.created_at}</TableCell>

                                            <TableCell align="right">
                                                <IconButton onClick={() => handleOpen(t)}>
                                                    <Edit />
                                                </IconButton>
                                                <IconButton>
                                                    <Visibility />
                                                </IconButton>
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
                                onChange={(e) =>
                                    setForm({ ...form, name: e.target.value })
                                }
                            />

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

                            <TextField
                                label="Message Content"
                                multiline
                                rows={4}
                                fullWidth
                                value={form.content}
                                error={!!errors.content}
                                helperText={errors.content}
                                onChange={(e) =>
                                    setForm({ ...form, content: e.target.value })
                                }
                            />
                        </Stack>
                    </DialogContent>

                    <DialogActions>
                        <Button onClick={() => setOpen(false)}>Cancel</Button>
                        <Button
                            variant="contained"
                            onClick={
                                editItem
                                    ? handleUpdate
                                    : handleCreate
                            }
                        >
                            {editItem ? "Update" : "Create"}
                        </Button>
                    </DialogActions>
                </Dialog>

            </Box>
        </AdminLayout>

    );
}

export default TemplateList;