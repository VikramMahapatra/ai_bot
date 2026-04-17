import {
  Grid,
  TextField,
  Button,
  MenuItem,
  FormControlLabel,
  Switch,
  Typography,
  Paper,
  Box,
  Chip,
  Select,
  Alert,
} from "@mui/material";
import { useEffect, useState } from "react";
import {
  CallingAgentLookup,
  callingAgentService,
} from "../../services/callingAgentService";
import { Product, productService } from "../../services/productService";
import { CallingNumberType, callService } from "../../services/callService";
import { CallingNumber } from "../../types";

import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import SmsIcon from "@mui/icons-material/Sms";
import EmailIcon from "@mui/icons-material/Email";
import { messageTemplateService } from "../../services/messageTemplateService";

interface CampaignInfoProps {
  form: any;
  setForm: any;
  nextStep: () => void;
}

const getInstantTemplateId = (value: unknown): number | undefined => {
  if (value == null || value === "") return undefined;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "object" && value !== null && "template_id" in value) {
    const id = (value as { template_id?: number }).template_id;
    if (id == null || id === ("" as unknown)) return undefined;
    const n = Number(id);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
};

const MODES = [
  {
    key: "whatsapp",
    label: "WhatsApp",
    icon: <WhatsAppIcon />,
    color: "success",
    filterType: "whatsapp",
  },
  {
    key: "sms",
    label: "SMS",
    icon: <SmsIcon />,
    color: "primary",
    filterType: "sms",
  },
  {
    key: "email",
    label: "Email",
    icon: <EmailIcon />,
    color: "secondary",
    filterType: "email",
  },
];

