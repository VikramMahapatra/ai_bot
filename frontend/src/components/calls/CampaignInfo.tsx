import { Grid, TextField, Button, MenuItem, FormControlLabel, Switch, Typography, Paper, Box, Stack, Chip } from "@mui/material";
import { useEffect, useState } from "react";
import { CallingAgentLookup, callingAgentService } from "../../services/callingAgentService";
import { Product, productService } from "../../services/productService";
import { CallingNumberType, callService } from "../../services/callService";
import { CallingNumber } from "../../types";

import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import SmsIcon from "@mui/icons-material/Sms";
import EmailIcon from "@mui/icons-material/Email";

interface CampaignInfoProps {
    form: any;
    setForm: any;
    nextStep: () => void;
}

const CampaignInfo = ({ form, setForm, nextStep }: CampaignInfoProps) => {
    const [errors, setErrors] = useState<any>({});
    const [agents, setAgents] = useState<CallingAgentLookup[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [callingNumbers, setCallingNumbers] = useState<CallingNumber[]>([])


    const loadAgentLookup = async () => {
        const data = await callingAgentService.agentLookup();
        setAgents(data || []);
    };

    const loadProductLookup = async () => {
        const data = await productService.productLookup();
        setProducts(data || []);
    };

    const loadCallingNoLookup = async () => {
        const data = await callService.getCallingNumbers(CallingNumberType.OUTBOUND);
        setCallingNumbers(data || []);
    };


    useEffect(() => {
        loadAgentLookup();
        loadProductLookup();
        loadCallingNoLookup();
    }, [form]);

    const validate = () => {

        let newErrors: any = {};

        if (!form.name.trim()) {
            newErrors.name = "Campaign name is required";
        }

        if (!form.description) {
            newErrors.description = "Description is required";
        }

        if (!form.agent_id) {
            newErrors.agent_id = "Agent is required";
        }

        if (!form.calling_no) {
            newErrors.calling_no = "From number is required";
        }

        if (form.instant_reply) {

            if (!form.instant_reply_modes || form.instant_reply_modes.length === 0) {
                newErrors.instant_reply_modes = "Select at least one reply mode";
            }

            const templates = form.instant_reply_templates || {};

            if (form.instant_reply_modes?.includes("whatsapp")) {
                if (!templates?.whatsapp?.trim()) {
                    newErrors.whatsapp_template = "WhatsApp template is required";
                }
            }

            if (form.instant_reply_modes?.includes("sms")) {
                if (!templates?.sms?.trim()) {
                    newErrors.sms_template = "SMS template is required";
                }
            }

            if (form.instant_reply_modes?.includes("email")) {
                if (!templates?.email?.subject?.trim()) {
                    newErrors.email_subject = "Email subject is required";
                }

                if (!templates?.email?.body?.trim()) {
                    newErrors.email_body = "Email body is required";
                }
            }
        }

        setErrors(newErrors);

        if (Object.keys(newErrors).length === 0) {
            nextStep();
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setForm({ ...form, [name]: value });
    };

    const toggleMode = (mode: string) => {
        const modes = form.instant_reply_modes || [];

        if (modes.includes(mode)) {
            setForm({
                ...form,
                instant_reply_modes: modes.filter((m: string) => m !== mode)
            });
        } else {
            setForm({
                ...form,
                instant_reply_modes: [...modes, mode]
            });
        }
    };

    const updateTemplate = (mode: string, value: string) => {
        setForm({
            ...form,
            instant_reply_templates: {
                ...form.instant_reply_templates,
                [mode]: value
            }
        });
    };

    const updateEmail = (field: string, value: string) => {
        setForm({
            ...form,
            instant_reply_templates: {
                ...form.instant_reply_templates,
                email: {
                    ...form.instant_reply_templates?.email,
                    [field]: value
                }
            }
        });
    };

    return (
        <Grid container spacing={3}>

            <Grid item xs={12}>
                <TextField
                    required
                    label="Campaign Name"
                    fullWidth
                    name="name"
                    value={form.name}
                    onChange={handleInputChange}
                    error={!!errors.name}
                    helperText={errors.name}
                />
            </Grid>

            <Grid item xs={12}>
                <TextField
                    required
                    label="Description"
                    multiline
                    rows={4}
                    fullWidth
                    name="description"
                    value={form.description}
                    onChange={handleInputChange}
                    error={!!errors.description}
                    helperText={errors.description}
                />
            </Grid>
            <Grid item xs={12} sm={6}>
                <TextField
                    required
                    label="Agent"
                    select
                    fullWidth
                    name="agent_id"
                    value={form.agent_id}
                    onChange={(e) =>
                        setForm({ ...form, agent_id: e.target.value })
                    }
                    error={!!errors.agent_id}
                    helperText={errors.agent_id}
                >
                    {
                        agents.map((agent) => (
                            <MenuItem key={agent.id} value={agent.id}>{agent.name}</MenuItem>
                        ))
                    }
                </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
                <TextField
                    required
                    label="From Number"
                    select
                    fullWidth
                    name="product_id"
                    value={form.calling_no}
                    onChange={(e) =>
                        setForm({ ...form, calling_no: e.target.value })
                    }
                    error={!!errors.calling_no}
                    helperText={errors.calling_no}
                >
                    {
                        callingNumbers.map((p) => (
                            <MenuItem key={p.id} value={p.calling_number}>{p.calling_number}</MenuItem>
                        ))
                    }
                </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
                <TextField
                    label="Product"
                    select
                    fullWidth
                    name="product_id"
                    value={form.product_id}
                    onChange={(e) =>
                        setForm({ ...form, product_id: e.target.value })
                    }
                >
                    {
                        products.map((p) => (
                            <MenuItem key={p.id} value={p.id}>{p.label}</MenuItem>
                        ))
                    }
                </TextField>
            </Grid>

            {/* <Grid item xs={4}>
                <TextField
                    label="Priority"
                    select
                    fullWidth
                    name="priority"
                    value={form.priority}
                    onChange={(e) =>
                        setForm({ ...form, priority: e.target.value })
                    }
                >
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                </TextField>
            </Grid> */}

            <Grid item xs={12} sm={6}>
                <TextField
                    label="Category"
                    select
                    fullWidth
                    name="category"
                    value={form.category}
                    onChange={(e) =>
                        setForm({ ...form, category: e.target.value })
                    }
                >
                    <MenuItem value="sales">Sales Outreach</MenuItem>
                    <MenuItem value="support">Support</MenuItem>
                </TextField>
            </Grid>
            {/* Instant Reply Section */}

            <Grid item xs={12}>
                <Paper
                    sx={{
                        p: 3,
                        borderRadius: 2,
                        border: "1px solid #e0e0e0"
                    }}
                >

                    {/* Header */}
                    <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        mb={2}
                    >
                        <Typography variant="h6">
                            Instant Reply
                        </Typography>

                        <FormControlLabel
                            control={
                                <Switch
                                    checked={form.instant_reply || false}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            instant_reply: e.target.checked,
                                            instant_reply_modes: [],
                                            instant_reply_templates: {}
                                        })
                                    }
                                />
                            }
                            label="Enable"
                        />
                    </Box>

                    {form.instant_reply && (
                        <>

                            {/* Mode Selector */}
                            <Stack
                                direction="row"
                                spacing={1}
                                mb={3}
                            >

                                <Chip
                                    icon={<WhatsAppIcon />}
                                    label="WhatsApp"
                                    clickable
                                    color={form.instant_reply_modes?.includes("whatsapp") ? "success" : "default"}
                                    onClick={() =>
                                        toggleMode("whatsapp")
                                    }
                                />

                                <Chip
                                    icon={<SmsIcon />}
                                    label="SMS"
                                    clickable
                                    color={form.instant_reply_modes?.includes("sms") ? "primary" : "default"}
                                    onClick={() =>
                                        toggleMode("sms")
                                    }
                                />

                                <Chip
                                    icon={<EmailIcon />}
                                    label="Email"
                                    clickable
                                    color={form.instant_reply_modes?.includes("email") ? "secondary" : "default"}
                                    onClick={() =>
                                        toggleMode("email")
                                    }
                                />

                            </Stack>
                            {/* Error Message */}
                            {errors.instant_reply_modes && (
                                <Typography
                                    variant="caption"
                                    color="error"
                                    sx={{ ml: 1, mt: 0.5, display: "block" }}
                                >
                                    {errors.instant_reply_modes}
                                </Typography>
                            )}

                            {/* WhatsApp */}
                            {form.instant_reply_modes?.includes("whatsapp") && (
                                <Box mb={2}>
                                    <Typography
                                        variant="subtitle2"
                                        gutterBottom
                                    >
                                        WhatsApp Template
                                    </Typography>

                                    <TextField
                                        size="small"
                                        fullWidth
                                        multiline
                                        minRows={3}
                                        placeholder="Hello {{name}}..."
                                        value={form.instant_reply_templates?.whatsapp || ""}
                                        onChange={(e) =>
                                            updateTemplate("whatsapp", e.target.value)
                                        }
                                        error={!!errors.whatsapp_template}
                                        helperText={errors.whatsapp_template}
                                    />
                                </Box>
                            )}


                            {/* SMS */}
                            {form.instant_reply_modes?.includes("sms") && (
                                <Box mb={2}>
                                    <Typography
                                        variant="subtitle2"
                                        gutterBottom
                                    >
                                        SMS Template
                                    </Typography>

                                    <TextField
                                        size="small"
                                        fullWidth
                                        multiline
                                        minRows={3}
                                        value={form.instant_reply_templates?.sms || ""}
                                        onChange={(e) =>
                                            updateTemplate("sms", e.target.value)
                                        }
                                        error={!!errors.sms_template}
                                        helperText={errors.sms_template}
                                    />
                                </Box>
                            )}


                            {/* Email */}
                            {form.instant_reply_modes?.includes("email") && (
                                <Box mb={2}>

                                    <Typography
                                        variant="subtitle2"
                                        gutterBottom
                                    >
                                        Email Template
                                    </Typography>

                                    <Grid container spacing={2}>

                                        <Grid item xs={12}>
                                            <TextField
                                                size="small"
                                                fullWidth
                                                label="Subject"
                                                value={form.instant_reply_templates?.email?.subject || ""}
                                                onChange={(e) =>
                                                    updateEmail("subject", e.target.value)
                                                }
                                                error={!!errors.email_subject}
                                                helperText={errors.email_subject}
                                            />
                                        </Grid>

                                        <Grid item xs={12}>
                                            <TextField
                                                size="small"
                                                fullWidth
                                                multiline
                                                minRows={6}
                                                label="Email Body"
                                                value={form.instant_reply_templates?.email?.body || ""}
                                                onChange={(e) =>
                                                    updateEmail("body", e.target.value)
                                                }
                                                error={!!errors.email_body}
                                                helperText={errors.email_body}
                                            />
                                        </Grid>

                                    </Grid>

                                </Box>
                            )}

                        </>
                    )}

                </Paper>
            </Grid>

            <Grid item xs={12} textAlign="right">
                <Button
                    variant="contained"
                    onClick={validate}
                >
                    Continue
                </Button>
            </Grid>

        </Grid>
    );
};

export default CampaignInfo;