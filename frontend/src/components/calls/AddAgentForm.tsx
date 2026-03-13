import React, { useEffect, useState } from 'react';
import {
    Box,
    Card,
    Stack,
    Typography,
    TextField,
    Button,
    Switch,
    FormControlLabel,
    Select,
    OutlinedInput,
    Chip,
    MenuItem,
    InputLabel,
    FormControl,
} from '@mui/material';
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";

interface AddAgentFormProps {
    agentType: "inbound" | "outbound";
    agent?: any; // existing agent for edit
    mode: "create" | "edit";
    onCancel: () => void;
    onSave: (data: any) => void;
}

const destinationOptions = ['India', 'USA', 'UK', 'Canada', 'Australia'];

export const AddAgentForm: React.FC<AddAgentFormProps> = ({ agentType, agent, mode, onCancel, onSave }) => {
    const [errors, setErrors] = useState<any>({});
    const [files, setFiles] = useState<File[]>([]);
    const [formData, setFormData] = useState({
        name: agent?.name || '',
        greeting: agent?.greeting || '',
        prompt: agent?.prompt || '',
        destination: agent?.destination || [],
        enable_sentiment: agent?.enable_sentiment || false,
        voice_mail_detection: agent?.voice_mail_detection || false,
        enable_call_recording: agent?.enable_call_recording || false,
        success_parameters: agent?.success_parameters || '',
        enable_call_summary: agent?.enable_call_summary || false,
        summary_prompt: agent?.summary_prompt || '',
        follow_up_whatsapp: agent?.follow_up_whatsapp || false,
    });
    const [existingFiles, setExistingFiles] = useState<string[]>(
        agent?.training_doc ? agent.training_doc.split(",") : []
    );


    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleToggleChange = (name: string, value: boolean) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleDestinationChange = (event: any) => {
        const { target: { value } } = event;
        setFormData(prev => ({ ...prev, destination: typeof value === 'string' ? value.split(',') : value }));
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setFiles(Array.from(event.target.files));
        }
    };

    const removeFile = (index: number) => {
        setFiles(files.filter((_, i) => i !== index));
    };

    const validate = () => {
        const newErrors: any = {};

        if (!formData.name.trim()) {
            newErrors.name = "Agent name is required";
        }

        if (!formData.prompt.trim()) {
            newErrors.prompt = "Agent prompt is required";
        }

        if (formData.destination.length === 0) {
            newErrors.destination = "Select at least one destination country";
        }

        if (formData.enable_call_summary && !formData.summary_prompt.trim()) {
            newErrors.summary_prompt = "Summary prompt is required";
        }

        setErrors(newErrors);

        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = () => {
        if (!validate()) return;

        const data = new FormData();

        // create agent object
        const agent = {
            ...formData,
            type: agentType
        };

        // send agent as JSON string
        data.append("agent", JSON.stringify(agent));

        // append files
        files.forEach((file) => {
            data.append("attachments", file);
        });

        onSave(data);
    };


    return (
        <Card sx={{ mb: 3, p: 3, borderRadius: 2, boxShadow: 2, position: 'sticky', top: 16, zIndex: 1 }}>
            <Stack spacing={3}>
                {/* Header */}
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="h6">
                            {mode === "create" ? "Add New Agent" : "Edit Agent"}
                        </Typography>

                        <Chip
                            label={agentType === "inbound" ? "Inbound Agent" : "Outbound Agent"}
                            color={agentType === "inbound" ? "success" : "primary"}
                            size="small"
                        />
                    </Stack>

                    <Button color="error" onClick={onCancel}>
                        Cancel
                    </Button>
                </Stack>

                {/* Agent Information */}
                <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="subtitle1" mb={2}>Agent Information</Typography>
                    <Stack spacing={2}>
                        <TextField
                            required
                            label="Name of the Agent"
                            name="name"
                            value={formData.name}
                            error={!!errors.name}
                            helperText={errors.name}
                            onChange={handleInputChange}
                        />
                        <TextField
                            label="Agent Greeting Message"
                            name="greeting"
                            value={formData.greeting}
                            onChange={handleInputChange}
                            multiline
                            rows={3}
                            inputProps={{
                                style: {
                                    overflow: "auto",
                                    resize: "none"
                                }
                            }}
                        />
                        <TextField
                            required
                            label="Agent Prompt"
                            name="prompt"
                            value={formData.prompt}
                            onChange={handleInputChange}
                            multiline
                            rows={10}
                            error={!!errors.prompt}
                            helperText={errors.prompt}
                            inputProps={{
                                style: {
                                    overflow: "auto",
                                    resize: "none"
                                }
                            }}
                        />
                        <Stack spacing={2}>

                            <Button variant="outlined" component="label">
                                Upload Training Document (Optional)
                                <input
                                    hidden
                                    type="file"
                                    multiple
                                    onChange={handleFileChange}
                                />
                            </Button>

                            {(existingFiles.length > 0 || files.length > 0) && (
                                <>
                                    <Typography variant="body2" color="text.secondary">
                                        Selected Files
                                    </Typography>

                                    <Stack direction="row" flexWrap="wrap" gap={1}>

                                        {/* Existing Files (Edit Mode) */}
                                        {existingFiles.map((file, index) => (
                                            <Chip
                                                key={`existing-${index}`}
                                                icon={<InsertDriveFileIcon color="primary" />}
                                                label={file.split("/").pop()}
                                                onDelete={() => {
                                                    setExistingFiles(existingFiles.filter((_, i) => i !== index));
                                                }}
                                                variant="outlined"
                                            />
                                        ))}

                                        {/* Newly Uploaded Files */}
                                        {files.map((file, index) => (
                                            <Chip
                                                key={`new-${index}`}
                                                icon={<InsertDriveFileIcon color="primary" />}
                                                label={file.name}
                                                onDelete={() => removeFile(index)}
                                                variant="outlined"
                                            />
                                        ))}

                                    </Stack>
                                </>
                            )}

                        </Stack>
                        <FormControl error={!!errors.destination}>
                            <InputLabel>Destination Country</InputLabel>

                            <Select
                                multiple
                                value={formData.destination}
                                onChange={handleDestinationChange}
                                input={<OutlinedInput label="Destination Country" />}
                            >
                                {destinationOptions.map((country) => (
                                    <MenuItem key={country} value={country}>
                                        {country}
                                    </MenuItem>
                                ))}
                            </Select>

                            {errors.destination && (
                                <Typography variant="caption" color="error">
                                    {errors.destination}
                                </Typography>
                            )}
                        </FormControl>
                    </Stack>
                </Card>

                {/* Analysis Options */}
                <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="subtitle1" mb={2}>Analysis Options</Typography>
                    <Stack spacing={1}>
                        <FormControlLabel
                            control={<Switch checked={formData.enable_sentiment} onChange={(e) => handleToggleChange('enable_sentiment', e.target.checked)} />}
                            label="Enable Sentiment Detection"
                        />
                        <FormControlLabel
                            control={<Switch checked={formData.voice_mail_detection} onChange={(e) => handleToggleChange('voice_mail_detection', e.target.checked)} />}
                            label="Voice Mail Detection"
                        />
                        <FormControlLabel
                            control={<Switch checked={formData.enable_call_recording} onChange={(e) => handleToggleChange('enable_call_recording', e.target.checked)} />}
                            label="Enable Call Recording"
                        />
                    </Stack>
                </Card>

                {/* Success Parameters */}
                <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="subtitle1" mb={2}>Success Parameters</Typography>
                    <Stack spacing={2}>
                        <TextField
                            label="Success Parameters"
                            name="success_parameters"
                            value={formData.success_parameters}
                            onChange={handleInputChange}
                            multiline
                            rows={10} // taller textarea for success parameters
                            inputProps={{
                                style: {
                                    overflow: "auto",
                                    resize: "none"
                                }
                            }}
                        />
                        <FormControlLabel
                            control={<Switch checked={formData.enable_call_summary} onChange={(e) => handleToggleChange('enable_call_summary', e.target.checked)} />}
                            label="Enable Call Summary"
                        />
                        {formData.enable_call_summary && (
                            <TextField
                                label="Summary Prompt"
                                name="summaryPrompt"
                                value={formData.summary_prompt}
                                onChange={handleInputChange}
                                multiline
                                error={!!errors.summary_prompt}
                                helperText={errors.summary_prompt}
                                rows={10} // taller textarea for success parameters
                                inputProps={{
                                    style: {
                                        overflow: "auto",
                                        resize: "none"
                                    }
                                }}
                            />
                        )}
                        <FormControlLabel
                            control={<Switch checked={formData.follow_up_whatsapp} onChange={(e) => handleToggleChange('follow_up_whatsapp', e.target.checked)} />}
                            label="After call completion, send follow-up WhatsApp message"
                        />
                    </Stack>
                </Card>

                {/* Save Button aligned right */}
                <Box display="flex" justifyContent="flex-end">
                    <Button variant="contained" onClick={handleSubmit}>
                        {mode === "create" ? "Save Agent" : "Update Agent"}
                    </Button>
                </Box>
            </Stack>
        </Card>
    );
};