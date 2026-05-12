// StepEditMode.tsx
import {
    Box,
    Typography,
    TextField,
    Select,
    MenuItem,
    Button,
    IconButton,
    FormControl,
    InputLabel,
    Divider,
    Chip,
    Alert,
    Snackbar,
} from "@mui/material";

import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import { Handle, Position } from "reactflow";
import { useFlow } from "../../../context/FlowContext";
import { useMemo, useState } from "react";

export default function StepEditMode({ data, id, outcomeId, agents, templates }: any) {
    const [error, setError] = useState<any>(null);
    const
        {
            nodes,
            onCancelOutcome,
            onSaveOutcome,
            onUpdateOutcome
        } = useFlow();

    const outcome = data.editingOutcomeDraft;
    if (!outcome) return null;

    const templatesByType = useMemo(() => {
        return templates?.reduce((acc: any, t: any) => {
            acc[t.type] = acc[t.type] || [];
            acc[t.type].push(t);
            return acc;
        }, {});
    }, [templates]);


    const titleCase = (value: string) =>
        value
            .split("_")
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ");

    const validateOutcome = (nodeId: string) => {
        const node = nodes.find((n: any) => n.id === nodeId);
        const outcome = node?.data?.editingOutcomeDraft;

        if (!outcome) return "Invalid outcome";

        const existingOutcomes = (node?.data?.outcomes || []).filter(
            (o: any) => o.id !== outcome.id
        );

        // Connected branch validation
        if (node.data.branch === "connected") {

            if (!outcome.outcome) {
                return "Outcome is required";
            }

            const duplicateOutcome = existingOutcomes.find(
                (o: any) => o.outcome === outcome.outcome
            );

            if (duplicateOutcome) {
                return "Duplicate outcome selected";
            }

            const hasAllOutcome = existingOutcomes.some(
                (o: any) => o.outcome === "all"
            );

            if (hasAllOutcome && outcome.outcome !== "all") {
                return `Cannot add other outcomes when "All" outcome exists`;
            }

            if (outcome.outcome === "all" && existingOutcomes.length > 0) {
                return `Cannot add "All" outcome when other outcomes exist`;
            }
        }

        // StepType required
        if (!outcome.stepType) {
            return "Step Type is required";
        }

        // Duplicate StepType (optional rule)
        const duplicateStepType = existingOutcomes.find(
            (o: any) =>
                o.outcome === outcome.outcome &&
                o.stepType === outcome.stepType
        );

        if (duplicateStepType) {
            return "Duplicate step type for this outcome";
        }

        // Call validation
        if (outcome.stepType === "call" && !outcome.agentId) {
            return "Agent required for Call";
        }

        // Template validation
        if (
            ["sms", "email", "whatsapp"].includes(outcome.stepType) &&
            !outcome.templateId
        ) {
            return "Template required";
        }

        if (outcome.delay <= 0) {
            return "Delay must be greater than 0";
        }

        return null;
    };


    return (
        <Box
            sx={{
                width: 340,
                bgcolor: "white",
                borderRadius: 3,
                border: "1px solid #dbeafe",
                boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
                p: 2,
                mt: 2
            }}
        >


            <Box
                key={outcome.id}
            >
                {error &&
                    <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>
                }

                {/* FORM */}
                <Box display="flex" flexDirection="column" gap={1.5}>
                    <TextField
                        size="small"
                        label="Step Label"
                        defaultValue={data.title}
                        fullWidth
                        disabled
                    />
                    {data.branch === "not_connected" ? (
                        <TextField
                            size="small"
                            label="Outcome"
                            defaultValue={titleCase(outcome.outcome || "all")}
                            fullWidth
                            disabled
                        />
                    ) : (

                        <div className="nodrag nopan">
                            <FormControl size="small" fullWidth>
                                <InputLabel shrink>Outcome</InputLabel>
                                <Select
                                    label="Outcome"
                                    value={outcome.outcome || "all"}
                                    onChange={(e) =>
                                        onUpdateOutcome(id, outcome.id, {
                                            outcome: e.target.value
                                        })}
                                    renderValue={(selected) => titleCase(selected)}
                                >
                                    <MenuItem value="all">
                                        All
                                    </MenuItem>
                                    <MenuItem value="negative">
                                        Negative
                                    </MenuItem>
                                    <MenuItem value="positive">
                                        Positive
                                    </MenuItem>
                                </Select>
                            </FormControl>
                        </div>
                    )}
                    <div className="nodrag nopan">
                        <FormControl size="small" fullWidth>
                            <InputLabel>Step Type</InputLabel>

                            <Select
                                value={outcome.stepType}
                                label="Step Type"
                                onChange={(e) =>
                                    onUpdateOutcome(id, outcome.id, {
                                        stepType: e.target.value
                                    })}
                            >
                                <MenuItem value="call">Call</MenuItem>
                                <MenuItem value="sms">SMS</MenuItem>
                                <MenuItem value="email">Email</MenuItem>
                                <MenuItem value="whatsapp">WhatsApp</MenuItem>
                            </Select>
                        </FormControl>
                    </div>
                    {outcome.stepType === "call" && (
                        <div className="nodrag nopan">
                            <FormControl size="small" fullWidth>
                                <InputLabel>Assign Agent</InputLabel>
                                <Select
                                    label="Assign Agent"
                                    value={outcome.agentId || ""}
                                    onChange={(e) =>
                                        onUpdateOutcome(id, outcome.id, {
                                            agentId: e.target.value
                                        })
                                    }
                                >
                                    {agents.length == 0 && <MenuItem value="">No Agent</MenuItem>}
                                    {agents.map((agent: any) => (
                                        <MenuItem key={agent.id} value={agent.id}>
                                            {agent.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </div>

                    )}

                    {(outcome.stepType === "email" || outcome.stepType === "whatsapp" || outcome.stepType === "sms") && (
                        <div className="nodrag nopan">
                            <FormControl size="small" fullWidth>
                                <InputLabel>Template</InputLabel>
                                <Select
                                    label="Template"
                                    value={outcome.templateId || ""}
                                    onChange={(e) =>
                                        onUpdateOutcome(id, outcome.id, {
                                            templateId: Number(e.target.value)
                                        })
                                    }
                                >
                                    {(templatesByType?.[outcome.stepType] || []).length === 0 ? (
                                        <MenuItem value="">No Templates Available</MenuItem>
                                    ) : (
                                        (templatesByType?.[outcome.stepType] || []).map(
                                            (template: any) => (
                                                <MenuItem key={template.id} value={template.id}>
                                                    {template.name}
                                                </MenuItem>
                                            )
                                        )
                                    )}
                                </Select>
                            </FormControl>
                        </div>

                    )}

                    <Box display="flex" gap={1}>

                        {/* Delay Value */}
                        <div className="nodrag nopan">
                            <TextField
                                size="small"
                                label="Delay"
                                type="number"
                                value={outcome.delay}
                                onChange={(e) =>
                                    onUpdateOutcome(id, outcome.id, {
                                        delay: Number(e.target.value)
                                    })
                                }
                                sx={{ flex: 1 }}
                            />
                        </div>

                        {/* Unit Dropdown */}
                        <div className="nodrag nopan">
                            <FormControl size="small" sx={{ width: 120 }}>
                                <InputLabel>Unit</InputLabel>
                                <Select
                                    label="Unit"
                                    value={outcome.delayUnit}
                                    onChange={(e) =>
                                        onUpdateOutcome(id, outcome.id, {
                                            delayUnit: e.target.value
                                        })
                                    }
                                >
                                    <MenuItem value="minutes">Minutes</MenuItem>
                                    <MenuItem value="hours">Hours</MenuItem>
                                    <MenuItem value="days">Days</MenuItem>
                                </Select>
                            </FormControl>
                        </div>
                    </Box>

                    {/* Chips */}
                    <Box display="flex" gap={1} flexWrap="wrap">
                        <Chip label="Workflow Step" size="small" />
                    </Box>

                    {/* ACTIONS */}
                    <Box display="flex" justifyContent="flex-end" gap={1} mt={1}>
                        <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => onCancelOutcome(id)}
                        >
                            Cancel
                        </Button>

                        <Button
                            size="small"
                            variant="contained"
                            startIcon={<SaveIcon />}
                            onClick={() => {
                                const error = validateOutcome(id);

                                if (error) {
                                    setError(error)
                                    return;
                                }

                                onSaveOutcome(id);
                            }}
                        >
                            Save
                        </Button>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}