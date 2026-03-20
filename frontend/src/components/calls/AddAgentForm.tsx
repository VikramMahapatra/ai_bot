import React, { useEffect, useMemo, useRef, useState } from 'react';
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
    Radio,
    Checkbox,
    Slider,
    Grid,
    FormHelperText
} from '@mui/material';
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import StopIcon from "@mui/icons-material/Stop";
import IconButton from "@mui/material/IconButton";
import moment from 'moment-timezone';
import { callingAgentService, Voice } from '../../services/callingAgentService';

interface AddAgentFormProps {
    agentType: "inbound" | "outbound";
    agent?: any; // existing agent for edit
    mode: "create" | "edit";
    onCancel: () => void;
    onSave: (data: any) => void;
    loading: boolean;
}

// const destinationOptions = ['India', 'USA', 'UK', 'Canada', 'Australia'];

// const voiceOptions = [
//     { id: "sBFce9RYjwinEuw3T4sS", name: "Mayuri", accent: "en-IN", gender: "Female" },
//     { id: "qNEtlFtvbX90lZZcDJ8X", name: "Neha", accent: "hi-IN", gender: "Female" },
//     { id: "MmQVkVZnQ0dUbfWzcW6f", name: "Zara", accent: "en-IN", gender: "Female" },
//     { id: "caMurMrvWp0v3NFJALhl", name: "Roopa", accent: "en-IN", gender: "Female" },
//     { id: "90ipbRoKi4CpHXvKVtl0", name: "Anika", accent: "en-IN", gender: "Female" },
//     { id: "QTKSa2Iyv0yoxvXY2V8a", name: "Neha P", accent: "hi-IN", gender: "Female" },
//     { id: "wJ5MX7uuKXZwFqGdWM4N", name: "Raj", accent: "en-IN", gender: "Male" },
//     { id: "6TcvxMZXgg9AlJrd8iCl", name: "Harshit", accent: "en-IN", gender: "Male" },
//     { id: "mCQMfsqGDT6IDkEKR20a", name: "Jeevan", accent: "en-IN", gender: "Male" },
// ];

// const accentOptions = [
//     { label: "All Accents", value: "all" },
//     { label: "Mul-Hi-En-Te", value: "Mul-Hi-En-Te" },
//     { label: "US-en", value: "US-en" },
//     { label: "en-IN", value: "en-IN" },
//     { label: "hi-IN", value: "hi-IN" },
// ];

const timezoneOptions = moment.tz.names().map((tz) => ({
    value: tz,
    label: `(GMT${moment.tz(tz).format("Z")}) ${tz}`
}));

const transcriberProviders = [
    { label: "Deepgram", value: "deepgram" },
    { label: "Azure", value: "azure" }
];

const transcriberModels = [
    { label: "Nova 2", value: "nova-2" },
    { label: "Nova", value: "nova" }
];

const transcriberLanguages = [
    { label: "English", value: "en" },
    { label: "English (US)", value: "en-US" },
    { label: "English (UK)", value: "en-GB" },
    { label: "English (India)", value: "en-IN" },
    { label: "English (Australia)", value: "en-AU" },
    { label: "French", value: "fr" },
    { label: "German", value: "de" },
    { label: "Italian", value: "it" },
    { label: "Spanish", value: "es" },
    { label: "Spanish (Latin America)", value: "es-419" },
    { label: "Portuguese", value: "pt" },
    { label: "Portuguese (Brazil)", value: "pt-BR" },
    { label: "Hindi", value: "hi" },
    { label: "Japanese", value: "ja" },
    { label: "Korean", value: "ko" },
    { label: "Chinese", value: "zh" },
    { label: "Auto Detect", value: "multi" }
];

