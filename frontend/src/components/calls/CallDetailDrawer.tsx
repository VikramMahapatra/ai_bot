import React from 'react';
import {
    Drawer,
    Slide,
    Box,
    Grid,
    Typography,
    IconButton,
    Stack,
    Button,
    Tooltip,
    Avatar,
    Chip,
    Divider
} from '@mui/material';
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import CloseIcon from '@mui/icons-material/Close';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PersonIcon from '@mui/icons-material/Person';
import BusinessIcon from '@mui/icons-material/Business';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DescriptionIcon from '@mui/icons-material/Description';
import TimerIcon from "@mui/icons-material/Timer";
import CallEndIcon from "@mui/icons-material/CallEnd";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import CampaignIcon from "@mui/icons-material/Campaign";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import BugReportIcon from "@mui/icons-material/BugReport";
import SentimentSatisfiedAltIcon from "@mui/icons-material/SentimentSatisfiedAlt";
import CallMadeIcon from '@mui/icons-material/CallMade';
import CallReceivedIcon from '@mui/icons-material/CallReceived';
import LeadIcon from "@mui/icons-material/HowToReg";
import SentimentDissatisfiedIcon from "@mui/icons-material/SentimentDissatisfied";
import SentimentNeutralIcon from "@mui/icons-material/SentimentNeutral";
import SentimentVerySatisfiedIcon from "@mui/icons-material/SentimentVerySatisfied";
import SentimentVeryDissatisfiedIcon from "@mui/icons-material/SentimentVeryDissatisfied";
import MessageIcon from "@mui/icons-material/Message";
import SmsIcon from "@mui/icons-material/Sms";
import EmailIcon from "@mui/icons-material/Email";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import ScheduleIcon from "@mui/icons-material/Schedule";
import InfoIcon from "@mui/icons-material/Info";
import { useDateFormatter } from '../../hooks/useDateFormatter';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';


const sentimentConfig: Record<
    string,
    { color: "success" | "error" | "warning" | "info" | "text.primary"; icon: JSX.Element }
> = {
    positive: { color: "success", icon: <SentimentVerySatisfiedIcon /> },
    negative: { color: "error", icon: <SentimentVeryDissatisfiedIcon /> },
    neutral: { color: "warning", icon: <SentimentNeutralIcon /> },
    satisfactory: { color: "info", icon: <SentimentSatisfiedAltIcon /> },
    unresolved: { color: "error", icon: <SentimentDissatisfiedIcon /> },
};



interface CallDetailDrawerProps {
    open: boolean;
    onClose: () => void;
    selectedCall: any;
}


const titleCase = (value: string) =>
    value
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");

export const formatEndedReason = (reason?: string) => {
    if (!reason) return "-";

    // Handle problematic long reasons
    if (reason.includes("failed-to-connect")) {
        return "Failed to Connect";
    }

    if (reason.includes("temporarily-unavailable")) {
        return "Temporarily Unavailable";
    }

    // Default: clean normal ones
    return reason
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()); // capitalize
};

const getTypeIcon = (type: string) => type === 'Outbound' ? <CallMadeIcon fontSize="small" color='primary' /> : <CallReceivedIcon fontSize="small" color='primary' />;

