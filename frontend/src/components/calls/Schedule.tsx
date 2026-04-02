import { useEffect, useMemo, useState } from "react";
import {
    Grid,
    Paper,
    Typography,
    Box,
    Button,
    ToggleButton,
    ToggleButtonGroup,
    TextField,
    Autocomplete,
    FormControlLabel,
    Checkbox,
    Alert,
    Stack,
    Divider
} from "@mui/material";
import { Send, CalendarToday } from "@mui/icons-material";
import moment from "moment-timezone";
import AccessTimeIcon from '@mui/icons-material/AccessTime'

interface ScheduleProps {
    form: any;
    setForm: any;
    sendOption: "now" | "schedule";
    setSendOption: (value: "now" | "schedule") => void;
    errors: any;
}

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const timezones = [
    {
        value: "Asia/Kolkata",
        label: "India (IST - Asia/Kolkata)"
    },
    {
        value: "Asia/Dubai",
        label: "UAE (GST - Asia/Dubai)"
    },
    {
        value: "America/New_York",
        label: "US Eastern (EST/EDT - America/New_York)"
    },
    {
        value: "America/Chicago",
        label: "US Central (CST/CDT - America/Chicago)"
    },
    {
        value: "America/Denver",
        label: "US Mountain (MST/MDT - America/Denver)"
    },
    {
        value: "America/Los_Angeles",
        label: "US Pacific (PST/PDT - America/Los_Angeles)"
    },
    {
        value: "America/Toronto",
        label: "Canada Eastern (EST/EDT - America/Toronto)"
    },
    {
        value: "America/Winnipeg",
        label: "Canada Central (CST/CDT - America/Winnipeg)"
    },
    {
        value: "America/Edmonton",
        label: "Canada Mountain (MST/MDT - America/Edmonton)"
    },
    {
        value: "America/Vancouver",
        label: "Canada Pacific (PST/PDT - America/Vancouver)"
    },
    {
        value: "America/Halifax",
        label: "Canada Atlantic (AST/ADT - America/Halifax)"
    }
];

