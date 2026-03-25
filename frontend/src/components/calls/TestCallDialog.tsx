import React, { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    Stack,
    Select,
    MenuItem,
    TextField,
    Avatar,
    Chip,
    InputAdornment,
    CircularProgress,
    Grid,
    Alert,
    IconButton
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import MicIcon from "@mui/icons-material/Mic";
import PhoneIcon from "@mui/icons-material/Phone";
import CallIcon from "@mui/icons-material/Call";
import PublicIcon from "@mui/icons-material/Public";
import { CallingAgent, callingAgentService } from "../../services/callingAgentService";
import { alpha, useTheme } from '@mui/material/styles';

interface Props {
    open: boolean;
    onClose: (response: any) => void;
    agent: CallingAgent | null;
}

export default function TestCallDialog({ open, onClose, agent }: Props) {
    if (!agent) return null;
    const theme = useTheme();
    const [callError, setCallError] = useState('');
    const [phoneError, setPhoneError] = useState("");
    const [countryCode, setCountryCode] = useState("+91");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [calling, setCalling] = useState(false);
    const [dynamicFields, setDynamicFields] = useState<string[]>([]);
    const [dynamicValues, setDynamicValues] = useState<Record<string, string>>({});

    useEffect(() => {
        setCallError('');
        setPhoneNumber('');
        if (agent?.greeting) {
            const fields = extractPlaceholders(agent.greeting);
            setDynamicFields(fields);

            // initialize values
            const initialValues: Record<string, string> = {};
            fields.forEach((field) => {
                initialValues[field] = "";
            });
            setDynamicValues(initialValues);
        }
    }, [agent, open]);

    const validatePhone = () => {
        if (!phoneNumber) {
            setPhoneError("Phone number is required");
            return false;
        }

        if (!/^[0-9]+$/.test(phoneNumber)) {
            setPhoneError("Only digits are allowed");
            return false;
        }

        if (countryCode === "+91" && phoneNumber.length !== 10) {
            setPhoneError("Enter valid 10 digit Indian number");
            return false;
        }

        if (countryCode === "+1" && phoneNumber.length !== 10) {
            setPhoneError("Enter valid 10 digit US number");
            return false;
        }

        if (countryCode === "+44" && phoneNumber.length < 10) {
            setPhoneError("Enter valid UK number");
            return false;
        }

        setPhoneError("");
        return true;
    };

    const handleStartCall = async () => {
        if (!validatePhone()) return;
        if (!agent.id) return;
        setCallError("");
        const fullNumber = `${countryCode}${phoneNumber}`;
        setCalling(true);
        // API CALL
        try {
            const payload = {
                phone_no: fullNumber,
                variables: dynamicValues
            };
            const response = await callingAgentService.testCall(agent.id, payload)

            if (response.success) {
                setTimeout(() => {
                    onClose(response);
                    setPhoneNumber("");
                }, 2000);
            }
            else {
                setCallError(response.message)
            }
        }
        catch (err: any) {
            setCallError("Failed to initiate the call. Please try again")
        }
        finally {
            setTimeout(() => {
                setCalling(false);
            }, 2000);
        }
    };

    const extractPlaceholders = (text: string) => {
        if (!text) return [];
        const matches = text.match(/{{(.*?)}}/g) || [];
        return matches.map((m) => m.replace(/[{}]/g, ""));
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>

            <DialogContent sx={{ pt: 4 }}>

                {/* Mic Animation Section */}
                <Box display="flex" flexDirection="column" alignItems="center" mb={3}>

                    <Box
                        sx={{
                            width: 110,
                            height: 110,
                            borderRadius: "50%",
                            background: "linear-gradient(135deg,#dbeafe,#e0e7ff)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: 4,
                            position: "relative"
                        }}
                    >
                        {calling ? (
                            <CircularProgress size={60} />
                        ) : (
                            <MicIcon sx={{ fontSize: 50, color: "#2563eb" }} />
                        )}
                    </Box>

                    <Typography mt={2} fontWeight={700} variant="h6">
                        Test AI Agent Call
                    </Typography>

                    <Typography variant="body2" color="text.secondary">
                        Connect with your AI voice agent instantly
                    </Typography>
                    {callError && (
                        <Stack
                            mt={2}
                            sx={{ width: "100%" }}
                        >
                            <Alert
                                severity="error"
                                sx={{
                                    borderRadius: "14px",
                                    boxShadow: `0 10px 18px ${alpha(theme.palette.error.dark, 0.12)}`,
                                    width: '100%'
                                }}
                                action={
                                    <IconButton
                                        aria-label="close"
                                        color="inherit"
                                        size="small"
                                        onClick={() => setCallError("")} // clears the error
                                    >
                                        <CloseIcon fontSize="inherit" />
                                    </IconButton>
                                }
                            >
                                {callError}
                            </Alert>
                        </Stack>
                    )
                    }

                </Box>

                {/* Agent Info */}
                <Grid container spacing={2} mb={3}>

                    {/* Agent Info */}
                    <Grid item xs={12} md={6}>
                        <Box
                            sx={{
                                p: 2,
                                borderRadius: 2,
                                border: "1px solid #e0e0e0",
                                background: "#fafafa",
                                height: "100%"
                            }}
                        >
                            <Stack direction="row" spacing={2} alignItems="center">
                                <Avatar
                                    sx={{
                                        bgcolor: "primary.main",
                                        color: "primary",
                                        width: 40,
                                        height: 40
                                    }}
                                >
                                    {agent?.name?.charAt(0)}
                                </Avatar>

                                <Box>
                                    <Typography fontWeight={600}>
                                        {agent?.name}
                                    </Typography>

                                    <Chip
                                        size="small"
                                        icon={<PublicIcon />}
                                        label={
                                            agent?.server_location === "IN"
                                                ? "India Server"
                                                : "US Server"
                                        }
                                        variant="outlined"
                                        sx={{ mt: 0.5 }}
                                    />
                                </Box>
                            </Stack>
                        </Box>
                    </Grid>

                    {/* Call From */}
                    <Grid item xs={12} md={6}>
                        <Box
                            sx={{
                                p: 2,
                                borderRadius: 2,
                                border: "1px solid #e0e0e0",
                                background: "#fafafa",
                                height: "100%"
                            }}
                        >
                            <Typography variant="caption" color="text.secondary">
                                Call From Number
                            </Typography>

                            <Stack direction="row" spacing={2} alignItems="center" mt={1}>
                                <Avatar sx={{ bgcolor: "#e3f2fd" }}>
                                    <PhoneIcon color="primary" />
                                </Avatar>

                                <Box>
                                    <Typography fontWeight={600}>
                                        {agent?.calling_no || "Not Assigned"}
                                    </Typography>

                                    <Typography variant="caption" color="text.secondary">
                                        Outgoing call number
                                    </Typography>
                                </Box>
                            </Stack>
                        </Box>
                    </Grid>

                </Grid>

                {/* Phone Input */}
                <Typography fontWeight={600} mb={1}>
                    Phone number to call *
                </Typography>

                <Stack direction="row" spacing={1} alignItems="flex-start">

                    <Select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        sx={{ width: 120, height: 56 }}
                    >
                        <MenuItem value="+91">🇮🇳 +91</MenuItem>
                        <MenuItem value="+1">🇺🇸 +1</MenuItem>
                        <MenuItem value="+44">🇬🇧 +44</MenuItem>
                    </Select>

                    <TextField
                        fullWidth
                        placeholder="Enter phone number"
                        value={phoneNumber}
                        onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, "");
                            setPhoneNumber(value);
                            setPhoneError("");
                        }}
                        error={!!phoneError}
                        helperText={phoneError || " "} // 👈 THIS IS THE KEY
                        FormHelperTextProps={{
                            sx: {
                                minHeight: 20 // 👈 reserves space always
                            }
                        }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <PhoneIcon fontSize="small" />
                                </InputAdornment>
                            )
                        }}
                    />
                </Stack>

                <Typography variant="caption" color="text.secondary" mt={1} display="block">
                    Enter the destination phone number you want the AI agent to call
                </Typography>

                {dynamicFields.length > 0 && (
                    <>
                        <Typography fontWeight={600} mt={2} mb={1}>
                            Additional Details
                        </Typography>

                        <Stack spacing={2}>
                            {dynamicFields.map((field) => (
                                <TextField
                                    key={field}
                                    fullWidth
                                    label={field.charAt(0).toUpperCase() + field.slice(1)}
                                    value={dynamicValues[field] || ""}
                                    onChange={(e) =>
                                        setDynamicValues((prev) => ({
                                            ...prev,
                                            [field]: e.target.value
                                        }))
                                    }
                                />
                            ))}
                        </Stack>
                    </>
                )}


            </DialogContent>

            <DialogActions sx={{ p: 2 }}>

                <Button
                    variant="outlined"
                    onClick={onClose}
                    disabled={calling}
                >
                    Cancel
                </Button>

                <Button
                    variant="contained"
                    startIcon={<CallIcon />}
                    disabled={!phoneNumber || calling}
                    onClick={handleStartCall}
                >
                    {calling ? "Calling..." : "Start Test Call"}
                </Button>

            </DialogActions>

        </Dialog>
    );
}