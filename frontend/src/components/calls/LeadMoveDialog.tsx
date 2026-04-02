import React, { useEffect, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Alert, TextField, MenuItem } from "@mui/material";
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import BarChartIcon from '@mui/icons-material/BarChart';
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

interface MoveLeadDialogProps {
    open: boolean;
    onClose: () => void;
    leadRow: any;
    onActionSelected: (stage: string) => void;
}

export const MoveLeadDialog: React.FC<MoveLeadDialogProps> = ({ open, onClose, leadRow, onActionSelected }) => {
    const [view, setView] = useState<"default" | "ai" | "manual">("default");
    const [selectedStage, setSelectedStage] = useState("lead_qualification");

    useEffect(() => {
        setView("default");
    }, [open])

    const handleLeadAction = (action: "ai" | "manual") => {
        setView(action);
    };

    const handleBack = () => {
        setView("default");
    };

    const handleConfirm = () => {
        const stage =
            view === "ai"
                ? "lead_qualification" // AI recommended stage
                : selectedStage;

        onActionSelected(stage); // your API call
        console.log("Move to stage:", stage);
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle sx={{ borderBottom: "1px solid #e0e0e0", pb: 1 }}>
                Move to Sales Funnel
            </DialogTitle>

            <DialogContent>

                {/* Lead Info */}
                <Box display="flex" alignItems="center" gap={2} mb={3}>
                    <Box
                        sx={{
                            width: 50,
                            height: 50,
                            borderRadius: 2,
                            bgcolor: "primary.main",
                            color: "white",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 600,
                            fontSize: 18,
                        }}
                    >
                        {leadRow?.contact?.charAt(0) || leadRow?.phone?.slice(-1)}
                    </Box>

                    <Box>
                        <Typography fontWeight={600}>
                            {leadRow?.contact || "Unknown"}
                        </Typography>

                        <Typography variant="body2" color="text.secondary">
                            {leadRow?.phone || "No Phone"}
                        </Typography>

                        <Typography variant="body2" color="text.secondary" mt={0.5}>
                            Lead Status: <strong>{leadRow?.lead_qualified_status}</strong>
                        </Typography>
                    </Box>
                </Box>

                {/* DEFAULT VIEW */}
                {view === "default" && (
                    <>
                        <Typography mb={1} fontWeight={600}>
                            How would you like to move this lead?
                        </Typography>

                        <Box display="flex" flexDirection="column" gap={2}>
                            <Button
                                fullWidth
                                startIcon={<AutoAwesomeIcon />}
                                sx={{
                                    bgcolor: "primary.main",
                                    color: "white",
                                    py: 1.5,
                                    fontWeight: 600,
                                    "&:hover": {
                                        bgcolor: "primary.dark",
                                    },
                                }}
                                onClick={() => handleLeadAction("ai")}
                            >
                                Let AI Decide
                            </Button>

                            <Button
                                fullWidth
                                startIcon={<BarChartIcon />}
                                variant="outlined"
                                sx={{ py: 1.5, fontWeight: 600 }}
                                onClick={() => handleLeadAction("manual")}
                            >
                                Move Manually
                            </Button>
                        </Box>
                    </>
                )}

                {/* AI VIEW */}
                {view === "ai" && (
                    <Box>

                        <Box display="flex" alignItems="center" gap={1} mb={2}>
                            <AutoAwesomeIcon color="primary" />
                            <Typography fontWeight={600}>
                                AI Recommendation
                            </Typography>
                        </Box>

                        <Box
                            sx={{
                                p: 2,
                                borderRadius: 2,
                                bgcolor: "primary.50",
                                border: "1px solid",
                                borderColor: "primary.200",
                                mb: 2
                            }}
                        >
                            <Typography variant="body2" mb={1}>
                                Based on call analysis, this lead will be moved to:
                            </Typography>

                            <Box display="flex" alignItems="center" gap={1}>
                                <CheckCircleIcon color="primary" />
                                <Typography fontWeight={700}>
                                    Lead Qualification
                                </Typography>
                            </Box>
                        </Box>

                        <Button
                            startIcon={<ArrowBackIcon />}
                            onClick={handleBack}
                            size="small"
                        >
                            Choose different method
                        </Button>

                    </Box>
                )}

                {/* MANUAL VIEW */}
                {view === "manual" && (
                    <Box>

                        <Box
                            display="flex"
                            alignItems="center"
                            justifyContent="space-between"
                            mb={2}
                        >
                            <Typography fontWeight={600}>
                                Select Funnel Stage
                            </Typography>

                            <Button
                                startIcon={<ArrowBackIcon />}
                                size="small"
                                onClick={handleBack}
                            >
                                Back
                            </Button>
                        </Box>

                        <TextField
                            select
                            fullWidth
                            size="small"
                            value={selectedStage}
                            onChange={(e) => setSelectedStage(e.target.value)}
                            sx={{ mb: 2 }}
                        >
                            <MenuItem value="lead_qualification">
                                Lead Qualification
                            </MenuItem>
                            <MenuItem value="initial_contact">
                                Initial Contact
                            </MenuItem>
                            <MenuItem value="needs_analysis">
                                Needs Analysis
                            </MenuItem>
                            <MenuItem value="proposal">
                                Proposal
                            </MenuItem>
                            <MenuItem value="negotiation">
                                Negotiation
                            </MenuItem>
                            <MenuItem value="closed_won">
                                Closed Won
                            </MenuItem>
                            <MenuItem value="closed_lost">
                                Closed Lost
                            </MenuItem>
                        </TextField>

                        <Alert severity="warning" icon={<WarningAmberIcon />}>
                            AI recommends: <strong>Lead Qualification</strong>
                        </Alert>

                    </Box>
                )}

            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2 }}>



                <Button onClick={onClose} color="error" variant="outlined">
                    Cancel
                </Button>
                {view !== "default" && (
                    <Button
                        variant="contained"
                        onClick={handleConfirm}
                        color="primary"
                    >
                        Confirm Move
                    </Button>
                )}

            </DialogActions>
        </Dialog>
    );
};