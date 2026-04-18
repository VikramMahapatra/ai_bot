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
} from "@mui/material";

import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import { Handle, Position } from "reactflow";
import { useFlow } from "../../../context/FlowContext";
import { useMemo } from "react";

export default function StepEditMode({ data, id, agents, templates }: any) {
    const
        {
            onChangeStepType,
            onChangeDelay,
            onChangeDelayUnit,
            onCancelNode,
            onChangeAgent,
            onChangeTemplate,
            addOutcome,
            updateOutcome,
            onSave
        } = useFlow();

    const templatesByType = useMemo(() => {
        return templates?.reduce((acc: any, t: any) => {
            acc[t.type] = acc[t.type] || [];
            acc[t.type].push(t);
            return acc;
        }, {});
    }, [templates]);

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
            <Box display="flex" flexDirection="column" gap={2}>
                <Button
                    size="small"
                    variant="outlined"
                    onClick={() => addOutcome(id)}
                >
                    + Add Outcome
                </Button>
            </Box>
            {data.outcomes?.map((outcome: any, index: number) => {

                return (
                    <Box
                        key={outcome.id}
                        sx={{
                            border: "1px solid #e5e7eb",
                            borderRadius: 2,
                            p: 1.5,
                            bgcolor: "#fafafa"
                        }}
                    >

                        {/* FORM */}
                        <Box display="flex" flexDirection="column" gap={1.5}>
                            <TextField
                                size="small"
                                label="Step Label"
                                defaultValue={data.title}
                                fullWidth
                                disabled
                            />

                            <div className="nodrag nopan">
                                <FormControl size="small" fullWidth>
                                    <InputLabel>Step Type</InputLabel>

                                    <Select
                                        value={outcome.stepType}
                                        label="Step Type"
                                        onChange={(e) =>
                                            updateOutcome(id, outcome.id, {
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
                                                updateOutcome(id, outcome.id, {
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
                                                updateOutcome(id, outcome.id, {
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
                                            updateOutcome(id, outcome.id, {
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
                                                updateOutcome(id, outcome.id, {
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
                                    onClick={() => onCancelNode(id)}
                                >
                                    Cancel
                                </Button>

                                <Button
                                    size="small"
                                    variant="contained"
                                    startIcon={<SaveIcon />}
                                    onClick={() => onSave(id)}
                                >
                                    Save
                                </Button>
                            </Box>
                        </Box>
                    </Box>
                )
            })}
        </Box>
    );
}