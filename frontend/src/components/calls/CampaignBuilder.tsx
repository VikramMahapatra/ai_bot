import { useEffect, useState } from "react";
import {
    Box,
    Paper,
    Typography,
    Stepper,
    Step,
    StepLabel,
    Button,
    Stack,
    Alert,
    IconButton,
    LinearProgress
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { alpha, useTheme } from '@mui/material/styles';

import CampaignInfo from "./CampaignInfo";
import Contacts from "./Contacts";
import Schedule from "./Schedule";
import CampaignList from "./CampaignList";
import { CallCampaign, callCampaignService, Contact } from "../../services/callCampaignService";
import CampaignDetails from "./CampaignDetails";

const steps = [
    "Campaign Info",
    "Contacts",
    "Schedule"
];

const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const emptyCampaignForm: CallCampaign = {
    // CAMPAIGN INFO
    name: "",
    description: "",
    category: "",
    priority: "",
    agent_id: "",
    contacts: [],
    start_datetime: "",
    timezone: browserTimezone,
    call_start_time: "09:00",
    call_end_time: "21:00",
    call_interval: 5,
    active_days: [],

    max_retry_attempts: "",
    retry_interval: "",

    retry_on_no_answer: false,
    retry_on_busy: false,
    retry_on_voicemail: false
};

const CampaignBuilder = () => {
    const [view, setView] = useState<"list" | "form" | "details">("list");
    const [mode, setMode] = useState<"create" | "edit">("create");
    const [campaignId, setCampaignId] = useState<number | null>(null);
    const [activeStep, setActiveStep] = useState(0);
    const [campaignContacts, setCampaignContacts] = useState<Contact[]>([]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const theme = useTheme();
    const nextStep = () => setActiveStep((prev) => prev + 1);
    const prevStep = () => setActiveStep((prev) => prev - 1);
    const [campaignForm, setCampaignForm] = useState<CallCampaign>(emptyCampaignForm);

    const showError = (message: string) => {
        setSuccess('');
        setError(message);

    };

    const showSuccess = (message: string) => {
        setError('');
        setSuccess(message);
    };


    const handleAddCampaign = () => {
        setView("form");
        setError('');
        setSuccess('');
        setCampaignId(null);
        setCampaignForm(emptyCampaignForm);
        setCampaignContacts([]);
        setActiveStep(0);
    };

    const handleEditCampaign = async (id?: number) => {
        if (id === undefined) return;
        setError('');
        setSuccess('');
        setActiveStep(0);
        window.scrollTo({ top: 0, behavior: "smooth" });

        try {
            const data = await callCampaignService.getCampaign(id);
            setCampaignForm({
                name: data.name,
                description: data.description,
                category: data.category,
                priority: data.priority,
                agent_id: data.agent_id,

                contacts: data.contacts || [],

                start_datetime: data.start_datetime,
                timezone: data.timezone,

                call_start_time: data.call_start_time,
                call_end_time: data.call_end_time,
                call_interval: data.call_interval,

                active_days: data.active_days || [],

                max_retry_attempts: data.max_retry_attempts,
                retry_interval: data.retry_interval,

                retry_on_no_answer: data.retry_on_no_answer,
                retry_on_busy: data.retry_on_busy,
                retry_on_voicemail: data.retry_on_voicemail
            });

            if (data.contacts && data.contacts.length > 0) {
                const contactsData = await callCampaignService.getContactByIds(data.contacts);
                setCampaignContacts(contactsData);
            } else {
                setCampaignContacts([]);
            }

            setCampaignId(id);
            setMode("edit");
            setView("form");
        }
        catch (err) {
            console.log(err)
        }
    };

    useEffect(() => {
        if (loading) {
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    }, [loading]);

    const handleSaveCampaign = async () => {
        setError('');
        setSuccess('');
        setLoading(true);
        try {

            if (mode == "edit" && campaignId) {
                await callCampaignService.updateCampaign(campaignForm, campaignId);
            }
            else {
                await callCampaignService.createCampaign(campaignForm);
            }
            showSuccess("Campaign saved successfully")
            setView("list");
        }
        catch (err: any) {
            showError(err?.response?.data?.detail || err?.detail || 'Failed to save the campaign data');
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
        finally {
            setLoading(false);
        }
    };

    const handleDeleteCampaign = async () => {
        setError('');
        setSuccess('');
        setLoading(true);
        try {
            await callCampaignService.createCampaign(campaignForm);
            showSuccess("Campaign delete successfully")
            setView("list");
        }
        catch (err: any) {
            showError(err?.response?.data?.detail || 'Failed to save the campaign data');
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
        finally {
            setLoading(false);
        }
    };

    const handleBackToList = () => {
        setView("list");
        setCampaignId(null);
        setCampaignForm(emptyCampaignForm);
        setCampaignContacts([]);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleViewCampaign = (id?: number) => {
        if (id === undefined) return;
        setCampaignId(id);
        setView("details");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const renderStep = () => {
        switch (activeStep) {
            case 0:
                return (
                    <CampaignInfo
                        form={campaignForm}
                        setForm={setCampaignForm}
                        nextStep={nextStep}
                    />
                );

            case 1:
                return (
                    <Contacts
                        form={campaignForm}
                        setForm={setCampaignForm}
                        campaignContacts={campaignContacts}
                        setCampaignContacts={setCampaignContacts}
                        nextStep={nextStep}
                        prevStep={prevStep}
                    />
                );

            case 2:
                return (
                    <Schedule
                        mode={mode}
                        form={campaignForm}
                        setForm={setCampaignForm}
                        prevStep={prevStep}
                        saveCampaign={handleSaveCampaign}
                        loading={loading}
                    />
                );
            default:
                return null;
        }
    };

    if (view === "list") {
        return (
            <CampaignList
                onAddCampaign={handleAddCampaign}
                onEditCampaign={handleEditCampaign}
                onViewCampaign={handleViewCampaign}
                onDeleteCampaign={handleViewCampaign}
            />
        );
    }

    if (view === "details" && campaignId) {
        return (
            <CampaignDetails
                campaignId={campaignId}
                onBack={handleBackToList}
                onEdit={(id) => {
                    handleEditCampaign(id);
                    setView("form");
                }}
            />
        );
    }

    return (
        <>
            {loading && (
                <Box mb={3}>
                    <LinearProgress sx={{ borderRadius: 1.2 }} />
                </Box>
            )}
            {(error || success) && (
                <Stack
                    mb={2}
                >
                    {error && (
                        <Alert
                            severity="error"
                            sx={{
                                borderRadius: "14px",
                                boxShadow: `0 10px 18px ${alpha(theme.palette.error.dark, 0.12)}`,
                            }}
                            action={
                                <IconButton
                                    aria-label="close"
                                    color="inherit"
                                    size="small"
                                    onClick={() => setError("")} // clears the error
                                >
                                    <CloseIcon fontSize="inherit" />
                                </IconButton>
                            }
                        >
                            {error}
                        </Alert>
                    )}
                    {success && (
                        <Alert
                            severity="success"
                            sx={{ borderRadius: '14px', boxShadow: `0 10px 18px ${alpha(theme.palette.success.dark, 0.12)}` }}
                            action={
                                <IconButton
                                    aria-label="close"
                                    color="inherit"
                                    size="small"
                                    onClick={() => setSuccess("")} // clears the error
                                >
                                    <CloseIcon fontSize="inherit" />
                                </IconButton>
                            }
                        >
                            {success}
                        </Alert>
                    )}
                </Stack>
            )}
            <Paper sx={{ p: 4 }}>
                <Box display="flex" justifyContent="space-between" mb={2}>
                    <Typography variant="h5">
                        {mode === "edit" ? "Edit Campaign" : "Create Campaign"}
                    </Typography>

                    <Box display="flex" justifyContent="flex-end" >
                        <Button variant="outlined" color="error" onClick={handleBackToList}>
                            Cancel
                        </Button>
                    </Box>
                </Box>


                <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                    {steps.map((label) => (
                        <Step key={label}>
                            <StepLabel>{label}</StepLabel>
                        </Step>
                    ))}
                </Stepper>

                <Box>
                    {renderStep()}
                </Box>
            </Paper>
        </>
    );
};

export default CampaignBuilder;