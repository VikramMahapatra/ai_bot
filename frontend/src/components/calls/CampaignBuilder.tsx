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
    LinearProgress,
    Grid
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { alpha, useTheme } from '@mui/material/styles';

import CampaignInfo from "./CampaignInfo";
import Contacts from "./Contacts";
import Schedule from "./Schedule";
import CampaignList from "./CampaignList";
import { CallCampaign, callCampaignService, Contact } from "../../services/callCampaignService";
import CampaignDetails from "./CampaignDetails";
import moment from "moment-timezone";


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
    calling_no: "",
    agent_id: "",
    product_id: "",
    contacts: [],
    start_datetime: "",
    end_datetime: "",
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


    const [campaignForm, setCampaignForm] = useState<CallCampaign>(emptyCampaignForm);
    const [errors, setErrors] = useState<any>({});
    const [sendOption, setSendOption] = useState<"now" | "schedule">("schedule");

    const nextStep = () => {
        setActiveStep((prev) => prev + 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };
    const prevStep = () => {
        setActiveStep((prev) => prev - 1);
        window.scrollTo({ top: 0, behavior: "smooth" });

    };
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
        setSendOption("schedule");
        setMode("create");
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
                product_id: data.product_id,
                contacts: data.contacts || [],
                calling_no: data.calling_no,

                start_datetime: data.start_datetime,
                end_datetime: data.end_datetime,
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
            setSendOption(data.start_datetime ? "schedule" : "now")
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

            const payload = {
                ...campaignForm,
                product_id: campaignForm.product_id || undefined
            };

            if (mode == "edit" && campaignId) {
                await callCampaignService.updateCampaign(payload, campaignId);
            }
            else {
                await callCampaignService.createCampaign(payload);
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

    const handleSave = () => {
        const newErrors: any = {};

        if (sendOption === "schedule" && !campaignForm.start_datetime) {
            newErrors.start_datetime = "Start date & time is required";
        }

        if (sendOption === "schedule" && !campaignForm.end_datetime) {
            newErrors.end_datetime = "End date & time is required";
        }

        if (sendOption === "schedule" && !campaignForm.timezone) {
            newErrors.timezone = "Timezone is required";
        }

        if (
            sendOption === "schedule" &&
            campaignForm.call_start_time &&
            campaignForm.call_end_time &&
            campaignForm.call_start_time >= campaignForm.call_end_time
        ) {
            newErrors.call_end_time = "End time must be after start time";
        }

        if (sendOption === "now") {
            const now = moment(); // current time
            const currentHour = now.hour(); // 0–23

            if (currentHour < 9 || currentHour >= 21) {
                newErrors.send_now = "Calls can only be sent between 9:00 AM and 9:00 PM";
            }
        }

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) return;

        handleSaveCampaign();
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
                        form={campaignForm}
                        setForm={setCampaignForm}
                        sendOption={sendOption}
                        setSendOption={setSendOption}
                        errors={errors}
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
                        {activeStep == 2 &&
                            <Grid item xs={6} textAlign="right">
                                <Button variant="contained" onClick={handleSave} sx={{ ml: 1 }} disabled={loading}>
                                    {mode === "edit" ? "Update" : "Add"}
                                </Button>
                            </Grid>
                        }
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
                {activeStep == 2 &&
                    <Grid container alignItems="center" mt={2}>
                        <Grid item xs={6}>
                            <Button onClick={prevStep}>Back</Button>
                        </Grid>

                        <Grid item xs={6}>
                            <Box display="flex" justifyContent="flex-end" gap={1}>
                                <Button
                                    variant="outlined"
                                    color="error"
                                    onClick={handleBackToList}
                                >
                                    Cancel
                                </Button>

                                <Button
                                    variant="contained"
                                    onClick={handleSave}
                                    disabled={loading}
                                >
                                    {mode === "edit" ? "Update" : "Add"}
                                </Button>
                            </Box>
                        </Grid>
                    </Grid>
                }

            </Paper>
        </>
    );
};

export default CampaignBuilder;