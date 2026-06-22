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
    Chip,
    MenuItem,
    InputLabel,
    FormControl,
    Checkbox,
    Slider,
    FormHelperText,
    Alert,
    ToggleButtonGroup,
    ToggleButton,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Collapse,
    Paper,
} from '@mui/material';
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import StopIcon from "@mui/icons-material/Stop";
import IconButton from "@mui/material/IconButton";
import moment from 'moment-timezone';
import { CallingAgent, callingAgentService, Voice } from '../../services/callingAgentService';
import { CallingNumberType, callService } from '../../services/callService';
import MaleIcon from "@mui/icons-material/Male";
import FemaleIcon from "@mui/icons-material/Female";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Grid from "@mui/material/Grid";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import { useAuth } from '../../context/AuthContext';

interface AddAgentFormProps {
    agentType: "inbound" | "outbound";
    agent?: any; // existing agent for edit
    mode: "create" | "edit";
    onCancel: () => void;
    onSave: (data: any) => void;
    loading: boolean;
}

const idleMessageOptions = [
    "Are you still there?",
    "Is there anything else you need help with?",
    "Feel free to ask me any questions.",
    "How can I assist you further?",
    "Let me know if there's anything you need.",
    "I'm still here if you need assistance.",
    "I'm ready to help whenever you are.",
    "Is there something specific you're looking for?",
    "I'm here to help with any questions you have.",
];

const languageMap = [
    { label: "English", value: "English" },
    { label: "Hindi", value: "Hindi" },
    { label: "Kannada", value: "Kannada" },
    { label: "Telugu", value: "Telugu" },
];

const languageRoutingRules: Record<
    string,
    {
        provider: "azure" | "deepgram";
        model?: string;
        languageCode: string;
    }
> = {
    English: {
        provider: "deepgram",
        model: "nova-3",
        languageCode: "en",
    },

    Hindi: {
        provider: "deepgram",
        model: "nova-3",
        languageCode: "hi-IN",
    },

    Telugu: {
        provider: "azure",
        languageCode: "te-IN",
    },

    Kannada: {
        provider: "azure",
        languageCode: "kn-IN",
    },
};

const timezones = [
    {
        value: "Asia/Kolkata",
        label: "India (IST - Asia/Kolkata)"
    },
    {
        value: "Asia/Dubai",
        label: "UAE (GST - Asia/Dubai)"
    },
    {
        value: "America/New_York",
        label: "US Eastern (EST/EDT - America/New_York)"
    },
    {
        value: "America/Chicago",
        label: "US Central (CST/CDT - America/Chicago)"
    },
    {
        value: "America/Denver",
        label: "US Mountain (MST/MDT - America/Denver)"
    },
    {
        value: "America/Los_Angeles",
        label: "US Pacific (PST/PDT - America/Los_Angeles)"
    }
];

const transcriberProviders = [
    { label: "Deepgram", value: "deepgram" },
    { label: "Azure", value: "azure" }
];

const transcriberModels = [
    { label: "Nova 2", value: "nova-2" },
    { label: "Nova 2 Phonecall", value: "nova-2-phonecall" },
    { label: "Nova 3", value: "nova-3" },
];

const languageOptions = [
    { label: "Auto Detect", value: "multi", azure: false, deepgram: true },

    // English
    { label: "English", value: "en", azure: true, deepgram: true },
    { label: "English (US)", value: "en-US", azure: true, deepgram: true },
    { label: "English (UK)", value: "en-GB", azure: true, deepgram: true },
    { label: "English (India)", value: "en-IN", azure: true, deepgram: true },
    { label: "English (Australia)", value: "en-AU", azure: true, deepgram: true },
    { label: "English (Ireland)", value: "en-IE", azure: true, deepgram: false },
    { label: "English (Singapore)", value: "en-SG", azure: true, deepgram: false },

    // European languages (FULL Azure FIX)
    { label: "French (France)", value: "fr-FR", azure: true, deepgram: true },
    { label: "German (Germany)", value: "de-DE", azure: true, deepgram: true },
    { label: "Italian (Italy)", value: "it-IT", azure: true, deepgram: true },

    { label: "Spanish (Spain)", value: "es-ES", azure: true, deepgram: true },
    { label: "Spanish (Latin America)", value: "es-419", azure: false, deepgram: true },

    { label: "Portuguese", value: "pt", azure: true, deepgram: true },
    { label: "Portuguese (Brazil)", value: "pt-BR", azure: true, deepgram: true },

    // Indian languages (Azure FIXED)
    { label: "Hindi (India)", value: "hi-IN", azure: true, deepgram: true },
    { label: "Kannada (India)", value: "kn-IN", azure: true, deepgram: true },
    { label: "Telugu (India)", value: "te-IN", azure: true, deepgram: true },

    // Asian languages
    { label: "Japanese (Japan)", value: "ja-JP", azure: true, deepgram: true },
    { label: "Korean (Korea)", value: "ko-KR", azure: true, deepgram: true },

    // Chinese (Azure correct structure)
    { label: "Chinese", value: "zh", azure: true, deepgram: true },
    { label: "Chinese (China)", value: "zh-CN", azure: true, deepgram: false },
    { label: "Chinese (Hong Kong)", value: "zh-HK", azure: true, deepgram: false },
    { label: "Chinese (Taiwan)", value: "zh-TW", azure: true, deepgram: false },
    { label: "Simplified Chinese", value: "zh-Hans", azure: true, deepgram: false },
    { label: "Traditional Chinese", value: "zh-Hant", azure: true, deepgram: false },

    // Optional extras
    { label: "Bulgarian", value: "bg", azure: false, deepgram: true },
    { label: "Catalan", value: "ca", azure: false, deepgram: true },
    { label: "Czech", value: "cs", azure: false, deepgram: true },
    { label: "Danish", value: "da", azure: false, deepgram: true },
    { label: "Dutch", value: "nl", azure: false, deepgram: true },
    { label: "Polish", value: "pl", azure: false, deepgram: true },
];

