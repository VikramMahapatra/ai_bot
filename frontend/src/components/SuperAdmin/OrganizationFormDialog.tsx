import {
    Alert,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    FormLabel,
    Grid,
    InputLabel,
    MenuItem,
    Radio,
    RadioGroup,
    Select,
    TextField,
} from "@mui/material";

import OrganizationLimitsSection from "./OrganizationLimitsSection";
import { LimitToggleField, OrganizationLimits, OrganizationStatus } from "../../types";

interface Props {
    open: boolean;
    onClose: () => void;

    mode: "create" | "edit";

    form: any;
    setForm: React.Dispatch<React.SetStateAction<any>>;

    limits: Partial<OrganizationLimits>;
    setLimits: React.Dispatch<
        React.SetStateAction<Partial<OrganizationLimits>>
    >;

    defaultLimits: Partial<OrganizationLimits>;
    limitToggleFields: LimitToggleField[];

    loading?: boolean;
    onSubmit: () => void;

    editingOrg?: any;
    actionError?: any;
    setActionError?: any;
}

const industries = [
    "Information Technology",
    "Software",
    "Healthcare",
    "Education",
    "Finance",
    "Insurance",
    "Manufacturing",
    "Retail",
    "Real Estate",
    "Construction",
    "Logistics",
    "Hospitality",
    "Telecommunications",
    "Automotive",
    "Media & Entertainment",
    "Consulting",
    "Government",
    "Non-Profit",
    "Other",
];

