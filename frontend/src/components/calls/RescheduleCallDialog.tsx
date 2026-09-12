import React, { useEffect, useState } from "react";
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
import { RescheduleCallRequest } from "../../services/callCampaignService";
import CloseIcon from "@mui/icons-material/Close";


interface RescheduleCallDialogProps {
    open: boolean;
    onClose: () => void;
    initialFromNumber?: string;
    timezone?: string;
    onSubmit: (data: Partial<RescheduleCallRequest>) => Promise<void> | void;
}


const getDefaultData = (
    initialFromNumber = "",
    timezone = "Asia/Kolkata"
): Partial<RescheduleCallRequest> => {
    const now = new Date();


    const safeTimezone =
        typeof timezone === "string" && timezone.trim()
            ? timezone.trim()
            : "Asia/Kolkata";

    return {
        from_number: initialFromNumber,
        schedule_type: "now",
        date: now.toISOString().split("T")[0],
        time: now.toTimeString().slice(0, 5),
        timezone: safeTimezone,
    };
};

const RescheduleCallDialog: React.FC<RescheduleCallDialogProps> = ({
    open,
    onClose,
    initialFromNumber = "",
    timezone,
    onSubmit,
}) => {
    const [data, setData] = useState<Partial<RescheduleCallRequest>>(
        getDefaultData(initialFromNumber, timezone)
    );

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const showError = (message: string) => {
        setError(message);
    };

    useEffect(() => {
        if (open) {
            setData(
                getDefaultData(initialFromNumber, timezone)
            );
        }
    }, [open, initialFromNumber, timezone]);

    const updateData = (
        changes: Partial<RescheduleCallRequest>
    ) => {
        setData((prev) => ({
            ...prev,
            ...changes,
        }));
    };


    const handleSubmit = async () => {
        if (!data.from_number) {
            showError("From number is required");
            return;
        }

        if (data.schedule_type === "now") {
            try {
                const now = new Date();

                const timeInSelectedTimezone = new Intl.DateTimeFormat("en-GB", {
                    timeZone: data.timezone || "Asia/Kolkata",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                }).format(now);

                const [hours, minutes] = timeInSelectedTimezone
                    .split(":")
                    .map(Number);

                const currentMinutes = hours * 60 + minutes;

                const startMinutes = 9 * 60;   // 09:00
                const endMinutes = 21 * 60;    // 21:00

                if (
                    currentMinutes < startMinutes ||
                    currentMinutes > endMinutes
                ) {
                    showError(
                        `Call can be rescheduled now only between 9:00 AM and 9:00 PM in ${data.timezone}`
                    );
                    return;
                }
            } catch {
                showError("Invalid timezone");
                return;
            }
        }

        if (data.schedule_type === "schedule") {
            if (!data.date) {
                showError("Date is required");
                return;
            }

            if (!data.time) {
                showError("Time is required");
                return;
            }

            if (!data.timezone) {
                showError("Timezone is required");
                return;
            }

            if (data.time < "09:00" || data.time > "21:00") {
                showError("Time must be between 9:00 AM and 9:00 PM");
                return;
            }

            if (data.date && data.time) {
                const selectedDateTime = new Date(
                    `${data.date}T${data.time}`
                );

                if (selectedDateTime <= new Date()) {
                    showError("Date and time must be in the future");
                    return;
                }
            }
        }

        try {
            setSubmitting(true);

            await onSubmit(data);

            onClose();
        } catch (error: any) {
            showError(error?.response?.data?.detail || "Failed to create reschedule call");
        } finally {
            setSubmitting(false);
        }
    };


    return (
        <Dialog
            open={open}
            onClose={submitting ? undefined : onClose}
            maxWidth="md"
            fullWidth
        >
            <DialogTitle
                sx={{
                    display: "flex",
                    alignItems: "center",
                }}
            >
                <Box component="span">
                    Reschedule Call
                </Box>

                <IconButton
                    onClick={onClose}
                    size="small"
                    aria-label="Close"
                    sx={{ ml: "auto" }}
                >
                    <CloseIcon fontSize="small" />
                </IconButton>
            </DialogTitle>

            <DialogContent dividers>
                <Alert severity="info" sx={{ mb: 2 }}>
                    A new call will be created for this contact using the
                    existing campaign settings.
                </Alert>

                {error && (
                    <Alert
                        severity="error"
                        sx={{
                            mb: 2,
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

                {/* From Number + Timezone */}
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 2,
                        mb: 2,
                    }}
                >
                    {/* From Number */}
                    <Box>
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            fontWeight={600}
                        >
                            From Number
                        </Typography>

                        <Typography
                            variant="body2"
                            fontWeight={600}
                            sx={{ mt: 0.5 }}
                        >
                            {data.from_number || "No phone number available"}
                        </Typography>
                    </Box>

                    {/* Timezone */}
                    <Box>
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            fontWeight={600}
                        >
                            Timezone
                        </Typography>

                        <Typography
                            variant="body2"
                            fontWeight={600}
                            sx={{ mt: 0.5 }}
                        >
                            {data.timezone || "Timezone not available"}
                        </Typography>
                    </Box>
                </Box>

                {/* Current Time */}
                <Alert
                    severity="info"
                    icon={<AccessTimeIcon />}
                    sx={{
                        mb: 2,
                        py: 0.75,
                    }}
                >
                    <Box
                        display="flex"
                        alignItems="center"
                        gap={1}
                        flexWrap="wrap"
                    >
                        <Typography variant="caption">
                            Current time:
                        </Typography>

                        <Typography
                            variant="body2"
                            fontWeight={600}
                        >
                            {new Date().toLocaleDateString("en-IN", {
                                timeZone: data.timezone,
                                dateStyle: "medium",
                            })}
                        </Typography>

                        <Typography
                            variant="body2"
                            fontWeight={700}
                        >
                            {new Date().toLocaleTimeString("en-IN", {
                                timeZone: data.timezone,
                            })}
                        </Typography>
                    </Box>
                </Alert>

                {/* When to send */}
                <Typography
                    variant="subtitle2"
                    fontWeight={600}
                    sx={{ mb: 1 }}
                >
                    When to send the call *
                </Typography>

                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 1.5,
                        mb: data.schedule_type === "schedule" ? 2 : 0,
                    }}
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

                {/* Date & Time */}
                {data.schedule_type === "schedule" && (
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 2,
                        }}
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
                        />
                    </Box>
                )}
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 1.5 }}>
                <Button
                    variant="outlined"
                    onClick={onClose}
                    disabled={submitting}
                >
                    Cancel
                </Button>

                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={
                        submitting ||
                        !data.from_number ||
                        (data.schedule_type === "schedule" &&
                            (!data.date || !data.time))
                    }
                >
                    {submitting
                        ? "Rescheduling..."
                        : "Reschedule Call"}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default RescheduleCallDialog;