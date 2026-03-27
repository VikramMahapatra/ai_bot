import { useEffect, useState } from "react";
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
    Alert
} from "@mui/material";
import { Send, CalendarToday } from "@mui/icons-material";
import moment from "moment-timezone";

interface ScheduleProps {
    form: any;
    setForm: any;
    sendOption: "now" | "schedule";
    setSendOption: (value: "now" | "schedule") => void;
    errors: any;
}

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const Schedule = ({
    form,
    setForm,
    sendOption,
    setSendOption,
    errors
}: ScheduleProps) => {

    const timezones = moment.tz.names().map((tz) => ({
        value: tz,
        label: `(GMT${moment.tz(tz).format("Z")}) ${tz}`
    }));

    return (
        <Grid container spacing={3}>
            {/* SEND OPTION TOGGLE */}
            <Grid item xs={12}>
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
                    {errors.send_now && (
                        <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
                            {errors.send_now}
                        </Alert>
                    )}
                </Paper>
            </Grid>

            {/* CAMPAIGN START */}
            {sendOption === "schedule" && (
                <>
                    <Grid item xs={12}>
                        <Paper sx={{ p: 3 }}>
                            <Typography variant="h6" mb={2}>
                                Campaign Start
                            </Typography>
                            <Grid container spacing={3}>
                                <Grid item xs={4}>
                                    <TextField
                                        required
                                        label="Start Date"
                                        type="date"
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

                                {/* End Date  */}
                                <Grid item xs={4}>
                                    <TextField
                                        required
                                        label="End Date"
                                        type="date"
                                        fullWidth
                                        InputLabelProps={{ shrink: true }}
                                        name="end_datetime"
                                        value={form.end_datetime || ""}
                                        onChange={(e) =>
                                            setForm({ ...form, end_datetime: e.target.value })
                                        }
                                        error={!!errors.end_datetime}
                                        helperText={errors.end_datetime}
                                    />
                                </Grid>
                                <Grid item xs={4}>
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