const CallDetailDrawer: React.FC<CallDetailDrawerProps> = ({ open, selectedCall, onClose }) => {
    if (!selectedCall) return null;

    const formatDisplayDate = useDateFormatter();

    const sentiment = selectedCall?.sentiment?.toLowerCase();
    const config = sentimentConfig[sentiment] || {
        color: "text.primary",
        icon: <SentimentNeutralIcon />,
    };

    const getSourceIcon = (source?: string) => {
        switch (source) {
            case "campaign_call":
                return <CampaignIcon fontSize="small" color="primary" />;
            case "rescheduled_call":
                return <ScheduleIcon fontSize="small" color="warning" />;
            case "test_call":
                return <BugReportIcon fontSize="small" color="error" />;
            default:
                return <InfoIcon fontSize="small" />;
        }
    };

    const getChannelIcon = (channel: string) => {
        switch (channel) {
            case "sms":
                return <SmsIcon fontSize="small" color="primary" />;
            case "email":
                return <EmailIcon fontSize="small" color="secondary" />;
            case "whatsapp":
                return <WhatsAppIcon fontSize="small" color="success" />;
            default:
                return <MessageIcon fontSize="small" />;
        }
    };

    const formatSource = (source?: string) => {
        if (!source) return "N/A";

        return source
            .replace(/_/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());
    };

    return (
        <Drawer
            anchor="right"
            transitionDuration={300}
            BackdropProps={{
                sx: { backgroundColor: 'rgba(0,0,0,0.5)' }, // subtle fade overlay
            }}
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: {
                    width: { xs: '100%', md: 850 },
                    p: 0,
                    display: 'flex',
                    flexDirection: 'column',
                },
            }}
        >
            {/* HEADER */}
            <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                px={3}
                py={2}
                sx={{ borderBottom: '1px solid #eee', backgroundColor: 'background.paper' }}
            >
                <Typography variant="h6" fontWeight={700}>
                    Phone No: {selectedCall.phone}
                </Typography>
                <IconButton onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </Box>

            {/* CONTENT */}
            <Grid container sx={{ flex: 1, overflow: 'hidden' }}>
                {/* LEFT PANEL: Metadata */}
                <Grid item xs={12} md={5} sx={{ p: 3, borderRight: '1px solid #eee', overflowY: 'auto' }}>
                    <Stack spacing={2}>
                        <Typography variant="subtitle2" color="text.secondary">
                            Call Details
                        </Typography>

                        <Stack spacing={1}>
                            <Box display="flex" alignItems="center" gap={1}>
                                <AccessTimeIcon fontSize="small" color="warning" />
                                <Typography variant="body2" color="text.secondary">
                                    Start:
                                </Typography>
                                <Typography variant="body2" fontWeight={600}>
                                    {selectedCall.startTime
                                        ? formatDisplayDate(selectedCall.startTime)
                                        : "-"}
                                </Typography>
                            </Box>

                            <Box display="flex" alignItems="center" gap={1}>
                                <AccessTimeIcon fontSize="small" color="warning" />
                                <Typography variant="body2" color="text.secondary">
                                    End:
                                </Typography>
                                <Typography variant="body2" fontWeight={600}>
                                    {selectedCall.endTime
                                        ? formatDisplayDate(selectedCall.endTime)
                                        : "-"}
                                </Typography>
                            </Box>
                            <Box display="flex" alignItems="center" gap={1}>
                                {getTypeIcon(selectedCall.type)}
                                <Typography variant="body2" color="text.secondary">
                                    Call type:
                                </Typography>
                                <Typography variant="body2" fontWeight={600}>
                                    {selectedCall.type}
                                </Typography>
                            </Box>
                            <Box display="flex" alignItems="center" gap={1}>
                                <SupportAgentIcon fontSize="small" color="secondary" />
                                <Typography variant="body2" color="text.secondary">
                                    Agent:
                                </Typography>
                                <Typography variant="body2" fontWeight={600}>
                                    {selectedCall.agent || "N/A"}
                                </Typography>
                            </Box>
                            <Box display="flex" alignItems="center" gap={1}>
                                <CampaignIcon fontSize="small" color="primary" />
                                <Typography variant="body2" color="text.secondary">
                                    Campaign:
                                </Typography>
                                <Typography variant="body2" fontWeight={600}>
                                    {selectedCall.campaign || "N/A"}
                                </Typography>
                            </Box>
                            <Box display="flex" alignItems="center" gap={1}>
                                <PersonIcon fontSize="small" color="primary" />
                                <Typography variant="body2" color="text.secondary">
                                    Contact:
                                </Typography>
                                <Typography variant="body2" fontWeight={600}>
                                    {selectedCall.contact || "N/A"}
                                </Typography>
                            </Box>
                            <Box display="flex" alignItems="center" gap={1}>
                                {config.icon}

                                <Typography variant="body2" color="text.secondary">
                                    Sentiment:
                                </Typography>

                                <Typography
                                    variant="body2"
                                    fontWeight={600}
                                    color={config.color}
                                >
                                    {titleCase(sentiment || "N/A")}
                                </Typography>
                            </Box>
                            <Box display="flex" alignItems="center" gap={1} mb={2}>
                                <LeadIcon
                                    fontSize="small"
                                    color={
                                        selectedCall?.lead_qualified_status === "positive"
                                            ? "success"
                                            : selectedCall?.lead_qualified_status === "negative"
                                                ? "error"
                                                : "disabled"
                                    }
                                />

                                <Typography variant="body2" color="text.secondary">
                                    Conversion Outcome:
                                </Typography>

                                <Typography
                                    variant="body2"
                                    fontWeight={600}
                                    color={
                                        selectedCall?.lead_qualified_status === "positive"
                                            ? "success"
                                            : selectedCall?.lead_qualified_status === "negative"
                                                ? "error"
                                                : "text.primary"
                                    }
                                >
                                    {selectedCall?.lead_qualified_status
                                        ? titleCase(selectedCall.lead_qualified_status)
                                        : "N/A"}
                                </Typography>
                            </Box>
                            <Box display="flex" alignItems="center" gap={1}>
                                {getSourceIcon(selectedCall.source)}

                                <Typography variant="body2" color="text.secondary">
                                    Source:
                                </Typography>

                                <Typography variant="body2" fontWeight={600}>
                                    {formatSource(selectedCall.source)}
                                </Typography>
                            </Box>
                            <Box display="flex" alignItems="center" gap={1}>
                                <TimerIcon fontSize="small" color="primary" />
                                <Typography variant="body2" color="text.secondary">
                                    Duration:
                                </Typography>
                                <Typography variant="body2" fontWeight={600}>
                                    {selectedCall.duration
                                        ? `${selectedCall.duration} sec`
                                        : "N/A"}
                                </Typography>
                            </Box>

                            <Box display="flex" alignItems="center" gap={1}>
                                <CallEndIcon fontSize="small" color="error" />
                                <Typography variant="body2" color="text.secondary">
                                    Ended Reason:
                                </Typography>
                                <Typography variant="body2" fontWeight={600} color="error.main">
                                    {formatEndedReason(selectedCall.ended_reason) || "N/A"}
                                </Typography>
                            </Box>
                        </Stack>
                    </Stack>
                    {selectedCall.instant_reply && (
                        <>
                            <Divider sx={{ my: 2 }} />

                            <Typography variant="subtitle2" color="text.secondary">
                                Instant Reply
                            </Typography>

                            <Box mt={1}>
                                <Typography variant="body2">
                                    Decision:{" "}
                                    <b>{titleCase(selectedCall.instant_reply.decision || "N/A")}</b>
                                </Typography>

                                <Typography variant="body2">
                                    Status:{" "}
                                    <b>{titleCase(selectedCall.instant_reply.status)}</b>
                                </Typography>

                                {selectedCall.instant_reply.channels?.map((ch: any, i: number) => (
                                    <Box key={i} display="flex" alignItems="center" gap={1} mt={1}>
                                        {getChannelIcon(ch.channel)}

                                        <Typography variant="body2">
                                            {titleCase(ch.channel)}:
                                        </Typography>

                                        <Typography
                                            variant="body2"
                                            fontWeight={600}
                                            color={ch.status === "success" ? "success.main" : "error.main"}
                                        >
                                            {titleCase(ch.status)}
                                        </Typography>

                                        {ch.error && (
                                            <Tooltip title={ch.error}>
                                                <ErrorOutlineIcon color="error" fontSize="small" />
                                            </Tooltip>
                                        )}
                                    </Box>
                                ))}
                            </Box>
                        </>
                    )}
                </Grid>

                {/* RIGHT PANEL: Audio + Transcript */}
                <Grid item xs={12} md={7} sx={{ p: 3, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {/* Action Buttons */}
                    <Box display="flex" gap={2}>
                        <Tooltip title={!selectedCall?.audioUrl ? "Recording not available" : ""}>
                            <span>
                                <Button
                                    variant="outlined"
                                    startIcon={<PlayArrowIcon />}
                                    disabled={!selectedCall?.audioUrl}
                                    onClick={() => {
                                        const link = document.createElement('a');
                                        link.href = selectedCall.audioUrl;
                                        link.download = `${selectedCall.id}.mp3`;
                                        link.click();
                                    }}
                                >
                                    Download Recording
                                </Button>
                            </span>
                        </Tooltip>

                        <Tooltip title={!selectedCall?.audioUrl ? "Recording not available" : ""}>
                            <span>
                                <Button
                                    variant="outlined"
                                    startIcon={<DescriptionIcon />}
                                    disabled={!selectedCall?.transcript || selectedCall.transcript.length === 0}
                                    onClick={() => {
                                        const text = selectedCall.transcript
                                            .map((msg: any) => `${msg.speaker}: ${msg.text}`)
                                            .join('\n');

                                        const blob = new Blob([text], { type: 'text/plain' });
                                        const link = document.createElement('a');
                                        link.href = URL.createObjectURL(blob);
                                        link.download = `${selectedCall.id}_transcript.txt`;
                                        link.click();
                                    }}
                                >
                                    Export Transcript
                                </Button>
                            </span>
                        </Tooltip>


                    </Box>
                    {/* Audio Player */}
                    <Box sx={{ border: '1px solid #eee', borderRadius: 2, p: 1 }}>
                        <audio controls style={{ width: '100%' }}>
                            <source src={selectedCall.audioUrl} type="audio/mpeg" />
                            Your browser does not support the audio element.
                        </audio>
                    </Box>

                    {/* Transcript */}
                    <Box
                        sx={{
                            flex: 1,
                            maxHeight: 450,
                            overflowY: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1,
                            p: 1
                        }}
                        ref={(el: HTMLDivElement | null) => {
                            if (el) el.scrollTop = el.scrollHeight;
                        }}
                    >
                        {selectedCall.transcript.map((msg: any, index: number) => {
                            const isAgent = msg.speaker === "Agent";

                            return (
                                <Box
                                    key={index}
                                    display="flex"
                                    justifyContent={isAgent ? "flex-start" : "flex-end"}
                                    alignItems="flex-end"
                                    gap={1}
                                >
                                    {/* Agent Avatar with Tooltip */}
                                    {isAgent && (
                                        <Tooltip title="AI Assistant" arrow placement="top">
                                            <Avatar sx={{ bgcolor: "primary.main", width: 32, height: 32 }}>
                                                <SmartToyIcon fontSize="small" />
                                            </Avatar>
                                        </Tooltip>
                                    )}

                                    {/* Message Bubble */}
                                    <Box
                                        sx={{
                                            backgroundColor: isAgent ? "primary.main" : "secondary.main",
                                            color: "white",
                                            p: 1.5,
                                            borderRadius: 2,
                                            boxShadow: 1,
                                            maxWidth: "75%",
                                        }}
                                    >
                                        <Typography variant="body2">{msg.text}</Typography>

                                        <Box display="flex" justifyContent="flex-end" mt={0.5}>
                                            <Typography
                                                variant="caption"
                                                sx={{ color: "rgba(255,255,255,0.7)" }}
                                            >
                                                {msg.timestamp || "10:25 AM"}
                                            </Typography>
                                        </Box>
                                    </Box>

                                    {/* User Avatar with Tooltip */}
                                    {!isAgent && (
                                        <Tooltip title="User" arrow placement="top">
                                            <Avatar sx={{ bgcolor: "secondary.main", width: 32, height: 32 }}>
                                                <PersonIcon fontSize="small" />
                                            </Avatar>
                                        </Tooltip>
                                    )}
                                </Box>
                            );
                        })}
                    </Box>
                </Grid>
            </Grid>
        </Drawer>
    );
};

export default CallDetailDrawer;