const INCOMING_DEFAULTS = {
    greeting: "Hello! Thank you for calling. How can I assist you today?",
    prompt: `You are a helpful and professional AI support agent handling incoming calls.

Your goal is to assist the caller with their queries, provide accurate information, and ensure a smooth experience.

Guidelines:
- Be polite, calm, and patient
- Listen carefully and understand the user's issue
- Ask clarifying questions when needed
- Provide clear and concise answers
- If unsure, politely say you will check or escalate

Always begin with the greeting provided.`
};

const OUTGOING_DEFAULTS = {
    greeting: "Hello! This is a quick call regarding an update. Is this a good time to talk?",
    prompt: `You are a professional AI calling agent making outgoing calls.

Your goal is to engage the user, communicate the purpose of the call clearly, and guide the conversation toward a specific outcome.

Guidelines:
- Start by confirming if it’s a good time to talk
- Be friendly and confident
- Clearly explain the purpose of the call
- Keep responses short and natural
- Handle objections politely

Always begin with the greeting provided.`
};

export const AddAgentForm: React.FC<AddAgentFormProps> = ({ agentType, agent, mode, onCancel, onSave, loading }) => {
    const [errors, setErrors] = useState<any>({});
    const [files, setFiles] = useState<File[]>([]);
    const [voiceOptions, setVoiceOptions] = useState<Voice[]>([]);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isDisabled, setIsDisabled] = useState(false);

    const defaults = agentType === "inbound"
        ? INCOMING_DEFAULTS
        : OUTGOING_DEFAULTS;

    const [formData, setFormData] = useState({
        name: agent?.name || '',
        greeting: agent?.greeting || defaults.greeting,
        prompt: agent?.prompt || defaults.prompt,
        destination: agent?.destination || [],
        server_location: agent?.server_location || "US",

        gender: agent?.gender || "Male",
        accent: agent?.accent || "",
        voice: agent?.voice || "",

        who_speaks_first: agent?.who_speaks_first || "ai",

        enable_prompt_timezone: agent?.enable_prompt_timezone || false,
        prompt_timezone: agent?.prompt_timezone || "",

        enable_call_forwarding: agent?.enable_call_forwarding || false,
        call_forwarding_number: agent?.call_forwarding_number || "",
        call_forwarding_role: agent?.call_forwarding_role || "",
        call_forwarding_action_desc: agent?.call_forwarding_action_desc || "",

        silence_timeout: agent?.silence_timeout || 10,
        talking_speed: agent?.talking_speed || 1.0,
        max_call_duration: agent?.max_call_duration || 120,
        calendar_sync: agent?.calendar_sync || false,
        enable_sentiment: agent?.enable_sentiment || false,
        voice_mail_detection: agent?.voice_mail_detection || false,
        enable_call_recording: agent?.enable_call_recording || false,

        success_parameters: agent?.success_parameters || '',
        enable_call_summary: agent?.enable_call_summary || false,
        summary_prompt: agent?.summary_prompt || '',
        follow_up_whatsapp: agent?.follow_up_whatsapp || false,
        important_data_points: agent?.important_data_points || "",
        enable_background_sound: agent?.enable_background_sound || false,
        background_sound_url: agent?.background_sound_url || "",
        start_speaking_wait_seconds: agent?.start_speaking_wait_seconds || "0.1",
        stop_speaking_voice_seconds: agent?.stop_speaking_voice_seconds || "0.3",
        transcriber_provider: agent?.transcriber_provider || "deepgram",
        transcriber_language: agent?.transcriber_language || "en-IN",
        transcriber_model: agent?.transcriber_model || "nova-2",
    });

    useEffect(() => {
        const fetchVoices = async () => {
            try {
                const voices = await callingAgentService.allVoices();
                setVoiceOptions(voices);

            } catch (err) {
                console.error("Failed to load voices", err);
            }
        };

        fetchVoices();
    }, []);

    const filteredVoices = useMemo(() => {

        let filtered = [...voiceOptions];

        if (formData.gender) {
            filtered = filtered.filter(v => v.gender === formData.gender);
        }

        if (formData.accent && formData.accent !== "all") {
            filtered = filtered.filter(v => v.accent === formData.accent);
        }

        return filtered;

    }, [voiceOptions, formData.gender, formData.accent]);

    const accentOptions = useMemo(() => {
        let filtered = [...voiceOptions];

        // Apply gender filter first
        if (formData.gender) {
            filtered = filtered.filter(v => v.gender === formData.gender);
        }

        return [
            { label: "All Accents", value: "all" },
            ...Array.from(new Set(filtered.map(v => v.accent)))
                .map(accent => ({
                    label: accent,
                    value: accent
                }))
        ];
    }, [voiceOptions, formData.gender]);

    const [existingFiles, setExistingFiles] = useState<string[]>(
        agent?.training_doc ? agent.training_doc.split(",") : []
    );

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name: string, value: any) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleProviderChange = (value: string) => {
        setFormData({
            ...formData,
            transcriber_provider: value,
            transcriber_language: "",
            transcriber_model: ""
        });
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

        // if (formData.destination.length === 0) {
        //     newErrors.destination = "Select at least one destination country";
        // }
        if (!formData.server_location) {
            newErrors.server_location = "Server location is required";
        }

        if (formData.enable_call_summary && !formData.summary_prompt.trim()) {
            newErrors.summary_prompt = "Summary prompt is required";
        }

        if (!formData.voice) {
            newErrors.voice = "Voice selection required";
        }

        if (formData.enable_prompt_timezone && !formData.prompt_timezone) {
            newErrors.prompt_timezone = "Timezone is required";
        }

        if (agentType == "inbound") {
            if (!formData.call_forwarding_number) {
                newErrors.call_forwarding_number = "Phone number is required";
            }
        }

        if (!formData.transcriber_provider) {
            newErrors.transcriber_provider = "Provider is required";
        }

        if (formData.transcriber_provider && !formData.transcriber_language) {
            newErrors.transcriber_language = "Language is required";
        }

        if (formData.transcriber_provider && formData.transcriber_provider == "deepgram" && !formData.transcriber_model) {
            newErrors.transcriber_model = "Model is required";
        }

        setErrors(newErrors);

        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = () => {
        if (!validate()) {
            console.log("Form is invalid")
            console.log("Validation Errors:", errors);
            return;
        }
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

    const selectedVoice = voiceOptions.find(v => v.voice_id === formData.voice);


    const togglePreview = (url: string) => {

        if (!audioRef.current) {
            const audio = new Audio(url);

            audio.addEventListener("ended", () => {
                setIsPlaying(false);
            });

            audioRef.current = audio;
        }

        const audio = audioRef.current;

        if (isPlaying) {
            audio.pause();
            setIsPlaying(false);
        } else {

            if (audio.src !== url) {
                audio.src = url;
            }

            audio.play();
            setIsPlaying(true);
        }
    };

    const stopPreview = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsPlaying(false);
        }
    };

    useEffect(() => {
        stopPreview();
    }, [formData.voice]);

    return (
        <Card sx={{ mb: 3, p: 3, borderRadius: 2, boxShadow: 2, position: 'sticky', zIndex: 1 }}>
            <Stack spacing={3}>
                {/* Header */}
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="h6">
                            {mode === "create" ? "Add New Agent" : "Edit Agent"}
                        </Typography>

                        <Chip
                            label={agentType === "inbound" ? "Inbound Agent" : "Outbound Agent"}
                            color={agentType === "inbound" ? "secondary" : "primary"}
                            size="small"
                        />
                    </Stack>

                    <Box display="flex" justifyContent="flex-end" >
                        <Button color="error" variant='outlined' onClick={onCancel}>
                            Cancel
                        </Button>
                        <Button variant="contained" onClick={handleSubmit} sx={{ ml: 1 }} disabled={loading}>
                            {mode === "create" ? "Save" : "Update"}
                        </Button>
                    </Box>
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

                            {/* Enable Prompt Timezone */}
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={formData.enable_prompt_timezone}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                enable_prompt_timezone: e.target.checked
                                            })
                                        }
                                    />
                                }
                                label="Enable Prompt Timezone"
                            />

                            {/* Timezone Select */}
                            {formData.enable_prompt_timezone && (
                                <FormControl fullWidth>
                                    <InputLabel>Timezone</InputLabel>

                                    <Select
                                        value={formData.prompt_timezone}
                                        label="Timezone"
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                prompt_timezone: e.target.value
                                            })
                                        }
                                    >
                                        <MenuItem value="">
                                            Select a timezone
                                        </MenuItem>

                                        {timezoneOptions.map((tz) => (
                                            <MenuItem key={tz.value} value={tz.value}>
                                                {tz.label}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            )}

                        </Stack>
                        {/* <Stack spacing={2}>

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

                        </Stack> */}
                        {/* <FormControl error={!!errors.destination}>
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
                        </FormControl> */}
                        <FormControl fullWidth error={!!errors.server_location}>
                            <InputLabel>Server Location</InputLabel>

                            <Select
                                value={formData.server_location || ""}
                                label="Server Location"
                                onChange={(e) =>
                                    setFormData({ ...formData, server_location: e.target.value })
                                }
                            >
                                <MenuItem value="">
                                    <em>Select Server Location</em>
                                </MenuItem>

                                <MenuItem value="IN">India Server</MenuItem>
                                <MenuItem value="US">US Server</MenuItem>

                            </Select>

                            {errors.server_location && (
                                <Typography variant="caption" color="error">
                                    {errors.server_location}
                                </Typography>
                            )}
                        </FormControl>
                    </Stack>
                </Card >

                <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="subtitle1" mb={2}>
                        Who Speaks First?
                    </Typography>

                    <FormControl fullWidth>
                        <Select
                            value={formData.who_speaks_first}
                            onChange={(e) =>
                                handleSelectChange("who_speaks_first", e.target.value)
                            }
                            displayEmpty
                        >
                            <MenuItem value="ai">
                                🤖 AI speaks first
                            </MenuItem>

                            <MenuItem value="user">
                                👤 User speaks first
                            </MenuItem>
                        </Select>
                    </FormControl>
                </Card>

                {/* Agent Voice Selection */}
                <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="subtitle1" mb={2}>
                        Agent Voice Selection
                    </Typography>

                    <Stack spacing={3}>

                        {/* Gender */}
                        <FormControl>
                            <Typography variant="body2" mb={1}>
                                Select Gender
                            </Typography>

                            <Stack direction="row" spacing={3}>
                                <FormControlLabel
                                    value="Male"
                                    control={
                                        <Radio
                                            checked={formData.gender === "Male"}
                                            onChange={(e) =>
                                                setFormData({ ...formData, gender: e.target.value })
                                            }
                                        />
                                    }
                                    label="Male"
                                />

                                <FormControlLabel
                                    value="Female"
                                    control={
                                        <Radio
                                            checked={formData.gender === "Female"}
                                            onChange={(e) =>
                                                setFormData({ ...formData, gender: e.target.value })
                                            }
                                        />
                                    }
                                    label="Female"
                                />
                            </Stack>
                        </FormControl>

                        {/* Accent */}
                        <FormControl fullWidth>
                            <InputLabel>Accent</InputLabel>

                            <Select
                                value={formData.accent || "all"}
                                label="Accent"
                                onChange={(e) =>
                                    setFormData({ ...formData, accent: e.target.value })
                                }
                            >
                                {accentOptions.map((accent) => (
                                    <MenuItem key={accent.value} value={accent.value}>
                                        {accent.label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {/* Voice */}
                        <FormControl
                            fullWidth
                            required
                            error={!!errors.voice}
                        >
                            <InputLabel>Select Voice</InputLabel>

                            <Select
                                required
                                value={formData.voice}
                                label="Select Voice"
                                onChange={(e) =>
                                    setFormData({ ...formData, voice: e.target.value })
                                }
                            >
                                {filteredVoices.map((voice) => (
                                    <MenuItem key={voice.voice_id} value={voice.voice_id}>
                                        {voice.caller_name}
                                    </MenuItem>
                                ))}
                            </Select>
                            <FormHelperText>{errors.voice}</FormHelperText>
                        </FormControl>

                        {/* Preview */}
                        {selectedVoice && (
                            <Card variant="outlined" sx={{ p: 2, background: "#f9fafb" }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center">

                                    <Box>
                                        <Typography fontWeight={500}>
                                            {selectedVoice.caller_name}
                                        </Typography>

                                        <Typography variant="caption" color="text.secondary">
                                            {selectedVoice.accent}
                                        </Typography>
                                    </Box>

                                    <Stack direction="row" spacing={1}>

                                        <Button
                                            variant="contained"
                                            size="small"
                                            startIcon={isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                                            onClick={() => togglePreview(selectedVoice.recording_url)}
                                        >
                                            {isPlaying ? "Pause" : "Play"}
                                        </Button>

                                        <Button
                                            variant="outlined"
                                            size="small"
                                            color="error"
                                            startIcon={<StopIcon />}
                                            onClick={stopPreview}
                                        >
                                            Stop
                                        </Button>

                                    </Stack>

                                </Stack>
                            </Card>
                        )}

                    </Stack>
                </Card>

                {/* Call Forwarding */}
                <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="subtitle1" mb={2}>
                        Call Forwarding
                    </Typography>

                    <Stack spacing={2}>

                        {agentType === "inbound" ? (
                            // ✅ Only phone field for inbound
                            <TextField
                                label="Forwarding Phone Number"
                                name="call_forwarding_number"
                                placeholder="+1234567890"
                                value={formData.call_forwarding_number}
                                onChange={handleInputChange}
                                type="tel"
                                required
                                error={!!errors.call_forwarding_number}
                                helperText={
                                    errors.call_forwarding_number || "Phone number to forward calls to"
                                }
                                fullWidth
                            />
                        ) : (
                            // ✅ Full UI for other types
                            <>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={formData.enable_call_forwarding}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    enable_call_forwarding: e.target.checked
                                                })
                                            }
                                        />
                                    }
                                    label="Enable Call Forwarding"
                                />

                                {formData.enable_call_forwarding && (
                                    <Stack spacing={2}>

                                        <TextField
                                            label="Forwarding Phone Number"
                                            name="call_forwarding_number"
                                            placeholder="+1234567890"
                                            value={formData.call_forwarding_number}
                                            onChange={handleInputChange}
                                            type="tel"
                                            fullWidth
                                        />

                                        <TextField
                                            label="Role"
                                            name="call_forwarding_role"
                                            value={formData.call_forwarding_role}
                                            onChange={handleInputChange}
                                            fullWidth
                                        />

                                        <TextField
                                            label="Action Description"
                                            name="call_forwarding_action_desc"
                                            value={formData.call_forwarding_action_desc}
                                            onChange={handleInputChange}
                                            multiline
                                            rows={3}
                                            fullWidth
                                        />

                                    </Stack>
                                )}
                            </>
                        )}

                    </Stack>
                </Card>


                <>
                    {/* Additional Settings */}
                    <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                        <Typography variant="subtitle1" mb={2}>Additional Settings</Typography>
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
                            <TextField
                                label="Important Data Points to Extract"
                                name="important_data_points"
                                value={formData.important_data_points}
                                onChange={handleInputChange}
                                multiline
                                rows={6}
                                placeholder="Example: name, email, interest_level, budget"
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
                                control={
                                    <Switch
                                        checked={formData.enable_background_sound}
                                        onChange={(e) =>
                                            handleToggleChange(
                                                "enable_background_sound",
                                                e.target.checked
                                            )
                                        }
                                    />
                                }
                                label="Enable Background Sound"
                            />

                            {/* Background Sound URL */}
                            {formData.enable_background_sound && (
                                <TextField
                                    label="Background Sound URL"
                                    name="background_sound_url"
                                    value={formData.background_sound_url}
                                    onChange={handleInputChange}
                                    placeholder="https://example.com/background.mp3"
                                    fullWidth
                                />
                            )}

                            {/* Start Speaking Wait Seconds */}
                            <TextField
                                label="Start Speaking Wait Seconds"
                                name="start_speaking_wait_seconds"
                                type="number"
                                value={formData.start_speaking_wait_seconds}
                                onChange={handleInputChange}
                                inputProps={{ min: 0, max: 1, step: 0.1 }}
                                helperText="How long AI waits before speaking"
                            />

                            {/* Stop Speaking Voice Seconds */}
                            <TextField
                                label="Stop Speaking Voice Seconds"
                                name="stop_speaking_voice_seconds"
                                type="number"
                                value={formData.stop_speaking_voice_seconds}
                                onChange={handleInputChange}
                                inputProps={{ min: 0, max: 1, step: 0.1 }}
                                helperText="Silence threshold before AI stops speaking"
                            />
                            {/* <FormControlLabel
                            control={<Switch checked={formData.follow_up_whatsapp} onChange={(e) => handleToggleChange('follow_up_whatsapp', e.target.checked)} />}
                            label="After call completion, send follow-up WhatsApp message"
                        /> */}

                            <Box sx={{ borderTop: "1px solid #e0e0e0", pt: 3, mt: 3 }}>

                                <Typography variant="h6" fontSize={16} fontWeight={600}>
                                    Transcriber
                                </Typography>

                                <Typography variant="body2" color="text.secondary" mb={2}>
                                    Configure the transcription provider and language settings.
                                </Typography>

                                <Grid container spacing={2}>

                                    {/* Provider */}
                                    <Grid item xs={12} md={4}>
                                        <FormControl
                                            fullWidth
                                            required
                                            error={!!errors.transcriber_provider}
                                        >
                                            <InputLabel>Provider</InputLabel>

                                            <Select
                                                value={formData.transcriber_provider}
                                                label="Provider"
                                                onChange={(e) => handleProviderChange(e.target.value)}
                                            >
                                                <MenuItem value="">Select Provider</MenuItem>
                                                {transcriberProviders.map((lang) => (
                                                    <MenuItem key={lang.value} value={lang.value}>
                                                        {lang.label}
                                                    </MenuItem>
                                                ))}
                                            </Select>

                                        </FormControl>
                                    </Grid>

                                    {/* Language (shown for both providers) */}
                                    {formData.transcriber_provider && (
                                        <Grid item xs={12} md={4}>
                                            <FormControl
                                                fullWidth
                                                required
                                                error={!!errors.transcriber_language}
                                            >
                                                <InputLabel>Language</InputLabel>

                                                <Select
                                                    value={formData.transcriber_language}
                                                    label="Language"
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            transcriber_language: e.target.value
                                                        })
                                                    }
                                                >
                                                    <MenuItem value="">Select Language</MenuItem>

                                                    {transcriberLanguages.map((lang) => (
                                                        <MenuItem key={lang.value} value={lang.value}>
                                                            {lang.label}
                                                        </MenuItem>
                                                    ))}

                                                </Select>

                                            </FormControl>
                                        </Grid>
                                    )}

                                    {/* Model (only for Deepgram) */}
                                    {formData.transcriber_provider === "deepgram" && (
                                        <Grid item xs={12} md={4}>
                                            <FormControl
                                                fullWidth
                                                required
                                                error={!!errors.transcriber_language}
                                            >
                                                <InputLabel>Model</InputLabel>

                                                <Select
                                                    value={formData.transcriber_model}
                                                    label="Model"
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            transcriber_model: e.target.value
                                                        })
                                                    }
                                                >
                                                    <MenuItem value="">Select Model</MenuItem>
                                                    {transcriberModels.map((lang) => (
                                                        <MenuItem key={lang.value} value={lang.value}>
                                                            {lang.label}
                                                        </MenuItem>
                                                    ))}
                                                </Select>

                                            </FormControl>
                                        </Grid>
                                    )}

                                </Grid>

                            </Box>
                        </Stack>
                    </Card >

                    {/* Analysis Options */}
                    <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                        <Typography variant="subtitle1" mb={2}>Analysis Options</Typography>
                        <Box sx={{ mt: 2 }}>
                            <Typography fontWeight={500} mb={1}>
                                Timing Settings
                            </Typography>

                            <Typography variant="body2">
                                Silence Timeout: <b>{formData.silence_timeout}</b> seconds
                            </Typography>

                            <Slider
                                value={formData.silence_timeout}
                                min={10}
                                max={20}
                                step={1}
                                onChange={(e, value) =>
                                    setFormData({ ...formData, silence_timeout: value as number })
                                }
                            />

                            <Typography variant="caption" color="text.secondary">
                                How long to wait before AI speaks again after silence
                            </Typography>
                        </Box>
                        <Box sx={{ mt: 2 }}>
                            <Typography fontWeight={500} mb={1}>
                                Talking Speed
                            </Typography>

                            <Typography variant="body2">
                                Speed: <b>{formData.talking_speed}x</b>
                            </Typography>

                            <Slider
                                value={formData.talking_speed}
                                min={0.5}
                                max={2}
                                step={0.1}
                                onChange={(e, value) =>
                                    setFormData({ ...formData, talking_speed: value as number })
                                }
                            />

                            <Stack direction="row" justifyContent="space-between">
                                <Typography variant="caption">0.5x (Slow)</Typography>
                                <Typography variant="caption">1.0x (Normal)</Typography>
                                <Typography variant="caption">2.0x (Fast)</Typography>
                            </Stack>

                            <Typography variant="caption" color="text.secondary">
                                Adjust the speaking speed of the AI agent voice
                            </Typography>
                        </Box>
                        <Box sx={{ mt: 2 }}>
                            <Typography fontWeight={500} mb={1}>
                                Max Call Duration
                            </Typography>

                            <Typography variant="body2">
                                Maximum Duration: <b>{Math.floor(formData.max_call_duration / 60)} min</b> ({formData.max_call_duration} seconds)
                            </Typography>

                            <Slider
                                value={formData.max_call_duration}
                                min={60}
                                max={600}
                                step={30}
                                onChange={(e, value) =>
                                    setFormData({ ...formData, max_call_duration: value as number })
                                }
                            />

                            <Stack direction="row" justifyContent="space-between">
                                <Typography variant="caption">1 min</Typography>
                                <Typography variant="caption">3 min</Typography>
                                <Typography variant="caption">5 min</Typography>
                                <Typography variant="caption">7 min</Typography>
                                <Typography variant="caption">10 min</Typography>
                            </Stack>

                            <Typography variant="caption" color="text.secondary">
                                Maximum duration for a single call
                            </Typography>
                        </Box>
                        {/* <Stack spacing={1} sx={{ mt: 3 }}>
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
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={formData.calendar_sync}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            calendar_sync: e.target.checked
                                        })
                                    }
                                />
                            }
                            label="Calendar Sync"
                        />
                    </Stack> */}
                    </Card >
                </>




                {/* Save Button aligned right */}
                <Box display="flex" justifyContent="flex-end" >
                    <Button variant="contained" onClick={handleSubmit} disabled={loading}>
                        {mode === "create" ? "Save" : "Update"}
                    </Button>
                </Box >
            </Stack >
        </Card >
    );
};