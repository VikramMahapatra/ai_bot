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
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import KeyboardArrowLeftIcon from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import ThermostatOutlinedIcon from "@mui/icons-material/ThermostatOutlined";
import ThumbUpAltOutlinedIcon from "@mui/icons-material/ThumbUpAltOutlined";
import TrackChangesIcon from "@mui/icons-material/TrackChanges";
import TuneIcon from "@mui/icons-material/Tune";
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

const defaultTemperatures: QualificationTemplatePayload["lead_temperatures"] = [
  { name: "Cold", min_score: 0, max_score: 24, description: "Early interest with limited buying intent.", color: "#4b86c6" },
  { name: "Warm", min_score: 25, max_score: 49, description: "Relevant need with growing engagement.", color: "#d59b20" },
  { name: "Hot", min_score: 50, max_score: 74, description: "Strong fit and clear purchase intent.", color: "#e56b35" },
  { name: "Very Hot", min_score: 75, max_score: 100, description: "Ready for immediate sales action.", color: "#d83b4c" },
];

const emptyTemplate: QualificationTemplatePayload = {
  name: "",
  description: "",
  objective: defaultCampaignObjective,
  status: "Active",
  qualification_mode: "essential_supporting",
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
  "Map the complete 0-100 score to clear sales-priority bands.",
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
        criteria: (template.criteria || []).map((criterion, index) => ({
          ...criterion,
          criterion_key: criterion.criterion_key || `legacy_${criterion.id || index}`,
          source: criterion.source || "custom",
          importance: criterion.importance || (criterion.is_required ? "Essential" : "Supporting"),
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
      attributes: { key: "", label: "", data_type: "text", description: "", is_required: false, options: [] },
      positive_signals: { name: "", description: "", score: 10 },
      disqualification_criteria: { name: "", description: "", action: "disqualify" },
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
    const contiguous = ordered[0]?.min_score === 0 && ordered[ordered.length - 1]?.max_score === 100
      && ordered.every((item, index) => index === 0 || item.min_score === ordered[index - 1].max_score + 1);
    if (!contiguous || ordered.some((item) => item.min_score > item.max_score)) {
      setActiveTab(5);
      setError("Temperature ranges must be contiguous, non-overlapping, and cover 0 through 100.");
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

  const sectionComplete = [
    Boolean(form.name.trim() && form.objective.trim()),
    form.criteria.length > 0 && form.criteria.every((item) => item.name.trim()),
    form.attributes.length > 0 && form.attributes.every((item) => item.key.trim() && item.label.trim()),
    form.positive_signals.length > 0 && form.positive_signals.every((item) => item.name.trim()),
    form.disqualification_criteria.length > 0 && form.disqualification_criteria.every((item) => item.name.trim()),
    form.lead_temperatures.length === 4,
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
              <Stack spacing={2}>
                {form.attributes.map((attribute, index) => (
                  <Paper key={index} elevation={0} sx={itemPaperSx}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                      <Chip label={attribute.label || `Attribute ${index + 1}`} size="small" sx={{ bgcolor: "#e6f3f1", color: "#106c66", fontWeight: 800 }} />
                      <Tooltip title="Remove attribute"><IconButton color="error" onClick={() => removeFromCollection("attributes", index)}><DeleteOutlineIcon /></IconButton></Tooltip>
                    </Stack>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.2fr 1fr 180px" }, gap: 2 }}>
                      <TextField required label="Display label" value={attribute.label} onChange={(event) => updateCollection("attributes", index, { label: event.target.value })} />
                      <TextField required label="Attribute key" value={attribute.key} onChange={(event) => updateCollection("attributes", index, { key: event.target.value.toLowerCase().replace(/\s+/g, "_") })} helperText="Lowercase letters, numbers, underscores" />
                      <TextField select label="Data type" value={attribute.data_type} onChange={(event) => updateCollection("attributes", index, { data_type: event.target.value, options: [] })}>
                        <MenuItem value="text">Text</MenuItem><MenuItem value="number">Number</MenuItem><MenuItem value="boolean">Yes / No</MenuItem><MenuItem value="date">Date</MenuItem><MenuItem value="select">Single select</MenuItem><MenuItem value="multi_select">Multi select</MenuItem>
                      </TextField>
                    </Box>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="flex-start" sx={{ mt: 2 }}>
                      <TextField fullWidth label="Description or collection guidance" value={attribute.description || ""} onChange={(event) => updateCollection("attributes", index, { description: event.target.value })} />
                      {(attribute.data_type === "select" || attribute.data_type === "multi_select") && (
                        <TextField fullWidth label="Options" value={attribute.options.join(", ")} onChange={(event) => updateCollection("attributes", index, { options: event.target.value.split(",").map((option) => option.trim()).filter(Boolean) })} helperText="Comma-separated values" />
                      )}
                      <FormControlLabel control={<Checkbox checked={attribute.is_required} onChange={(event) => updateCollection("attributes", index, { is_required: event.target.checked })} />} label="Required" sx={{ minWidth: 115 }} />
                    </Stack>
                  </Paper>
                ))}
                <Button variant="outlined" startIcon={<AddIcon />} onClick={() => addItem("attributes")} sx={{ alignSelf: "flex-start" }}>Add business attribute</Button>
              </Stack>
            )}

            {activeTab === 3 && (
              <Stack spacing={2}>
                {form.positive_signals.map((signal, index) => (
                  <Paper key={index} elevation={0} sx={{ ...itemPaperSx, borderLeft: "4px solid #168a72" }}>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="flex-start">
                      <TextField required fullWidth label="Positive signal" value={signal.name} onChange={(event) => updateCollection("positive_signals", index, { name: event.target.value })} />
                      <TextField type="number" label="Score" value={signal.score} onChange={(event) => updateCollection("positive_signals", index, { score: Number(event.target.value) })} inputProps={{ min: 1, max: 100 }} sx={{ width: { xs: "100%", md: 150 } }} />
                      <Tooltip title="Remove signal"><IconButton color="error" onClick={() => removeFromCollection("positive_signals", index)}><DeleteOutlineIcon /></IconButton></Tooltip>
                    </Stack>
                    <TextField fullWidth label="What the agent should listen for" value={signal.description || ""} onChange={(event) => updateCollection("positive_signals", index, { description: event.target.value })} sx={{ mt: 2 }} />
                  </Paper>
                ))}
                <Button variant="outlined" startIcon={<AddIcon />} onClick={() => addItem("positive_signals")} sx={{ alignSelf: "flex-start" }}>Add positive signal</Button>
              </Stack>
            )}

            {activeTab === 4 && (
              <Stack spacing={2}>
                {form.disqualification_criteria.map((criterion, index) => (
                  <Paper key={index} elevation={0} sx={{ ...itemPaperSx, borderLeft: "4px solid #d84b5d" }}>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="flex-start">
                      <TextField required fullWidth label="Disqualification criterion" value={criterion.name} onChange={(event) => updateCollection("disqualification_criteria", index, { name: event.target.value })} />
                      <TextField select label="Outcome" value={criterion.action} onChange={(event) => updateCollection("disqualification_criteria", index, { action: event.target.value })} sx={{ width: { xs: "100%", md: 190 } }}>
                        <MenuItem value="disqualify">Disqualify</MenuItem><MenuItem value="review">Manual review</MenuItem>
                      </TextField>
                      <Tooltip title="Remove criterion"><IconButton color="error" onClick={() => removeFromCollection("disqualification_criteria", index)}><DeleteOutlineIcon /></IconButton></Tooltip>
                    </Stack>
                    <TextField fullWidth label="Evaluation guidance" value={criterion.description || ""} onChange={(event) => updateCollection("disqualification_criteria", index, { description: event.target.value })} sx={{ mt: 2 }} />
                  </Paper>
                ))}
                <Button variant="outlined" startIcon={<AddIcon />} onClick={() => addItem("disqualification_criteria")} sx={{ alignSelf: "flex-start" }}>Add disqualification rule</Button>
              </Stack>
            )}

            {activeTab === 5 && (
              <Stack spacing={2}>
                <Alert severity="info" variant="outlined">Ranges must cover every score from 0 to 100 without gaps or overlaps.</Alert>
                {form.lead_temperatures.map((temperature, index) => (
                  <Paper key={temperature.name} elevation={0} sx={{ ...itemPaperSx, borderLeft: `6px solid ${temperature.color}` }}>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "160px 130px 130px 1fr 56px" }, gap: 2, alignItems: "start" }}>
                      <Box><Typography fontWeight={900}>{temperature.name}</Typography><Typography variant="caption" color="text.secondary">Sales priority</Typography></Box>
                      <TextField type="number" label="Minimum" value={temperature.min_score} onChange={(event) => updateCollection("lead_temperatures", index, { min_score: Number(event.target.value) })} inputProps={{ min: 0, max: 100 }} />
                      <TextField type="number" label="Maximum" value={temperature.max_score} onChange={(event) => updateCollection("lead_temperatures", index, { max_score: Number(event.target.value) })} inputProps={{ min: 0, max: 100 }} />
                      <TextField label="Definition" value={temperature.description || ""} onChange={(event) => updateCollection("lead_temperatures", index, { description: event.target.value })} sx={{ gridColumn: { xs: "1 / -1", md: "auto" } }} />
                      <Tooltip title="Band color"><Box component="input" type="color" value={temperature.color} onChange={(event: any) => updateCollection("lead_temperatures", index, { color: event.target.value })} sx={{ width: 48, height: 48, border: 0, bgcolor: "transparent", cursor: "pointer" }} /></Tooltip>
                    </Box>
                  </Paper>
                ))}
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