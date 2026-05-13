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
import Schedule from "./Schedule";
import CampaignList from "./CampaignList";
import { CallCampaign, callCampaignService, Contact } from "../../services/callCampaignService";
import CampaignDetails from "./CampaignDetails";
import moment from "moment-timezone";
import CampaignContacts from "./CampaignContacts";
import { FEATURE_CODES, CREDIT_ERRORS } from "../../types/creditModules";
import { useCredits } from "../../context/CreditsContext";
import { chatService } from "../../services/chatService";


const steps = [
    "Campaign Info",
    "Contacts",
    "Schedule"
];

const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const timezoneAliasMap: any = {
    "Asia/Calcutta": "Asia/Kolkata",
    "US/Eastern": "America/New_York",
    "US/Central": "America/Chicago",
    "US/Mountain": "America/Denver",
    "US/Pacific": "America/Los_Angeles"
};

const normalizedTimezone =
    timezoneAliasMap[browserTimezone] || browserTimezone;

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
    timezone: normalizedTimezone,
    call_start_time: "09:00",
    call_end_time: "21:00",
    call_interval: 5,
    active_days: days,

    max_retry_attempts: "",
    retry_interval: "",

    retry_on_no_answer: false,
    retry_on_busy: false,
    retry_on_voicemail: false,

    instant_reply: false,
    instant_reply_modes: [],
    instant_reply_templates: {
        whatsapp: "",
        sms: "",
        email: ""
    },
    workflow_id: ""
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
    const { getRequiredCreditInfo, totalCredits, refreshCredits } = useCredits();

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

    const validateAddCampaignCredits = (setError: any) => {
        const credits = getRequiredCreditInfo(FEATURE_CODES.CORE_CALL_OUT_MINUTE);

        if (credits.minReservedCredits != null && totalCredits < credits.minReservedCredits) {
            setError(CREDIT_ERRORS.BELOW_MIN_RESERVED);
            return false;
        }

        return true;
    };

    const validateChannel = async () => {
        try {
          const res = await chatService.isChannelAvailable();
          return res;
        } catch (error) {
          console.error("Failed to channel validation service", error);
        }
      };

    const isChannelAvailable = async (setError: any) => {
        const isChannelAvailable = await validateChannel();
        if (!isChannelAvailable) {
            setError("Channel is not available for your organization. Please contact support for assistance.");
            return false;
        }
        return true;
      };

    const handleAddCampaign = (setListError: any) => {
        if (!isChannelAvailable(setListError)) {
            return;
        }

        if (!validateAddCampaignCredits(setListError))
            return;

        setView("form");
        setError('');
        setSuccess('');
        setCampaignId(null);
        setCampaignForm(emptyCampaignForm);
        setCampaignContacts([]);
        setErrors({});
        setActiveStep(0);
        setSendOption("schedule");
        setMode("create");
    };

    const handleEditCampaign = async (id?: number) => {
        if (id === undefined) return;
        setError('');
        setSuccess('');
        setErrors({});
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

                start_datetime: moment(data.start_datetime).format("YYYY-MM-DD"),
                end_datetime: moment(data.end_datetime).format("YYYY-MM-DD"),
                timezone: data.timezone,

                call_start_time: data.call_start_time,
                call_end_time: data.call_end_time,
                call_interval: data.call_interval,

                active_days: data.active_days || [],

                max_retry_attempts: data.max_retry_attempts,
                retry_interval: data.retry_interval,

                retry_on_no_answer: data.retry_on_no_answer,
                retry_on_busy: data.retry_on_busy,
                retry_on_voicemail: data.retry_on_voicemail,

                instant_reply: data.instant_reply,
                instant_reply_modes: data.instant_reply_modes,
                instant_reply_templates: data.instant_reply_templates,
                workflow_id: data.workflow_id || ""
            });

            if (data.contacts && data.contacts.length > 0) {
                const contactsData = await callCampaignService.getContactByIds(data.contacts);
                setCampaignContacts(contactsData);
            } else {
                setCampaignContacts([]);
            }
            setSendOption(!data.start_datetime && (!data.active_days || data.active_days.length === 0) ? "now" : "schedule")
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

    const validateCreateCampaignCredits = (contactsCount: number) => {
        const { creditsPerUnit, minReservedCredits } =
            getRequiredCreditInfo(FEATURE_CODES.CORE_CALL_OUT_ATTEMPT);

        // 1 contact = 1 call attempt
        const requiredCredits = contactsCount * creditsPerUnit;

        // Optional min reserved validation
        if (minReservedCredits && totalCredits < minReservedCredits) {
            showError(CREDIT_ERRORS.BELOW_MIN_RESERVED);
            return false;
        }

        // Required credits validation
        if (totalCredits < requiredCredits) {
            showError(CREDIT_ERRORS.INSUFFICIENT_CREDITS);
            return false;
        }

        return true;
    };

    const handleSaveCampaign = async () => {
        if (!validateCreateCampaignCredits(campaignForm.contacts.length))
            return;

        setError('');
        setSuccess('');
        setLoading(true);
        try {

            const cleanTemplates = (templates: any) => ({
                whatsapp: templates.whatsapp || null,
                sms: templates.sms || null,
                email: templates.email || null
            });

            const payload = {
                ...campaignForm,
                product_id: campaignForm.product_id || undefined,
                workflow_id: campaignForm.workflow_id || undefined,
                active_days: sendOption === "now" ? [] : campaignForm.active_days, // conditional
                start_datetime: formatDateForBackend(campaignForm.start_datetime),
                end_datetime: formatDateForBackend(campaignForm.end_datetime),
                instant_reply_templates: cleanTemplates(
                    campaignForm.instant_reply_templates || {}
                )
            };
            let response;

            if (mode == "edit" && campaignId) {
                response = await callCampaignService.updateCampaign(payload, campaignId);
            }
            else {
                response = await callCampaignService.createCampaign(payload);
            }

            if (response.success) {
                showSuccess(response.message || "Campaign saved successfully")
                refreshCredits();
            }
            else {
                showError(response.message || "Failed to save the campaign data")
            }
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

    const handleDeleteCampaign = async (campaignId: number) => {
        setError('');
        setSuccess('');
        setLoading(true);

        if (!campaignId) {
            showError('Invalid campaign ID');
        }

        try {
            await callCampaignService.deleteCampaign(campaignId);
            showSuccess("Campaign delete successfully")
            setView("list");
            refreshCredits()
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
        window.scrollTo({ top: 0, behavior: "smooth" });

        if (sendOption === "schedule") {

            // Active Days Required
            if (!campaignForm.active_days || campaignForm.active_days.length === 0) {
                newErrors.active_days = "Please select at least one active day";
            }

            const hasStart = !!campaignForm.start_datetime;
            const hasEnd = !!campaignForm.end_datetime;


            // If only start selected
            if (hasStart && !hasEnd) {
                newErrors.end_datetime = "End date is required";
            }

            // If only end selected
            if (!hasStart && hasEnd) {
                newErrors.start_datetime = "Start date is required";
            }

            // If both selected validate range
            if (hasStart && hasEnd && campaignForm.start_datetime > campaignForm.end_datetime) {
                newErrors.end_datetime = "End date must be after start date";
            }

            // Timezone required
            if (!campaignForm.timezone) {
                newErrors.timezone = "Timezone is required";
            }

            // Call time validation
            if (
                campaignForm.call_start_time &&
                campaignForm.call_end_time &&
                campaignForm.call_start_time >= campaignForm.call_end_time
            ) {
                newErrors.call_end_time =
                    "End time must be after start time";
            }

            // Call window required
            if (!campaignForm.call_start_time) {
                newErrors.call_start_time = "Start time required";
            }

            if (!campaignForm.call_end_time) {
                newErrors.call_end_time = "End time required";
            }
        }

        // Send Now Validation
        if (sendOption === "now") {
            const now = moment().tz(campaignForm.timezone || moment.tz.guess());
            const currentHour = now.hour();

            if (currentHour < 9 || currentHour >= 21) {
                newErrors.send_now =
                    "Calls allowed between 9:00 AM and 9:00 PM only";
            }
        }

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) return;

        handleSaveCampaign();
    };

    const formatDateForBackend = (value: any) => {
        if (!value) return null; // null or empty string
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date.toISOString();
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
                    <CampaignContacts
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
                onDeleteCampaign={handleDeleteCampaign}
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
                                    {mode === "edit" ? "Update Campaign" : "Add Campaign"}
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
                                    {mode === "edit" ? "Update Campaign" : "Add Campaign"}
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