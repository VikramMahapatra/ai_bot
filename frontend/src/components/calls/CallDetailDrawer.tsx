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
    Tooltip
} from '@mui/material';

import CloseIcon from '@mui/icons-material/Close';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PersonIcon from '@mui/icons-material/Person';
import BusinessIcon from '@mui/icons-material/Business';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DescriptionIcon from '@mui/icons-material/Description';

interface CallDetailDrawerProps {
    selectedCall: any;
    onClose: () => void;
}

const CallDetailDrawer: React.FC<CallDetailDrawerProps> = ({ selectedCall, onClose }) => {
    if (!selectedCall) return null;

    return (
        <Drawer
            anchor="right"
            transitionDuration={300}
            BackdropProps={{
                sx: { backgroundColor: 'rgba(0,0,0,0.5)' }, // subtle fade overlay
            }}
            open={!!selectedCall}
            onClose={onClose}
            PaperProps={{
                sx: {
                    width: { xs: '100%', md: 700 },
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
                                <AccessTimeIcon fontSize="small" />
                                <Typography variant="body2">Start: {selectedCall.startTime
                                    ? new Date(selectedCall.startTime).toLocaleString()
                                    : "-"}</Typography>
                            </Box>
                            <Box display="flex" alignItems="center" gap={1}>
                                <AccessTimeIcon fontSize="small" />
                                <Typography variant="body2">End: {selectedCall.endTime
                                    ? new Date(selectedCall.endTime).toLocaleString()
                                    : "-"}</Typography>
                            </Box>
                            <Box display="flex" alignItems="center" gap={1}>
                                <PersonIcon fontSize="small" />
                                <Typography variant="body2">Agent: {selectedCall.agent || "N/A"}</Typography>
                            </Box>
                            <Box display="flex" alignItems="center" gap={1}>
                                <PersonIcon fontSize="small" />
                                <Typography variant="body2">Contact: {selectedCall.contact || "N/A"}</Typography>
                            </Box>
                            <Box display="flex" alignItems="center" gap={1}>
                                <BusinessIcon fontSize="small" />
                                <Typography variant="body2">Industry: {selectedCall.industry || "N/A"}</Typography>
                            </Box>
                        </Stack>
                    </Stack>
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
                            maxHeight: 400,
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
                        {selectedCall.transcript.map((msg: any, index: number) => (
                            <Box
                                key={index}
                                display="flex"
                                justifyContent={msg.speaker === 'Agent' ? 'flex-start' : 'flex-end'}
                            >
                                <Box
                                    sx={{
                                        backgroundColor: msg.speaker === 'Agent' ? 'primary.main' : 'secondary.main',
                                        color: 'white',
                                        p: 1.5,
                                        pr: 2.5, // extra right padding so timestamp has space
                                        pb: 3,   // extra bottom padding so timestamp doesn't touch text
                                        borderRadius: 2,
                                        boxShadow: 1,
                                        maxWidth: '75%',
                                        position: 'relative',
                                    }}
                                >
                                    <Typography variant="body2">{msg.text}</Typography>
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            position: 'absolute',
                                            bottom: 4, // move a little higher
                                            right: 8,
                                            color: 'rgba(255,255,255,0.7)',
                                        }}
                                    >
                                        {msg.timestamp || '10:25 AM'}
                                    </Typography>
                                </Box>
                            </Box>
                        ))}
                    </Box>
                </Grid>
            </Grid>
        </Drawer>
    );
};

export default CallDetailDrawer;