export default function OrganizationFormDialog({
    open,
    onClose,
    mode,
    form,
    setForm,
    limits,
    setLimits,
    defaultLimits,
    limitToggleFields,
    loading,
    onSubmit,
    editingOrg,
    actionError,
    setActionError
}: Props) {
    const isCreate = mode === "create";

    if (!isCreate && editingOrg) {
        editingOrg.organization_name = editingOrg.name;
    }

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{ sx: { borderRadius: "18px" } }}
        >
            <DialogTitle>
                {isCreate
                    ? "Create Organization + Admin"
                    : "Edit Organization"}
            </DialogTitle>

            <DialogContent>
                {!isCreate &&
                    editingOrg &&
                    !editingOrg.admin_username && (
                        <Alert severity="warning" sx={{ mt: 1, mb: 2 }}>
                            No admin attached to this organization.
                            Provide username, email and password to create
                            admin access.
                        </Alert>
                    )}

                {actionError && (
                    <Alert
                        severity="error"
                        sx={{ mb: 2 }}
                        onClose={() => setActionError("")}
                    >
                        {actionError}
                    </Alert>
                )}

                <Grid container spacing={2} sx={{ mt: 1 }}>
                    <Grid item xs={12} md={4}>
                        <TextField
                            label="Organization Name"
                            fullWidth
                            value={form.organization_name}
                            onChange={(e) =>
                                setForm((p: any) => ({
                                    ...p,
                                    organization_name: e.target.value,
                                }))
                            }
                        />
                    </Grid>
                    {/* Status */}
                    <Grid item xs={12} md={4}>
                        <FormControl fullWidth >
                            <InputLabel>Status</InputLabel>
                            <Select
                                value={form.status}
                                label="Status"
                                onChange={(e) =>
                                    setForm((prev: any) => ({
                                        ...prev,
                                        status: e.target.value as OrganizationStatus,
                                    }))
                                }
                            >
                                <MenuItem value="active">Active</MenuItem>
                                <MenuItem value="inactive">Inactive</MenuItem>
                                <MenuItem value="trial">Trial</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    {/* Industry */}
                    <Grid item xs={12} md={4}>
                        <FormControl fullWidth >
                            <InputLabel>Industry</InputLabel>

                            <Select
                                value={form.industry}
                                label="Industry"
                                onChange={(e) =>
                                    setForm((prev: any) => ({
                                        ...prev,
                                        industry: e.target.value,
                                    }))
                                }
                            >
                                {industries.map((industry) => (
                                    <MenuItem
                                        key={industry}
                                        value={industry}
                                    >
                                        {industry}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    {form.status === "trial" && (
                        <Grid item xs={12} md={3}>
                            <TextField
                                label="Trial End Date"
                                type="date"
                                fullWidth
                                value={form.trial_end_date}
                                onChange={(e) =>
                                    setForm((prev: any) => ({
                                        ...prev,
                                        trial_end_date: e.target.value,
                                    }))
                                }
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>
                    )}
                    {/* Joining Date */}
                    <Grid item xs={12} md={form.status === "trial" ? 3 : 4}>
                        <TextField
                            label="Joining Date"
                            type="date"
                            fullWidth
                            value={form.joining_date}
                            onChange={(e) =>
                                setForm((p: any) => ({
                                    ...p,
                                    joining_date: e.target.value,
                                }))
                            }
                            InputLabelProps={{ shrink: true }}
                        />
                    </Grid>
                    {/* Effective Start Date */}
                    <Grid item xs={12} md={form.status === "trial" ? 3 : 4}>
                        <TextField
                            label="Effective Start Date"
                            type="date"
                            fullWidth
                            value={form.effective_joining_date}
                            onChange={(e) =>
                                setForm((p: any) => ({
                                    ...p,
                                    effective_joining_date: e.target.value,
                                }))
                            }
                            InputLabelProps={{ shrink: true }}
                        />
                    </Grid>

                    {/* Timezone */}
                    <Grid item xs={12} md={form.status === "trial" ? 3 : 4}>
                        <FormControl fullWidth >
                            <InputLabel>Time Zone</InputLabel>
                            <Select
                                value={form.timezone}
                                label="Time Zone"
                                onChange={(e) =>
                                    setForm((prev: any) => ({
                                        ...prev,
                                        timezone: e.target.value,
                                    }))
                                }
                            >
                                <MenuItem value="Asia/Kolkata">
                                    India (IST)
                                </MenuItem>

                                <MenuItem value="Asia/Dubai">
                                    UAE (GST)
                                </MenuItem>

                                <MenuItem value="Europe/London">
                                    London (GMT/BST)
                                </MenuItem>

                                <MenuItem value="America/New_York">
                                    New York (EST/EDT)
                                </MenuItem>

                                <MenuItem value="America/Los_Angeles">
                                    Los Angeles (PST/PDT)
                                </MenuItem>

                                <MenuItem value="Australia/Sydney">
                                    Sydney (AEST)
                                </MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    {/* Admin Username */}
                    <Grid item xs={12} md={4}>
                        <TextField
                            label="Admin Username"
                            fullWidth
                            value={form.admin_username}
                            onChange={(e) =>
                                setForm((p: any) => ({
                                    ...p,
                                    admin_username: e.target.value,
                                }))
                            }
                        />
                    </Grid>
                    {/* Admin Email */}
                    <Grid item xs={12} md={4}>
                        <TextField
                            label="Admin Email"
                            fullWidth
                            value={form.admin_email}
                            onChange={(e) =>
                                setForm((p: any) => ({
                                    ...p,
                                    admin_email: e.target.value,
                                }))
                            }
                        />
                    </Grid>
                    {/* Admin Password */}
                    <Grid item xs={12} md={4}>
                        <TextField
                            label="Admin Password"
                            type="password"
                            fullWidth
                            value={form.admin_password}
                            onChange={(e) =>
                                setForm((p: any) => ({
                                    ...p,
                                    admin_password: e.target.value,
                                }))
                            }
                            helperText={
                                !isCreate
                                    ? editingOrg?.admin_username
                                        ? "Leave blank to keep current password."
                                        : "Required to create missing admin user."
                                    : ""
                            }
                        />
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <TextField
                            label="Description"
                            fullWidth
                            value={form.description}
                            onChange={(e) =>
                                setForm((p: any) => ({
                                    ...p,
                                    description: e.target.value,
                                }))
                            }
                        />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <TextField
                            label="Echoleads API Key"
                            fullWidth
                            value={form.echoleads_api_key}
                            onChange={(e) =>
                                setForm((p: any) => ({
                                    ...p,
                                    echoleads_api_key: e.target.value,
                                }))
                            }
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <TextField
                            label="Commercial Notes"
                            fullWidth
                            multiline
                            minRows={4}
                            value={form.commercial_notes}
                            onChange={(e) =>
                                setForm((prev: any) => ({
                                    ...prev,
                                    commercial_notes: e.target.value,
                                }))
                            }
                            placeholder="Pricing, discounts, contract terms, payment terms, onboarding notes, etc."
                        />
                    </Grid>
                </Grid>

                <OrganizationLimitsSection
                    limits={limits}
                    setLimits={setLimits}
                    defaultLimits={defaultLimits}
                    limitToggleFields={limitToggleFields}
                />
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>

                <Button
                    variant="contained"
                    onClick={onSubmit}
                    disabled={loading}
                    sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 1,
                    }}
                >
                    {loading && (
                        <CircularProgress
                            size={18}
                            color="inherit"
                        />
                    )}

                    {loading
                        ? isCreate
                            ? "Creating..."
                            : "Saving..."
                        : isCreate
                            ? "Create"
                            : "Save"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}