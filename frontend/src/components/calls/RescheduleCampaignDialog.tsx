import React, { useEffect, useRef, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormHelperText,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    Typography,
} from "@mui/material";

import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PhoneCallbackIcon from "@mui/icons-material/PhoneCallback";
import CloseIcon from "@mui/icons-material/Close";

export interface RescheduleCampaignData {
    campaign_name: string;
    from_number: string;
    schedule_type: "now" | "schedule";
    date?: string;
    time?: string;
    timezone: string;
    workflow_id?: number | null;
    concurrency?: number | null;
    contact_ids: number[];
}

interface RescheduleCampaignDialogProps {
    open: boolean;
    onClose: () => void;

    selectedContactIds: number[];

    initialCampaignName?: string;
    agentName?: string;
    initialFromNumber?: string;
    timezone?: string;

    activePhoneNumbers: string[];

    workflows?: {
        id: string | number;
        name: string;
    }[];

    initialWorkflowId?: number | null;

    maxConcurrency?: number;
    initialConcurrency?: number;

    onSubmit: (
        data: RescheduleCampaignData
    ) => Promise<void> | void;
}

const TIMEZONES = [
    {
        value: "Asia/Kolkata",
        label: "India (IST - Asia/Kolkata)",
    },
    {
        value: "Asia/Dubai",
        label: "UAE (GST - Asia/Dubai)",
    },
    {
        value: "America/New_York",
        label: "US Eastern (EST/EDT - America/New_York)",
    },
    {
        value: "America/Chicago",
        label: "US Central (CST/CDT - America/Chicago)",
    },
    {
        value: "America/Denver",
        label: "US Mountain (MST/MDT - America/Denver)",
    },
    {
        value: "America/Los_Angeles",
        label: "US Pacific (PST/PDT - America/Los_Angeles)",
    },
    {
        value: "America/Toronto",
        label: "Canada Eastern (EST/EDT - America/Toronto)",
    },
    {
        value: "America/Winnipeg",
        label: "Canada Central (CST/CDT - America/Winnipeg)",
    },
    {
        value: "America/Edmonton",
        label: "Canada Mountain (MST/MDT - America/Edmonton)",
    },
    {
        value: "America/Vancouver",
        label: "Canada Pacific (PST/PDT - America/Vancouver)",
    },
    {
        value: "America/Halifax",
        label: "Canada Atlantic (AST/ADT - America/Halifax)",
    },
    {
        value: "Australia/Sydney",
        label: "Australia Eastern (AEST/AEDT - Australia/Sydney)",
    },
];

const getSafeTimezone = (timezone?: string) => {
    return timezone?.trim() || "Asia/Kolkata";
};

const getDefaultDate = () => {
    return new Date().toISOString().split("T")[0];
};

const getDefaultTime = () => {
    const now = new Date();

    return now.toTimeString().slice(0, 5);
};

const getCurrentTime = (timezone: string) => {
    const now = new Date();

    return {
        date: now.toLocaleDateString("en-IN", {
            timeZone: timezone,
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        }),
        time: now.toLocaleTimeString("en-IN", {
            timeZone: timezone,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
        }),
    };
};