const Schedule = ({
    form,
    setForm,
    sendOption,
    setSendOption,
    errors
}: ScheduleProps) => {

    const [currentTime, setCurrentTime] = useState("")
    const [currentDate, setCurrentDate] = useState("")

    useEffect(() => {
        const interval = setInterval(() => {
            const now = moment().tz(form.timezone);

            setCurrentTime(now.format("hh:mm:ss A"));
            setCurrentDate(now.format("dddd, MMM DD YYYY"));
        }, 1000);

        return () => clearInterval(interval)
    }, [form.timezone])


    const selectedTimezoneLabel = useMemo(() => {
        return timezones.find(t => t.value === form.timezone)?.label || form.timezone
    }, [form.timezone, timezones])

    const today = form.timezone
        ? moment().tz(form.timezone).format("YYYY-MM-DD")
        : moment().format("YYYY-MM-DD");

    useEffect(() => {
        if (form.start_datetime && form.end_datetime) {
            const validDays = getDaysBetween(
                form.start_datetime,
                form.end_datetime
            )

            const filtered = form.active_days?.filter((day: string) =>
                validDays.includes(day)
            )

            setForm((prev: any) => ({
                ...prev,
                active_days: filtered
            }))
        }
    }, [form.start_datetime, form.end_datetime])


    const getDaysBetween = (start: string, end: string) => {
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

        const startDate = new Date(start)
        const endDate = new Date(end)

        const availableDays = new Set<string>()

        let current = new Date(startDate)

        while (current <= endDate) {
            availableDays.add(days[current.getDay()])
            current.setDate(current.getDate() + 1)
        }

        return Array.from(availableDays)
    }

    const validDays =
        form.start_datetime && form.end_datetime
            ? getDaysBetween(form.start_datetime, form.end_datetime)
            : days

    return (
        <Grid container spacing={3}>
            {/* SEND OPTION TOGGLE */}
            <Grid item xs={12}>
                {errors.schedule && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {errors.schedule}
                    </Alert>
                )}

                {errors.send_now && (
                    <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
                        {errors.send_now}
                    </Alert>
                )}
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" mb={2}>
                        When to send the calls
                    </Typography>

                    <ToggleButtonGroup
                        value={sendOption}
                        exclusive
                        onChange={(e, value) => value && setSendOption(value)}
                        sx={{ display: "flex", gap: 2 }}
                    >
                        {[
                            { value: "schedule", label: "Schedule", icon: <CalendarToday fontSize="small" />, sub: "Pick date & time" },
                            { value: "now", label: "Send Now", icon: <Send fontSize="small" />, sub: "Start immediately" }
                        ].map((item) => (
                            <ToggleButton
                                key={item.value}
                                value={item.value}
                                sx={{
                                    flex: 1,
                                    borderRadius: 2,
                                    borderColor: "grey.300",
                                    backgroundColor: "#fff",

                                    "&.Mui-selected": {
                                        background: "linear-gradient(135deg, #3b82f6, #93c5fd)",
                                        color: "#fff",
                                        borderColor: "primary.main"
                                    },

                                    "&.Mui-selected:hover": {
                                        background: "linear-gradient(135deg, #2563eb, #60a5fa)"
                                    }
                                }}
                            >
                                <Box display="flex" flexDirection="column" alignItems="center">
                                    <Box
                                        mb={1}
                                        display="flex"
                                        justifyContent="center"
                                        alignItems="center"
                                        width={40}
                                        height={40}
                                        borderRadius="50%"
                                        bgcolor={sendOption === item.value ? "primary.main" : "grey.100"}
                                        color={sendOption === item.value ? "#fff" : "grey.600"}
                                    >
                                        {item.icon}
                                    </Box>

                                    <Typography fontWeight={600}>{item.label}</Typography>
                                    <Typography variant="caption">{item.sub}</Typography>
                                </Box>
                            </ToggleButton>
                        ))}
                    </ToggleButtonGroup>

                </Paper>
            </Grid>

            {/* CAMPAIGN START */}
            {sendOption === "schedule" && (
                <>
                    <Grid item xs={12}>
                        <Paper sx={{ p: 3 }}>

                            <Typography variant="h6" mb={2}>
                                Timezone
                            </Typography>

                            <Grid container spacing={3}>
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
                                                error={!!errors.timezone}
                                                helperText={errors.timezone}
                                            />
                                        )}
                                    />
                                </Grid>
                            </Grid>

                            {/* Current Time */}
                            <Box
                                sx={{
                                    mt: 3,
                                    p: 2,
                                    borderRadius: 2,
                                    background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
                                    border: "1px solid #bfdbfe"
                                }}
                            >
                                <Stack direction="row" spacing={2} alignItems="center">
                                    <AccessTimeIcon sx={{ color: "#2563eb" }} />

                                    <Box>
                                        <Typography variant="caption" color="#1d4ed8" fontWeight={600}>
                                            Current time in {selectedTimezoneLabel}
                                        </Typography>

                                        <Typography variant="body2" fontWeight={600}>
                                            {currentDate}
                                        </Typography>

                                        <Typography variant="h6" fontWeight={700}>
                                            {currentTime}
                                        </Typography>
                                    </Box>
                                </Stack>
                            </Box>

                        </Paper>
                    </Grid>
                    <Grid item xs={12}>
                        <Paper sx={{ p: 3 }}>

                            <Typography variant="h6">
                                Dialer Schedule
                            </Typography>

                            <Alert
                                severity="info"
                                variant="outlined"
                                sx={{ mt: 1, mb: 3 }}
                            >
                                You can either:
                                <br />
                                • Select <b>Date Range + Active Days</b> (Campaign runs only within selected dates)
                                <br />
                                • Select <b>Active Days only</b> (Campaign runs indefinitely)
                            </Alert>

                            {/* DATE RANGE */}

                            <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Typography fontWeight={600}>
                                    Date Range
                                </Typography>

                                <Button
                                    size="small"
                                    color="error"
                                    onClick={() =>
                                        setForm((prev: any) => ({
                                            ...prev,
                                            start_datetime: "",
                                            end_datetime: "",
                                            active_days: days
                                        }))
                                    }
                                >
                                    Reset
                                </Button>
                            </Box>

                            <Typography variant="caption" color="text.secondary">
                                Run campaign between specific start and end dates
                            </Typography>

                            <Grid container spacing={3} mt={0.5} mb={3}>
                                <Grid item xs={4}>
                                    <TextField
                                        label="Start Date"
                                        type="date"
                                        fullWidth
                                        InputLabelProps={{ shrink: true }}
                                        value={form.start_datetime}
                                        inputProps={{
                                            min: today
                                        }}
                                        onChange={(e) =>
                                            setForm((prev: any) => ({
                                                ...prev,
                                                start_datetime: e.target.value,
                                            }))
                                        }
                                        error={!!errors.start_datetime}
                                        helperText={errors.start_datetime}
                                    />
                                </Grid>

                                <Grid item xs={4}>
                                    <TextField
                                        label="End Date"
                                        type="date"
                                        fullWidth
                                        InputLabelProps={{ shrink: true }}
                                        value={form.end_datetime}
                                        inputProps={{
                                            min: today
                                        }}
                                        onChange={(e) =>
                                            setForm((prev: any) => ({
                                                ...prev,
                                                end_datetime: e.target.value,
                                            }))
                                        }
                                        error={!!errors.end_datetime}
                                        helperText={errors.end_datetime}
                                    />
                                </Grid>

                            </Grid>



                            {/* ACTIVE DAYS */}

                            <Typography fontWeight={600} mb={1}>
                                Active Days *
                            </Typography>

                            <Typography variant="caption" color="text.secondary">
                                Run campaign on selected days
                            </Typography>

                            <Box mt={1}>
                                <ToggleButtonGroup
                                    value={form.active_days}
                                    onChange={(event, newDays) =>
                                        setForm((prev: any) => ({
                                            ...prev,
                                            active_days: newDays,
                                        }))
                                    }
                                    sx={{
                                        width: "100%",
                                        display: "flex",
                                        gap: 1
                                    }}
                                >
                                    {days.map((day) => (
                                        <ToggleButton
                                            key={day}
                                            value={day}
                                            disabled={!validDays.includes(day)}
                                            color="primary"
                                            sx={{
                                                flex: 1,
                                                "&.Mui-selected": {
                                                    backgroundColor: "primary.main",
                                                    color: "white",
                                                    "&:hover": {
                                                        backgroundColor: "primary.dark"
                                                    }
                                                }
                                            }}
                                        >
                                            {day}
                                        </ToggleButton>
                                    ))}
                                </ToggleButtonGroup>
                                {errors.active_days && (
                                    <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
                                        {errors.active_days}
                                    </Alert>
                                )}
                            </Box>
                            <Box mt={4}>
                                <Divider sx={{ mb: 2 }} />

                                <Typography fontWeight={600} mb={1}>
                                    Call Time Window
                                </Typography>

                                <Typography variant="caption" color="text.secondary">
                                    Calls will be placed only during this time window
                                </Typography>

                                <Grid container spacing={3} mt={0.5}>

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
                                        />
                                    </Grid>

                                </Grid>

                            </Box>

                            <Box mt={3}>
                                {/* Date Range + Active Days */}
                                {form.start_datetime && form.end_datetime && form.active_days?.length > 0 && (
                                    <Alert severity="info" variant="outlined">
                                        Campaign will run from <b>{form.start_datetime}</b> to <b>{form.end_datetime}</b>
                                        <> on  <b>{form.active_days.join(", ")}</b> </>
                                        {form.call_start_time && form.call_end_time && (
                                            <> between <b>{form.call_start_time}</b> - <b>{form.call_end_time}</b></>
                                        )}
                                    </Alert>
                                )}

                                {/* Only Active Days */}
                                {form.active_days?.length > 0 && (!form.start_datetime || !form.end_datetime) && (
                                    <Alert severity="info" variant="outlined">
                                        Campaign will run every <b>{form.active_days.join(", ")}</b>
                                        {form.call_start_time && form.call_end_time && (
                                            <> between <b>{form.call_start_time}</b> - <b>{form.call_end_time}</b></>
                                        )}
                                    </Alert>
                                )}
                            </Box>

                        </Paper>
                    </Grid>

                </>
            )}

            {/* RETRY SETTINGS */}
            {/* <Grid item xs={12}>
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
            </Grid> */}
            {/* ... */}
            {/* <Grid item xs={6}>
                <Button onClick={prevStep}>Back</Button>
            </Grid>
            <Grid item xs={6} textAlign="right">
                <Button variant="contained" onClick={handleSave} disabled={loading}>
                    {mode === "edit" ? "Update Campaign" : "Save Campaign"}
                </Button>
            </Grid> */}
        </Grid>
    );
};


export default Schedule;