const CampaignInfo = ({ form, setForm, nextStep }: CampaignInfoProps) => {
  const [errors, setErrors] = useState<any>({});
  const [agents, setAgents] = useState<CallingAgentLookup[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [callingNumbers, setCallingNumbers] = useState<CallingNumber[]>([]);

  const loadAgentLookup = async () => {
    const data = await callingAgentService.agentLookup();
    setAgents(data || []);
  };

  const loadProductLookup = async () => {
    const data = await productService.productLookup();
    setProducts(data || []);
  };

  const loadCallingNoLookup = async () => {
    const data = await callService.getCallingNumbers(
      CallingNumberType.OUTBOUND,
    );
    setCallingNumbers(data || []);
  };

  const loadTemplateLookup = async () => {
    const data = await messageTemplateService.templateLookup();
    setTemplates(data || []);
  };

  useEffect(() => {
    loadAgentLookup();
    loadProductLookup();
    loadCallingNoLookup();
    loadTemplateLookup();
  }, [form]);

  const validate = () => {
    let newErrors: any = {};

    if (!form.name.trim()) {
      newErrors.name = "Campaign name is required";
    }

    if (!form.description) {
      newErrors.description = "Description is required";
    }

    if (!form.agent_id) {
      newErrors.agent_id = "Agent is required";
    }

    if (!form.calling_no) {
      newErrors.calling_no = "From number is required";
    }

    if (form.instant_reply) {
      const templates = form.instant_reply_templates || {};
      const modes = form.instant_reply_modes || [];

      if (modes.length === 0) {
        newErrors.instant_reply_modes = "Select at least one reply mode";
      }

      MODES.forEach((mode) => {
        const isActive = modes.includes(mode.key);

        if (isActive && getInstantTemplateId(templates?.[mode.key]) == null) {
          newErrors[`${mode.key}_template`] =
            `${mode.label} template is required`;
        }
      });
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      nextStep();
    }
  };

  const updateTemplateId = (mode: string, templateId: number) => {
    const selected = templates.find((t) => t.id === templateId);
    setForm((prev: any) => ({
      ...prev,
      instant_reply_templates: {
        ...prev.instant_reply_templates,
        [mode]:
          templateId
            ? {
                template_id: templateId,
                name: selected?.name ?? "",
              }
            : "",
      },
    }));
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const toggleMode = (mode: string) => {
    const modes = form.instant_reply_modes || [];

    if (modes.includes(mode)) {
      setForm({
        ...form,
        instant_reply_modes: modes.filter((m: string) => m !== mode),
      });
    } else {
      setForm({
        ...form,
        instant_reply_modes: [...modes, mode],
      });
    }
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <TextField
          required
          label="Campaign Name"
          fullWidth
          name="name"
          value={form.name}
          onChange={handleInputChange}
          error={!!errors.name}
          helperText={errors.name}
        />
      </Grid>

      <Grid item xs={12}>
        <TextField
          required
          label="Description"
          multiline
          rows={4}
          fullWidth
          name="description"
          value={form.description}
          onChange={handleInputChange}
          error={!!errors.description}
          helperText={errors.description}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          required
          label="Agent"
          select
          fullWidth
          name="agent_id"
          value={form.agent_id}
          onChange={(e) => setForm({ ...form, agent_id: e.target.value })}
          error={!!errors.agent_id}
          helperText={errors.agent_id}
        >
          {agents.map((agent) => (
            <MenuItem key={agent.id} value={agent.id}>
              {agent.name}
            </MenuItem>
          ))}
        </TextField>
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          required
          label="From Number"
          select
          fullWidth
          name="product_id"
          value={form.calling_no}
          onChange={(e) => setForm({ ...form, calling_no: e.target.value })}
          error={!!errors.calling_no}
          helperText={errors.calling_no}
        >
          {callingNumbers.map((p) => (
            <MenuItem key={p.id} value={p.calling_number}>
              {p.calling_number}
            </MenuItem>
          ))}
        </TextField>
      </Grid>

      <Grid item xs={12} sm={6}>
        <TextField
          label="Product"
          select
          fullWidth
          name="product_id"
          value={form.product_id}
          onChange={(e) => setForm({ ...form, product_id: e.target.value })}
        >
          {products.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.label}
            </MenuItem>
          ))}
        </TextField>
      </Grid>

      {/* <Grid item xs={4}>
                <TextField
                    label="Priority"
                    select
                    fullWidth
                    name="priority"
                    value={form.priority}
                    onChange={(e) =>
                        setForm({ ...form, priority: e.target.value })
                    }
                >
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                </TextField>
            </Grid> */}

      <Grid item xs={12} sm={6}>
        <TextField
          label="Category"
          select
          fullWidth
          name="category"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        >
          <MenuItem value="sales">Sales Outreach</MenuItem>
          <MenuItem value="support">Support</MenuItem>
        </TextField>
      </Grid>
      {/* Instant Reply Section */}

      <Grid item xs={12}>
        <Paper
          sx={{
            p: 3,
            borderRadius: 2,
            border: "1px solid #e0e0e0",
          }}
        >
          {/* Header */}
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            mb={2}
          >
            <Typography variant="h6">Instant Reply</Typography>

            <FormControlLabel
              control={
                <Switch
                  checked={form.instant_reply || false}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      instant_reply: e.target.checked,
                      instant_reply_modes: [],
                      instant_reply_templates: {},
                    })
                  }
                />
              }
              label="Enable"
            />
          </Box>

          {errors.instant_reply_modes && (
            <Typography
              color="error"
              variant="caption"
              sx={{ mt: 0.5, display: "block" }}
            >
              {errors.instant_reply_modes}
            </Typography>
          )}
          {form.instant_reply && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                Click on WhatsApp / SMS / Email to enable that mode, then choose
                a template.
              </Alert>
              {MODES.map((mode) => {
                const isActive = form.instant_reply_modes?.includes(mode.key);

                return (
                  <Box
                    key={mode.key}
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    mb={1.5}
                    px={2}
                    py={1.5}
                    borderRadius={2}
                    border="1px solid"
                    borderColor={isActive ? "#d1e9ff" : "#eee"}
                    bgcolor={isActive ? "#f5faff" : "#fff"}
                    sx={{
                      transition: "all 0.2s ease",
                      "&:hover": {
                        backgroundColor: "#f9fafb",
                      },
                    }}
                  >
                    {/* LEFT SIDE */}
                    <Box display="flex" alignItems="center" gap={1.5}>
                      <Chip
                        icon={mode.icon}
                        label={mode.label}
                        clickable
                        variant={isActive ? "filled" : "outlined"}
                        color={isActive ? (mode.color as any) : "default"}
                        onClick={() => toggleMode(mode.key)}
                        sx={{
                          fontWeight: 500,
                        }}
                      />
                    </Box>

                    {/* RIGHT SIDE */}
                    <Box width="55%">
                      <Select
                        fullWidth
                        size="small"
                        disabled={!isActive}
                        displayEmpty
                        value={
                          getInstantTemplateId(
                            form.instant_reply_templates?.[mode.key],
                          ) ?? ""
                        }
                        onChange={(e) => {
                          const raw = e.target.value;
                          updateTemplateId(
                            mode.key,
                            raw === "" ? 0 : Number(raw),
                          );
                        }}
                        sx={{
                          backgroundColor: isActive ? "#fff" : "#f5f5f5",
                        }}
                      >
                        <MenuItem value="">Select template</MenuItem>

                        {templates
                          ?.filter((t) => t.type === mode.filterType)
                          .map((t) => (
                            <MenuItem key={t.id} value={t.id}>
                              {t.name}
                            </MenuItem>
                          ))}
                      </Select>
                      {errors[`${mode.key}_template`] && (
                        <Typography
                          color="error"
                          variant="caption"
                          sx={{ mt: 0.5, display: "block" }}
                        >
                          {errors[`${mode.key}_template`]}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Paper>
      </Grid>

      <Grid item xs={12} textAlign="right">
        <Button variant="contained" onClick={validate}>
          Continue
        </Button>
      </Grid>
    </Grid>
  );
};

export default CampaignInfo;
