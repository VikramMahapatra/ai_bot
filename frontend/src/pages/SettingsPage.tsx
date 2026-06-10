import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Switch,
  FormControlLabel,
  TextField,
  Divider,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Chip,
  Tooltip,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import AdminLayout from "../components/Layout/AdminLayout";
import { twilioSmsService } from "../services/twilioSmsService";
import { organizationService } from "../services/organizationService";
import { Tabs, Tab, Paper } from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import HubIcon from "@mui/icons-material/Hub";
import CloseIcon from "@mui/icons-material/Close";
// Chat Escalation Settings (commented section below)
// import SupportAgentIcon from "@mui/icons-material/SupportAgent";
// import PriorityHighIcon from "@mui/icons-material/PriorityHigh";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import TuneIcon from "@mui/icons-material/Tune";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import SendIcon from '@mui/icons-material/Send';
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import { launchWhatsAppEmbeddedSignup, loadFacebookSdk } from "../services/metaEmbeddedSignup";
import axios from "axios";
import { whatsappService } from "../services/whatsappService";
import { messageTemplateService, Template } from "../services/messageTemplateService";
import { generatePreview } from "./TemplatePage";
import { DeleteIcon, EditIcon } from "lucide-react";
import { ConfirmDialog } from "../components/Common/ConfirmDialog";

const DEFAULT_TWILIO_ACCOUNT_SID = "ACb6df90735425e0809d1457366c6d5623xxxxx";
const DEFAULT_TWILIO_FROM_NUMBER = "+18126125486";
const DEFAULT_TWILIO_INBOUND_NUMBER = "(812) 612-5486";
const DEFAULT_TWILIO_LOCATION_LABEL = "Mccutchanville, IN, US";
const DEFAULT_TWILIO_VOICE_WEBHOOK = "https://demo.twilio.com/welcome/voice/";
const DEFAULT_TWILIO_MESSAGE_WEBHOOK =
  "https://demo.twilio.com/welcome/sms/reply/";

type TwilioFormState = {
  accountSid: string;
  authToken: string;
  fromPhoneNumber: string;
  inboundPhoneNumber: string;
  locationLabel: string;
  voiceWebhookUrl: string;
  messagingWebhookUrl: string;
  isActive: boolean;
  testToNumber: string;
  testMessage: string;
};

type EmailSetting = {
  // SMTP
  id?: number;
  name: string;
  smtp_host: string;
  smtp_port: string;
  smtp_username: string;
  smtp_password: string;
  sender_email: string;
  sender_name?: string;
  cc_emails?: string; // comma-separated
  use_tls: boolean;
  is_active: boolean;
  is_default: boolean;
};

const buildDefaultTwilioState = (): TwilioFormState => ({
  accountSid: DEFAULT_TWILIO_ACCOUNT_SID,
  authToken: "",
  fromPhoneNumber: DEFAULT_TWILIO_FROM_NUMBER,
  inboundPhoneNumber: DEFAULT_TWILIO_INBOUND_NUMBER,
  locationLabel: DEFAULT_TWILIO_LOCATION_LABEL,
  voiceWebhookUrl: DEFAULT_TWILIO_VOICE_WEBHOOK,
  messagingWebhookUrl: DEFAULT_TWILIO_MESSAGE_WEBHOOK,
  isActive: true,
  testToNumber: "",
  testMessage: "Hello from AI Bot SMS Campaign!",
});


