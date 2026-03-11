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
    Checkbox
} from "@mui/material";
import { useState } from "react";

interface ScheduleProps {
    prevStep: () => void;
}

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const Schedule = ({ prevStep }: ScheduleProps) => {

    const [activeDays, setActiveDays] = useState<string[]>([]);

    const handleDaysChange = (
        event: React.MouseEvent<HTMLElement>,
        newDays: string[]
    ) => {
        setActiveDays(newDays);
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
                                label="Start Date & Time"
                                type="datetime-local"
                                fullWidth
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>

                        <Grid item xs={6}>
                            <TextField
                                label="Call Timezone"
                                fullWidth
                                placeholder="Select Timezone"
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
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>

                        <Grid item xs={4}>
                            <TextField
                                label="Call End Time"
                                type="time"
                                fullWidth
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>

                        <Grid item xs={4}>
                            <TextField
                                label="Call Interval (Minutes)"
                                type="number"
                                fullWidth
                            />
                        </Grid>

                        {/* ACTIVE DAYS */}

                        <Grid item xs={12}>

                            <Typography mb={1}>
                                Active Days
                            </Typography>

                            <ToggleButtonGroup
                                value={activeDays}
                                onChange={handleDaysChange}
                                aria-label="active days"
                            >
                                {days.map((day) => (
                                    <ToggleButton
                                        key={day}
                                        value={day}
                                    >
                                        {day}
                                    </ToggleButton>
                                ))}
                            </ToggleButtonGroup>

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
                <Button variant="contained">
                    Save Campaign
                </Button>
            </Grid>

        </Grid>
    );
};

export default Schedule;