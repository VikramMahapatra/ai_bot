import React, { useState } from 'react';
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
} from '@mui/material';

interface AddAgentFormProps {
    onCancel: () => void;
    onSave: (data: any) => void;
}

const destinationOptions = ['India', 'USA', 'UK', 'Canada', 'Australia'];

export const AddAgentForm: React.FC<AddAgentFormProps> = ({ onCancel, onSave }) => {
    const [formData, setFormData] = useState({
        name: '',
        greeting: '',
        prompt: '',
        trainingDoc: null as File | null,
        destination: [] as string[],
        enableSentiment: false,
        voiceMailDetection: false,
        enableCallRecording: false,
        successParameters: '',
        enableCallSummary: false,
        summaryPrompt: '',
        followUpWhatsApp: false,
    });

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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFormData(prev => ({ ...prev, trainingDoc: e.target.files![0] }));
        }
    };

    const handleSubmit = () => {
        onSave(formData);
    };

    return (
        <Card sx={{ mb: 3, p: 3, borderRadius: 2, boxShadow: 2, position: 'sticky', top: 16, zIndex: 1 }}>
            <Stack spacing={3}>
                {/* Header */}
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">Add New Agent</Typography>
                    <Button color="secondary" onClick={onCancel}>Cancel</Button>
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
                            onChange={handleInputChange}
                        />
                        <TextField
                            label="Agent Greeting Message"
                            name="greeting"
                            value={formData.greeting}
                            onChange={handleInputChange}
                            multiline
                            minRows={3}
                        />
                        <TextField
                            label="Agent Prompt"
                            name="prompt"
                            value={formData.prompt}
                            onChange={handleInputChange}
                            multiline
                            minRows={4}
                        />
                        <Button variant="outlined" component="label">
                            Upload Training Document (Optional)
                            <input type="file" hidden onChange={handleFileChange} />
                        </Button>
                        <InputLabel>Destination Country</InputLabel>
                        <Select
                            multiple
                            value={formData.destination}
                            onChange={handleDestinationChange}
                            input={<OutlinedInput label="Destination Country" />}
                            renderValue={(selected) => (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {(selected as string[]).map((value) => <Chip key={value} label={value} />)}
                                </Box>
                            )}
                        >
                            {destinationOptions.map((country) => (
                                <MenuItem key={country} value={country}>{country}</MenuItem>
                            ))}
                        </Select>
                    </Stack>
                </Card>

                {/* Analysis Options */}
                <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="subtitle1" mb={2}>Analysis Options</Typography>
                    <Stack spacing={1}>
                        <FormControlLabel
                            control={<Switch checked={formData.enableSentiment} onChange={(e) => handleToggleChange('enableSentiment', e.target.checked)} />}
                            label="Enable Sentiment Detection"
                        />
                        <FormControlLabel
                            control={<Switch checked={formData.voiceMailDetection} onChange={(e) => handleToggleChange('voiceMailDetection', e.target.checked)} />}
                            label="Voice Mail Detection"
                        />
                        <FormControlLabel
                            control={<Switch checked={formData.enableCallRecording} onChange={(e) => handleToggleChange('enableCallRecording', e.target.checked)} />}
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
                            name="successParameters"
                            value={formData.successParameters}
                            onChange={handleInputChange}
                            multiline
                            minRows={5} // taller textarea for success parameters
                        />
                        <FormControlLabel
                            control={<Switch checked={formData.enableCallSummary} onChange={(e) => handleToggleChange('enableCallSummary', e.target.checked)} />}
                            label="Enable Call Summary"
                        />
                        {formData.enableCallSummary && (
                            <TextField
                                label="Summary Prompt"
                                name="summaryPrompt"
                                value={formData.summaryPrompt}
                                onChange={handleInputChange}
                                multiline
                                minRows={4} // taller summary prompt
                            />
                        )}
                        <FormControlLabel
                            control={<Switch checked={formData.followUpWhatsApp} onChange={(e) => handleToggleChange('followUpWhatsApp', e.target.checked)} />}
                            label="After call completion, send follow-up WhatsApp message"
                        />
                    </Stack>
                </Card>

                {/* Save Button aligned right */}
                <Box display="flex" justifyContent="flex-end">
                    <Button variant="contained" onClick={handleSubmit}>Save Agent</Button>
                </Box>
            </Stack>
        </Card>
    );
};