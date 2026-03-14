import {
    Grid,
    TextField,
    Button,
    Typography,
    Paper,
    Box,
    ToggleButtonGroup,
    ToggleButton,
    FormControlLabel,
    Checkbox,
    Autocomplete
} from "@mui/material";
import { useState } from "react";
import moment from "moment-timezone";

interface ScheduleProps {
    mode: "create" | "edit";
    form: any;
    setForm: any;
    prevStep: () => void;
    saveCampaign: () => void;
}

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const Schedule = ({ mode, form, setForm, prevStep, saveCampaign }: ScheduleProps) => {

    const [errors, setErrors] = useState<any>({});

    const timezones = moment.tz.names().map((tz) => ({
        value: tz,
        label: `(GMT${moment.tz(tz).format("Z")}) ${tz}`
    }));

    const handleSave = () => {

        const newErrors: any = {};

        if (!form.start_datetime) {
            newErrors.start_datetime = "Start date & time is required";
        }

        if (!form.timezone) {
            newErrors.timezone = "Timezone is required";
        }

        if (!form.call_start_time) {
            newErrors.call_start_time = "Call start time is required";
        }

        if (!form.call_end_time) {
            newErrors.call_end_time = "Call end time is required";
        }

        if (!form.call_interval) {
            newErrors.call_interval = "Call interval is required";
        }

        if (!form.active_days || form.active_days.length === 0) {
            newErrors.active_days = "Select at least one active day";
        }

        if (
            form.call_start_time &&
            form.call_end_time &&
            form.call_start_time >= form.call_end_time
        ) {
            newErrors.call_end_time = "End time must be after start time";
        }

        setErrors(newErrors);

        if (Object.keys(newErrors).length > 0) return;

        saveCampaign();
    };

    return (
        <Grid container spacing={3}>

            {/* CAMPAIGN START */}

            <Grid item xs={12}>
                <Paper sx={{ p: 3 }}>

                    <Typography variant="h6" mb={2}>
                        Campaign Start
                    </Typography>

                    <Grid container spacing={3}>

                        <Grid item xs={6}>
                            <TextField
                                required
                                label="Start Date & Time"
                                type="datetime-local"
                                fullWidth
                                InputLabelProps={{ shrink: true }}
                                name="start_datetime"
                                value={form.start_datetime}
                                onChange={(e) =>
                                    setForm({ ...form, start_datetime: e.target.value })
                                }
                                error={!!errors.start_datetime}
                                helperText={errors.start_datetime}
                            />
                        </Grid>

                        <Grid item xs={6}>
                            <Autocomplete
                                options={timezones}
                                getOptionLabel={(option) => option.label}
                                value={timezones.find((t) => t.value === form.timezone) || null}
                                onChange={(event, newValue) =>
                                    setForm((prev: any) => ({
                                        ...prev,
                                        timezone: newValue?.value || ""
                                    }))
                                }
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Call Timezone"
                                        required
                                        name="timezone"
                                        error={!!errors.timezone}
                                        helperText={errors.timezone}
                                    />
                                )}
                            />
                        </Grid>

                    </Grid>

                </Paper>
            </Grid>

            {/* CALLING HOURS */}

            <Grid item xs={12}>
                <Paper sx={{ p: 3 }}>

                    <Typography variant="h6" mb={2}>
                        Calling Hours
                    </Typography>

                    <Grid container spacing={3}>

                        <Grid item xs={4}>
                            <TextField
                                label="Call Start Time"
                                type="time"
                                fullWidth
                                required
                                value={form.call_start_time}
                                onChange={(e) =>
                                    setForm((prev: any) => ({
                                        ...prev,
                                        call_start_time: e.target.value
                                    }))
                                }
                                InputLabelProps={{ shrink: true }}
                                error={!!errors.call_start_time}
                                helperText={errors.call_start_time}
                            />
                        </Grid>

                        <Grid item xs={4}>
                            <TextField
                                label="Call End Time"
                                type="time"
                                fullWidth
                                required
                                value={form.call_end_time}
                                onChange={(e) =>
                                    setForm((prev: any) => ({
                                        ...prev,
                                        call_end_time: e.target.value
                                    }))
                                }
                                InputLabelProps={{ shrink: true }}
                                error={!!errors.call_end_time}
                                helperText={errors.call_end_time}
                            />
                        </Grid>

                        <Grid item xs={4}>
                            <TextField
                                label="Call Interval (Minutes)"
                                type="number"
                                fullWidth
                                required
                                value={form.call_interval}
                                onChange={(e) =>
                                    setForm((prev: any) => ({
                                        ...prev,
                                        call_interval: e.target.value
                                    }))
                                }
                                error={!!errors.call_interval}
                                helperText={errors.call_interval}
                            />
                        </Grid>

                        {/* ACTIVE DAYS */}

                        <Grid item xs={12}>

                            <Typography mb={1}>
                                Active Days *
                            </Typography>

                            <ToggleButtonGroup
                                value={form.active_days}
                                onChange={(event, newDays) =>
                                    setForm((prev: any) => ({
                                        ...prev,
                                        active_days: newDays
                                    }))
                                }
                                sx={{
                                    width: "100%",
                                    display: "flex",
                                    gap: 1,

                                    "& .MuiToggleButtonGroup-grouped": {
                                        border: "1px solid",
                                        borderColor: "divider",
                                        borderRadius: "6px !important"
                                    }
                                }}
                            >
                                {days.map((day) => (
                                    <ToggleButton
                                        key={day}
                                        value={day}
                                        sx={{
                                            flex: 1,

                                            "&.Mui-selected": {
                                                backgroundColor: "primary.main",
                                                color: "#fff",
                                                borderColor: "primary.main"
                                            },

                                            "&.Mui-selected:hover": {
                                                backgroundColor: "primary.dark"
                                            }
                                        }}
                                    >
                                        {day}
                                    </ToggleButton>
                                ))}
                            </ToggleButtonGroup>
                            {errors.active_days && (
                                <Typography color="error" variant="caption">
                                    {errors.active_days}
                                </Typography>
                            )}
                        </Grid>
                    </Grid>

                </Paper>
            </Grid>

            {/* RETRY SETTINGS */}

            <Grid item xs={12}>
                <Paper sx={{ p: 3 }}>

                    <Typography variant="h6" mb={2}>
                        Retry Settings
                    </Typography>

                    <Grid container spacing={3}>

                        <Grid item xs={6}>
                            <TextField
                                label="Max Retry Attempts"
                                type="number"
                                fullWidth
                            />
                        </Grid>

                        <Grid item xs={6}>
                            <TextField
                                label="Retry Interval (Minutes)"
                                type="number"
                                fullWidth
                            />
                        </Grid>

                    </Grid>

                    {/* CHECKBOX OPTIONS */}

                    <Box mt={3}>

                        <FormControlLabel
                            control={<Checkbox />}
                            label={
                                <Box>
                                    <Typography fontWeight={500}>
                                        Retry on No Answer
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                    >
                                        Automatically retry if contact doesn't answer
                                    </Typography>
                                </Box>
                            }
                        />

                        <FormControlLabel
                            control={<Checkbox />}
                            label={
                                <Box>
                                    <Typography fontWeight={500}>
                                        Retry on Busy
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                    >
                                        Retry when line is busy
                                    </Typography>
                                </Box>
                            }
                        />

                        <FormControlLabel
                            control={<Checkbox />}
                            label={
                                <Box>
                                    <Typography fontWeight={500}>
                                        Retry on Voicemail
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                    >
                                        Leave voicemail and retry later
                                    </Typography>
                                </Box>
                            }
                        />

                    </Box>

                </Paper>
            </Grid>

            {/* FOOTER BUTTONS */}

            <Grid item xs={6}>
                <Button onClick={prevStep}>
                    Back
                </Button>
            </Grid>

            <Grid item xs={6} textAlign="right">
                <Button
                    variant="contained"
                    onClick={handleSave}
                >
                    {mode === "edit" ? "Update Campaign" : "Save Campaign"}
                </Button>
            </Grid>

        </Grid>
    );
};

export default Schedule;