const SettingsPage: React.FC = () => {
  const theme = useTheme();
  const [twilioForm, setTwilioForm] = useState<TwilioFormState>(
    buildDefaultTwilioState,
  );
  const [twilioLoading, setTwilioLoading] = useState(false);
  const [twilioSaving, setTwilioSaving] = useState(false);
  const [twilioTesting, setTwilioTesting] = useState(false);
  const [twilioHasAuthToken, setTwilioHasAuthToken] = useState(false);
  const [twilioError, setTwilioError] = useState("");
  const [twilioSuccess, setTwilioSuccess] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testToNumber, setTestToNumber] = useState('');
  const [testMessage, setTestMessage] = useState('Hello from Zentrixel WhatsApp bot');
  const [whatsappTesting, setWhatsappTesting] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);


  const getToday = () => {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localDate = new Date(today.getTime() - offset * 60 * 1000);
    return localDate.toISOString().split("T")[0];
  };

  const [orgSettings, setOrgSettings] = useState({
    enable_email_notifications: true,
    auto_save_conversations: true,
    dark_mode: false,
    show_analytics_dashboard: true,

    enable_rag: true,
    use_semantic_search: true,
    auto_vectorize_documents: true,
    enable_debugging: false,

    auto_capture_leads: true,
    require_email_for_lead: true,
    send_lead_notifications: false,

    default_escalation_level_1: "",
    default_escalation_level_2: "",

    expected_close_days: 0,
  });

  const [orgEmailSettings, setOrgEmailSettings] = useState<EmailSetting | null>(null);

  const [emailSettings, setEmailSettings] = useState<EmailSetting[]>([]);
  const [selectedEmailSetting, setSelectedEmailSetting] = useState<EmailSetting | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [smtpErrors, setSmtpErrors] = useState<Record<string, string>>({});

  const [smtpProfileToDelete, setSmtpProfileToDelete] = useState<EmailSetting | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [orgSaving, setOrgSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [whatsappData, setWhatsappData] = useState<any>(null);


  useEffect(() => {
    loadOrgSettings();
    loadOrgEmailSettings();
  }, []);

  useEffect(() => {
    const loadTwilioConfig = async () => {
      setTwilioLoading(true);
      setTwilioError("");
      try {
        const config = await twilioSmsService.getConfig();
        setTwilioForm((prev) => ({
          ...prev,
          accountSid: config.account_sid || DEFAULT_TWILIO_ACCOUNT_SID,
          authToken: "",
          fromPhoneNumber:
            config.from_phone_number || DEFAULT_TWILIO_FROM_NUMBER,
          inboundPhoneNumber:
            config.inbound_phone_number || DEFAULT_TWILIO_INBOUND_NUMBER,
          locationLabel: config.location_label || DEFAULT_TWILIO_LOCATION_LABEL,
          voiceWebhookUrl:
            config.voice_webhook_url || DEFAULT_TWILIO_VOICE_WEBHOOK,
          messagingWebhookUrl:
            config.messaging_webhook_url || DEFAULT_TWILIO_MESSAGE_WEBHOOK,
          isActive: config.is_active ?? true,
        }));
        setTwilioHasAuthToken(Boolean(config.has_auth_token));
      } catch (err: any) {
        setTwilioError(
          err?.response?.data?.detail || "Failed to load Twilio settings",
        );
      } finally {
        setTwilioLoading(false);
      }
    };

    loadTwilioConfig();
    loadWhatsAppConfig();
    loadWhatsAppUtilityTemplates();
  }, []);


  const loadOrgSettings = async () => {
    const data = await organizationService.getOrgSettings();
    setOrgSettings(data);
  };

  const loadOrgEmailSettings = async () => {
    const data = await organizationService.getOrgEmailSettings();
    setEmailSettings(data);
  };

  const loadWhatsAppConfig = async () => {
    try {
      const config = await whatsappService.getGlobalConfig();

      if (config.configured) {
        setWhatsappData({
          phone_number_id: config.phone_number_id || '',
          waba_id: config.waba_id || '',
          business_phone_number: config.business_phone_number || '',
          is_active: config.is_active ?? true,
        });
      }
    } catch {
      // Keep wizard moving even if config preload fails
    }
  };

  const loadWhatsAppUtilityTemplates = async () => {
    try {
      const templateList = await messageTemplateService.getWhatsappUtilityTemplates();

      setTemplates(templateList || []);
      // For demo, just pick the first one. In a real UI, you'd show a list to choose from.
      if (templateList.length > 0) {
        setSelectedTemplate(templateList[0]);
        setSelectedTemplateId(String(templateList[0].id));
      }
    } catch (err) {
      console.error("Failed to load WhatsApp utility templates", err);
    }
  };

  const handleTwilioFieldChange = <K extends keyof TwilioFormState>(
    key: K,
    value: TwilioFormState[K],
  ) => {
    setTwilioForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveTwilioSettings = async () => {
    setTwilioError("");
    setTwilioSuccess("");
    setTwilioSaving(true);

    try {
      const response = await twilioSmsService.upsertConfig({
        account_sid: twilioForm.accountSid.trim(),
        auth_token: twilioForm.authToken.trim() || undefined,
        from_phone_number: twilioForm.fromPhoneNumber.trim(),
        inbound_phone_number: twilioForm.inboundPhoneNumber.trim() || undefined,
        location_label: twilioForm.locationLabel.trim() || undefined,
        voice_webhook_url: twilioForm.voiceWebhookUrl.trim() || undefined,
        messaging_webhook_url:
          twilioForm.messagingWebhookUrl.trim() || undefined,
        is_active: twilioForm.isActive,
      });

      setTwilioHasAuthToken(Boolean(response.has_auth_token));
      setTwilioForm((prev) => ({ ...prev, authToken: "" }));
      setTwilioSuccess("Twilio SMS settings saved successfully.");
    } catch (err: any) {
      setTwilioError(
        err?.response?.data?.detail || "Failed to save Twilio settings",
      );
    } finally {
      setTwilioSaving(false);
    }
  };

  const handleSendTwilioTestSms = async () => {
    setTwilioError("");
    setTwilioSuccess("");
    setTwilioTesting(true);

    try {
      await twilioSmsService.sendTestMessage(
        twilioForm.testToNumber,
        twilioForm.testMessage,
      );
      setTwilioSuccess("Twilio test SMS sent successfully.");
    } catch (err: any) {
      setTwilioError(
        err?.response?.data?.detail || "Failed to send Twilio test SMS",
      );
    } finally {
      setTwilioTesting(false);
    }
  };

  // START WHATSAPP
  useEffect(() => {

    const onMetaMessage = async (
      event: MessageEvent
    ) => {

      if (
        event.origin !==
        "https://www.facebook.com" &&
        event.origin !==
        "https://web.facebook.com"
      ) {
        return;
      }

      let payload: any;

      try {

        payload =
          typeof event.data === "string"
            ? JSON.parse(event.data)
            : event.data;

      } catch {
        return;
      }

      if (
        payload?.type !==
        "WA_EMBEDDED_SIGNUP"
      ) {
        return;
      }

      if (
        payload?.event !== "FINISH"
      ) {
        return;
      }

      const data = payload?.data;

      if (!data?.phone_number_id || !data?.waba_id) {
        return;
      }

      try {

        await whatsappService.saveEmbeddedSignup({
          phone_number_id: data.phone_number_id,
          waba_id: data.waba_id
        });

        setSuccess(
          "WhatsApp configuration saved successfully"
        );

      } catch (err: any) {
        setError(
          err?.response?.data?.detail ||
          err?.message ||
          "Failed to save WhatsApp config"
        );

      }
    };

    window.addEventListener(
      "message",
      onMetaMessage
    );

    return () =>
      window.removeEventListener(
        "message",
        onMetaMessage
      );

  }, []);

  const handleMetaAuthCode = async (code: string) => {
    setLoading(true);
    try {
      const exchange = await whatsappService.exchangeEmbeddedSignupCode({
        code,
        auto_save: true,
      });

      await loadWhatsAppConfig();

      setSuccess(
        exchange.saved
          ? 'WhatsApp connected and configuration saved via Meta wizard.'
          : 'Meta wizard completed. Review the imported values before saving.'
      );
    }
    catch (err: any) {
      setError(
        err?.response?.data?.detail ||
        err?.detail ||
        "Failed to exchange Meta signup code"
      );
    } finally {
      setLoading(false);
    }

  };

  const handleConnectWhatsApp = async () => {
    setLoading(true);
    try {
      const appId = import.meta.env.VITE_META_APP_ID;
      const configId = import.meta.env.VITE_META_EMBEDDED_SIGNUP_CONFIG_ID;

      if (!appId || !configId) {
        throw new Error("Meta configuration missing");
      }

      await loadFacebookSdk(appId);

      const code = await launchWhatsAppEmbeddedSignup(configId);

      // Send to backend
      await handleMetaAuthCode(code);

    } catch (err: any) {
      console.error(err);
      setError(
        err?.response?.data?.detail ||
        err?.detail ||
        "Failed to exchange Meta signup code"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    try {
      setLoading(true);
      await whatsappService.disconnectWhatsApp();
      setWhatsappData(null);
      setSuccess("WhatsApp disconnected successfully");

    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
        err?.detail ||
        "Failed to exchange Meta signup code"
      );
    } finally {
      setLoading(false);
    }
  };

  const sendWhatsAppTest = async () => {

    if (!testToNumber.trim()) {
      setError("Enter recipient number.");
      return;
    }

    if (!selectedTemplateId) {
      setError("Select WhatsApp template.");
      return;
    }

    try {
      setWhatsappTesting(true);
      setError("");
      await whatsappService.sendTestMessage({
        to_number: testToNumber.trim(),
        template_id: selectedTemplateId,
      });

      setSuccess(
        "WhatsApp template message sent successfully."
      );

      setTestOpen(false);
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
        err?.detail ||
        "Failed to send WhatsApp message."
      );

    } finally {
      setWhatsappTesting(false);
    }
  };


  // END WHATSAPP


  const handleOrgFieldChange = (key: string, value: any) => {
    setOrgSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleOrgEmailFieldChange = (key: string, value: any) => {
    setSelectedEmailSetting((prev: any) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSaveOrgSettings = async () => {
    setOrgSaving(true);
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
      await organizationService.updateOrgSettings(orgSettings);
      showSuccess("Settings updated successfully");
    } catch (err) {
      showError("Failed to update settings");
    }

    setOrgSaving(false);
  };

  const handleSaveOrgEmailSettings = async () => {
    if (!validateEmailSetting()) {
      return;
    }

    setOrgSaving(true);
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
      await organizationService.updateOrgEmailSettings(selectedEmailSetting);
      setEmailDialogOpen(false);
      showSuccess("Settings updated successfully");

      loadOrgEmailSettings();
    } catch (err) {
      showError("Failed to update settings");
    }

    setOrgSaving(false);
  };

  const handleSendTestEmail = async () => {
    setError("");
    setSuccess("");

    if (!selectedEmailSetting?.id) {
      setError("Please select an email configuration");
      return;
    }

    if (!testEmail) {
      setError("Test Email is required");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(testEmail)) {
      setError("Invalid test email format");
      return;
    }

    try {
      setSendingTestEmail(true);

      await organizationService.sendTestEmail(
        selectedEmailSetting.id,
        testEmail
      );
      setTestDialogOpen(false);
      setSuccess("Test email sent successfully");
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
        "Failed to send test email"
      );
    } finally {
      setSendingTestEmail(false);
    }
  };


  const handleSMTPDelete = async () => {
    if (!smtpProfileToDelete?.id) return;
    setError("");
    setSuccess("");
    setDeleteSubmitting(true);
    setLoading(true);
    try {
      await organizationService.deleteEmailSetting(smtpProfileToDelete.id);
      setSmtpProfileToDelete(null);
      await loadOrgEmailSettings();
      setSuccess("SMTP profile deleted successfully");
    } catch (error) {
      showError(`Failed to delete the SMTP profile`);
    } finally {
      setDeleteSubmitting(false);
      setLoading(false);
    }
  };

  const showError = (message: string) => {
    setSuccess("");
    setError(message);
  };

  const showSuccess = (message: string) => {
    setError("");
    setSuccess(message);
  };


  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: '12px',
      backgroundColor: alpha(theme.palette.common.white, 0.72),
    },
  } as const;

  const validateEmailSetting = () => {
    const newErrors: Record<string, string> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!selectedEmailSetting?.name?.trim()) {
      newErrors.name = "Profile name is required";
    }

    if (!selectedEmailSetting?.smtp_host?.trim()) {
      newErrors.smtp_host = "SMTP host is required";
    }

    if (!selectedEmailSetting?.smtp_port) {
      newErrors.smtp_port = "SMTP port is required";
    }

    if (!selectedEmailSetting?.smtp_username?.trim()) {
      newErrors.smtp_username = "SMTP username is required";
    }

    if (!selectedEmailSetting?.smtp_password?.trim()) {
      newErrors.smtp_password = "SMTP password is required";
    }

    if (!selectedEmailSetting?.sender_email?.trim()) {
      newErrors.sender_email = "Sender email is required";
    } else {


      if (!emailRegex.test(selectedEmailSetting.sender_email)) {
        newErrors.sender_email = "Invalid email address";
      }
    }
    if (selectedEmailSetting?.cc_emails?.trim()) {
      const emails = selectedEmailSetting.cc_emails
        .split(",")
        .map((email) => email.trim())
        .filter(Boolean);

      const invalidEmails = emails.filter(
        (email) => !emailRegex.test(email)
      );

      if (invalidEmails.length > 0) {
        newErrors.cc_emails = `Invalid email(s): ${invalidEmails.join(", ")}`;
      }
    }

    setSmtpErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };


  return (
    <AdminLayout>
      <Box>
        <Card
          sx={{
            p: { xs: 2, md: 2.6 },
            mb: 3,
            borderRadius: "22px",
            border: `1px solid ${alpha(theme.palette.common.white, 0.65)}`,
            background: `linear-gradient(125deg, ${alpha("#deebfb", 0.92)} 0%, ${alpha(
              theme.palette.background.paper,
              0.84,
            )} 72%, ${alpha("#a9bfdc", 0.98)} 100%)`,
            boxShadow: `0 18px 36px ${alpha(theme.palette.primary.dark, 0.24)}`,
            position: "relative",
            overflow: "hidden",
            "&::before": {
              content: '""',
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(115deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.06) 34%, rgba(255,255,255,0) 62%)",
              pointerEvents: "none",
            },
            "&::after": {
              content: '""',
              position: "absolute",
              top: "-24%",
              right: "-6%",
              width: "42%",
              height: "150%",
              background:
                "radial-gradient(circle, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0) 72%)",
              pointerEvents: "none",
            },
            "& > *": {
              position: "relative",
              zIndex: 1,
            },
          }}
        >
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            flexWrap="wrap"
            gap={2}
          >
            <Box>
              <Typography
                variant="h4"
                sx={{ fontWeight: 700, color: "primary.main", mb: 0.5 }}
              >
                Settings
              </Typography>

              <Typography variant="body1" sx={{ color: "text.secondary" }}>
                Configure your AI platform preferences and system settings.
              </Typography>
            </Box>
          </Box>
        </Card>
        <Snackbar
          open={Boolean(success || error)}
          autoHideDuration={4000}
          onClose={() => {
            setSuccess("");
            setError("");
          }}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Stack>
            {error && (
              <Alert
                severity="error"
                sx={{
                  borderRadius: "14px",
                  boxShadow: `0 10px 18px ${alpha(
                    theme.palette.error.dark,
                    0.12
                  )}`,
                }}
                action={
                  <IconButton
                    aria-label="close"
                    color="inherit"
                    size="small"
                    onClick={() => setError("")}
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
                sx={{
                  borderRadius: "14px",
                  boxShadow: `0 10px 18px ${alpha(
                    theme.palette.success.dark,
                    0.12
                  )}`,
                }}
                action={
                  <IconButton
                    aria-label="close"
                    color="inherit"
                    size="small"
                    onClick={() => setSuccess("")}
                  >
                    <CloseIcon fontSize="inherit" />
                  </IconButton>
                }
              >
                {success}
              </Alert>
            )}
          </Stack>
        </Snackbar>
        <Paper
          sx={{
            mb: 3,
            borderRadius: 2,
            boxShadow: 1,
          }}
        >
          <Tabs
            value={activeTab}
            onChange={(e, val) => setActiveTab(val)}
            indicatorColor="primary"
            textColor="primary"
          >
            <Tab
              icon={<SettingsIcon />}
              iconPosition="start"
              label="Settings"
            />

            <Tab icon={<HubIcon />} iconPosition="start" label="Integrations" />
          </Tabs>
        </Paper>
        {activeTab === 0 && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                borderBottom="1px solid"
                borderColor="divider"
                pb={2}
              >
                <Box>
                  <Typography variant="h6" fontWeight={600}>
                    Application Settings
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Configure general behavior, AI features, lead capture, and
                    email settings
                  </Typography>
                </Box>

                <Button
                  variant="contained"
                  onClick={handleSaveOrgSettings}
                  disabled={orgSaving}
                >
                  {orgSaving ? "Saving..." : "Save Settings"}
                </Button>
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card sx={{ boxShadow: 2 }}>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <TuneIcon color="primary" />
                    <Typography variant="h6" fontWeight={600}>
                      General Settings
                    </Typography>
                  </Box>
                  <Box
                    sx={{ display: "flex", flexDirection: "column", gap: 2 }}
                  >
                    <FormControlLabel
                      control={
                        <Switch
                          checked={orgSettings.enable_email_notifications}
                          onChange={(e) =>
                            handleOrgFieldChange(
                              "enable_email_notifications",
                              e.target.checked,
                            )
                          }
                        />
                      }
                      label="Enable email notifications"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={orgSettings.auto_save_conversations}
                          onChange={(e) =>
                            handleOrgFieldChange(
                              "auto_save_conversations",
                              e.target.checked,
                            )
                          }
                        />
                      }
                      label="Auto-save conversations"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={orgSettings.dark_mode}
                          onChange={(e) =>
                            handleOrgFieldChange("dark_mode", e.target.checked)
                          }
                        />
                      }
                      label="Dark mode"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={orgSettings.show_analytics_dashboard}
                          onChange={(e) =>
                            handleOrgFieldChange(
                              "show_analytics_dashboard",
                              e.target.checked,
                            )
                          }
                        />
                      }
                      label="Show analytics dashboard"
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card sx={{ boxShadow: 2 }}>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <SmartToyIcon color="primary" />
                    <Typography variant="h6" fontWeight={600}>
                      AI Configuration
                    </Typography>
                  </Box>
                  <Box
                    sx={{ display: "flex", flexDirection: "column", gap: 2 }}
                  >
                    <FormControlLabel
                      control={
                        <Switch
                          checked={orgSettings.enable_rag}
                          onChange={(e) =>
                            handleOrgFieldChange("enable_rag", e.target.checked)
                          }
                        />
                      }
                      label="Enable RAG (Retrieval-Augmented Generation)"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={orgSettings.use_semantic_search}
                          onChange={(e) =>
                            handleOrgFieldChange(
                              "use_semantic_search",
                              e.target.checked,
                            )
                          }
                        />
                      }
                      label="Use semantic search"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={orgSettings.auto_vectorize_documents}
                          onChange={(e) =>
                            handleOrgFieldChange(
                              "auto_vectorize_documents",
                              e.target.checked,
                            )
                          }
                        />
                      }
                      label="Auto-vectorize documents"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={orgSettings.enable_debugging}
                          onChange={(e) =>
                            handleOrgFieldChange(
                              "enable_debugging",
                              e.target.checked,
                            )
                          }
                        />
                      }
                      label="Enable debugging mode"
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card sx={{ boxShadow: 2 }}>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <PersonAddAlt1Icon color="primary" />
                    <Typography variant="h6" fontWeight={600}>
                      Lead Capture Settings
                    </Typography>
                  </Box>
                  <Box
                    sx={{ display: "flex", flexDirection: "column", gap: 2 }}
                  >
                    <FormControlLabel
                      control={
                        <Switch
                          checked={orgSettings.auto_capture_leads}
                          onChange={(e) =>
                            handleOrgFieldChange(
                              "auto_capture_leads",
                              e.target.checked,
                            )
                          }
                        />
                      }
                      label="Automatically capture leads after 3 messages"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={orgSettings.require_email_for_lead}
                          onChange={(e) =>
                            handleOrgFieldChange(
                              "require_email_for_lead",
                              e.target.checked,
                            )
                          }
                        />
                      }
                      label="Require email for lead capture"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={orgSettings.send_lead_notifications}
                          onChange={(e) =>
                            handleOrgFieldChange(
                              "send_lead_notifications",
                              e.target.checked,
                            )
                          }
                        />
                      }
                      label="Send lead notifications to admin"
                    />
                    {/* Exepected Close Days */}
                    <TextField
                      sx={{ width: "20%" }} // adjust as needed
                      label="Expected Close Days"
                      type="number"
                      size="small"
                      value={orgSettings.expected_close_days}
                      onChange={(e) =>
                        handleOrgFieldChange(
                          "expected_close_days",
                          e.target.value,
                        )
                      }
                      InputLabelProps={{ shrink: true }}
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>



            <Grid item xs={12}>
              <Box display="flex" justifyContent="flex-end">
                <Button
                  variant="contained"
                  onClick={handleSaveOrgSettings}
                  disabled={orgSaving}
                >
                  {orgSaving ? "Saving..." : "Save Settings"}
                </Button>
              </Box>
            </Grid>
          </Grid>
        )}
        {activeTab === 1 && (
          <>
            <Grid item xs={12}>
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                borderBottom="1px solid"
                borderColor="divider"
                pb={2}
              >
                <Box>
                  <Typography variant="h6" fontWeight={600}>
                    Integrations
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Connect external services and communication channels
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} mt={2}>
              <Card sx={{ boxShadow: 2 }}>
                <CardContent>
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    mb={2}
                  >
                    <Typography variant="h6">
                      Email SMTP Configurations
                    </Typography>

                    <Button
                      variant="contained"
                      onClick={() => {
                        setSelectedEmailSetting(null);
                        setEmailDialogOpen(true);
                        setSmtpErrors({});
                      }}
                    >
                      Add SMTP Profile
                    </Button>
                  </Box>
                  {emailSettings.length === 0 ? (
                    <Box
                      sx={{
                        py: 6,
                        textAlign: "center",
                        border: "1px dashed",
                        borderColor: "divider",
                        borderRadius: 2,
                        bgcolor: "background.default",
                      }}
                    >
                      <MailOutlineIcon
                        color="disabled"
                        sx={{ fontSize: 48, mb: 2 }}
                      />

                      <Typography
                        variant="h6"
                        gutterBottom
                      >
                        No SMTP Profiles Configured
                      </Typography>

                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 3 }}
                      >
                        Add your first SMTP profile to send emails, campaigns,
                        notifications, and conversation transcripts.
                      </Typography>

                      <Button
                        variant="contained"
                        onClick={() => {
                          setSelectedEmailSetting(null);
                          setEmailDialogOpen(true);
                          setSmtpErrors({});
                        }}
                      >
                        Add SMTP Profile
                      </Button>
                    </Box>
                  ) : (

                    emailSettings.map((setting) => (
                      <Card
                        key={setting.id}
                        variant="outlined"
                        sx={{
                          mb: 2,
                          borderRadius: 2,
                          transition: "all 0.2s ease",
                          "&:hover": {
                            boxShadow: 3,
                          },
                        }}
                      >
                        <CardContent>
                          <Box
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                          >
                            <Box>
                              <Box display="flex" alignItems="center" gap={1}>
                                <MailOutlineIcon color="primary" />

                                <Typography variant="h6">
                                  {setting.name}
                                </Typography>

                                {setting.is_default && (
                                  <Chip
                                    label="Default"
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                  />
                                )}

                                <Chip
                                  label={setting.is_active ? "Active" : "Inactive"}
                                  size="small"
                                  color={setting.is_active ? "success" : "default"}
                                  variant="outlined"
                                />
                              </Box>

                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ mt: 1 }}
                              >
                                {setting.sender_email}
                              </Typography>

                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                {setting.smtp_host}:{setting.smtp_port}
                              </Typography>
                            </Box>

                            <Box display="flex" gap={1}>
                              <Button
                                startIcon={<SendIcon />}
                                onClick={() => {
                                  setSelectedEmailSetting(setting);
                                  setTestDialogOpen(true);
                                }}
                              >
                                Test
                              </Button>
                              <Button
                                size="small"
                                startIcon={<EditIcon />}
                                onClick={() => {
                                  setSelectedEmailSetting(setting);
                                  setEmailDialogOpen(true);
                                  setSmtpErrors({});
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                size="small"
                                startIcon={<DeleteIcon />}
                                color="error"
                                onClick={() => setSmtpProfileToDelete(setting)}
                              >
                                Delete
                              </Button>
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </CardContent>
              </Card>
              {/* <Card sx={{ boxShadow: 2 }}>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <MailOutlineIcon color="primary" />
                    <Typography variant="h6" fontWeight={600}>
                      Email SMTP Configuration
                    </Typography>
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{ mb: 3, color: "text.secondary" }}
                  >
                    Configure SMTP settings for sending conversation transcripts
                    via email
                  </Typography>


                  <Divider sx={{ my: 3 }} />

                  <Box mb={2}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      Test SMTP Configuration
                    </Typography>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 2 }}
                    >
                      Send a test email to verify your SMTP settings
                    </Typography>
                  </Box>

                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={8}>
                      <TextField
                        fullWidth
                        label="Test Email Address"
                        size="small"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                      />
                    </Grid>

                    <Grid item xs={12} md={4}>
                      <Button
                        fullWidth
                        variant="contained"
                        startIcon={<SendIcon />}
                        onClick={handleSendTestEmail}
                        disabled={sendingTestEmail}
                      >
                        {sendingTestEmail ? "Sending..." : "Send Test Email"}
                      </Button>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card> */}

            </Grid>
            <Grid item xs={12} mt={2}>
              <Card sx={{ boxShadow: 2 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Twilio SMS Integration
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ mb: 3, color: "text.secondary" }}
                  >
                    Configure Twilio for SMS campaigns from Campaign Management.
                  </Typography>

                  {twilioError && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      {twilioError}
                    </Alert>
                  )}
                  {twilioSuccess && (
                    <Alert severity="success" sx={{ mb: 2 }}>
                      {twilioSuccess}
                    </Alert>
                  )}

                  {twilioLoading ? (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <CircularProgress size={20} />
                      <Typography variant="body2" color="text.secondary">
                        Loading Twilio configuration...
                      </Typography>
                    </Box>
                  ) : (
                    <>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            label="Twilio Account SID"
                            value={twilioForm.accountSid}
                            onChange={(e) =>
                              handleTwilioFieldChange(
                                "accountSid",
                                e.target.value,
                              )
                            }
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            label="Twilio Auth Token"
                            type="password"
                            value={twilioForm.authToken}
                            onChange={(e) =>
                              handleTwilioFieldChange(
                                "authToken",
                                e.target.value,
                              )
                            }
                            size="small"
                            helperText={
                              twilioHasAuthToken
                                ? "Leave empty to keep existing token, or enter a new one to rotate it."
                                : "Required to send SMS via Twilio."
                            }
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            label="Twilio Sender Number (From)"
                            value={twilioForm.fromPhoneNumber}
                            onChange={(e) =>
                              handleTwilioFieldChange(
                                "fromPhoneNumber",
                                e.target.value,
                              )
                            }
                            size="small"
                            helperText="Use E.164 format, e.g. +18126125486"
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            label="Inbound Number"
                            value={twilioForm.inboundPhoneNumber}
                            onChange={(e) =>
                              handleTwilioFieldChange(
                                "inboundPhoneNumber",
                                e.target.value,
                              )
                            }
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            label="Location"
                            value={twilioForm.locationLabel}
                            onChange={(e) =>
                              handleTwilioFieldChange(
                                "locationLabel",
                                e.target.value,
                              )
                            }
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Box sx={{ pt: 1 }}>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={twilioForm.isActive}
                                  onChange={(e) =>
                                    handleTwilioFieldChange(
                                      "isActive",
                                      e.target.checked,
                                    )
                                  }
                                />
                              }
                              label="Enable Twilio SMS Channel"
                            />
                          </Box>
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            label="Voice Webhook URL"
                            value={twilioForm.voiceWebhookUrl}
                            onChange={(e) =>
                              handleTwilioFieldChange(
                                "voiceWebhookUrl",
                                e.target.value,
                              )
                            }
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            label="Messaging Webhook URL"
                            value={twilioForm.messagingWebhookUrl}
                            onChange={(e) =>
                              handleTwilioFieldChange(
                                "messagingWebhookUrl",
                                e.target.value,
                              )
                            }
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <Button
                            variant="contained"
                            onClick={handleSaveTwilioSettings}
                            disabled={twilioSaving}
                          >
                            {twilioSaving
                              ? "Saving..."
                              : "Save Twilio SMS Settings"}
                          </Button>
                        </Grid>
                      </Grid>

                      <Divider sx={{ my: 2.5 }} />

                      <Typography
                        variant="subtitle1"
                        sx={{ mb: 1.5, fontWeight: 600 }}
                      >
                        Send Test SMS
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Recipient Number"
                            placeholder="+1XXXXXXXXXX"
                            value={twilioForm.testToNumber}
                            onChange={(e) =>
                              handleTwilioFieldChange(
                                "testToNumber",
                                e.target.value,
                              )
                            }
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Test Message"
                            value={twilioForm.testMessage}
                            onChange={(e) =>
                              handleTwilioFieldChange(
                                "testMessage",
                                e.target.value,
                              )
                            }
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                        <Grid item xs={12} md={2}>
                          <Button
                            fullWidth
                            variant="outlined"
                            disabled={twilioTesting}
                            onClick={handleSendTwilioTestSms}
                          >
                            {twilioTesting ? "Sending..." : "Send Test"}
                          </Button>
                        </Grid>
                      </Grid>
                    </>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} mt={2}>
              <Card sx={{ boxShadow: 2 }}>
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                    <WhatsAppIcon sx={{ color: "#25D366" }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      WhatsApp Integration
                    </Typography>
                  </Box>

                  <Typography
                    variant="body2"
                    sx={{ mb: 3, color: "text.secondary" }}
                  >
                    Connect your WhatsApp Business account to enable automated messaging.
                    Perfect for customer support and engagement.
                  </Typography>

                  <Card
                    variant="outlined"
                    sx={{
                      borderRadius: 2,
                      mb: 3,
                      p: 2
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Box
                          sx={{
                            width: 48,
                            height: 48,
                            background: "#25D366",
                            borderRadius: 2,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white"
                          }}
                        >
                          <WhatsAppIcon />
                        </Box>

                        <Box>
                          <Typography fontWeight={600}>WhatsApp</Typography>
                          <Typography
                            variant="caption"
                            color={whatsappData ? "success.main" : "text.secondary"}
                          >
                            {whatsappData
                              ? `Connected • ${whatsappData.business_phone_number || ""}`
                              : "Not Connected"}
                          </Typography>
                        </Box>
                      </Box>
                      {whatsappData ? (
                        <Stack direction="row" spacing={1}>

                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => setTestOpen(true)}
                            sx={{
                              minWidth: 150,
                              py: 0.7,
                              px: 2,
                              fontWeight: 600,
                              borderColor: "#25D366",
                              color: "#25D366",
                              "&:hover": {
                                borderColor: "#1ebe5d",
                                background: "rgba(37, 211, 102, 0.08)"
                              }
                            }}
                          >
                            Send Test Message
                          </Button>

                          <Button
                            variant="outlined"
                            color="error"
                            onClick={handleDisconnectWhatsApp}
                            disabled={loading}
                          >
                            Disconnect
                          </Button>

                        </Stack>
                      ) : (
                        <Button
                          variant="contained"
                          onClick={handleConnectWhatsApp}
                          disabled={loading}
                          sx={{
                            background: "#25D366",
                            "&:hover": {
                              background: "#1ebe5d"
                            }
                          }}
                        >
                          {loading ? "Connecting..." : "Connect WhatsApp"}
                        </Button>
                      )}
                    </Box>
                  </Card>
                  {whatsappData && (
                    <Alert severity="success" sx={{ mb: 2 }}>
                      WhatsApp Business connected successfully
                      {whatsappData.business_name &&
                        ` • ${whatsappData.business_name}`}
                    </Alert>
                  )}
                  {!whatsappData && (
                    <>
                      <Alert severity="warning" sx={{ mb: 2 }}>
                        WhatsApp not connected. Please connect to enable WhatsApp messaging.
                      </Alert>
                      <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: 600, mb: 2 }}
                      >
                        Requirements
                      </Typography>

                      <Stack spacing={1.5}>
                        <Alert severity="info">
                          You must have a valid dedicated phone number
                        </Alert>

                        <Alert severity="info">
                          Phone number must not be linked to another provider
                        </Alert>

                        <Alert severity="info">
                          You need a personal Facebook account
                        </Alert>

                        <Alert severity="warning">
                          Verify your Meta Business Account
                        </Alert>
                      </Stack>
                    </>

                  )}

                </CardContent>
              </Card>
            </Grid>
          </>
        )}

        <Dialog open={testOpen} maxWidth="sm" fullWidth onClose={() => setTestOpen(false)}  >
          <DialogTitle>Send WhatsApp Test Message</DialogTitle>

          <DialogContent>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Only <b>UTILITY</b> WhatsApp templates can be used for sending test messages.
            </Alert>
            <Stack sx={{ mt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Recipient Number"
                    value={testToNumber}
                    onChange={(e) => setTestToNumber(e.target.value)}
                    placeholder="9198XXXXXXXX"
                    fullWidth
                    sx={fieldSx}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    select
                    label="WhatsApp Template"
                    value={selectedTemplateId}
                    onChange={(e) => {
                      setSelectedTemplateId(e.target.value);

                      const selected = templates.find(
                        (t) => t.id === Number(e.target.value)
                      );

                      setSelectedTemplate(selected || null);
                    }}
                    fullWidth
                    sx={fieldSx}
                  >
                    {(templates || []).map((template) => (
                      <MenuItem
                        key={template.id}
                        value={template.id}
                      >
                        {template.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>
              {selectedTemplate ? (
                <Box
                  sx={{
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    overflow: "hidden",
                    height: "100%",
                    mt: 2,
                  }}
                >
                  {/* Header */}
                  <Box
                    sx={{
                      px: 1.5,
                      py: 1,
                      bgcolor: "grey.100",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <Typography variant="subtitle2" fontWeight={600}>
                      Preview
                    </Typography>

                    <Typography variant="caption" color="text.secondary">
                      {selectedTemplate.name}
                    </Typography>
                  </Box>

                  {/* Body */}
                  <Box
                    sx={{
                      p: 1.5,
                      bgcolor: "#ece5dd", // WhatsApp chat background
                      minHeight: 140,
                      display: "flex",
                      flexDirection: "column",
                      gap: 1,
                    }}
                  >
                    {/* incoming message bubble */}
                    <Box
                      sx={{
                        alignSelf: "flex-start",
                        maxWidth: "85%",
                        bgcolor: "#ffffff",
                        p: 1.2,
                        borderRadius: "12px",
                        borderTopLeftRadius: 4,
                        boxShadow: "0 1px 1px rgba(0,0,0,0.08)",
                        whiteSpace: "pre-wrap",
                        fontSize: "0.85rem",
                        lineHeight: 1.4,
                        position: "relative",
                      }}
                    >
                      {/* sender label */}
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 600,
                          display: "block",
                          mb: 0.5,
                          color: "text.secondary",
                        }}
                      >
                        Test Message
                      </Typography>

                      {generatePreview(
                        selectedTemplate.content,
                        selectedTemplate.variable_mappings || {}
                      )}

                      {/* optional timestamp */}
                      <Typography
                        variant="caption"
                        sx={{
                          display: "block",
                          mt: 0.5,
                          textAlign: "right",
                          color: "text.disabled",
                          fontSize: "0.7rem",
                        }}
                      >
                        just now
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              ) : (
                <Box
                  sx={{
                    height: "100%",
                    minHeight: 80,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px dashed",
                    borderColor: "divider",
                    borderRadius: 2,
                    color: "text.secondary",
                  }}
                >
                  Select a template to preview
                </Box>
              )}
            </Stack>
          </DialogContent>

          <DialogActions>
            <Button onClick={() => setTestOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={sendWhatsAppTest} disabled={whatsappTesting} sx={{ background: `linear-gradient(120deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.dark, 0.92)} 100%)` }} >
              Send
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog
          open={emailDialogOpen}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            {selectedEmailSetting
              ? "Edit SMTP Profile"
              : "Add SMTP Profile"}
          </DialogTitle>

          <DialogContent>
            <Grid container spacing={2} mt={1}>
              <Grid item xs={12} md={12}>
                <TextField
                  fullWidth
                  label="SMTP Profile Name"
                  defaultValue="Default SMTP"
                  size="small"
                  value={selectedEmailSetting?.name}
                  onChange={(e) =>
                    handleOrgEmailFieldChange("name", e.target.value)
                  }
                  error={!!smtpErrors.name}
                  helperText={smtpErrors.name || "e.g., Default SMTP, Gmail, Office365"}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="SMTP Host"
                  defaultValue="smtp.office365.com"
                  size="small"
                  value={selectedEmailSetting?.smtp_host}
                  onChange={(e) =>
                    handleOrgEmailFieldChange("smtp_host", e.target.value)
                  }
                  error={!!smtpErrors.smtp_host}
                  helperText={
                    smtpErrors.smtp_host || "e.g., smtp.gmail.com, smtp.office365.com"
                  }
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="SMTP Port"
                  size="small"
                  type="number"
                  value={selectedEmailSetting?.smtp_port}
                  onChange={(e) => {
                    console.log("SMTP PORT : ", parseInt(e.target.value)),
                      handleOrgEmailFieldChange(
                        "smtp_port",
                        parseInt(e.target.value),
                      )
                  }
                  }
                  error={!!smtpErrors.smtp_port}
                  helperText={
                    smtpErrors.smtp_port || "e.g., 25, 587 (TLS), 465 (SSL)"
                  }
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="SMTP Username"
                  size="small"
                  value={selectedEmailSetting?.smtp_username}
                  onChange={(e) =>
                    handleOrgEmailFieldChange("smtp_username", e.target.value)
                  }
                  error={!!smtpErrors.smtp_username}
                  helperText={
                    smtpErrors.smtp_username ||
                    "Your SMTP authentication username"
                  }
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="SMTP Password"
                  size="small"
                  type="password"
                  value={selectedEmailSetting?.smtp_password}
                  onChange={(e) =>
                    handleOrgEmailFieldChange("smtp_password", e.target.value)
                  }
                  error={!!smtpErrors.smtp_password}
                  helperText={smtpErrors.smtp_password || "App password or SMTP password"}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Email Sender"
                  size="small"
                  value={selectedEmailSetting?.sender_email}
                  onChange={(e) =>
                    handleOrgEmailFieldChange(
                      "sender_email",
                      e.target.value,
                    )
                  }
                  error={!!smtpErrors.sender_email}
                  helperText={
                    smtpErrors.sender_email ||
                    "The email address that will appear in the 'From' field when sending emails"
                  }
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Sender Name"
                  size="small"
                  helperText="Shown before the email address (e.g., Zentrixel Team <hello@zentrixel.com>)"
                  value={selectedEmailSetting?.sender_name}
                  onChange={(e) =>
                    handleOrgEmailFieldChange(
                      "sender_name",
                      e.target.value,
                    )
                  }
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="CC Email Addresses"
                  size="small"
                  value={selectedEmailSetting?.cc_emails}
                  onChange={(e) =>
                    handleOrgEmailFieldChange(
                      "cc_emails",
                      e.target.value,
                    )
                  }
                  InputLabelProps={{ shrink: true }}
                  error={!!smtpErrors.cc_emails}
                  helperText={
                    smtpErrors.cc_emails ||
                    "Comma-separated list of email addresses"
                  }
                />
              </Grid>
              <Grid
                item
                xs={12}
                md={3}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  height: "40px", // match small TextField height
                  mt: "2px",      // optional fine-tuning
                }}
              >
                <FormControlLabel
                  control={
                    <Switch
                      checked={selectedEmailSetting?.use_tls}
                      onChange={(e) =>
                        handleOrgEmailFieldChange(
                          "use_tls",
                          e.target.checked
                        )
                      }
                    />
                  }
                  label="Use SSL/TLS"
                  sx={{ m: 0 }}
                />
              </Grid>
              <Grid
                item
                xs={12}
                md={3}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  height: "40px", // match small TextField height
                  mt: "2px",      // optional fine-tuning
                }}
              >
                <FormControlLabel
                  control={
                    <Switch
                      checked={selectedEmailSetting?.is_default}
                      onChange={(e) =>
                        handleOrgEmailFieldChange(
                          "is_default",
                          e.target.checked
                        )
                      }
                    />
                  }
                  label="Set as Default"
                  sx={{ m: 0 }}
                />
              </Grid>
            </Grid>
          </DialogContent>

          <DialogActions>
            <Button
              onClick={() => setEmailDialogOpen(false)}
            >
              Cancel
            </Button>

            <Button
              variant="contained"
              onClick={handleSaveOrgEmailSettings}
            >
              Save
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog
          open={testDialogOpen}
          onClose={() => setTestDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            Send Test Email
          </DialogTitle>

          <DialogContent>
            <TextField
              fullWidth
              margin="normal"
              label="Recipient Email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
            />
          </DialogContent>

          <DialogActions>
            <Button onClick={() => setTestDialogOpen(false)}>
              Cancel
            </Button>

            <Button
              variant="contained"
              onClick={() =>
                handleSendTestEmail()
              }
            >
              Send Test Email
            </Button>
          </DialogActions>
        </Dialog>
        <ConfirmDialog
          open={Boolean(smtpProfileToDelete)}
          title="Delete SMTP profile?"
          description={
            smtpProfileToDelete
              ? `This will permanently remove "${smtpProfileToDelete.name}". This action cannot be undone.`
              : undefined
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          confirmColor="error"
          loading={deleteSubmitting}
          onCancel={() => !deleteSubmitting && setSmtpProfileToDelete(null)}
          onConfirm={handleSMTPDelete}
        />
      </Box>
    </AdminLayout>
  );
};

export default SettingsPage;