const getLanguages = (provider: "azure" | "deepgram") => {
    return languageOptions.filter((lang) => lang[provider]);
};

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

        Always begin with the greeting provided.`,
    end_call_message: "Thank you for taking the time to discuss your needs with me today. Our team will be in touch with more information soon. Have a great day!"
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

        Always begin with the greeting provided.`,
    end_call_message: "Thank you for taking the time to discuss your needs with me today. Our team will be in touch with more information soon. Have a great day!"

};

const emptyFormData = {
    name: '',
    greeting: OUTGOING_DEFAULTS.greeting,
    prompt: OUTGOING_DEFAULTS.prompt,
    destination: [],
    server_location: "US",

    gender: "Male",
    language: "",
    accent: "",
    voice: "",

    who_speaks_first: "ai",

    enable_prompt_timezone: false,
    prompt_timezone: "",
    inbound_phone_number: "",
    enable_call_forwarding: false,
    call_forwarding_number: "",
    call_forwarding_role: "",
    call_forwarding_action_desc: "",

    silence_timeout: 10,
    talking_speed: 1.0,
    max_call_duration: 120,
    calendar_sync: false,
    background_denoising_filter_enabled: false,
    enable_sentiment: false,
    voice_mail_detection: false,

    voicemail_start_at_seconds: 5,
    voicemail_frequency_seconds: 5,
    voicemail_max_retries: 5,
    voicemail_beep_max_await_seconds: 0,

    end_call_message: OUTGOING_DEFAULTS.end_call_message,

    enable_call_recording: false,

    success_parameters: '',
    enable_call_summary: false,
    summary_prompt: '',
    follow_up_whatsapp: false,
    important_data_points: "",
    background_sound: "none",
    background_sound_url: "",
    start_speaking_wait_seconds: "0.1",
    stop_speaking_voice_seconds: "0.3",

    temperature: 0.4,

    message_plan_idle_timeout_seconds: 28.7,
    message_plan_idle_message_max_spoken_count: 4,
    message_plan_idle_messages_selected: [] as string[],

    transcriber_provider: "deepgram",
    transcriber_language: "en-IN",
    transcriber_model: "nova-2",

    punctuation_boundaries: [] as string[]
};

