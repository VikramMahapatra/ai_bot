import React, { useState } from "react";
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
} from "@mui/material";

import { alpha, useTheme } from "@mui/material/styles";
import { Add, Edit, Visibility } from "@mui/icons-material";
import AdminLayout from "../components/Layout/AdminLayout";

type TemplateType = "sms" | "whatsapp" | "email";

interface Template {
    id: number;
    name: string;
    type: TemplateType;
    subject?: string;
    content: string;
    status: "Active" | "Inactive";
    created_at: string;
}

function TemplateList() {
    const theme = useTheme();

    const [open, setOpen] = useState(false);
    const [editItem, setEditItem] = useState<Template | null>(null);

    const [form, setForm] = useState({
        name: "",
        type: "sms" as TemplateType,
        subject: "",
        content: "",
    });

    const templates: Template[] = [
        {
            id: 1,
            name: "Welcome SMS",
            type: "sms",
            content: "Welcome to our platform!",
            status: "Active",
            created_at: "2024-06-10",
        },
        {
            id: 2,
            name: "OTP Email",
            type: "email",
            subject: "Your OTP Code",
            content: "Your OTP is 123456",
            status: "Active",
            created_at: "2024-06-12",
        },
    ];

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

    return (
        <AdminLayout>
            <Box>

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

                        <Button
                            variant="contained"
                            startIcon={<Add />}
                            onClick={() => handleOpen()}
                        >
                            Add Template
                        </Button>
                    </Box>
                </Paper>

                {/* FILTER */}
                <Stack direction="row" spacing={2} mb={2}>
                    <TextField fullWidth label="Search templates" size="small" />
                    <TextField select label="Type" size="small" sx={{ width: 200 }}>
                        <MenuItem value="all">All</MenuItem>
                        <MenuItem value="sms">SMS</MenuItem>
                        <MenuItem value="whatsapp">WhatsApp</MenuItem>
                        <MenuItem value="email">Email</MenuItem>
                    </TextField>
                </Stack>

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
                            {templates.map((t) => (
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
                            ))}
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
                                onChange={(e) =>
                                    setForm({ ...form, name: e.target.value })
                                }
                            />

                            <TextField
                                select
                                label="Type"
                                value={form.type}
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
                                onChange={(e) =>
                                    setForm({ ...form, content: e.target.value })
                                }
                            />
                        </Stack>
                    </DialogContent>

                    <DialogActions>
                        <Button onClick={() => setOpen(false)}>Cancel</Button>
                        <Button variant="contained">
                            {editItem ? "Update" : "Create"}
                        </Button>
                    </DialogActions>
                </Dialog>

            </Box>
        </AdminLayout>

    );
}

export default TemplateList;