export default function RescheduleCampaignDialog({
    open,
    onClose,
    selectedContactIds,
    initialCampaignName = "",
    agentName = "",
    initialFromNumber = "",
    timezone,
    activePhoneNumbers,
    workflows = [],
    initialWorkflowId = null,
    maxConcurrency = 2,
    initialConcurrency = 1,
    onSubmit,
}: RescheduleCampaignDialogProps) {
    const safeTimezone = getSafeTimezone(timezone);
    const dialogContentRef = useRef<HTMLDivElement>(null);
    const getInitialFromNumber = () => {
        if (
            initialFromNumber &&
            activePhoneNumbers.includes(initialFromNumber)
        ) {
            return initialFromNumber;
        }

        return activePhoneNumbers[0] || "";
    };

    const [data, setData] =
        useState<RescheduleCampaignData>({
            campaign_name: `${initialCampaignName} (Rescheduled)`,
            from_number: getInitialFromNumber(),
            schedule_type: "schedule",
            date: getDefaultDate(),
            time: getDefaultTime(),
            timezone: safeTimezone,
            workflow_id: initialWorkflowId,
            concurrency: initialConcurrency,
            contact_ids: selectedContactIds,
        });

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const [errors, setErrors] = useState<{
        campaign_name?: string;
        from_number?: string;
        contact_ids?: string;
        date?: string;
        time?: string;
        timezone?: string;
    }>({});

    const showError = (message: string) => {
        setError(message);
    };


    useEffect(() => {
        if (!open) return;

        const timezoneValue = getSafeTimezone(timezone);

        const fromNumber =
            initialFromNumber &&
                activePhoneNumbers.includes(initialFromNumber)
                ? initialFromNumber
                : activePhoneNumbers[0] || "";

        setData({
            campaign_name: `${initialCampaignName} (Rescheduled)`,
            from_number: fromNumber,
            schedule_type: "schedule",
            date: getDefaultDate(),
            time: getDefaultTime(),
            timezone: timezoneValue,
            workflow_id: initialWorkflowId,
            concurrency: initialConcurrency,
            contact_ids: selectedContactIds,
        });
    }, [
        open,
        initialCampaignName,
        initialFromNumber,
        timezone,
        initialWorkflowId,
        initialConcurrency,
        selectedContactIds,
        activePhoneNumbers,
    ]);



    const updateData = (
        changes: Partial<RescheduleCampaignData>
    ) => {
        setData((prev) => ({
            ...prev,
            ...changes,
        }));
    };

    const handleSubmit = async () => {
        const newErrors: typeof errors = {};

        if (!data.campaign_name?.trim()) {
            newErrors.campaign_name = "Campaign name is required";
        }

        if (!data.from_number) {
            newErrors.from_number = "Calling number is required";
        }

        if (selectedContactIds.length === 0) {
            newErrors.contact_ids = "Please select at least one contact";
        }

        if (data.schedule_type === "schedule") {
            if (!data.date) {
                newErrors.date = "Date is required";
            }

            if (!data.time) {
                newErrors.time = "Time is required";
            } else if (
                data.time < "09:00" ||
                data.time > "21:00"
            ) {
                newErrors.time = "Time must be between 9:00 AM and 9:00 PM";
            }

            if (data.date && data.time) {
                const selectedDateTime = new Date(
                    `${data.date}T${data.time}`
                );

                if (selectedDateTime <= new Date()) {
                    newErrors.date = "Date and time must be in the future";
                    newErrors.time = "Date and time must be in the future";
                }
            }

            if (!data.timezone) {
                newErrors.timezone = "Timezone is required";
            }
        }

        setErrors(newErrors);

        // STOP submit if validation failed
        if (Object.keys(newErrors).length > 0) {
            return;
        }

        try {
            setSubmitting(true);

            await onSubmit({
                ...data,
                contact_ids: selectedContactIds,
                workflow_id: data.workflow_id ? Number(data.workflow_id) : null,
                concurrency: 1,
            });

            onClose();
        } catch (err: any) {
            showError(err?.response?.data?.detail || "Failed to create rescheduled campaign");
            dialogContentRef.current?.scrollTo({
                top: 0,
                behavior: "smooth",
            });
        } finally {
            setSubmitting(false);
        }
    };

    const currentTime = getCurrentTime(
        getSafeTimezone(data.timezone)
    );

    return (
        <Dialog
            open={open}
            onClose={submitting ? undefined : onClose}
            fullWidth
            maxWidth="md"
        >
            <DialogTitle
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontWeight: 700,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                }}
            >
                <Box component="span">
                    Reschedule Campaign
                </Box>

                <IconButton
                    onClick={onClose}
                    size="small"
                    aria-label="Close"
                >
                    <CloseIcon fontSize="small" />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ pt: 3 }} ref={dialogContentRef}>
                {/* Selected contacts */}
                <Alert
                    severity="info"
                    sx={{
                        mb: 2.5,
                        py: 1,
                    }}
                >
                    <Typography variant="body2">
                        <strong>
                            {selectedContactIds.length} contact(s)
                        </strong>{" "}
                        will be moved to a new campaign with the same
                        settings. They will be copied from the original
                        campaign.
                    </Typography>
                </Alert>

                {error && (
                    <Alert
                        severity="error"
                        sx={{
                            borderWidth: 2,
                            borderStyle: 'solid',
                            borderColor: 'error.main',
                            backgroundColor: '#ffebee',
                            color: 'error.dark',
                            fontWeight: 700,
                            '& .MuiAlert-icon': { color: 'error.main' },
                        }}
                    >
                        {error}
                    </Alert>
                )}
                {/* Campaign Name */}
                <Box mb={2}>
                    <Typography
                        variant="caption"
                        fontWeight={600}
                        color="text.primary"
                    >
                        Campaign Name *
                    </Typography>

                    <TextField
                        fullWidth
                        value={data.campaign_name}
                        onChange={(e) =>
                            setData((prev) => ({
                                ...prev,
                                campaign_name: e.target.value,
                            }))
                        }
                        error={Boolean(errors.campaign_name)}
                        helperText={errors.campaign_name}
                    />
                </Box>

                {/* Agent */}
                <Box mb={2}>
                    <Typography
                        variant="caption"
                        fontWeight={600}
                        color="text.primary"
                    >
                        Agent
                    </Typography>

                    <Box
                        sx={{
                            mt: 0.5,
                            px: 1.5,
                            py: 1,
                            bgcolor: "grey.50",
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 1,
                        }}
                    >
                        <Typography variant="body2">
                            {agentName || "Same agent from original campaign"}
                        </Typography>
                    </Box>

                    <Typography
                        variant="caption"
                        color="text.secondary"
                    >
                        The agent cannot be changed when rescheduling.
                        It will use the same agent from the original
                        campaign.
                    </Typography>
                </Box>

                {/* From Number */}
                <Box mb={2}>
                    <FormControl
                        fullWidth
                        error={Boolean(errors.from_number)}
                    >
                        <InputLabel>From Number *</InputLabel>

                        <Select
                            value={data.from_number || initialFromNumber || activePhoneNumbers[0] || ""}
                            label="From Number *"
                            onChange={(e) =>
                                updateData({
                                    from_number: e.target.value,
                                })
                            }
                        >
                            {activePhoneNumbers.map((phone) => (
                                <MenuItem key={phone} value={phone}>
                                    {phone}
                                </MenuItem>
                            ))}
                        </Select>

                        {errors.from_number && (
                            <FormHelperText>
                                {errors.from_number}
                            </FormHelperText>
                        )}
                    </FormControl>

                    <Typography
                        variant="caption"
                        color="text.secondary"
                    >
                        {activePhoneNumbers.length} active phone numbers
                        available
                    </Typography>
                </Box>

                {/* When to send */}
                <Box mb={2}>
                    <Typography
                        variant="body2"
                        fontWeight={600}
                        mb={1}
                    >
                        When to send the calls *
                    </Typography>

                    <Box
                        display="grid"
                        gridTemplateColumns="1fr 1fr"
                        gap={1.5}
                    >
                        <Button
                            variant={
                                data.schedule_type === "now"
                                    ? "contained"
                                    : "outlined"
                            }
                            onClick={() =>
                                updateData({
                                    schedule_type: "now",
                                })
                            }
                        >
                            Send Now
                        </Button>

                        <Button
                            variant={
                                data.schedule_type === "schedule"
                                    ? "contained"
                                    : "outlined"
                            }
                            onClick={() =>
                                updateData({
                                    schedule_type: "schedule",
                                })
                            }
                        >
                            Schedule
                        </Button>
                    </Box>
                </Box>

                {/* Date / Time */}
                {data.schedule_type === "schedule" && (
                    <Box
                        display="grid"
                        gridTemplateColumns="1fr 1fr"
                        gap={2}
                        mb={2}
                    >
                        <TextField
                            label="Date"
                            type="date"
                            value={data.date}
                            onChange={(e) =>
                                updateData({
                                    date: e.target.value,
                                })
                            }
                            InputLabelProps={{
                                shrink: true,
                            }}
                            fullWidth
                            required
                            error={Boolean(errors.date)}
                            helperText={errors.date}
                        />

                        <TextField
                            label="Time"
                            type="time"
                            value={data.time}
                            onChange={(e) =>
                                updateData({
                                    time: e.target.value,
                                })
                            }
                            InputLabelProps={{
                                shrink: true,
                            }}
                            inputProps={{
                                min: "09:00",
                                max: "21:00",
                            }}
                            fullWidth
                            required
                            error={Boolean(errors.time)}
                            helperText={errors.time}
                        />
                    </Box>
                )}

                {/* Timezone */}
                <Box mb={2}>
                    <FormControl
                        fullWidth
                        size="small"
                        error={Boolean(errors.timezone)}
                    >
                        <InputLabel>Timezone *</InputLabel>

                        <Select
                            value={data.timezone}
                            label="Timezone *"
                            onChange={(e) =>
                                updateData({
                                    timezone: e.target.value,
                                })
                            }
                        >
                            {TIMEZONES.map((timezoneOption) => (
                                <MenuItem
                                    key={timezoneOption.value}
                                    value={timezoneOption.value}
                                >
                                    {timezoneOption.label}
                                </MenuItem>
                            ))}
                        </Select>

                        {errors.timezone && (
                            <FormHelperText>
                                {errors.timezone}
                            </FormHelperText>
                        )}
                    </FormControl>

                    {/* Current time */}
                    <Alert
                        severity="info"
                        icon={<AccessTimeIcon />}
                        sx={{
                            mt: 1.5,
                            py: 0.75,
                        }}
                    >
                        <Box>
                            <Typography
                                variant="caption"
                                color="primary.dark"
                                fontWeight={600}
                            >
                                Current time
                            </Typography>

                            <Box
                                display="flex"
                                gap={1}
                                flexWrap="wrap"
                            >
                                <Typography
                                    variant="body2"
                                    fontWeight={600}
                                >
                                    {currentTime.date}
                                </Typography>

                                <Typography
                                    variant="body2"
                                    fontWeight={700}
                                >
                                    {currentTime.time}
                                </Typography>
                            </Box>
                        </Box>
                    </Alert>
                </Box>

                {/* Workflow */}
                <Box mb={2}>
                    <FormControl fullWidth size="small">
                        <InputLabel>
                            Workflow for new campaign
                        </InputLabel>

                        <Select
                            value={data.workflow_id}
                            label="Workflow for new campaign"
                            onChange={(e) =>
                                updateData({
                                    workflow_id: Number(e.target.value),
                                })
                            }
                        >
                            <MenuItem value="">
                                Select a workflow
                            </MenuItem>

                            {workflows.map((workflow) => (
                                <MenuItem
                                    key={workflow.id}
                                    value={workflow.id}
                                >
                                    {workflow.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>

            </DialogContent>

            <DialogActions
                sx={{
                    px: 3,
                    py: 2,
                    borderTop: "1px solid",
                    borderColor: "divider",
                }}
            >
                <Button
                    variant="outlined"
                    onClick={onClose}
                    disabled={submitting}
                >
                    Cancel
                </Button>

                <Button
                    variant="contained"
                    startIcon={<PhoneCallbackIcon />}
                    onClick={handleSubmit}
                    disabled={
                        submitting ||
                        selectedContactIds.length < 2 ||
                        !data.campaign_name.trim() ||
                        !data.from_number ||
                        (data.schedule_type === "schedule" &&
                            (!data.date || !data.time))
                    }
                >
                    {submitting
                        ? "Creating..."
                        : "Create Rescheduled Campaign"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}