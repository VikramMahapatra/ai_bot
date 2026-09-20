import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import DataObjectOutlinedIcon from "@mui/icons-material/DataObjectOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import KeyboardArrowLeftIcon from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import RocketLaunchOutlinedIcon from "@mui/icons-material/RocketLaunchOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import ThermostatOutlinedIcon from "@mui/icons-material/ThermostatOutlined";
import ThumbUpAltOutlinedIcon from "@mui/icons-material/ThumbUpAltOutlined";
import TrackChangesIcon from "@mui/icons-material/TrackChanges";
import TuneIcon from "@mui/icons-material/Tune";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import AdminLayout from "../components/Layout/AdminLayout";
import {
  QualificationTemplatePayload,
  qualificationTemplateService,
} from "../services/qualificationTemplateService";

const defaultCampaignObjective =
  "Identify customers who are genuinely interested in purchasing our products and are likely to take the next step.";

const campaignObjectiveExamples = [
  "Find businesses that are looking for a solution to their current operational problem.",
  "Identify customers interested in booking a property within our service locations.",
  "Find existing customers who may be interested in our new product range.",
];

const predefinedQualificationCriteria = [
  { key: "genuine_need", label: "Genuine need / requirement", hint: "A real and current need has been expressed." },
  { key: "relevant_use_case", label: "Relevant use case", hint: "The intended use aligns with what you provide." },
  { key: "product_service_interest", label: "Product / service interest", hint: "Interest in a specific product or service is clear." },
  { key: "purchase_use_intention", label: "Purchase / use intention", hint: "The lead indicates an intention to buy or use." },
  { key: "specific_requirement", label: "Specific requirement", hint: "The requirement contains concrete details." },
  { key: "future_requirement", label: "Future requirement", hint: "A credible upcoming need or project exists." },
  { key: "further_discussion", label: "Willingness for further discussion", hint: "The lead agrees to continue the conversation." },
  { key: "problem_solving_intent", label: "Intent to solve a problem", hint: "There is motivation to address the stated problem." },
  { key: "offering_match", label: "Requirement matches our offering", hint: "Your offering can reasonably satisfy the requirement." },
  { key: "target_customer", label: "Meets target customer criteria", hint: "The lead fits your intended customer profile." },
];

const attributeDataTypes = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "currency", label: "Amount / Currency" },
  { value: "quantity", label: "Quantity" },
  { value: "boolean", label: "Yes / No" },
  { value: "select", label: "Single Select" },
  { value: "multi_select", label: "Multi Select" },
  { value: "date", label: "Date" },
  { value: "date_range", label: "Date Range" },
  { value: "location", label: "Location" },
  { value: "percentage", label: "Percentage" },
] as const;

const numericAttributeTypes = new Set(["number", "currency", "quantity", "percentage"]);
const selectableAttributeTypes = new Set(["select", "multi_select"]);

const positiveSignalGroups = [
  {
    category: "Interest" as const,
    icon: <ThumbUpAltOutlinedIcon />,
    color: "#157f78",
    description: "Active curiosity and a relevant need.",
    signals: [
      ["expresses_interest", "Expresses interest"],
      ["asks_more_information", "Asks for more information"],
      ["describes_requirement", "Describes a requirement"],
      ["asks_suitability", "Asks about product / service suitability"],
      ["asks_options", "Asks about available options / alternatives"],
    ],
  },
  {
    category: "Commercial Interest" as const,
    icon: <PaymentsOutlinedIcon />,
    color: "#b87916",
    description: "Questions that indicate serious evaluation.",
    signals: [
      ["price_enquiry", "Price enquiry"],
      ["quotation_request", "Quotation request"],
      ["availability_enquiry", "Availability enquiry"],
      ["budget_discussion", "Budget discussion"],
      ["quantity_discussion", "Quantity discussion"],
      ["package_plan_discussion", "Package / plan discussion"],
      ["payment_terms_discussion", "Payment / terms discussion"],
    ],
  },
  {
    category: "Next Step" as const,
    icon: <RocketLaunchOutlinedIcon />,
    color: "#3d75d9",
    description: "Concrete actions that move the opportunity forward.",
    signals: [
      ["callback_request", "Callback request"],
      ["meeting_request", "Meeting request"],
      ["demo_request", "Demo request"],
      ["visit_request", "Visit request"],
      ["catalogue_details_request", "Catalogue / details request"],
      ["sample_request", "Sample request"],
      ["proposal_request", "Proposal request"],
      ["purchase_order_intention", "Purchase / order intention"],
      ["booking_signup_intention", "Booking / sign-up intention"],
    ],
  },
  {
    category: "Timing" as const,
    icon: <EventAvailableOutlinedIcon />,
    color: "#d84b5d",
    description: "Time-bound intent that helps prioritize follow-up.",
    signals: [
      ["immediate_requirement", "Immediate requirement"],
      ["defined_period", "Requirement within a defined period"],
      ["future_requirement", "Future requirement"],
      ["specific_date", "Specific purchase / usage date"],
    ],
  },
];

const predefinedDisqualificationCriteria = [
  { key: "explicitly_not_interested", label: "Explicitly not interested", hint: "The customer clearly states they have no interest." },
  { key: "no_requirement", label: "No requirement", hint: "There is no current or future need to address." },
  { key: "wrong_customer_profile", label: "Wrong customer / profile", hint: "The lead does not fit the intended customer profile." },
  { key: "outside_offering", label: "Requirement outside our offering", hint: "The requested product or service is not provided." },
  { key: "outside_service_area", label: "Outside service area", hint: "The customer is beyond the supported geography or territory." },
  { key: "not_intended_customer", label: "Not the intended customer", hint: "The enquiry is for another audience or customer type." },
  { key: "offering_mismatch", label: "Requirement does not match our offering", hint: "The need cannot be satisfied by the available solution." },
  { key: "no_further_contact", label: "Requests no further contact", hint: "The customer asks to stop all future outreach." },
];

const defaultTemperatures: QualificationTemplatePayload["lead_temperatures"] = [
  { name: "Cold", min_score: 1, max_score: 39, description: "Early interest with limited buying intent.", color: "#4b86c6" },
  { name: "Warm", min_score: 40, max_score: 59, description: "Relevant need with growing engagement.", color: "#d59b20" },
  { name: "Hot", min_score: 60, max_score: 79, description: "Strong fit and clear purchase intent.", color: "#e56b35" },
  { name: "Very Hot", min_score: 80, max_score: 100, description: "Ready for immediate sales action.", color: "#d83b4c" },
];

const emptyTemplate: QualificationTemplatePayload = {
  name: "",
  description: "",
  objective: defaultCampaignObjective,
  status: "Active",
  qualification_mode: "essential_supporting",
  temperature_mode: "standard",
  criteria: [],
  attributes: [],
  positive_signals: [],
  disqualification_criteria: [],
  lead_temperatures: defaultTemperatures,
};

const tabs = [
  { label: "Campaign Objective", short: "Objective", icon: <TrackChangesIcon /> },
  { label: "Qualification Criteria", short: "Criteria", icon: <FactCheckOutlinedIcon /> },
  { label: "Business / Qualification Attributes", short: "Attributes", icon: <TuneIcon /> },
  { label: "Positive Signals", short: "Signals", icon: <ThumbUpAltOutlinedIcon /> },
  { label: "Disqualification Criteria", short: "Disqualifiers", icon: <BlockOutlinedIcon /> },
  { label: "Lead Temperature", short: "Temperature", icon: <ThermostatOutlinedIcon /> },
];

const sectionCopy = [
  "Define what you are trying to achieve with this campaign.",
  "Add the weighted conditions that determine whether a lead is qualified.",
  "Create organization-specific data points without relying on hardcoded industry fields.",
  "Capture behaviors and statements that demonstrate genuine buying interest.",
  "Define hard stops and cases that should be sent for manual review.",
  "Map the complete 1-100 score to clear sales-priority bands.",
];

const errorMessage = (error: any) => {
  const detail = error?.response?.data?.detail;
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join(". ");
  return detail || "Unable to save the qualification template.";
};

