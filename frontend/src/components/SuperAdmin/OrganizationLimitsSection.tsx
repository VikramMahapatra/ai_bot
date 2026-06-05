import {
    Box,
    Button,
    Chip,
    Divider,
    FormControl,
    FormControlLabel,
    Grid,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    Switch,
    TextField,
    Typography,
    alpha,
} from "@mui/material";
import { LimitToggleField, OrganizationLimitKey, OrganizationLimits } from "../../types";

interface Props {
    limits: Partial<OrganizationLimits>;
    setLimits: React.Dispatch<
        React.SetStateAction<Partial<OrganizationLimits>>
    >;
    defaultLimits: Partial<OrganizationLimits>;
    limitToggleFields: LimitToggleField[];
    title?: string;
    subtitle?: string;
    resetButtonText?: string;
}

export default function OrganizationLimitsSection({
    limits,
    setLimits,
    defaultLimits,
    limitToggleFields,
    title = "Organization Limits",
    subtitle = "Configure feature access for this organization.",
    resetButtonText = "Apply Default Limits",
}: Props) {

    const groupedFields = limitToggleFields
        .filter((field) => field.visible)
        .reduce(
            (acc, field) => {
                if (!acc[field.category]) {
                    acc[field.category] = [];
                }

                acc[field.category].push(field);
                return acc;
            },
            {} as Record<string, LimitToggleField[]>
        );

    return (
        <Paper
            elevation={0}
            sx={{
                mt: 3,
                p: 2,
                borderRadius: "14px",
                border: (theme) =>
                    `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
                background: `linear-gradient(150deg, ${alpha(
                    "#eef6ff",
                    0.9
                )} 0%, ${alpha("#ffffff", 1)} 88%)`,
            }}
        >
            <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                spacing={1}
            >
                <Box>
                    <Typography variant="subtitle1" fontWeight={700}>
                        {title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {subtitle}
                    </Typography>
                </Box>
            </Stack>

            <Typography
                variant="subtitle2"
                sx={{ mt: 2.4, mb: 1, fontWeight: 700 }}
            >
                Feature Entitlements
            </Typography>

            <Box sx={{ mt: 2 }}>
                {Object.entries(groupedFields).map(([category, fields]) => (
                    <Box key={category} sx={{ mb: 3 }}>
                        <Typography
                            variant="subtitle2"
                            sx={{
                                mb: 1.5,
                                fontWeight: 700,
                                color: "text.primary",
                            }}
                        >
                            {category}
                        </Typography>

                        <Grid container spacing={1.5}>
                            {fields.map((field) => {
                                const enabled = Boolean(limits[field.key]);

                                return (
                                    <Grid
                                        item
                                        xs={12}
                                        sm={6}
                                        md={4}
                                        lg={3}
                                        key={String(field.key)}
                                    >
                                        <Paper
                                            variant="outlined"
                                            sx={{
                                                p: 1.5,
                                                height: "100%",
                                                borderRadius: "12px",
                                                borderColor: (theme) =>
                                                    alpha(
                                                        theme.palette.secondary.main,
                                                        0.24
                                                    ),
                                            }}
                                        >
                                            <Stack
                                                direction="row"
                                                justifyContent="space-between"
                                                alignItems="center"
                                                sx={{ mb: 1 }}
                                            >
                                                <Typography
                                                    variant="body2"
                                                    fontWeight={600}
                                                >
                                                    {field.label}
                                                </Typography>

                                                <Chip
                                                    size="small"
                                                    label={
                                                        enabled
                                                            ? "Enabled"
                                                            : "Disabled"
                                                    }
                                                    color={
                                                        enabled
                                                            ? "success"
                                                            : "default"
                                                    }
                                                    variant="outlined"
                                                />
                                            </Stack>

                                            <FormControlLabel
                                                sx={{ m: 0 }}
                                                control={
                                                    <Switch
                                                        checked={enabled}
                                                        onChange={(e) =>
                                                            setLimits((prev) => ({
                                                                ...prev,
                                                                [field.key]:
                                                                    e.target.checked,
                                                            }))
                                                        }
                                                    />
                                                }
                                                label={
                                                    enabled
                                                        ? "Enabled"
                                                        : "Disabled"
                                                }
                                            />
                                        </Paper>
                                    </Grid>
                                );
                            })}
                        </Grid>
                    </Box>
                ))}
            </Box>
            <Typography
                variant="subtitle2"
                sx={{
                    mt: 3,
                    mb: 1.5,
                    fontWeight: 700,
                }}
            >
                Voice Calling Configuration
            </Typography>

            <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                    <FormControl fullWidth size="small">
                        <InputLabel>Outbound Billing Model</InputLabel>
                        <Select
                            value={limits.outbound_call_billing_model ?? ""}
                            label="Outbound Billing Model"
                            onChange={(e) =>
                                setLimits((prev) => ({
                                    ...prev,
                                    outbound_call_billing_model: e.target.value as
                                        | "per_attempt"
                                        | "per_minute",
                                }))
                            }
                        >
                            <MenuItem value="per_attempt">
                                Per Attempt Based
                            </MenuItem>
                            <MenuItem value="per_minute">
                                Per Minute Based
                            </MenuItem>
                        </Select>
                    </FormControl>
                </Grid>

                <Grid item xs={12} md={3}>
                    <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="Max Outbound Calls"
                        value={limits.max_outbound_calls ?? ""}
                        onChange={(e) =>
                            setLimits((prev) => ({
                                ...prev,
                                max_outbound_calls:
                                    e.target.value === ""
                                        ? undefined
                                        : Number(e.target.value),
                            }))
                        }
                        inputProps={{ min: 0 }}
                    />
                </Grid>

                <Grid item xs={12} md={3}>
                    <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="Max Outbound Voice Agents"
                        value={limits.max_outbound_voice_agents ?? ""}
                        onChange={(e) =>
                            setLimits((prev) => ({
                                ...prev,
                                max_outbound_voice_agents:
                                    e.target.value === ""
                                        ? undefined
                                        : Number(e.target.value),
                            }))
                        }
                        helperText="Maximum outbound voice agents allowed."
                        inputProps={{ min: 0 }}
                    />
                </Grid>

                <Grid item xs={12} md={3}>
                    <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="Max Inbound Voice Agents"
                        value={limits.max_inbound_voice_agents ?? ""}
                        onChange={(e) =>
                            setLimits((prev) => ({
                                ...prev,
                                max_inbound_voice_agents:
                                    e.target.value === ""
                                        ? undefined
                                        : Number(e.target.value),
                            }))
                        }
                        helperText="Maximum inbound voice agents allowed."
                        inputProps={{ min: 0 }}
                    />
                </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", sm: "center" }}
            >
                <Typography variant="body2" color="text.secondary">
                    Review and save limits for this organization.
                </Typography>

                <Button
                    variant="text"
                    onClick={() => setLimits({ ...defaultLimits })}
                >
                    {resetButtonText}
                </Button>
            </Stack>
        </Paper>
    );
}