export const AddAgentForm: React.FC<AddAgentFormProps> = ({ agentType, agent, mode, onCancel, onSave, loading }) => {
    const [errors, setErrors] = useState<any>({});
    const [files, setFiles] = useState<File[]>([]);
    const [voiceOptions, setVoiceOptions] = useState<Voice[]>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [formData, setFormData] = useState(emptyFormData);
    const [inboundCallingNumbers, setInboundCallingNumbers] = useState<any[]>([])
    const [voiceExpanded, setVoiceExpanded] = useState(true);
    const [speakFirstExpanded, setSpeakFirstExpanded] = useState(false);
    const [additionalSettingExpanded, setAdditionalSettingExpanded] = useState(false);
    const [analysisOptionExpanded, setAnalysisOptionExpanded] = useState(false);
    const { featureFlags } = useAuth();

    const callForwardingEnabled =
        featureFlags?.call_forwarding_enabled ?? false;

    useEffect(() => {
        const defaults = agentType === "inbound"
            ? INCOMING_DEFAULTS
            : OUTGOING_DEFAULTS;

        setFormData({
            name: agent?.name || '',
            greeting: agent?.greeting || defaults.greeting,
            prompt: agent?.prompt || defaults.prompt,
            destination: agent?.destination || [],
            server_location: agent?.server_location || "US",

            gender: agent?.gender || "Male",
            language: agent?.language || "",
            accent: agent?.accent || "",
            voice: agent?.voice || "",

            who_speaks_first: agent?.who_speaks_first || "ai",

            enable_prompt_timezone: agent?.enable_prompt_timezone || false,
            prompt_timezone: agent?.prompt_timezone || "",

            inbound_phone_number: agent?.inbound_phone_number || "",

            enable_call_forwarding: agent?.enable_call_forwarding || false,
            call_forwarding_number: agent?.call_forwarding_number || "",
            call_forwarding_role: agent?.call_forwarding_role || "",
            call_forwarding_action_desc: agent?.call_forwarding_action_desc || "",

            silence_timeout: agent?.silence_timeout || 10,
            talking_speed: agent?.talking_speed || 1.0,
            max_call_duration: agent?.max_call_duration || 120,
            calendar_sync: agent?.calendar_sync || false,
            background_denoising_filter_enabled: agent?.background_denoising_filter_enabled || false,
            enable_sentiment: agent?.enable_sentiment || false,
            voice_mail_detection: agent?.voice_mail_detection || false,

            voicemail_start_at_seconds: agent?.voicemail_start_at_seconds || 5,
            voicemail_frequency_seconds: agent?.voicemail_frequency_seconds || 5,
            voicemail_max_retries: agent?.voicemail_max_retries || 5,
            voicemail_beep_max_await_seconds: agent?.voicemail_beep_max_await_seconds || 0,

            end_call_message: agent?.end_call_message || defaults.end_call_message,

            enable_call_recording: agent?.enable_call_recording || false,
            success_parameters: agent?.success_parameters || '',
            enable_call_summary: agent?.enable_call_summary || false,
            summary_prompt: agent?.summary_prompt || '',
            follow_up_whatsapp: agent?.follow_up_whatsapp || false,
            important_data_points: agent?.important_data_points || "",
            background_sound: agent?.background_sound || "off",
            background_sound_url: agent?.background_sound_url || "",
            start_speaking_wait_seconds: agent?.start_speaking_wait_seconds || "0.1",
            stop_speaking_voice_seconds: agent?.stop_speaking_voice_seconds || "0.3",
            transcriber_provider: agent?.transcriber_provider || "deepgram",
            transcriber_language: agent?.transcriber_language || "en-IN",
            transcriber_model: agent?.transcriber_model || "nova-3",

            temperature: agent?.temperature || 0.4,
            message_plan_idle_timeout_seconds: agent?.message_plan_idle_timeout_seconds || 28.7,
            message_plan_idle_message_max_spoken_count: agent?.message_plan_idle_message_max_spoken_count || 4,
            message_plan_idle_messages_selected: agent?.message_plan_idle_messages_selected || [],
            punctuation_boundaries: agent?.punctuation_boundaries || [],
        });

        setExistingFiles(
            agent?.training_doc ? agent.training_doc.split(",") : []
        );

    }, [agent, agentType]);

    useEffect(() => {
        fetchVoices();
        loadInboundCallingNoLookup();
    }, [mode]);

    const fetchVoices = async () => {
        try {
            const voices = await callingAgentService.allVoices();
            setVoiceOptions(voices);

        } catch (err) {
            console.error("Failed to load voices", err);
        }
    };

    const filteredVoices = useMemo(() => {
        const requiredVoiceType =
            agentType && formData.server_location
                ? `${agentType}_${formData.server_location}`.toLowerCase()
                : null;

        return voiceOptions.filter((voice) => {
            if (!requiredVoiceType) return true;

            // Available for all configurations
            if (
                !voice.voice_types ||
                voice.voice_types.length === 0
            ) {
                return true;
            }

            return voice.voice_types.includes(requiredVoiceType);
        });
    }, [
        voiceOptions,
        agentType,
        formData.server_location,
    ]);

    const availableVoices = useMemo(() => {
        let filtered = [...filteredVoices];

        if (formData.gender) {
            filtered = filtered.filter(
                (v) => v.gender === formData.gender
            );
        }

        if (formData.language && formData.language !== "all") {
            filtered = filtered.filter((v) =>
                v.languages?.includes(formData.language)
            );
        }

        return filtered;
    }, [
        filteredVoices,
        formData.gender,
        formData.language,
    ]);

    const languageOptions = useMemo(() => {
        const languages = filteredVoices.flatMap(
            (v) => v.languages || []
        );

        const uniqueLanguages = Array.from(new Set(languages))
            .sort((a, b) => a.localeCompare(b));

        return [
            ...uniqueLanguages.map((language) => ({
                label: language,
                value: language,
            })),
        ];
    }, [filteredVoices]);

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

        if (!formData.server_location) {
            newErrors.server_location = "Server location is required";
        }

        if (formData.enable_call_summary && !formData.summary_prompt.trim()) {
            newErrors.summary_prompt = "Summary prompt is required";
        }

        if (!formData.language) {
            newErrors.language = "Language selection required";
        }

        if (formData.language) {
            if (!formData.voice) {
                newErrors.voice = "Voice selection required";
            }
        }

        if (formData.enable_prompt_timezone && !formData.prompt_timezone) {
            newErrors.prompt_timezone = "Timezone is required";
        }

        if (agentType == "inbound") {
            if (!formData.inbound_phone_number) {
                newErrors.inbound_phone_number = "Inbound phone number is required";
            }
        }
        else {
            if (formData.enable_call_forwarding && !formData.call_forwarding_number) {
                newErrors.call_forwarding_number = "Phone number is required";
            }

            if (formData.enable_call_forwarding && !formData.call_forwarding_role) {
                newErrors.call_forwarding_role = "Message is required";
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
            window.scrollTo({ top: 0, behavior: "smooth" });
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

    const loadInboundCallingNoLookup = async () => {
        const data = await callService.getCallingNumbers(CallingNumberType.INBOUND);
        setInboundCallingNumbers(data || []);
    };

    const isLanguageSelected =
        formData.language && formData.language !== "all";


    const language = formData.language?.toLowerCase() ?? "";

    const recordingUrl =
        selectedVoice?.recordings?.[language.toLowerCase() as any] ||
        selectedVoice?.recording_url;

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
                            {mode === "create" ? "Add Agent" : "Update Agent"}
                        </Button>
                    </Box>
                </Stack>

                {/* ✅ ERROR SUMMARY HERE */}
                {Object.keys(errors).length > 0 && (
                    <Box
                        sx={{
                            p: 2,
                            borderRadius: 2,
                            backgroundColor: "#fff5f5",
                            border: "1px solid #fecaca",
                            boxShadow: "0 4px 12px rgba(239,68,68,0.08)"
                        }}
                    >
                        <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                            <Typography fontWeight={700} color="error">
                                Fix these issues before saving
                            </Typography>
                        </Stack>

                        <Stack spacing={1}>
                            {Object.entries(errors).map(([key, value]) => {
                                const labelMap: Record<string, string> = {
                                    name: "Agent Name",
                                    prompt: "Agent Prompt",
                                    voice: "Voice Selection",
                                    server_location: "Server Location",
                                    call_forwarding_number: "Forwarding Number",
                                    call_forwarding_role: "Forwarding Message",
                                    summary_prompt: "Summary Prompt",
                                    prompt_timezone: "Timezone"
                                };

                                const label = labelMap[key] || key;

                                return (
                                    <Box
                                        key={key}
                                        onClick={() => {
                                            const el = document.querySelector(`[name="${key}"]`);
                                            el?.scrollIntoView({ behavior: "smooth", block: "center" });
                                            (el as HTMLElement)?.focus();
                                        }}
                                        sx={{
                                            px: 1.5,
                                            py: 1,
                                            borderRadius: 1.5,
                                            cursor: "pointer",
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            backgroundColor: "#fff",
                                            border: "1px solid #fee2e2",
                                            transition: "all 0.2s",
                                            "&:hover": {
                                                backgroundColor: "#fef2f2",
                                                transform: "translateX(4px)"
                                            }
                                        }}
                                    >
                                        <Typography variant="body2" fontWeight={500}>
                                            {label}
                                        </Typography>

                                        <Typography variant="caption" color="error">
                                            {String(value)}
                                        </Typography>
                                    </Box>
                                );
                            })}
                        </Stack>
                    </Box>
                )}


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
                            rows={15}
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

                                        {timezones.map((tz) => (
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
                        {/* <FormControl fullWidth error={!!errors.server_location}>
                            <InputLabel>Server Location</InputLabel>

                            <Select
                                value={formData.server_location || ""}
                                label="Server Location"
                                onChange={(e) =>
                                    setFormData({ ...formData, server_location: e.target.value })
                                }
                            >
                                <MenuItem value="">
                                    Select Server Location
                                </MenuItem>

                                <MenuItem value="IN">India Server</MenuItem>
                                <MenuItem value="US">US Server</MenuItem>

                            </Select>

                            {errors.server_location && (
                                <Typography variant="caption" color="error">
                                    {errors.server_location}
                                </Typography>
                            )}
                        </FormControl> */}
                    </Stack>
                </Card >
                {/* Agent Voice Selection */}
                <Accordion
                    expanded={voiceExpanded}
                    onChange={(_, expanded) => setVoiceExpanded(expanded)}
                    sx={{
                        borderRadius: 2,
                        "&:before": {
                            display: "none",
                        },
                        boxShadow: 1,
                    }}
                >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            width="100%"
                            mr={2}
                        >
                            <Typography variant="subtitle1">
                                Agent Voice Selection
                            </Typography>

                            {selectedVoice && (
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                >
                                    {selectedVoice.caller_name}
                                </Typography>
                            )}
                        </Stack>
                    </AccordionSummary>

                    <AccordionDetails>

                        <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                            <Stack spacing={3}>
                                {/* Language */}
                                <FormControl
                                    fullWidth
                                    required
                                    error={!!errors.language}
                                >
                                    <InputLabel>Language</InputLabel>

                                    <Select
                                        value={formData.language}
                                        label="Language"
                                        required
                                        onChange={(e) => {
                                            const selectedLanguage = e.target.value;

                                            const matchingVoice = voiceOptions.find(
                                                (v) => v.languages?.includes(selectedLanguage)
                                            );

                                            const rule = languageRoutingRules[selectedLanguage];

                                            setFormData((prev) => ({
                                                ...prev,

                                                // UI language
                                                language: selectedLanguage,
                                                accent: matchingVoice?.accent || "",
                                                gender: "Male",
                                                voice: "",

                                                // transcriber config
                                                transcriber_language: rule?.languageCode,
                                                transcriber_provider: rule?.provider || "",
                                                transcriber_model: rule?.model || "",
                                            }));
                                        }}
                                    >
                                        {languageOptions.map((language) => (
                                            <MenuItem key={language.value} value={language.value}>
                                                {language.label}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                {!isLanguageSelected ? (
                                    <Alert severity="info">
                                        Please select a language to view available voices.
                                    </Alert>
                                ) : (
                                    <>
                                        {/* Gender */}
                                        <FormControl>
                                            <Box>
                                                <Typography
                                                    variant="body2"
                                                    sx={{ mb: 1.5, fontWeight: 500 }}
                                                >
                                                    Voice Gender
                                                </Typography>

                                                <ToggleButtonGroup
                                                    exclusive
                                                    fullWidth
                                                    value={formData.gender}
                                                    onChange={(_, value) => {
                                                        if (value) {
                                                            setFormData({
                                                                ...formData,
                                                                gender: value,
                                                                voice: "",
                                                            });
                                                        }
                                                    }}
                                                    sx={{
                                                        "& .MuiToggleButton-root": {
                                                            py: 1.5,
                                                            borderRadius: "12px !important",
                                                            border: "1px solid",
                                                            borderColor: "divider",
                                                            gap: 1,
                                                            fontWeight: 600,
                                                            textTransform: "none",
                                                            transition: "all 0.2s ease",
                                                        },

                                                        "& .MuiToggleButton-root.Mui-selected": {
                                                            bgcolor: "primary.main",
                                                            color: "primary.contrastText",
                                                            borderColor: "primary.main",

                                                            "&:hover": {
                                                                bgcolor: "primary.dark",
                                                            },
                                                        },

                                                        "& .MuiToggleButton-root:not(.Mui-selected):hover": {
                                                            bgcolor: "action.hover",
                                                        },
                                                    }}
                                                >
                                                    <ToggleButton value="Male">
                                                        <MaleIcon />
                                                        Male
                                                    </ToggleButton>

                                                    <ToggleButton value="Female">
                                                        <FemaleIcon />
                                                        Female
                                                    </ToggleButton>
                                                </ToggleButtonGroup>
                                            </Box>
                                        </FormControl>
                                        {availableVoices.length === 0 && (
                                            <Alert severity="warning">
                                                No voices available for the selected language and gender.
                                            </Alert>
                                        )}
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
                                                {availableVoices.map((voice) => (
                                                    <MenuItem key={voice.voice_id} value={voice.voice_id}>
                                                        <Stack
                                                            direction="row"
                                                            alignItems="center"
                                                            justifyContent="space-between"
                                                            sx={{ width: "100%" }}
                                                        >
                                                            {/* LEFT SIDE: Name + Tags */}
                                                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                                                <Typography variant="body2" fontWeight={600}>
                                                                    {voice.caller_name}
                                                                </Typography>

                                                                {voice.tags?.map((tag) => (
                                                                    <Chip
                                                                        key={tag}
                                                                        label={tag}
                                                                        size="small"
                                                                        color="warning"
                                                                        variant="outlined"
                                                                        sx={{
                                                                            height: 18,
                                                                            fontSize: "0.65rem",
                                                                            "& .MuiChip-label": { px: 0.75 },
                                                                        }}
                                                                    />
                                                                ))}
                                                            </Stack>

                                                            {/* RIGHT SIDE: Price */}
                                                            {agentType === "inbound" && (
                                                                <Chip
                                                                    label={`₹${voice.price}`}
                                                                    size="small"
                                                                    variant="filled"
                                                                    color='success'
                                                                    sx={{
                                                                        fontWeight: 700,
                                                                        minWidth: 60,
                                                                        color: "#ffffff",
                                                                    }}
                                                                />
                                                            )}
                                                        </Stack>
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
                                                        <Stack
                                                            direction="row"
                                                            spacing={1}
                                                            alignItems="center"
                                                            flexWrap="wrap"
                                                        >
                                                            <Typography fontWeight={600}>
                                                                {selectedVoice.caller_name}
                                                            </Typography>

                                                            {selectedVoice.tags?.map((tag) => (
                                                                <Chip
                                                                    key={tag}
                                                                    label={tag}
                                                                    size="small"
                                                                    variant="outlined"
                                                                    color='warning'
                                                                    sx={{
                                                                        height: 18,
                                                                        fontSize: "0.65rem",
                                                                        "& .MuiChip-label": {
                                                                            px: 0.75,
                                                                        },
                                                                    }}
                                                                />
                                                            ))}
                                                        </Stack>

                                                        <Typography
                                                            variant="caption"
                                                            color="text.secondary"
                                                        >
                                                            {selectedVoice.languages?.join(", ")}
                                                        </Typography>
                                                    </Box>

                                                    <Stack direction="row" spacing={1}>

                                                        <Button
                                                            variant="contained"
                                                            size="small"
                                                            startIcon={isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                                                            onClick={() => recordingUrl && togglePreview(recordingUrl)}
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
                                    </>
                                )}
                            </Stack>
                        </Card>
                    </AccordionDetails>
                </Accordion>

                <Accordion
                    expanded={speakFirstExpanded}
                    onChange={(_, expanded) => setSpeakFirstExpanded(expanded)}
                    sx={{
                        borderRadius: 2,
                        "&:before": {
                            display: "none",
                        },
                        boxShadow: 1,
                    }}
                >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            width="100%"
                            mr={2}
                        >
                            <Typography variant="subtitle1">
                                Who Speaks First?
                            </Typography>

                            {formData.who_speaks_first && (
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                >
                                    {formData.who_speaks_first == "ai" ? "🤖 AI speaks first" : "👤 User speaks first"}
                                </Typography>
                            )}
                        </Stack>
                    </AccordionSummary>

                    <AccordionDetails>
                        <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                            <FormControl fullWidth>
                                <Select
                                    value={formData.who_speaks_first}
                                    onChange={(e) => {
                                        handleSelectChange("who_speaks_first", e.target.value)
                                        setSpeakFirstExpanded(false);
                                    }}
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
                    </AccordionDetails>
                </Accordion>

                {agentType === "inbound" &&

                    <Accordion
                        expanded={speakFirstExpanded}
                        onChange={(_, expanded) => setSpeakFirstExpanded(expanded)}
                        sx={{
                            borderRadius: 2,
                            "&:before": {
                                display: "none",
                            },
                            boxShadow: 1,
                        }}
                    >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Stack
                                direction="row"
                                justifyContent="space-between"
                                alignItems="center"
                                width="100%"
                                mr={2}
                            >
                                <Typography variant="subtitle1">
                                    Inbound Phone Number
                                </Typography>

                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                >
                                    {formData.inbound_phone_number ? `📞 ${formData.inbound_phone_number}` : "📞 Select Inbound Number"}
                                </Typography>
                            </Stack>
                        </AccordionSummary>

                        <AccordionDetails>
                            <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                                <FormControl
                                    fullWidth
                                    required
                                    error={!!errors.inbound_phone_number}
                                >
                                    <Select
                                        value={formData.inbound_phone_number}
                                        onChange={(e) =>
                                            handleSelectChange("inbound_phone_number", e.target.value)
                                        }
                                        displayEmpty
                                    >
                                        {inboundCallingNumbers.map((phone) => (
                                            <MenuItem key={phone.id} value={phone.calling_number}>
                                                {phone.calling_number}
                                            </MenuItem>
                                        ))}

                                    </Select>
                                </FormControl>
                                <FormHelperText>{errors.inbound_phone_number}</FormHelperText>
                            </Card>
                        </AccordionDetails>
                    </Accordion>

                }

                <>
                    {/* Additional Settings */}
                    <Accordion
                        expanded={additionalSettingExpanded}
                        onChange={(_, expanded) => setAdditionalSettingExpanded(expanded)}
                        sx={{
                            borderRadius: 2,
                            "&:before": {
                                display: "none",
                            },
                            boxShadow: 1,
                        }}
                    >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Stack
                                direction="row"
                                justifyContent="space-between"
                                alignItems="center"
                                width="100%"
                                mr={2}
                            >
                                <Typography variant="subtitle1">
                                    Additional Settings
                                </Typography>
                            </Stack>
                        </AccordionSummary>

                        <AccordionDetails>
                            <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                                <Stack spacing={2}>
                                    {agentType === "outbound" &&
                                        <>
                                            <Box
                                                sx={{
                                                    p: 2,
                                                    bgcolor: "#eff6ff",
                                                    border: "1px solid #dbeafe",
                                                    borderRadius: 2,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "space-between",
                                                }}
                                            >
                                                <Stack direction="row" spacing={1.5} alignItems="center">
                                                    <Box
                                                        sx={{
                                                            width: 40,
                                                            height: 40,
                                                            borderRadius: "50%",
                                                            bgcolor: "#dbeafe",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                        }}
                                                    >
                                                        <CalendarMonthIcon
                                                            sx={{
                                                                color: "#2563eb",
                                                                fontSize: 20,
                                                            }}
                                                        />
                                                    </Box>

                                                    <Box>
                                                        <Typography
                                                            variant="subtitle2"
                                                            fontWeight={600}
                                                            color="text.primary"
                                                        >
                                                            Calendar Sync
                                                        </Typography>

                                                        <Typography
                                                            variant="caption"
                                                            color="text.secondary"
                                                        >
                                                            Integrate with calendar for scheduling.
                                                        </Typography>
                                                    </Box>
                                                </Stack>

                                                <Switch
                                                    checked={formData.calendar_sync}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            calendar_sync: e.target.checked
                                                        })
                                                    }
                                                />
                                            </Box>
                                            <Box
                                                sx={{
                                                    p: 2,
                                                    bgcolor: "#eff6ff",
                                                    border: "1px solid #dbeafe",
                                                    borderRadius: 2,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "space-between",
                                                }}
                                            >
                                                {/* LEFT SIDE */}
                                                <Stack direction="row" spacing={1.5} alignItems="center">
                                                    {/* ICON BOX */}
                                                    <Box
                                                        sx={{
                                                            width: 40,
                                                            height: 40,
                                                            borderRadius: "50%",
                                                            bgcolor: "#dbeafe",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                        }}
                                                    >
                                                        <VolumeUpIcon
                                                            sx={{
                                                                color: "#2563eb",
                                                                fontSize: 20,
                                                            }}
                                                        />
                                                    </Box>

                                                    {/* TEXT */}
                                                    <Box>
                                                        <Typography variant="subtitle2" fontWeight={600} color="text.primary">
                                                            Background Denoising
                                                        </Typography>

                                                        <Typography variant="caption" color="text.secondary">
                                                            Filter background noise while the user is talking.
                                                        </Typography>
                                                    </Box>
                                                </Stack>

                                                {/* RIGHT SIDE - SWITCH */}
                                                <Switch
                                                    checked={formData.background_denoising_filter_enabled}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            background_denoising_filter_enabled: e.target.checked,
                                                        })
                                                    }
                                                />
                                            </Box>
                                            <Box sx={{ px: 0.5 }}>
                                                <Typography fontWeight={500} mb={1}>
                                                    Temperature
                                                </Typography>

                                                <Typography variant="body2">
                                                    Creativity Level: <b>{formData.temperature}</b>
                                                </Typography>

                                                <Slider
                                                    value={formData.temperature}
                                                    min={0}
                                                    max={2}
                                                    step={0.01}
                                                    onChange={(e, value) =>
                                                        setFormData({ ...formData, temperature: value as number })
                                                    }
                                                />

                                                <Typography variant="caption" color="text.secondary">
                                                    Controls randomness. Typical range 0–1. Higher = more creative, lower = more deterministic.
                                                </Typography>
                                            </Box>
                                        </>

                                    }
                                    <Box sx={{ px: 0.5 }}>
                                        <Typography fontWeight={500} mb={1}>
                                            Voice Speed
                                        </Typography>

                                        <Typography variant="body2">
                                            Speed: <b>{formData.talking_speed}x</b>
                                        </Typography>

                                        <Slider
                                            value={formData.talking_speed}
                                            min={0.7}
                                            max={1.2}
                                            step={0.1}
                                            onChange={(e, value) =>
                                                setFormData({ ...formData, talking_speed: value as number })
                                            }
                                        />
                                        <Typography variant="caption" color="text.secondary">
                                            Adjust the speaking speed of the AI agent voice
                                        </Typography>
                                    </Box>
                                    {agentType === "outbound" &&
                                        <>
                                            <Box sx={{ px: 0.5 }}>
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

                                            <Box sx={{ px: 0.5 }}>
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
                                            <Box sx={{ borderTop: "1px solid #e0e0e0", mt: 3, pt: 3, px: 0.5 }}>
                                                <Stack
                                                    direction="row"
                                                    spacing={1}
                                                    alignItems="center"
                                                    mb={1}
                                                >
                                                    <Typography
                                                        variant="body2"
                                                        fontWeight={500}
                                                    >
                                                        End Call Message
                                                    </Typography>

                                                </Stack>

                                                <TextField
                                                    fullWidth
                                                    multiline
                                                    minRows={3}
                                                    placeholder="Thank you for taking the time to discuss your needs with me today. Our team will be in touch with more information soon. Have a great day!"
                                                    value={formData.end_call_message}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            end_call_message: e.target.value,
                                                        })
                                                    }
                                                    helperText="This message will be spoken AI just before ending the call"
                                                />
                                            </Box>
                                        </>

                                    }
                                    <FormControl fullWidth >
                                        <InputLabel>Background Sound</InputLabel>

                                        <Select
                                            value={formData.background_sound || ""}
                                            label="Background Sound"
                                            onChange={(e) =>
                                                setFormData({ ...formData, background_sound: e.target.value })
                                            }
                                        >
                                            <MenuItem value="off">Off</MenuItem>
                                            <MenuItem value="office">Office</MenuItem>

                                        </Select>

                                        {errors.server_location && (
                                            <Typography variant="caption" color="error">
                                                {errors.server_location}
                                            </Typography>
                                        )}
                                    </FormControl>

                                    {/* Background Sound URL */}
                                    <TextField
                                        label="Background Sound URL"
                                        name="background_sound_url"
                                        value={formData.background_sound_url}
                                        onChange={handleInputChange}
                                        placeholder="https://example.com/background.mp3"
                                        fullWidth
                                    />
                                    {agentType === "outbound" && (
                                        <>
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

                                            <Box sx={{ borderTop: "1px solid #e0e0e0", pt: 3, mt: 3, px: 0.5 }}>

                                                <Typography variant="h6" fontSize={16} fontWeight={600}>
                                                    Idle Message Plan
                                                </Typography>

                                                <Typography variant="body2" color="text.secondary" mb={2}>
                                                    Configure what the assistant says when the caller remains silent.
                                                </Typography>

                                                <Grid container spacing={2}>
                                                    <Grid item xs={12} md={6}>
                                                        <TextField
                                                            fullWidth
                                                            type="number"
                                                            label="Idle Timeout (Seconds)"
                                                            value={formData.message_plan_idle_timeout_seconds}
                                                            inputProps={{ min: 5, step: 0.1 }}
                                                            onChange={(e) =>
                                                                setFormData({
                                                                    ...formData,
                                                                    message_plan_idle_timeout_seconds: Number(e.target.value),
                                                                })
                                                            }
                                                        />
                                                    </Grid>

                                                    <Grid item xs={12} md={6}>
                                                        <TextField
                                                            fullWidth
                                                            type="number"
                                                            label="Max Idle Prompts"
                                                            value={formData.message_plan_idle_message_max_spoken_count}
                                                            inputProps={{ min: 1 }}
                                                            onChange={(e) =>
                                                                setFormData({
                                                                    ...formData,
                                                                    message_plan_idle_message_max_spoken_count: Number(e.target.value),
                                                                })
                                                            }
                                                        />
                                                    </Grid>
                                                </Grid>
                                                <Box mt={3}>
                                                    <Typography
                                                        variant="body2"
                                                        fontWeight={500}
                                                        mb={1}
                                                    >
                                                        Idle Messages
                                                    </Typography>

                                                    <Paper
                                                        variant="outlined"
                                                        sx={{
                                                            maxHeight: 250,
                                                            overflowY: "auto",
                                                            overflowX: "hidden",
                                                            overflow: "auto !important",
                                                            border: "1px solid",
                                                            borderColor: "divider",
                                                            p: 1,
                                                        }}
                                                    >
                                                        <Stack spacing={0.5}>
                                                            {idleMessageOptions.map((message) => (
                                                                <FormControlLabel
                                                                    key={message}
                                                                    control={
                                                                        <Checkbox
                                                                            checked={
                                                                                formData.message_plan_idle_messages_selected?.includes(message) ?? false
                                                                            }
                                                                            onChange={(e) => {
                                                                                const selected =
                                                                                    (formData.message_plan_idle_messages_selected ?? []) as string[];

                                                                                setFormData({
                                                                                    ...formData,
                                                                                    message_plan_idle_messages_selected: e.target.checked
                                                                                        ? [...selected, message]
                                                                                        : selected.filter((m) => m !== message),
                                                                                });
                                                                            }}
                                                                        />
                                                                    }
                                                                    label={message}
                                                                />
                                                            ))}
                                                        </Stack>
                                                    </Paper>
                                                </Box>
                                            </Box>
                                            <Box sx={{ borderTop: "1px solid #e0e0e0", pt: 3, mt: 3, px: 0.5 }}>

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
                                                                    {getLanguages(formData.transcriber_provider as any).map((lang) => (
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
                                            <Box sx={{ borderTop: "1px solid #e0e0e0", pt: 3, mt: 3, px: 0.5 }}>
                                                <Typography variant="h6" fontSize={16} fontWeight={600}>
                                                    Punctuation Boundaries
                                                </Typography>

                                                <Typography variant="body2" color="text.secondary" mb={2}>
                                                    Select punctuation marks that should be treated as valid sentence boundaries while streaming responses.
                                                </Typography>

                                                <Grid container spacing={1}>
                                                    {[
                                                        ".",
                                                        ",",
                                                        "!",
                                                        "?",
                                                        ";",
                                                        ":",
                                                        "(",
                                                        ")",
                                                        "—",
                                                        "-",
                                                        "|",
                                                        "||",
                                                    ].map((punctuation) => (
                                                        <Grid item xs={6} sm={4} md={3} key={punctuation}>
                                                            <FormControlLabel
                                                                control={
                                                                    <Checkbox
                                                                        checked={
                                                                            formData.punctuation_boundaries?.includes(
                                                                                punctuation
                                                                            ) ?? false
                                                                        }
                                                                        onChange={(e) => {
                                                                            const selected =
                                                                                formData.punctuation_boundaries ?? [];

                                                                            setFormData({
                                                                                ...formData,
                                                                                punctuation_boundaries: e.target.checked
                                                                                    ? [...selected, punctuation]
                                                                                    : selected.filter(
                                                                                        (p) => p !== punctuation
                                                                                    ),
                                                                            });
                                                                        }}
                                                                    />
                                                                }
                                                                label={
                                                                    <Typography
                                                                        sx={{
                                                                            fontFamily: "monospace",
                                                                            fontWeight: 600,
                                                                        }}
                                                                    >
                                                                        {punctuation}
                                                                    </Typography>
                                                                }
                                                            />
                                                        </Grid>
                                                    ))}
                                                </Grid>

                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                    sx={{ display: "block", mt: 1 }}
                                                >
                                                    {formData.punctuation_boundaries?.length
                                                        ? `${formData.punctuation_boundaries.length} boundar${formData.punctuation_boundaries.length > 1 ? "ies" : "y"
                                                        } selected`
                                                        : "No punctuation boundaries selected"}
                                                </Typography>
                                            </Box>

                                        </>
                                    )}
                                    {callForwardingEnabled && (
                                        <Box sx={{ borderTop: "1px solid #e0e0e0", pt: 3, mt: 3, px: 0.5 }}>

                                            <Typography variant="h6" fontSize={16} fontWeight={600}>
                                                Call Forwarding
                                            </Typography>

                                            <Typography variant="body2" color="text.secondary" mb={2}>
                                                Configure where calls should be forwarded when required.
                                            </Typography>

                                            <Stack spacing={2}>
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
                                                            error={!!errors.call_forwarding_number}
                                                            helperText={
                                                                errors.call_forwarding_number
                                                            }
                                                        />

                                                        <TextField
                                                            label="Message"
                                                            name="call_forwarding_role"
                                                            placeholder="eg. Please hold on"
                                                            value={formData.call_forwarding_role}
                                                            onChange={handleInputChange}
                                                            fullWidth
                                                            error={!!errors.call_forwarding_role}
                                                            helperText={
                                                                errors.call_forwarding_role
                                                            }
                                                        />

                                                    </Stack>
                                                )}

                                            </Stack>

                                        </Box>
                                    )}
                                    {agentType === "outbound" && (
                                        <Box sx={{ borderTop: "1px solid #e0e0e0", pt: 3, mt: 3, px: 0.5 }}>
                                            <Typography variant="h6" fontSize={16} fontWeight={600}>
                                                Voice Mail Detection
                                            </Typography>

                                            <Typography variant="body2" color="text.secondary" mb={2}>
                                                Automatically detect voicemail and handle calls accordingly.
                                            </Typography>
                                            <Stack>
                                                <FormControlLabel
                                                    control={
                                                        <Switch
                                                            checked={formData.voice_mail_detection}
                                                            onChange={(e) =>
                                                                handleToggleChange(
                                                                    "voice_mail_detection",
                                                                    e.target.checked
                                                                )
                                                            }
                                                        />
                                                    }
                                                    label="Voice Mail Detection"
                                                />
                                            </Stack>


                                            <Collapse in={formData.voice_mail_detection}>
                                                <Card
                                                    variant="outlined"
                                                    sx={{
                                                        mt: 2,
                                                        mx: 0,
                                                        p: 2,
                                                        borderRadius: 2,
                                                        bgcolor: "grey.50",
                                                    }}
                                                >
                                                    <Typography
                                                        variant="subtitle2"
                                                        fontWeight={600}
                                                        mb={2}
                                                    >
                                                        Voicemail Detection Settings
                                                    </Typography>

                                                    <Stack spacing={3}>
                                                        <Box>
                                                            <Typography gutterBottom>
                                                                Initial Detection Delay ({formData.voicemail_start_at_seconds}s)
                                                            </Typography>

                                                            <Slider
                                                                value={formData.voicemail_start_at_seconds}
                                                                min={0}
                                                                max={20}
                                                                step={1}
                                                                onChange={(_, value) =>
                                                                    setFormData({
                                                                        ...formData,
                                                                        voicemail_start_at_seconds: value as number,
                                                                    })
                                                                }
                                                            />
                                                            <Stack direction="row" justifyContent="space-between">
                                                                <Typography variant="caption">0s</Typography>
                                                                <Typography variant="caption">10s</Typography>
                                                                <Typography variant="caption">20s</Typography>
                                                            </Stack>
                                                            <Typography
                                                                variant="caption"
                                                                color="text.secondary"
                                                            >
                                                                Delay before the first detection check.
                                                            </Typography>
                                                        </Box>

                                                        <Box>
                                                            <Typography gutterBottom>
                                                                Detection Retry Interval ({formData.voicemail_frequency_seconds}s)
                                                            </Typography>

                                                            <Slider
                                                                value={formData.voicemail_frequency_seconds}
                                                                min={2.5}
                                                                max={20}
                                                                step={0.5}
                                                                onChange={(_, value) =>
                                                                    setFormData({
                                                                        ...formData,
                                                                        voicemail_frequency_seconds: value as number,
                                                                    })
                                                                }
                                                            />
                                                            <Stack direction="row" justifyContent="space-between">
                                                                <Typography variant="caption">2.5s</Typography>
                                                                <Typography variant="caption">11s</Typography>
                                                                <Typography variant="caption">20s</Typography>
                                                            </Stack>
                                                            <Typography
                                                                variant="caption"
                                                                color="text.secondary"
                                                            >
                                                                Interval between detection checks.
                                                            </Typography>
                                                        </Box>

                                                        <Box>
                                                            <Typography gutterBottom>
                                                                Max Detection Retries ({formData.voicemail_max_retries})
                                                            </Typography>

                                                            <Slider
                                                                value={formData.voicemail_max_retries}
                                                                min={1}
                                                                max={10}
                                                                step={1}
                                                                onChange={(_, value) =>
                                                                    setFormData({
                                                                        ...formData,
                                                                        voicemail_max_retries: value as number,
                                                                    })
                                                                }
                                                            />
                                                            <Stack direction="row" justifyContent="space-between">
                                                                <Typography variant="caption">1</Typography>
                                                                <Typography variant="caption">5</Typography>
                                                                <Typography variant="caption">10</Typography>
                                                            </Stack>
                                                            <Typography
                                                                variant="caption"
                                                                color="text.secondary"
                                                            >
                                                                Limit on detection attempts.
                                                            </Typography>
                                                        </Box>

                                                        <Box>
                                                            <Typography gutterBottom>
                                                                Max Voicemail Message Wait ({formData.voicemail_beep_max_await_seconds}s)
                                                            </Typography>

                                                            <Slider
                                                                value={formData.voicemail_beep_max_await_seconds}
                                                                min={0}
                                                                max={60}
                                                                step={1}
                                                                onChange={(_, value) =>
                                                                    setFormData({
                                                                        ...formData,
                                                                        voicemail_beep_max_await_seconds: value as number,
                                                                    })
                                                                }
                                                            />
                                                            <Stack direction="row" justifyContent="space-between">
                                                                <Typography variant="caption">0s</Typography>
                                                                <Typography variant="caption">30s</Typography>
                                                                <Typography variant="caption">60s</Typography>
                                                            </Stack>

                                                            <Typography
                                                                variant="caption"
                                                                color="text.secondary"
                                                            >
                                                                Maximum wait before leaving voicemail. 0 = immediate.
                                                            </Typography>
                                                        </Box>
                                                    </Stack>
                                                </Card>
                                            </Collapse>
                                        </Box>
                                    )}
                                </Stack>
                            </Card >
                        </AccordionDetails>
                    </Accordion>

                </>




                {/* Save Button aligned right */}
                <Box display="flex" justifyContent="flex-end" >
                    <Button color="error" variant='outlined' onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button variant="contained" onClick={handleSubmit} sx={{ ml: 1 }} disabled={loading}>
                        {mode === "create" ? "Add Agent" : "Update Agent"}
                    </Button>
                </Box >
            </Stack >
        </Card >
    );
};