export default function QualificationTemplateEditorPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { templateId } = useParams();
  const id = templateId ? Number(templateId) : null;
  const [activeTab, setActiveTab] = useState(0);
  const [form, setForm] = useState<QualificationTemplatePayload>(emptyTemplate);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!id) return;
    qualificationTemplateService.get(id)
      .then((template) => setForm({
        ...emptyTemplate,
        ...template,
        qualification_mode: template.qualification_mode || "essential_supporting",
        temperature_mode: template.temperature_mode || "custom",
        criteria: (template.criteria || []).map((criterion, index) => ({
          ...criterion,
          criterion_key: criterion.criterion_key || `legacy_${criterion.id || index}`,
          source: criterion.source || "custom",
          importance: criterion.importance || (criterion.is_required ? "Essential" : "Supporting"),
        })),
        attributes: (template.attributes || []).map((attribute) => ({
          ...attribute,
          is_qualification_relevant: attribute.is_qualification_relevant ?? false,
          importance: attribute.importance || "Supporting",
          currency: attribute.currency || (attribute.data_type === "currency" ? "INR" : undefined),
          value_rule: attribute.value_rule || "any",
          options: attribute.options || [],
        })),
        positive_signals: (template.positive_signals || []).map((signal, index) => ({
          ...signal,
          signal_key: signal.signal_key || `legacy_signal_${signal.id || index}`,
          category: signal.category || "Other / Custom",
          source: signal.source || "custom",
        })),
        disqualification_criteria: (template.disqualification_criteria || []).map((criterion, index) => ({
          ...criterion,
          criterion_key: criterion.criterion_key || `legacy_disqualifier_${criterion.id || index}`,
          source: criterion.source || "custom",
        })),
      }))
      .catch((requestError) => setError(errorMessage(requestError)))
      .finally(() => setLoading(false));
  }, [id]);

  const updateCollection = (
    section: "criteria" | "attributes" | "positive_signals" | "disqualification_criteria" | "lead_temperatures",
    index: number,
    changes: Record<string, unknown>,
  ) => {
    setForm((current) => ({
      ...current,
      [section]: (current[section] as any[]).map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...changes } : item,
      ),
    }));
  };

  const removeFromCollection = (
    section: "criteria" | "attributes" | "positive_signals" | "disqualification_criteria",
    index: number,
  ) => {
    setForm((current) => ({
      ...current,
      [section]: (current[section] as any[]).filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const addItem = (section: "criteria" | "attributes" | "positive_signals" | "disqualification_criteria") => {
    const defaults = {
      criteria: { name: "", criterion_key: `custom_${Date.now()}`, source: "custom", importance: "Essential", description: "", is_required: true, weight: 10 },
      attributes: { key: "", label: "", data_type: "text", description: "", is_required: true, is_qualification_relevant: false, importance: "Supporting", currency: undefined, value_rule: "any", min_value: undefined, max_value: undefined, options: [] },
      positive_signals: { name: "", signal_key: `custom_signal_${Date.now()}`, category: "Other / Custom", source: "custom", description: "", score: 10 },
      disqualification_criteria: { name: "", criterion_key: `custom_disqualifier_${Date.now()}`, source: "custom", description: "", action: "disqualify" },
    };
    setForm((current) => ({
      ...current,
      [section]: [...(current[section] as any[]), defaults[section]],
    }));
  };

  const togglePredefinedCriterion = (criterionKey: string, label: string) => {
    setForm((current) => {
      const exists = current.criteria.some((criterion) => criterion.criterion_key === criterionKey);
      return {
        ...current,
        criteria: exists
          ? current.criteria.filter((criterion) => criterion.criterion_key !== criterionKey)
          : [
              ...current.criteria,
              {
                name: label,
                criterion_key: criterionKey,
                source: "predefined",
                importance: "Essential",
                description: "",
                is_required: true,
                weight: 10,
              },
            ],
      };
    });
  };

  const toggleCustomCriteria = () => {
    const hasCustomCriteria = form.criteria.some((criterion) => criterion.source === "custom");
    if (hasCustomCriteria) {
      setForm((current) => ({
        ...current,
        criteria: current.criteria.filter((criterion) => criterion.source !== "custom"),
      }));
      return;
    }
    addItem("criteria");
  };

  const togglePositiveSignal = (
    signalKey: string,
    name: string,
    category: "Interest" | "Commercial Interest" | "Next Step" | "Timing",
  ) => {
    setForm((current) => {
      const exists = current.positive_signals.some((signal) => signal.signal_key === signalKey);
      return {
        ...current,
        positive_signals: exists
          ? current.positive_signals.filter((signal) => signal.signal_key !== signalKey)
          : [...current.positive_signals, { name, signal_key: signalKey, category, source: "predefined", description: "", score: 10 }],
      };
    });
  };

  const toggleCustomSignals = () => {
    const hasCustomSignals = form.positive_signals.some((signal) => signal.source === "custom");
    if (hasCustomSignals) {
      setForm((current) => ({
        ...current,
        positive_signals: current.positive_signals.filter((signal) => signal.source !== "custom"),
      }));
      return;
    }
    addItem("positive_signals");
  };

  const toggleDisqualificationCriterion = (criterionKey: string, name: string) => {
    setForm((current) => {
      const exists = current.disqualification_criteria.some(
        (criterion) => criterion.criterion_key === criterionKey,
      );
      return {
        ...current,
        disqualification_criteria: exists
          ? current.disqualification_criteria.filter(
              (criterion) => criterion.criterion_key !== criterionKey,
            )
          : [
              ...current.disqualification_criteria,
              {
                name,
                criterion_key: criterionKey,
                source: "predefined",
                description: "",
                action: "disqualify",
              },
            ],
      };
    });
  };

  const toggleCustomDisqualifiers = () => {
    const hasCustomReasons = form.disqualification_criteria.some(
      (criterion) => criterion.source === "custom",
    );
    if (hasCustomReasons) {
      setForm((current) => ({
        ...current,
        disqualification_criteria: current.disqualification_criteria.filter(
          (criterion) => criterion.source !== "custom",
        ),
      }));
      return;
    }
    addItem("disqualification_criteria");
  };

  const validate = () => {
    if (!form.name.trim() || !form.objective.trim()) {
      setActiveTab(0);
      setError("Template name and campaign objective are required.");
      return false;
    }
    const missingCriteriaName = form.criteria.some((item) => !item.name.trim());
    const missingSignalName = form.positive_signals.some((item) => !item.name.trim());
    const missingDisqualifierName = form.disqualification_criteria.some((item) => !item.name.trim());
    if (missingCriteriaName || missingSignalName || missingDisqualifierName) {
      setError("Every configured rule must have a name.");
      return false;
    }
    const keys = form.attributes.map((item) => item.key.trim());
    if (form.attributes.some((item) => !item.label.trim() || !/^[a-z][a-z0-9_]*$/.test(item.key))) {
      setActiveTab(2);
      setError("Each attribute needs a label and a lowercase key using letters, numbers, or underscores.");
      return false;
    }
    if (new Set(keys).size !== keys.length) {
      setActiveTab(2);
      setError("Business attribute keys must be unique.");
      return false;
    }
    const ordered = [...form.lead_temperatures].sort((a, b) => a.min_score - b.min_score);
    const contiguous = ordered[0]?.min_score === 1 && ordered[ordered.length - 1]?.max_score === 100
      && ordered.every((item, index) => index === 0 || item.min_score === ordered[index - 1].max_score + 1);
    if (!contiguous || ordered.some((item) => item.min_score > item.max_score)) {
      setActiveTab(5);
      setError("Temperature ranges must be contiguous, non-overlapping, and cover 1 through 100.");
      return false;
    }
    return true;
  };

  const validateSection = (section: number) => {
    if (section === 0 && (!form.name.trim() || !form.objective.trim())) {
      setError("Template name and campaign objective are required before continuing.");
      return false;
    }
    if (section === 1 && form.criteria.some((item) => !item.name.trim())) {
      setError("Every qualification criterion must have a name.");
      return false;
    }
    if (section === 2) {
      const keys = form.attributes.map((item) => item.key.trim());
      if (form.attributes.some((item) => !item.label.trim() || !/^[a-z][a-z0-9_]*$/.test(item.key))) {
        setError("Each attribute needs a label and a lowercase key using letters, numbers, or underscores.");
        return false;
      }
      if (new Set(keys).size !== keys.length) {
        setError("Business attribute keys must be unique.");
        return false;
      }
      const invalidOptions = form.attributes.some((attribute) =>
        selectableAttributeTypes.has(attribute.data_type)
        && (!attribute.options.length || attribute.options.some((option) => !option.trim()))
      );
      if (invalidOptions) {
        setError("Single Select and Multi Select attributes require at least one completed option.");
        return false;
      }
      const invalidRange = form.attributes.some((attribute) =>
        attribute.is_qualification_relevant
        && numericAttributeTypes.has(attribute.data_type)
        && ((attribute.value_rule === "minimum" && attribute.min_value === undefined)
          || (attribute.value_rule === "maximum" && attribute.max_value === undefined)
          || (attribute.value_rule === "range" && (attribute.min_value === undefined || attribute.max_value === undefined || attribute.min_value > attribute.max_value)))
      );
      if (invalidRange) {
        setError("Complete the relevant numeric value rule and ensure the minimum does not exceed the maximum.");
        return false;
      }
    }
    if (section === 3 && form.positive_signals.some((item) => !item.name.trim())) {
      setError("Every positive signal must have a name.");
      return false;
    }
    if (section === 4 && form.disqualification_criteria.some((item) => !item.name.trim())) {
      setError("Every disqualification criterion must have a name.");
      return false;
    }
    return true;
  };

  const saveAndContinue = async () => {
    if (!validateSection(activeTab)) return;
    setSaving(true);
    setError("");
    try {
      const savedTemplate = id
        ? await qualificationTemplateService.update(id, form)
        : await qualificationTemplateService.create(form);
      setForm(savedTemplate);
      setSuccess(`${tabs[activeTab].label} saved.`);
      if (!id) {
        navigate(`/qualification-templates/${savedTemplate.id}/edit`, { replace: true });
      }
      setActiveTab((current) => Math.min(current + 1, tabs.length - 1));
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    setError("");
    try {
      if (id) await qualificationTemplateService.update(id, form);
      else await qualificationTemplateService.create(form);
      navigate("/qualification-templates");
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const orderedTemperatures = [...form.lead_temperatures].sort(
    (first, second) => first.min_score - second.min_score,
  );
  const temperatureRangesValid =
    orderedTemperatures.length === 4
    && orderedTemperatures[0]?.min_score === 1
    && orderedTemperatures[orderedTemperatures.length - 1]?.max_score === 100
    && orderedTemperatures.every(
      (temperature, index) =>
        temperature.min_score <= temperature.max_score
        && (index === 0 || temperature.min_score === orderedTemperatures[index - 1].max_score + 1),
    );

  const sectionComplete = [
    Boolean(form.name.trim() && form.objective.trim()),
    form.criteria.length > 0 && form.criteria.every((item) => item.name.trim()),
    form.attributes.length > 0 && form.attributes.every((item) => item.key.trim() && item.label.trim()),
    form.positive_signals.length > 0 && form.positive_signals.every((item) => item.name.trim()),
    form.disqualification_criteria.length > 0 && form.disqualification_criteria.every((item) => item.name.trim()),
    temperatureRangesValid,
  ];

  if (loading) {
    return <AdminLayout><Box sx={{ minHeight: 520, display: "grid", placeItems: "center" }}><CircularProgress /></Box></AdminLayout>;
  }

  const itemPaperSx = {
    p: 2,
    border: `1px solid ${theme.palette.divider}`,
    bgcolor: alpha(theme.palette.background.paper, 0.78),
  };

  return (
    <AdminLayout>
      <Box sx={{ width: "100%", maxWidth: 1460, mx: "auto", p: { xs: 1.5, md: 3 } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 2.5 }}>
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
            <Tooltip title="Back to qualification templates">
              <IconButton onClick={() => navigate("/qualification-templates")}><ArrowBackIcon /></IconButton>
            </Tooltip>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h4" fontWeight={800} noWrap>{id ? "Edit qualification template" : "New qualification template"}</Typography>
              <Typography variant="body2" color="text.secondary">Build a reusable decision framework in six focused steps.</Typography>
            </Box>
          </Stack>
          <Button variant="contained" startIcon={<SaveOutlinedIcon />} onClick={save} disabled={saving} sx={{ bgcolor: "#157f78", "&:hover": { bgcolor: "#106c66" } }}>
            {saving ? "Saving..." : "Save template"}
          </Button>
        </Stack>

        <Paper elevation={0} sx={{ border: `1px solid ${theme.palette.divider}`, overflow: "hidden", boxShadow: `0 20px 55px ${alpha(theme.palette.common.black, 0.08)}` }}>
          <Box sx={{ borderBottom: `1px solid ${theme.palette.divider}`, bgcolor: alpha(theme.palette.primary.main, 0.035) }}>
            <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} variant="scrollable" scrollButtons="auto" aria-label="Qualification template sections">
              {tabs.map((tab, index) => (
                <Tab
                  key={tab.short}
                  icon={sectionComplete[index] ? <CheckCircleOutlineIcon color="success" /> : tab.icon}
                  iconPosition="start"
                  label={<Box sx={{ textAlign: "left" }}><Typography variant="caption" color="text.secondary">0{index + 1}</Typography><Typography variant="body2" fontWeight={800}>{tab.short}</Typography></Box>}
                  sx={{ minHeight: 72, px: 2.2 }}
                />
              ))}
            </Tabs>
          </Box>

          <Box sx={{ p: { xs: 2, md: 3.5 }, minHeight: 520 }}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h5" fontWeight={800}>{tabs[activeTab].label}</Typography>
              <Typography color="text.secondary">{sectionCopy[activeTab]}</Typography>
            </Box>

            {activeTab === 0 && (
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.55fr) minmax(300px, .75fr)" }, gap: 2.5 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: { xs: 2, md: 3 },
                    border: `1px solid ${alpha("#157f78", 0.28)}`,
                    background: theme.palette.mode === "dark"
                      ? `linear-gradient(145deg, ${alpha("#157f78", 0.18)}, ${alpha(theme.palette.background.paper, 0.92)} 48%)`
                      : "linear-gradient(145deg, #effaf8 0%, #ffffff 48%, #f4f8ff 100%)",
                    boxShadow: `0 18px 42px ${alpha("#157f78", 0.1)}`,
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
                    <Box sx={{ width: 46, height: 46, display: "grid", placeItems: "center", borderRadius: 2, bgcolor: "#157f78", color: "#fff", boxShadow: "0 10px 22px rgba(21,127,120,.24)" }}>
                      <CampaignOutlinedIcon />
                    </Box>
                    <Box>
                      <Typography variant="overline" color="text.secondary" fontWeight={800}>Campaign foundation</Typography>
                      <Typography variant="h6" fontWeight={900}>Give your qualification logic a clear north star</Typography>
                    </Box>
                  </Stack>

                  <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
                    <TextField required fullWidth label="Template name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Inbound sales qualification" />
                    <TextField select label="Status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as any })} sx={{ minWidth: { xs: "100%", md: 170 } }}>
                      <MenuItem value="Active">Active</MenuItem>
                      <MenuItem value="Inactive">Inactive</MenuItem>
                    </TextField>
                  </Stack>
                  <TextField fullWidth label="Internal description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Help your team recognize when to use this template" sx={{ mb: 3 }} />

                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, mb: 1.25 }}>
                    <Typography component="label" htmlFor="campaign-objective" variant="h6" fontWeight={900}>
                      What are you trying to achieve with this campaign?
                      <Box component="span" sx={{ color: "error.main", ml: 0.5 }}>*</Box>
                    </Typography>
                    <Chip icon={<EditNoteOutlinedIcon />} label="Editable" size="small" sx={{ flexShrink: 0, fontWeight: 800, bgcolor: alpha("#157f78", 0.1), color: "#106c66" }} />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Describe the customer outcome the campaign should identify. This becomes the guiding intent for every qualification decision.
                  </Typography>
                  <TextField
                    id="campaign-objective"
                    required
                    fullWidth
                    multiline
                    minRows={7}
                    value={form.objective}
                    onChange={(event) => setForm({ ...form, objective: event.target.value })}
                    placeholder={defaultCampaignObjective}
                    inputProps={{ "aria-label": "What are you trying to achieve with this campaign?" }}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        alignItems: "flex-start",
                        bgcolor: alpha(theme.palette.background.paper, 0.84),
                        fontSize: "1.05rem",
                        lineHeight: 1.75,
                        "& fieldset": { borderWidth: 2, borderColor: alpha("#157f78", 0.24) },
                        "&:hover fieldset": { borderColor: alpha("#157f78", 0.55) },
                        "&.Mui-focused fieldset": { borderColor: "#157f78" },
                      },
                    }}
                  />
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">Required field</Typography>
                    <Typography variant="caption" color="text.secondary">{form.objective.length} characters</Typography>
                  </Stack>
                </Paper>

                <Stack spacing={2}>
                  <Paper elevation={0} sx={{ p: 2.5, border: `1px solid ${theme.palette.divider}`, bgcolor: alpha(theme.palette.background.paper, 0.72) }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                      <AutoAwesomeOutlinedIcon sx={{ color: "#d59b20" }} />
                      <Typography fontWeight={900}>A strong objective is</Typography>
                    </Stack>
                    <Stack spacing={1.25}>
                      {["Specific about the target customer", "Focused on observable intent", "Clear about the desired next step"].map((tip) => (
                        <Stack key={tip} direction="row" spacing={1} alignItems="center">
                          <CheckCircleOutlineIcon sx={{ fontSize: 18, color: "#168a72" }} />
                          <Typography variant="body2">{tip}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Paper>

                  <Paper elevation={0} sx={{ p: 2.5, border: `1px solid ${theme.palette.divider}`, bgcolor: alpha(theme.palette.primary.main, 0.035) }}>
                    <Typography variant="subtitle1" fontWeight={900} sx={{ mb: 0.5 }}>Objective examples</Typography>
                    <Typography variant="caption" color="text.secondary">Select an example to use it as your starting point.</Typography>
                    <Stack spacing={1} sx={{ mt: 1.75 }}>
                      {campaignObjectiveExamples.map((example) => (
                        <Button
                          key={example}
                          variant="text"
                          onClick={() => setForm({ ...form, objective: example })}
                          sx={{ justifyContent: "flex-start", textAlign: "left", alignItems: "flex-start", px: 1.25, py: 1, color: "text.primary", border: `1px solid ${alpha(theme.palette.divider, 0.75)}`, bgcolor: alpha(theme.palette.background.paper, 0.58), "&:hover": { borderColor: "#157f78", bgcolor: alpha("#157f78", 0.07) } }}
                        >
                          {example}
                        </Button>
                      ))}
                    </Stack>
                  </Paper>
                </Stack>
              </Box>
            )}

            {activeTab === 1 && (
              <Stack spacing={2.5}>
                <Paper
                  elevation={0}
                  sx={{
                    p: { xs: 2, md: 3 },
                    border: `1px solid ${alpha("#157f78", 0.25)}`,
                    background: theme.palette.mode === "dark"
                      ? `linear-gradient(145deg, ${alpha("#157f78", 0.15)}, ${alpha(theme.palette.background.paper, 0.94)} 46%)`
                      : "linear-gradient(145deg, #effaf8 0%, #ffffff 48%, #f5f8fd 100%)",
                    boxShadow: `0 16px 40px ${alpha("#157f78", 0.08)}`,
                  }}
                >
                  <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2} sx={{ mb: 2.5 }}>
                    <Box>
                      <Stack direction="row" spacing={1.25} alignItems="center">
                        <Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: "#157f78", color: "#fff", display: "grid", placeItems: "center" }}><FactCheckOutlinedIcon /></Box>
                        <Box>
                          <Typography variant="h6" fontWeight={900}>What makes a lead qualified?</Typography>
                          <Typography variant="body2" color="text.secondary">Select all requirements that apply to this campaign.</Typography>
                        </Box>
                      </Stack>
                    </Box>
                    <Chip
                      label={`${form.criteria.length} selected`}
                      color={form.criteria.length ? "success" : "default"}
                      variant={form.criteria.length ? "filled" : "outlined"}
                      sx={{ alignSelf: { xs: "flex-start", md: "center" }, fontWeight: 800 }}
                    />
                  </Stack>

                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.25 }}>
                    {predefinedQualificationCriteria.map((option) => {
                      const selected = form.criteria.some((criterion) => criterion.criterion_key === option.key);
                      return (
                        <Box
                          key={option.key}
                          onClick={() => togglePredefinedCriterion(option.key, option.label)}
                          role="checkbox"
                          aria-checked={selected}
                          tabIndex={0}
                          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") togglePredefinedCriterion(option.key, option.label); }}
                          sx={{
                            minHeight: 78,
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 1,
                            p: 1.4,
                            borderRadius: 1.5,
                            cursor: "pointer",
                            border: `1px solid ${selected ? "#157f78" : theme.palette.divider}`,
                            bgcolor: selected ? alpha("#157f78", 0.09) : alpha(theme.palette.background.paper, 0.62),
                            boxShadow: selected ? `0 8px 20px ${alpha("#157f78", 0.1)}` : "none",
                            transition: "border-color 160ms ease, background 160ms ease, box-shadow 160ms ease",
                            "&:hover": { borderColor: alpha("#157f78", 0.65), bgcolor: alpha("#157f78", 0.055) },
                          }}
                        >
                          <Checkbox checked={selected} tabIndex={-1} disableRipple sx={{ p: 0.35, color: "#157f78", "&.Mui-checked": { color: "#157f78" } }} />
                          <Box>
                            <Typography variant="body2" fontWeight={850}>{option.label}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.35, display: "block", mt: 0.35 }}>{option.hint}</Typography>
                          </Box>
                        </Box>
                      );
                    })}
                    <Box
                      onClick={toggleCustomCriteria}
                      role="checkbox"
                      aria-checked={form.criteria.some((criterion) => criterion.source === "custom")}
                      tabIndex={0}
                      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") toggleCustomCriteria(); }}
                      sx={{
                        minHeight: 78,
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 1,
                        p: 1.4,
                        borderRadius: 1.5,
                        cursor: "pointer",
                        border: `1px solid ${form.criteria.some((criterion) => criterion.source === "custom") ? "#157f78" : theme.palette.divider}`,
                        bgcolor: form.criteria.some((criterion) => criterion.source === "custom") ? alpha("#157f78", 0.09) : alpha(theme.palette.background.paper, 0.62),
                        "&:hover": { borderColor: alpha("#157f78", 0.65), bgcolor: alpha("#157f78", 0.055) },
                      }}
                    >
                      <Checkbox checked={form.criteria.some((criterion) => criterion.source === "custom")} tabIndex={-1} disableRipple sx={{ p: 0.35, color: "#157f78", "&.Mui-checked": { color: "#157f78" } }} />
                      <Box>
                        <Typography variant="body2" fontWeight={850}>Other / Custom</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.35, display: "block", mt: 0.35 }}>Define one or more organization-specific qualification requirements.</Typography>
                      </Box>
                    </Box>
                  </Box>
                </Paper>

                {form.criteria.some((criterion) => criterion.source === "custom") && (
                <Paper elevation={0} sx={{ p: { xs: 2, md: 2.5 }, border: `1px solid ${theme.palette.divider}`, bgcolor: alpha(theme.palette.background.paper, 0.76) }}>
                  <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} gap={1} sx={{ mb: 2 }}>
                    <Box>
                      <Typography variant="h6" fontWeight={900}>Other / Custom requirements</Typography>
                      <Typography variant="body2" color="text.secondary">Add business-specific conditions that are not covered above.</Typography>
                    </Box>
                    <Button variant="outlined" startIcon={<AddIcon />} onClick={() => addItem("criteria")}>Add another custom requirement</Button>
                  </Stack>
                  <Stack spacing={1.5}>
                    {form.criteria.map((criterion, index) => criterion.source === "custom" && (
                      <Box key={criterion.criterion_key || index} sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                        <TextField
                          required
                          fullWidth
                          multiline
                          minRows={2}
                          label="Describe the additional qualification requirement"
                          placeholder="The customer must have an active requirement for at least 100 units."
                          value={criterion.name}
                          onChange={(event) => updateCollection("criteria", index, { name: event.target.value })}
                        />
                        <Tooltip title="Remove custom requirement"><IconButton color="error" onClick={() => removeFromCollection("criteria", index)}><DeleteOutlineIcon /></IconButton></Tooltip>
                      </Box>
                    ))}
                  </Stack>
                </Paper>
                )}

                <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: `1px solid ${theme.palette.divider}`, bgcolor: alpha(theme.palette.primary.main, 0.025) }}>
                  <Typography variant="h6" fontWeight={900}>How should these requirements be considered?</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Choose the decision rule used when evaluating the selected requirements.</Typography>
                  <RadioGroup
                    value={form.qualification_mode}
                    onChange={(event) => setForm({ ...form, qualification_mode: event.target.value as QualificationTemplatePayload["qualification_mode"] })}
                    sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(3, 1fr)" }, gap: 1.5 }}
                  >
                    {[
                      { value: "essential_supporting", title: "Essential + Supporting", detail: "All Essential requirements must be satisfied. Supporting requirements strengthen qualification." },
                      { value: "any_selected", title: "Any selected requirement", detail: "Any one selected requirement can qualify the lead." },
                      { value: "all_selected", title: "All selected requirements", detail: "Every selected requirement must be satisfied." },
                    ].map((mode) => {
                      const selected = form.qualification_mode === mode.value;
                      return (
                        <FormControlLabel
                          key={mode.value}
                          value={mode.value}
                          control={<Radio sx={{ color: "#157f78", "&.Mui-checked": { color: "#157f78" } }} />}
                          label={<Box><Typography fontWeight={850}>{mode.title}</Typography><Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4, display: "block" }}>{mode.detail}</Typography></Box>}
                          sx={{ m: 0, p: 1.5, alignItems: "flex-start", borderRadius: 1.5, border: `1px solid ${selected ? "#157f78" : theme.palette.divider}`, bgcolor: selected ? alpha("#157f78", 0.08) : alpha(theme.palette.background.paper, 0.62) }}
                        />
                      );
                    })}
                  </RadioGroup>
                </Paper>

                {form.qualification_mode === "essential_supporting" && form.criteria.length > 0 && (
                  <Paper elevation={0} sx={{ overflow: "hidden", border: `1px solid ${theme.palette.divider}` }}>
                    <Box sx={{ p: 2.25, bgcolor: alpha("#157f78", 0.07), borderBottom: `1px solid ${theme.palette.divider}` }}>
                      <Typography variant="h6" fontWeight={900}>Set requirement importance</Typography>
                      <Typography variant="body2" color="text.secondary">Essential items are mandatory. Supporting items add confidence but do not block qualification.</Typography>
                    </Box>
                    <Stack divider={<Box sx={{ borderTop: `1px solid ${theme.palette.divider}` }} />}>
                      {form.criteria.map((criterion, index) => (
                        <Stack key={criterion.criterion_key || index} direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} gap={1.5} sx={{ px: 2.25, py: 1.5 }}>
                          <Stack direction="row" spacing={1.25} alignItems="center">
                            <Box sx={{ width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: 1.2, bgcolor: criterion.importance === "Essential" ? alpha("#d84b5d", 0.1) : alpha("#d59b20", 0.12), color: criterion.importance === "Essential" ? "#c7374b" : "#a9740d" }}>
                              <FactCheckOutlinedIcon fontSize="small" />
                            </Box>
                            <Box><Typography variant="body2" fontWeight={850}>{criterion.name || "Untitled custom requirement"}</Typography><Typography variant="caption" color="text.secondary">{criterion.source === "custom" ? "Custom requirement" : "Standard requirement"}</Typography></Box>
                          </Stack>
                          <TextField
                            select
                            size="small"
                            label="Importance"
                            value={criterion.importance}
                            onChange={(event) => updateCollection("criteria", index, { importance: event.target.value, is_required: event.target.value === "Essential" })}
                            sx={{ minWidth: 170 }}
                          >
                            <MenuItem value="Essential">Essential</MenuItem>
                            <MenuItem value="Supporting">Supporting</MenuItem>
                          </TextField>
                        </Stack>
                      ))}
                    </Stack>
                  </Paper>
                )}
              </Stack>
            )}

            {activeTab === 2 && (
              <Stack spacing={2.5}>
                <Paper
                  elevation={0}
                  sx={{
                    p: { xs: 2, md: 3 },
                    display: "flex",
                    flexDirection: { xs: "column", sm: "row" },
                    justifyContent: "space-between",
                    alignItems: { xs: "flex-start", sm: "center" },
                    gap: 2,
                    border: `1px solid ${alpha("#157f78", 0.25)}`,
                    background: theme.palette.mode === "dark"
                      ? `linear-gradient(145deg, ${alpha("#157f78", 0.16)}, ${alpha(theme.palette.background.paper, 0.94)} 52%)`
                      : "linear-gradient(145deg, #effaf8 0%, #ffffff 55%, #f3f7fd 100%)",
                    boxShadow: `0 16px 40px ${alpha("#157f78", 0.08)}`,
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box sx={{ width: 46, height: 46, borderRadius: 2, bgcolor: "#157f78", color: "#fff", display: "grid", placeItems: "center", boxShadow: "0 10px 22px rgba(21,127,120,.22)" }}><DataObjectOutlinedIcon /></Box>
                    <Box>
                      <Typography variant="h6" fontWeight={900}>Business-specific qualification data</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 720 }}>Define exactly what the agent should collect. Attributes are organization-specific and never hardcoded by industry.</Typography>
                    </Box>
                  </Stack>
                  <Button variant="contained" startIcon={<AddIcon />} onClick={() => addItem("attributes")} sx={{ bgcolor: "#157f78", whiteSpace: "nowrap", "&:hover": { bgcolor: "#106c66" } }}>Add attribute</Button>
                </Paper>

                {form.attributes.length === 0 && (
                  <Paper elevation={0} sx={{ py: 7, px: 2, textAlign: "center", border: `1px dashed ${alpha(theme.palette.text.secondary, 0.35)}`, bgcolor: alpha(theme.palette.background.paper, 0.55) }}>
                    <Box sx={{ width: 54, height: 54, display: "grid", placeItems: "center", mx: "auto", mb: 1.5, borderRadius: 2, bgcolor: alpha("#157f78", 0.1), color: "#157f78" }}><TuneIcon /></Box>
                    <Typography variant="h6" fontWeight={900}>No business attributes yet</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Add details such as Budget, Property Type, Current Software, or any field unique to this organization.</Typography>
                    <Button variant="outlined" startIcon={<AddIcon />} onClick={() => addItem("attributes")}>Add your first attribute</Button>
                  </Paper>
                )}

                {form.attributes.map((attribute, index) => (
                  <Paper key={attribute.id || index} elevation={0} sx={{ overflow: "hidden", border: `1px solid ${attribute.is_qualification_relevant ? alpha("#157f78", 0.42) : theme.palette.divider}`, boxShadow: attribute.is_qualification_relevant ? `0 14px 34px ${alpha("#157f78", 0.08)}` : "none" }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: { xs: 2, md: 2.5 }, py: 1.6, bgcolor: attribute.is_qualification_relevant ? alpha("#157f78", 0.07) : alpha(theme.palette.primary.main, 0.035), borderBottom: `1px solid ${theme.palette.divider}` }}>
                      <Stack direction="row" spacing={1.25} alignItems="center">
                        <Box sx={{ width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: 1.25, bgcolor: attribute.data_type === "currency" ? alpha("#d59b20", 0.15) : alpha("#157f78", 0.11), color: attribute.data_type === "currency" ? "#a9740d" : "#106c66" }}>
                          {attribute.data_type === "currency" ? <AccountBalanceWalletOutlinedIcon fontSize="small" /> : <DataObjectOutlinedIcon fontSize="small" />}
                        </Box>
                        <Box><Typography fontWeight={900}>{attribute.label || `Untitled attribute ${index + 1}`}</Typography><Typography variant="caption" color="text.secondary">{attributeDataTypes.find((type) => type.value === attribute.data_type)?.label || "Select data type"}{attribute.is_qualification_relevant ? " · Qualification relevant" : " · Information only"}</Typography></Box>
                      </Stack>
                      <Tooltip title="Remove attribute"><IconButton color="error" onClick={() => removeFromCollection("attributes", index)}><DeleteOutlineIcon /></IconButton></Tooltip>
                    </Stack>
                    <Box sx={{ p: { xs: 2, md: 2.5 } }}>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.15fr .85fr" }, gap: 2 }}>
                      <TextField required label="Attribute name" value={attribute.label} onChange={(event) => { const label = event.target.value; updateCollection("attributes", index, { label, key: label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") }); }} placeholder="Budget" />
                      <TextField select required label="Data type" value={attribute.data_type} onChange={(event) => { const dataType = event.target.value; updateCollection("attributes", index, { data_type: dataType, options: selectableAttributeTypes.has(dataType) ? attribute.options : [], currency: dataType === "currency" ? (attribute.currency || "INR") : undefined, value_rule: numericAttributeTypes.has(dataType) ? attribute.value_rule : "any", min_value: numericAttributeTypes.has(dataType) ? attribute.min_value : undefined, max_value: numericAttributeTypes.has(dataType) ? attribute.max_value : undefined }); }}>
                        {attributeDataTypes.map((type) => <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>)}
                      </TextField>
                    </Box>
                    <TextField fullWidth multiline minRows={2} label="What does this information represent?" value={attribute.description || ""} onChange={(event) => updateCollection("attributes", index, { description: event.target.value })} placeholder="Customer's expected budget for the purchase." sx={{ mt: 2 }} />

                    {attribute.data_type === "currency" && (
                      <TextField select label="Currency" value={attribute.currency || "INR"} onChange={(event) => updateCollection("attributes", index, { currency: event.target.value })} sx={{ minWidth: 180, mt: 2 }}>
                        <MenuItem value="INR">INR (₹)</MenuItem><MenuItem value="USD">USD ($)</MenuItem><MenuItem value="EUR">EUR (€)</MenuItem><MenuItem value="GBP">GBP (£)</MenuItem><MenuItem value="AED">AED</MenuItem>
                      </TextField>
                    )}

                    {selectableAttributeTypes.has(attribute.data_type) && (
                      <Box sx={{ mt: 2.5, p: 2, borderRadius: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.035), border: `1px solid ${theme.palette.divider}` }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}><Box><Typography fontWeight={900}>Options</Typography><Typography variant="caption" color="text.secondary">One choice per row. Order is preserved.</Typography></Box><Button size="small" startIcon={<AddIcon />} onClick={() => updateCollection("attributes", index, { options: [...attribute.options, ""] })}>Add option</Button></Stack>
                        <Stack spacing={1}>
                          {attribute.options.map((option, optionIndex) => (
                            <Stack key={optionIndex} direction="row" spacing={1} alignItems="center"><TextField fullWidth size="small" label={`Option ${optionIndex + 1}`} value={option} onChange={(event) => updateCollection("attributes", index, { options: attribute.options.map((current, currentIndex) => currentIndex === optionIndex ? event.target.value : current) })} placeholder={optionIndex === 0 ? "Apartment" : "Add another choice"} /><Tooltip title="Delete option"><IconButton color="error" onClick={() => updateCollection("attributes", index, { options: attribute.options.filter((_, currentIndex) => currentIndex !== optionIndex) })}><DeleteOutlineIcon /></IconButton></Tooltip></Stack>
                          ))}
                          {attribute.options.length === 0 && <Typography variant="body2" color="text.secondary">Add at least one option for this data type.</Typography>}
                        </Stack>
                      </Box>
                    )}

                    <Box sx={{ mt: 2.5, display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1.4fr" }, gap: 2 }}>
                      <Box sx={{ p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1.5 }}><Typography fontWeight={900}>Required?</Typography><RadioGroup row value={attribute.is_required ? "yes" : "no"} onChange={(event) => updateCollection("attributes", index, { is_required: event.target.value === "yes" })}><FormControlLabel value="yes" control={<Radio />} label="Yes" /><FormControlLabel value="no" control={<Radio />} label="No" /></RadioGroup></Box>
                      <Box sx={{ p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1.5 }}><Typography fontWeight={900}>Qualification relevant?</Typography><RadioGroup row value={attribute.is_qualification_relevant ? "yes" : "no"} onChange={(event) => updateCollection("attributes", index, { is_qualification_relevant: event.target.value === "yes", importance: event.target.value === "yes" ? attribute.importance : "Supporting", value_rule: event.target.value === "yes" ? attribute.value_rule : "any", min_value: event.target.value === "yes" ? attribute.min_value : undefined, max_value: event.target.value === "yes" ? attribute.max_value : undefined })}><FormControlLabel value="yes" control={<Radio />} label="Yes — Consider for qualification" /><FormControlLabel value="no" control={<Radio />} label="No — Information only" /></RadioGroup></Box>
                    </Box>

                    {attribute.is_qualification_relevant && (
                      <Box sx={{ mt: 2, p: 2, borderRadius: 1.5, border: `1px solid ${alpha("#157f78", 0.3)}`, bgcolor: alpha("#157f78", 0.055) }}>
                        <Typography fontWeight={900}>Qualification importance</Typography>
                        <RadioGroup row value={attribute.importance} onChange={(event) => updateCollection("attributes", index, { importance: event.target.value })}><FormControlLabel value="Essential" control={<Radio />} label="Essential" /><FormControlLabel value="Supporting" control={<Radio />} label="Supporting" /></RadioGroup>

                        {numericAttributeTypes.has(attribute.data_type) && (
                          <Box sx={{ mt: 1.5, pt: 2, borderTop: `1px solid ${alpha("#157f78", 0.2)}` }}>
                            <Typography fontWeight={900} sx={{ mb: 1 }}>Relevant value</Typography>
                            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
                              <RadioGroup row value={attribute.value_rule} onChange={(event) => updateCollection("attributes", index, { value_rule: event.target.value, min_value: event.target.value === "any" || event.target.value === "maximum" ? undefined : attribute.min_value, max_value: event.target.value === "any" || event.target.value === "minimum" ? undefined : attribute.max_value })}><FormControlLabel value="any" control={<Radio />} label="Any value" /><FormControlLabel value="minimum" control={<Radio />} label="Minimum" /><FormControlLabel value="maximum" control={<Radio />} label="Maximum" /><FormControlLabel value="range" control={<Radio />} label="Range" /></RadioGroup>
                            </Stack>
                            {attribute.value_rule !== "any" && <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 1.5 }}>{(attribute.value_rule === "minimum" || attribute.value_rule === "range") && <TextField type="number" label="Minimum value" value={attribute.min_value ?? ""} onChange={(event) => updateCollection("attributes", index, { min_value: event.target.value === "" ? undefined : Number(event.target.value) })} />}{(attribute.value_rule === "maximum" || attribute.value_rule === "range") && <TextField type="number" label="Maximum value" value={attribute.max_value ?? ""} onChange={(event) => updateCollection("attributes", index, { max_value: event.target.value === "" ? undefined : Number(event.target.value) })} />}</Stack>}
                          </Box>
                        )}
                      </Box>
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>System key: {attribute.key || "generated from attribute name"}</Typography>
                    </Box>
                  </Paper>
                ))}
              </Stack>
            )}

            {activeTab === 3 && (
              <Stack spacing={2.5}>
                <Paper
                  elevation={0}
                  sx={{
                    p: { xs: 2, md: 3 },
                    border: `1px solid ${alpha("#157f78", 0.25)}`,
                    background: theme.palette.mode === "dark"
                      ? `linear-gradient(145deg, ${alpha("#157f78", 0.16)}, ${alpha(theme.palette.background.paper, 0.94)} 50%)`
                      : "linear-gradient(145deg, #effaf8 0%, #ffffff 52%, #f3f7fd 100%)",
                    boxShadow: `0 16px 40px ${alpha("#157f78", 0.08)}`,
                  }}
                >
                  <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} gap={2}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Box sx={{ width: 46, height: 46, borderRadius: 2, bgcolor: "#157f78", color: "#fff", display: "grid", placeItems: "center", boxShadow: "0 10px 22px rgba(21,127,120,.22)" }}><ThumbUpAltOutlinedIcon /></Box>
                      <Box>
                        <Typography variant="h6" fontWeight={900}>What indicates genuine interest?</Typography>
                        <Typography variant="body2" color="text.secondary">Select every signal the agent should recognize during a conversation.</Typography>
                      </Box>
                    </Stack>
                    <Chip label={`${form.positive_signals.length} selected`} color={form.positive_signals.length ? "success" : "default"} variant={form.positive_signals.length ? "filled" : "outlined"} sx={{ fontWeight: 800 }} />
                  </Stack>
                </Paper>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "1fr 1fr" }, gap: 2 }}>
                  {positiveSignalGroups.map((group) => {
                    const selectedCount = group.signals.filter(([key]) => form.positive_signals.some((signal) => signal.signal_key === key)).length;
                    return (
                      <Paper key={group.category} elevation={0} sx={{ overflow: "hidden", border: `1px solid ${theme.palette.divider}`, bgcolor: alpha(theme.palette.background.paper, 0.75) }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2.25, py: 1.75, borderBottom: `1px solid ${theme.palette.divider}`, bgcolor: alpha(group.color, 0.07) }}>
                          <Stack direction="row" spacing={1.2} alignItems="center">
                            <Box sx={{ width: 36, height: 36, borderRadius: 1.4, display: "grid", placeItems: "center", bgcolor: alpha(group.color, 0.13), color: group.color }}>{group.icon}</Box>
                            <Box><Typography fontWeight={900}>{group.category}</Typography><Typography variant="caption" color="text.secondary">{group.description}</Typography></Box>
                          </Stack>
                          <Chip size="small" label={`${selectedCount}/${group.signals.length}`} sx={{ fontWeight: 800, color: group.color, bgcolor: alpha(group.color, 0.1) }} />
                        </Stack>
                        <Stack sx={{ p: 1.25 }}>
                          {group.signals.map(([signalKey, signalName]) => {
                            const selected = form.positive_signals.some((signal) => signal.signal_key === signalKey);
                            return (
                              <Box
                                key={signalKey}
                                role="checkbox"
                                aria-checked={selected}
                                tabIndex={0}
                                onClick={() => togglePositiveSignal(signalKey, signalName, group.category)}
                                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") togglePositiveSignal(signalKey, signalName, group.category); }}
                                sx={{ display: "flex", alignItems: "center", gap: 1, minHeight: 46, px: 1, borderRadius: 1.25, cursor: "pointer", border: `1px solid ${selected ? alpha(group.color, 0.48) : "transparent"}`, bgcolor: selected ? alpha(group.color, 0.075) : "transparent", "&:hover": { bgcolor: alpha(group.color, 0.055) } }}
                              >
                                <Checkbox checked={selected} tabIndex={-1} disableRipple sx={{ p: 0.5, color: group.color, "&.Mui-checked": { color: group.color } }} />
                                <Typography variant="body2" fontWeight={selected ? 800 : 600}>{signalName}</Typography>
                              </Box>
                            );
                          })}
                        </Stack>
                      </Paper>
                    );
                  })}
                </Box>

                <Paper elevation={0} sx={{ overflow: "hidden", border: `1px solid ${form.positive_signals.some((signal) => signal.source === "custom") ? alpha("#157f78", 0.45) : theme.palette.divider}` }}>
                  <Box
                    role="checkbox"
                    aria-checked={form.positive_signals.some((signal) => signal.source === "custom")}
                    tabIndex={0}
                    onClick={toggleCustomSignals}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") toggleCustomSignals(); }}
                    sx={{ p: 2.25, display: "flex", alignItems: "center", gap: 1.25, cursor: "pointer", bgcolor: form.positive_signals.some((signal) => signal.source === "custom") ? alpha("#157f78", 0.075) : alpha(theme.palette.primary.main, 0.025) }}
                  >
                    <Checkbox checked={form.positive_signals.some((signal) => signal.source === "custom")} tabIndex={-1} disableRipple sx={{ color: "#157f78", "&.Mui-checked": { color: "#157f78" } }} />
                    <Box><Typography variant="h6" fontWeight={900}>Other / Custom</Typography><Typography variant="body2" color="text.secondary">Capture organization-specific expressions of intent that are not listed above.</Typography></Box>
                  </Box>

                  {form.positive_signals.some((signal) => signal.source === "custom") && (
                    <Box sx={{ p: { xs: 2, md: 2.5 }, borderTop: `1px solid ${theme.palette.divider}` }}>
                      <Stack spacing={1.5}>
                        {form.positive_signals.map((signal, index) => signal.source === "custom" && (
                          <Box key={signal.signal_key || index} sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                            <TextField
                              required
                              fullWidth
                              multiline
                              minRows={2}
                              label="Describe the custom positive signal"
                              placeholder="Customer asks us to contact them after discussing the requirement internally."
                              value={signal.name}
                              onChange={(event) => updateCollection("positive_signals", index, { name: event.target.value })}
                            />
                            <Tooltip title="Remove custom signal"><IconButton color="error" onClick={() => removeFromCollection("positive_signals", index)}><DeleteOutlineIcon /></IconButton></Tooltip>
                          </Box>
                        ))}
                      </Stack>
                      <Button variant="outlined" startIcon={<AddIcon />} onClick={() => addItem("positive_signals")} sx={{ mt: 1.5 }}>Add another custom signal</Button>
                    </Box>
                  )}
                </Paper>
              </Stack>
            )}

            {activeTab === 4 && (
              <Stack spacing={2.5}>
                <Paper
                  elevation={0}
                  sx={{
                    p: { xs: 2, md: 3 },
                    border: `1px solid ${alpha("#d84b5d", 0.27)}`,
                    background: theme.palette.mode === "dark"
                      ? `linear-gradient(145deg, ${alpha("#d84b5d", 0.14)}, ${alpha(theme.palette.background.paper, 0.94)} 52%)`
                      : "linear-gradient(145deg, #fff3f5 0%, #ffffff 52%, #f5f8fd 100%)",
                    boxShadow: `0 16px 40px ${alpha("#d84b5d", 0.08)}`,
                  }}
                >
                  <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} gap={2}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Box sx={{ width: 46, height: 46, borderRadius: 2, bgcolor: "#d84b5d", color: "#fff", display: "grid", placeItems: "center", boxShadow: "0 10px 22px rgba(216,75,93,.22)" }}><BlockOutlinedIcon /></Box>
                      <Box>
                        <Typography variant="h6" fontWeight={900}>What makes a lead NOT qualified?</Typography>
                        <Typography variant="body2" color="text.secondary">Select the clear hard-stop conditions the agent should recognize.</Typography>
                      </Box>
                    </Stack>
                    <Chip label={`${form.disqualification_criteria.length} selected`} sx={{ fontWeight: 800, color: form.disqualification_criteria.length ? "#b92f43" : "text.secondary", bgcolor: form.disqualification_criteria.length ? alpha("#d84b5d", 0.12) : "transparent", border: `1px solid ${form.disqualification_criteria.length ? alpha("#d84b5d", 0.28) : theme.palette.divider}` }} />
                  </Stack>
                </Paper>

                <Paper elevation={0} sx={{ p: { xs: 1.25, md: 2 }, border: `1px solid ${theme.palette.divider}`, bgcolor: alpha(theme.palette.background.paper, 0.76) }}>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.25 }}>
                    {predefinedDisqualificationCriteria.map((option) => {
                      const selected = form.disqualification_criteria.some(
                        (criterion) => criterion.criterion_key === option.key,
                      );
                      return (
                        <Box
                          key={option.key}
                          role="checkbox"
                          aria-checked={selected}
                          tabIndex={0}
                          onClick={() => toggleDisqualificationCriterion(option.key, option.label)}
                          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") toggleDisqualificationCriterion(option.key, option.label); }}
                          sx={{
                            minHeight: 82,
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 1,
                            p: 1.5,
                            borderRadius: 1.5,
                            cursor: "pointer",
                            border: `1px solid ${selected ? "#d84b5d" : theme.palette.divider}`,
                            bgcolor: selected ? alpha("#d84b5d", 0.075) : alpha(theme.palette.background.paper, 0.62),
                            boxShadow: selected ? `0 8px 20px ${alpha("#d84b5d", 0.09)}` : "none",
                            transition: "border-color 160ms ease, background 160ms ease, box-shadow 160ms ease",
                            "&:hover": { borderColor: alpha("#d84b5d", 0.65), bgcolor: alpha("#d84b5d", 0.05) },
                          }}
                        >
                          <Checkbox checked={selected} tabIndex={-1} disableRipple sx={{ p: 0.35, color: "#d84b5d", "&.Mui-checked": { color: "#d84b5d" } }} />
                          <Box><Typography variant="body2" fontWeight={850}>{option.label}</Typography><Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.35, display: "block", mt: 0.35 }}>{option.hint}</Typography></Box>
                        </Box>
                      );
                    })}

                    <Box
                      role="checkbox"
                      aria-checked={form.disqualification_criteria.some((criterion) => criterion.source === "custom")}
                      tabIndex={0}
                      onClick={toggleCustomDisqualifiers}
                      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") toggleCustomDisqualifiers(); }}
                      sx={{ minHeight: 82, display: "flex", alignItems: "flex-start", gap: 1, p: 1.5, borderRadius: 1.5, cursor: "pointer", border: `1px solid ${form.disqualification_criteria.some((criterion) => criterion.source === "custom") ? "#d84b5d" : theme.palette.divider}`, bgcolor: form.disqualification_criteria.some((criterion) => criterion.source === "custom") ? alpha("#d84b5d", 0.075) : alpha(theme.palette.background.paper, 0.62), "&:hover": { borderColor: alpha("#d84b5d", 0.65), bgcolor: alpha("#d84b5d", 0.05) } }}
                    >
                      <Checkbox checked={form.disqualification_criteria.some((criterion) => criterion.source === "custom")} tabIndex={-1} disableRipple sx={{ p: 0.35, color: "#d84b5d", "&.Mui-checked": { color: "#d84b5d" } }} />
                      <Box><Typography variant="body2" fontWeight={850}>Other / Custom</Typography><Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.35, display: "block", mt: 0.35 }}>Define organization-specific reasons that should stop qualification.</Typography></Box>
                    </Box>
                  </Box>
                </Paper>

                {form.disqualification_criteria.some((criterion) => criterion.source === "custom") && (
                  <Paper elevation={0} sx={{ overflow: "hidden", border: `1px solid ${alpha("#d84b5d", 0.32)}` }}>
                    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ px: 2.25, py: 1.75, bgcolor: alpha("#d84b5d", 0.07), borderBottom: `1px solid ${theme.palette.divider}` }}>
                      <WarningAmberOutlinedIcon sx={{ color: "#d84b5d" }} />
                      <Box><Typography fontWeight={900}>Custom disqualification reasons</Typography><Typography variant="caption" color="text.secondary">Use specific, objective language the agent can reliably identify.</Typography></Box>
                    </Stack>
                    <Box sx={{ p: { xs: 2, md: 2.5 } }}>
                      <Stack spacing={1.5}>
                        {form.disqualification_criteria.map((criterion, index) => criterion.source === "custom" && (
                          <Box key={criterion.criterion_key || index} sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                            <TextField
                              required
                              fullWidth
                              multiline
                              minRows={2}
                              label="Describe the custom disqualification reason"
                              placeholder="The customer is only looking for a service that we do not provide."
                              value={criterion.name}
                              onChange={(event) => updateCollection("disqualification_criteria", index, { name: event.target.value })}
                            />
                            <Tooltip title="Remove custom reason"><IconButton color="error" onClick={() => removeFromCollection("disqualification_criteria", index)}><DeleteOutlineIcon /></IconButton></Tooltip>
                          </Box>
                        ))}
                      </Stack>
                      <Button variant="outlined" color="error" startIcon={<AddIcon />} onClick={() => addItem("disqualification_criteria")} sx={{ mt: 1.5 }}>Add another custom disqualification reason</Button>
                    </Box>
                  </Paper>
                )}
              </Stack>
            )}

            {activeTab === 5 && (
              <Stack spacing={2.5}>
                <Paper
                  elevation={0}
                  sx={{
                    p: { xs: 2, md: 3 },
                    border: `1px solid ${alpha("#3d75d9", 0.24)}`,
                    background: theme.palette.mode === "dark"
                      ? `linear-gradient(145deg, ${alpha("#3d75d9", 0.17)}, ${alpha(theme.palette.background.paper, 0.94)} 52%)`
                      : "linear-gradient(145deg, #eef5ff 0%, #ffffff 52%, #effaf8 100%)",
                    boxShadow: `0 16px 40px ${alpha("#3d75d9", 0.09)}`,
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box sx={{ width: 46, height: 46, borderRadius: 2, bgcolor: "#3d75d9", color: "#fff", display: "grid", placeItems: "center", boxShadow: "0 10px 22px rgba(61,117,217,.22)" }}><ThermostatOutlinedIcon /></Box>
                    <Box>
                      <Typography variant="h6" fontWeight={900}>Turn qualification scores into sales priority</Typography>
                      <Typography variant="body2" color="text.secondary">Temperature is assigned only after a lead qualifies. The platform maps its 1–100 score to the configured band.</Typography>
                    </Box>
                  </Stack>
                </Paper>

                <RadioGroup
                  value={form.temperature_mode}
                  onChange={(event) => {
                    const mode = event.target.value as QualificationTemplatePayload["temperature_mode"];
                    setForm({
                      ...form,
                      temperature_mode: mode,
                      lead_temperatures: mode === "standard"
                        ? defaultTemperatures.map((temperature) => ({ ...temperature }))
                        : form.lead_temperatures.map((temperature) => ({ ...temperature })),
                    });
                  }}
                  sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}
                >
                  {[
                    { value: "standard", title: "Use standard temperature ranges", detail: "Recommended defaults with balanced progression across the 1–100 score." },
                    { value: "custom", title: "Customize temperature ranges", detail: "Set organization-specific boundaries while preserving complete coverage." },
                  ].map((mode) => {
                    const selected = form.temperature_mode === mode.value;
                    return (
                      <FormControlLabel
                        key={mode.value}
                        value={mode.value}
                        control={<Radio sx={{ color: "#3d75d9", "&.Mui-checked": { color: "#3d75d9" } }} />}
                        label={<Box><Typography fontWeight={900}>{mode.title}</Typography><Typography variant="body2" color="text.secondary">{mode.detail}</Typography></Box>}
                        sx={{ m: 0, p: 2, alignItems: "flex-start", borderRadius: 1.5, border: `1px solid ${selected ? "#3d75d9" : theme.palette.divider}`, bgcolor: selected ? alpha("#3d75d9", 0.075) : alpha(theme.palette.background.paper, 0.7), boxShadow: selected ? `0 10px 24px ${alpha("#3d75d9", 0.1)}` : "none" }}
                      />
                    );
                  })}
                </RadioGroup>

                <Paper elevation={0} sx={{ p: { xs: 2, md: 2.5 }, border: `1px solid ${theme.palette.divider}`, bgcolor: alpha(theme.palette.background.paper, 0.78) }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Box><Typography variant="h6" fontWeight={900}>{form.temperature_mode === "standard" ? "Standard ranges" : "Custom ranges"}</Typography><Typography variant="body2" color="text.secondary">Every possible qualified-lead score belongs to exactly one band.</Typography></Box>
                    <Chip icon={temperatureRangesValid ? <CheckCircleOutlineIcon /> : <WarningAmberOutlinedIcon />} label={temperatureRangesValid ? "Complete 1–100 coverage" : "Range needs attention"} color={temperatureRangesValid ? "success" : "warning"} variant="outlined" sx={{ fontWeight: 800 }} />
                  </Stack>

                  <Box sx={{ display: "flex", height: 18, borderRadius: 1, overflow: "hidden", mb: 0.75, border: `1px solid ${alpha(theme.palette.text.primary, 0.12)}` }}>
                    {orderedTemperatures.map((temperature) => (
                      <Tooltip key={temperature.name} title={`${temperature.name}: ${temperature.min_score}–${temperature.max_score}`}>
                        <Box sx={{ width: `${Math.max(0, temperature.max_score - temperature.min_score + 1)}%`, bgcolor: temperature.color, transition: "width 220ms ease" }} />
                      </Tooltip>
                    ))}
                  </Box>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 2.5 }}><Typography variant="caption" color="text.secondary">1</Typography><Typography variant="caption" color="text.secondary">Lead score</Typography><Typography variant="caption" color="text.secondary">100</Typography></Stack>

                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)", xl: "repeat(4, 1fr)" }, gap: 1.5 }}>
                    {form.lead_temperatures.map((temperature, index) => (
                      <Paper key={temperature.name} elevation={0} sx={{ p: 2, border: `1px solid ${alpha(temperature.color, 0.42)}`, borderTop: `5px solid ${temperature.color}`, bgcolor: alpha(temperature.color, 0.055), minWidth: 0 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                          <Typography fontWeight={950} sx={{ color: temperature.color }}>{temperature.name.toUpperCase()}</Typography>
                          <Chip size="small" label={`${temperature.min_score}–${temperature.max_score}`} sx={{ fontWeight: 900, bgcolor: alpha(temperature.color, 0.12), color: temperature.color }} />
                        </Stack>
                        {form.temperature_mode === "custom" ? (
                          <Stack direction="row" spacing={1}>
                            <TextField fullWidth size="small" type="number" label="Minimum" value={temperature.min_score} onChange={(event) => updateCollection("lead_temperatures", index, { min_score: Number(event.target.value) })} inputProps={{ min: 1, max: 100 }} />
                            <TextField fullWidth size="small" type="number" label="Maximum" value={temperature.max_score} onChange={(event) => updateCollection("lead_temperatures", index, { max_score: Number(event.target.value) })} inputProps={{ min: 1, max: 100 }} />
                          </Stack>
                        ) : (
                          <Box sx={{ py: 1.1 }}><Typography variant="h5" fontWeight={950}>{temperature.min_score}<Typography component="span" color="text.secondary" sx={{ mx: 0.7 }}>to</Typography>{temperature.max_score}</Typography></Box>
                        )}
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>{temperature.description}</Typography>
                      </Paper>
                    ))}
                  </Box>
                </Paper>

                {form.temperature_mode === "custom" && !temperatureRangesValid && (
                  <Alert severity="warning" variant="outlined">Custom ranges must cover scores 1 through 100 with no gaps or overlaps. Each next minimum must be one greater than the previous maximum.</Alert>
                )}
              </Stack>
            )}
          </Box>

          <Stack direction="row" justifyContent="space-between" sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}`, bgcolor: alpha(theme.palette.background.default, 0.5) }}>
            <Button startIcon={<KeyboardArrowLeftIcon />} disabled={activeTab === 0} onClick={() => setActiveTab((current) => current - 1)}>Previous</Button>
            {activeTab < tabs.length - 1 ? (
              <Button variant="contained" endIcon={saving ? undefined : <KeyboardArrowRightIcon />} onClick={saveAndContinue} disabled={saving}>
                {saving ? "Saving section..." : "Save & next section"}
              </Button>
            ) : (
              <Button variant="contained" startIcon={<SaveOutlinedIcon />} onClick={save} disabled={saving} sx={{ bgcolor: "#157f78", "&:hover": { bgcolor: "#106c66" } }}>{saving ? "Saving..." : "Save template"}</Button>
            )}
          </Stack>
        </Paper>
      </Box>

      <Snackbar open={Boolean(error || success)} autoHideDuration={4000} onClose={() => { setError(""); setSuccess(""); }} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={error ? "error" : "success"} variant="filled" onClose={() => { setError(""); setSuccess(""); }}>{error || success}</Alert>
      </Snackbar>
    </AdminLayout>
  );
}