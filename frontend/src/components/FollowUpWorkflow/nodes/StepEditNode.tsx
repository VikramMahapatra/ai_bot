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

export default function StepEditMode({ data, id, agents, templates }: any) {
    const
        {
            onChangeStepType,
            onChangeDelay,
            onChangeDelayUnit,
            onCancelNode,
            onChangeAgent,
            onChangeTemplate,
            onSave
        } = useFlow();
    const stepType = data?.stepType || "call";

    const filteredTemplates = templates?.filter(
        (t: any) => t.type === stepType
    );
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
            {/* Handles */}
            <Handle type="target" position={Position.Left} />
            <Handle type="source" position={Position.Right} />

            <Divider sx={{ my: 1.5 }} />

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
                            value={stepType}
                            label="Step Type"
                            onChange={(e) => onChangeStepType(id, e.target.value)}
                        >
                            <MenuItem value="call">Call</MenuItem>
                            <MenuItem value="sms">SMS</MenuItem>
                            <MenuItem value="email">Email</MenuItem>
                            <MenuItem value="whatsapp">WhatsApp</MenuItem>
                        </Select>
                    </FormControl>
                </div>
                {stepType === "call" && (
                    <div className="nodrag nopan">
                        <FormControl size="small" fullWidth>
                            <InputLabel>Assign Agent</InputLabel>
                            <Select
                                value={data.agentId || ""}
                                label="Assign Agent"
                                onChange={(e) =>
                                    onChangeAgent(id, e.target.value)
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

                {(stepType === "email" || stepType === "whatsapp" || stepType === "sms") && (
                    <div className="nodrag nopan">
                        <FormControl size="small" fullWidth>
                            <InputLabel>Template</InputLabel>
                            <Select
                                label="Template"
                                value={data.templateId || ""}
                                onChange={(e) =>
                                    onChangeTemplate(id, e.target.value)
                                }
                            >
                                {filteredTemplates.length === 0 ? (
                                    <MenuItem value="">No Templates Available</MenuItem>
                                ) : (
                                    filteredTemplates.map((template: any) => (
                                        <MenuItem key={template.id} value={template.id}>
                                            {template.name}
                                        </MenuItem>
                                    ))
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
                            value={data?.delay || 0}
                            onChange={(e) =>
                                onChangeDelay(id, Number(e.target.value))
                            }
                            sx={{ flex: 1 }}
                        />
                    </div>

                    {/* Unit Dropdown */}
                    <div className="nodrag nopan">
                        <FormControl size="small" sx={{ width: 120 }}>
                            <Select
                                value={data.delayUnit || "minutes"}
                                onChange={(e) =>
                                    onChangeDelayUnit(id, {
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
    );
}