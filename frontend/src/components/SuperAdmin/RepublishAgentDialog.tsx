import React, { useState } from "react";
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    TextField,
    Typography,
} from "@mui/material";
import { SuperAdminOrganization } from "../../types";

export interface RepublishAgentDialogProps {
    open: boolean;
    onClose: () => void;
    organizations: SuperAdminOrganization[];
    onPublish: (payload: RepublishPayload) => Promise<void>;
    loading?: boolean;
}

export interface RepublishPayload {
    external_agent_name: string | null;
    organization_id: number | null;
}

export interface RepublishAgentResult {
    agent_id: number;
    external_agent_name: string;
    success: boolean;
    error?: string;
}

export interface RepublishAgentResponse {
    success: boolean;
    message: string;
    total: number;
    success_count: number;
    failed_count: number;
    results: RepublishAgentResult[];
}

export default function RepublishAgentDialog({
    open,
    onClose,
    organizations = [],
    onPublish,
    loading = false,
}: RepublishAgentDialogProps) {
    const [externalAgentName, setExternalAgentName] = useState("");
    const [selectedOrganization, setSelectedOrganization] = useState<SuperAdminOrganization | null>(null);
    const [showConfirmation, setShowConfirmation] = useState(false);


    const handlePublishClick = () => {
        if (!externalAgentName && !selectedOrganization) {
            return;
        }

        setShowConfirmation(true);
    };

    const handleConfirmPublish = async () => {
        await onPublish({
            external_agent_name: externalAgentName.trim() || null,
            organization_id: selectedOrganization?.id || null,
        });

        setShowConfirmation(false);

        setExternalAgentName("");
        setSelectedOrganization(null);

        onClose();
    };

    const handleClose = () => {
        if (loading) return;

        setExternalAgentName("");
        setSelectedOrganization(null);
        setShowConfirmation(false);

        onClose();
    };

    const canSubmit =
        externalAgentName.trim().length > 0 ||
        selectedOrganization !== null;

    return (
        <>
            <Dialog
                open={open}
                onClose={handleClose}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    Republish Agents
                </DialogTitle>

                <DialogContent>

                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 3 }}
                    >
                        Choose ONE of the following options:
                    </Typography>

                    <TextField
                        fullWidth
                        label="External Agent Name"
                        placeholder="e.g. support_agent_v2"
                        value={externalAgentName}
                        disabled={!!selectedOrganization}
                        onChange={(e) =>
                            setExternalAgentName(e.target.value)
                        }
                    />

                    <Typography
                        align="center"
                        color="text.secondary"
                        sx={{ my: 2 }}
                    >
                        OR
                    </Typography>

                    <Autocomplete
                        options={organizations}
                        value={selectedOrganization}
                        disabled={!!externalAgentName}
                        getOptionLabel={(option) =>
                            option.name || ""
                        }
                        onChange={(_, value) => {
                            setSelectedOrganization(value);
                            console.log(value)
                        }}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Organization"
                            />
                        )}
                    />

                    <Box mt={3}>
                        <Alert severity="info">
                            {externalAgentName
                                ? `Only the active agent with External Agent Name "${externalAgentName}" will be republished.`
                                : selectedOrganization
                                    ? `All active agents belonging to "${selectedOrganization.name}" will be republished.`
                                    : "Enter an External Agent Name or select an Organization."}
                        </Alert>
                    </Box>

                </DialogContent>

                <DialogActions>
                    <Button
                        onClick={handleClose}
                        disabled={loading}
                        color="error"
                    >
                        Cancel
                    </Button>

                    <Button
                        variant="contained"
                        color="primary"
                        disabled={!canSubmit || loading}
                        onClick={handlePublishClick}
                    >
                        Republish
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Confirmation Dialog */}
            <Dialog
                open={showConfirmation}
                onClose={() => setShowConfirmation(false)}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle>
                    Confirm Republish
                </DialogTitle>

                <DialogContent>

                    {externalAgentName ? (
                        <>
                            <Typography>
                                The following agent will be republished:
                            </Typography>

                            <Typography
                                fontWeight={700}
                                mt={2}
                            >
                                {externalAgentName}
                            </Typography>
                        </>
                    ) : (
                        <>
                            <Typography>
                                All agents for the following organization
                                will be republished:
                            </Typography>

                            <Typography
                                fontWeight={700}
                                mt={2}
                            >
                                {selectedOrganization?.organization_name}
                            </Typography>
                        </>
                    )}

                </DialogContent>

                <DialogActions>
                    <Button
                        onClick={() =>
                            setShowConfirmation(false)
                        }
                    >
                        Back
                    </Button>

                    <Button
                        variant="contained"
                        color="primary"
                        disabled={loading}
                        onClick={handleConfirmPublish}
                    >
                        Confirm
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}