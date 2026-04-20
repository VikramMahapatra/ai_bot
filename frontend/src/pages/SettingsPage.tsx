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

    // SMTP
    smtp_host: "",
    smtp_port: 587,
    smtp_username: "",
    smtp_password: "",
    smtp_sender_email: "",
    smtp_use_tls: true,

    default_escalation_level_1: "",
    default_escalation_level_2: "",

    expected_close_days: 0,
  });
  const [orgSaving, setOrgSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const loadOrgSettings = async () => {
      try {
        const data = await organizationService.getOrgSettings();
        setOrgSettings(data);
      } catch (err) {
        console.error("Failed to load org settings");
      }
    };

    loadOrgSettings();
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
  }, []);

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

  const handleOrgFieldChange = (key: string, value: any) => {
    setOrgSettings((prev) => ({
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

  const showError = (message: string) => {
    setSuccess("");
    setError(message);
  };

  const showSuccess = (message: string) => {
    setError("");
    setSuccess(message);
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
        {(success || error) && (
          <Stack mb={2}>
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
                sx={{
                  borderRadius: "14px",
                  boxShadow: `0 10px 18px ${alpha(theme.palette.success.dark, 0.12)}`,
                }}
                action={
                  <IconButton
                    aria-label="close"
                    color="inherit"
                    size="small"
                    onClick={() => setSuccess("")} // clears the success message
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
              <Card sx={{ boxShadow: 2 }}>
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

                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="SMTP Host"
                        defaultValue="smtp.office365.com"
                        size="small"
                        helperText="e.g., smtp.gmail.com, smtp.office365.com"
                        value={orgSettings.smtp_host}
                        onChange={(e) =>
                          handleOrgFieldChange("smtp_host", e.target.value)
                        }
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="SMTP Port"
                        size="small"
                        type="number"
                        helperText="Common: 25, 587, 465"
                        value={orgSettings.smtp_port}
                        onChange={(e) =>
                          {console.log("SMTP PORT : ",parseInt(e.target.value)),
                          handleOrgFieldChange(
                            "smtp_port",
                            parseInt(e.target.value),
                          )}
                        }
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="SMTP Username"
                        size="small"
                        helperText="Your SMTP authentication username"
                        value={orgSettings.smtp_username}
                        onChange={(e) =>
                          handleOrgFieldChange("smtp_username", e.target.value)
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
                        helperText="App password or SMTP password"
                        value={orgSettings.smtp_password}
                        onChange={(e) =>
                          handleOrgFieldChange("smtp_password", e.target.value)
                        }
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Email Sender"
                        size="small"
                        helperText="From email address"
                        value={orgSettings.smtp_sender_email}
                        onChange={(e) =>
                          handleOrgFieldChange(
                            "smtp_sender_email",
                            e.target.value,
                          )
                        }
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Box sx={{ pt: 1 }}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={orgSettings.smtp_use_tls}
                              onChange={(e) =>
                                handleOrgFieldChange(
                                  "smtp_use_tls",
                                  e.target.checked,
                                )
                              }
                            />
                          }
                          label="Use SSL/TLS"
                        />
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
            {/* Chat Escalation Settings — hidden for now
            <Grid item xs={12}>
              <Card sx={{ boxShadow: 2 }}>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <SupportAgentIcon color="primary" />
                    <Typography variant="h6" fontWeight={600}>
                      Chat Escalation Settings
                    </Typography>
                  </Box>

                  <Typography
                    variant="body2"
                    sx={{ mb: 3, color: "text.secondary" }}
                  >
                    Configure escalation contacts when AI cannot resolve queries
                  </Typography>

                  <Grid container spacing={3}>
                    <Grid item xs={12}>
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          border: "1px solid",
                          borderColor: "divider",
                          backgroundColor: "background.default",
                        }}
                      >
                        <Box display="flex" alignItems="center" gap={1} mb={1}>
                          <SupportAgentIcon color="primary" fontSize="small" />
                          <Typography fontWeight={600}>
                            Level 1 — Support Team
                          </Typography>
                        </Box>

                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Support Team: Name | email | phone"
                          value={orgSettings.default_escalation_level_1}
                          onChange={(e) =>
                            handleOrgFieldChange(
                              "default_escalation_level_1",
                              e.target.value,
                            )
                          }
                          helperText="Primary support escalation contact"
                        />
                      </Box>
                    </Grid>

                    <Grid item xs={12}>
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          border: "1px solid",
                          borderColor: "divider",
                          backgroundColor: "background.default",
                        }}
                      >
                        <Box display="flex" alignItems="center" gap={1} mb={1}>
                          <PriorityHighIcon color="warning" fontSize="small" />
                          <Typography fontWeight={600}>
                            Level 2 — Escalation Manager
                          </Typography>
                        </Box>

                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Escalation Manager: Name | email | phone"
                          value={orgSettings.default_escalation_level_2}
                          onChange={(e) =>
                            handleOrgFieldChange(
                              "default_escalation_level_2",
                              e.target.value,
                            )
                          }
                          helperText="Secondary escalation contact"
                        />
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
            */}
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

            <Grid item xs={12}>
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
          </>
        )}
      </Box>
    </AdminLayout>
  );
};

export default SettingsPage;
