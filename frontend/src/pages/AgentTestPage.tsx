import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import HubIcon from "@mui/icons-material/Hub";
import PsychologyAltIcon from "@mui/icons-material/PsychologyAlt";
import LanguageIcon from "@mui/icons-material/Language";
import InsightsIcon from "@mui/icons-material/Insights";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import ChatBubbleRoundedIcon from "@mui/icons-material/ChatBubbleRounded";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import EventAvailableRoundedIcon from "@mui/icons-material/EventAvailableRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { useParams, useSearchParams } from "react-router-dom";
import { appEnv } from "../config/env";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatApiResponse {
  response?: string;
  ui_action?: string;
  handoff_chat_id?: string;
  handoff_status?: string;
}

interface HandoffSessionResponse {
  active: boolean;
  chat_id?: string | null;
  status?: string | null;
  assigned_agent_id?: number | null;
  call_room_id?: string | null;
  call_status?: "none" | "requested" | "active" | "ended" | string;
  call_mode?: "video" | "audio" | string;
  call_requested_at?: string | null;
  call_started_at?: string | null;
  call_ended_at?: string | null;
  wait_cycle?: number | null;
  waiting_expires_at?: string | null;
  waiting_timeout_notified?: boolean | null;
  wait_timeout_seconds?: number | null;
}

interface HandoffMessageResponse {
  chat_id: string;
  status?: string | null;
  assigned_agent_id?: number | null;
  call_room_id?: string | null;
  call_status?: "none" | "requested" | "active" | "ended" | string;
  call_mode?: "video" | "audio" | string;
  call_requested_at?: string | null;
  call_started_at?: string | null;
  call_ended_at?: string | null;
  wait_cycle?: number | null;
  waiting_expires_at?: string | null;
  waiting_timeout_notified?: boolean | null;
  wait_timeout_seconds?: number | null;
  items: Array<{
    id: number;
    sender_type: string;
    message: string;
  }>;
}

interface WidgetPublicConfig {
  name?: string;
  welcome_message?: string;
  primary_color?: string;
  secondary_color?: string;
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  lead_fields?: string;
}

const BOT_ICON_GLYPHS: Record<string, string> = {
  "bot-robot": "🤖",
  "bot-spark": "✨",
  "bot-brain": "🧠",
  "bot-guide": "🛰️",
  "bot-helper": "🧑‍🔧",
  "bot-assistant": "🤝",
  "bot-shield": "🛡️",
  "bot-light": "💡",
};

const USER_ICON_GLYPHS: Record<string, string> = {
  "user-person": "👤",
  "user-smile": "🙂",
  "user-chat": "💬",
  "user-brief": "🧑‍💼",
  "user-student": "🧑‍🎓",
  "user-creative": "🎨",
  "user-tech": "🧑‍💻",
  "user-star": "🌟",
};

const parseStyleSelection = (
  leadFieldsRaw?: string,
): { botIcon?: string; userIcon?: string; chatHeaderFontColor?: string } => {
  if (!leadFieldsRaw) return {};
  try {
    const parsed = JSON.parse(leadFieldsRaw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return {
      botIcon:
        typeof (parsed as any).bot_icon === "string"
          ? (parsed as any).bot_icon
          : undefined,
      userIcon:
        typeof (parsed as any).user_icon === "string"
          ? (parsed as any).user_icon
          : undefined,
      chatHeaderFontColor:
        typeof (parsed as any).chat_header_font_color === "string"
          ? (parsed as any).chat_header_font_color
          : undefined,
    };
  } catch {
    return {};
  }
};

const APPOINTMENT_FORM_PROMPT =
  "If you would like to set a meeting, please fill this short form and I will set it up for you.";

const IST_TIMEZONE = "Asia/Kolkata";

const getDefaultAppointmentDateTime = () => {
  const seed = new Date(Date.now() + 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(seed);

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  const local = `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:00`;
  return {
    date: local.slice(0, 10),
    time: local.slice(11, 16),
  };
};

const buildIstIsoDateTime = (date: string, time: string): Date => {
  return new Date(`${date}T${time}:00+05:30`);
};

const parseJwtExpiryMs = (token: string): number | null => {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const base64 = base64Url.padEnd(
      base64Url.length + ((4 - (base64Url.length % 4)) % 4),
      "=",
    );
    const payloadRaw = window.atob(base64);
    const payload = JSON.parse(payloadRaw);
    const exp = Number(payload?.exp);
    if (!Number.isFinite(exp) || exp <= 0) return null;
    return exp * 1000;
  } catch {
    return null;
  }
};

const formatTimeRemaining = (ms: number): string => {
  if (ms <= 0) return "Expired";

  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const formatCountdownSeconds = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};

const CHAT_INACTIVITY_TIMEOUT_MS = 120000;
const STREAM_FALLBACK_TIMEOUT_MS = 12000;
const CHAT_INACTIVITY_CLOSE_MESSAGE =
  "Closing this chat session as no activity happened in the last 120 seconds.";
const HANDOFF_WAITING_MESSAGE =
  "I am connecting you to a human expert. Please share any additional details and we will respond shortly.";
const HANDOFF_LEAD_CAPTURE_MESSAGE =
  "Before I transfer this handoff request to a live agent, please fill the quick contact form in chat so we can reach you if needed.";
const POST_HANDOFF_FOLLOWUP_MESSAGE =
  "Welcome back from live support. Are you satisfied with the help, or should I set up a meeting for you?";
const createPublicSessionId = () =>
  `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const parseServerDateToMs = (value?: string | null): number | null => {
  if (!value) return null;

  const normalized = String(value).trim().replace(" ", "T");
  if (!normalized) return null;

  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized);
  const candidate = hasTimezone ? normalized : `${normalized}Z`;
  const ms = Date.parse(candidate);
  return Number.isNaN(ms) ? null : ms;
};

const normalizeIntentText = (value: string): string =>
  (value || "")
    .trim()
    .toLowerCase()
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2014|\u2013/g, "-");

const wantsMeetingSetup = (value: string): boolean => {
  const normalized = normalizeIntentText(value);
  if (!normalized) return false;
  const tokens = new Set(normalized.match(/[a-z0-9]+/g) || []);
  if (
    tokens.has("yes") &&
    (tokens.has("meeting") || tokens.has("appointment") || tokens.has("call"))
  ) {
    return true;
  }
  if (
    tokens.has("book") ||
    tokens.has("schedule") ||
    tokens.has("meeting") ||
    tokens.has("appointment")
  ) {
    return true;
  }
  return false;
};

const isSatisfiedResponse = (value: string): boolean => {
  const normalized = normalizeIntentText(value);
  if (!normalized) return false;
  const affirmative = [
    "yes",
    "satisfied",
    "happy",
    "resolved",
    "all good",
    "good now",
    "fine now",
  ];
  return affirmative.some((item) => normalized.includes(item));
};

interface ProductTrack {
  title: string;
  description: string;
  outcome: string;
  icon: React.ReactNode;
  accent: string;
}

const productTracks: ProductTrack[] = [
  {
    title: "Conversational AI Agents",
    description:
      "Multichannel assistants with memory-aware prompts, organization scoping, and escalation handoff to human support.",
    outcome: "Outcome: faster first response and higher conversion from chat.",
    icon: <PsychologyAltIcon />,
    accent: "#2f6bff",
  },
  {
    title: "Knowledge Intelligence",
    description:
      "RAG pipelines that ingest websites, files, and operational FAQs with controlled retrieval to keep responses grounded.",
    outcome: "Outcome: fewer hallucinations and better answer coverage.",
    icon: <HubIcon />,
    accent: "#2d8ef0",
  },
  {
    title: "Commerce + Support Automation",
    description:
      "Retail and post-purchase automation for order questions, policy explanations, and personalized customer journeys.",
    outcome: "Outcome: reduced support load and smoother customer experience.",
    icon: <LanguageIcon />,
    accent: "#5e72ff",
  },
  {
    title: "AI Ops and Insights",
    description:
      "Analytics on response quality, lead capture, conversation outcomes, and performance trends across widgets.",
    outcome:
      "Outcome: measurable growth decisions backed by conversation data.",
    icon: <InsightsIcon />,
    accent: "#36a8ff",
  },
];

const deliveryFlow = [
  {
    step: "1. Discover",
    detail:
      "Understand your support, sales, and onboarding workflows and identify where AI creates real business lift.",
  },
  {
    step: "2. Build",
    detail:
      "Design prompts, retrieval strategy, and integrations that match your organization and brand tone.",
  },
  {
    step: "3. Launch",
    detail:
      "Deploy to web, widget, and messaging surfaces with testable links for stakeholders and teams.",
  },
  {
    step: "4. Optimize",
    detail:
      "Use analytics and feedback loops to improve coverage, latency, trust, and conversion over time.",
  },
];
//For the bold text in the message
const renderInlineMarkdown = (
  text: string,
  keyPrefix = "msg",
): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  const tokens = text.split(/(\*[^*]+\*)/g);

  tokens.forEach((token, index) => {
    if (!token) return;
    if (token.startsWith("*") && token.endsWith("*") && token.length > 2) {
      parts.push(
        <Box
          component="strong"
          key={`${keyPrefix}-b-${index}`}
          sx={{ fontWeight: 700 }}
        >
          {token.slice(2, -2)}
        </Box>,
      );
      return;
    }
    parts.push(
      <React.Fragment key={`${keyPrefix}-t-${index}`}>{token}</React.Fragment>,
    );
  });

  return parts;
};

const TypingDots: React.FC<{ color: string }> = ({ color }) => (
  <Box
    sx={{
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      "@keyframes typingDotBounce": {
        "0%, 60%, 100%": { transform: "translateY(0)", opacity: 0.35 },
        "30%": { transform: "translateY(-4px)", opacity: 1 },
      },
    }}
  >
    {[0, 1, 2].map((dot) => (
      <Box
        key={dot}
        sx={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          bgcolor: color,
          animation: "typingDotBounce 1.2s infinite ease-in-out",
          animationDelay: `${dot * 0.18}s`,
        }}
      />
    ))}
  </Box>
);

const AgentTestPage: React.FC = () => {
  const { widgetId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const testToken = (searchParams.get("token") || "").trim();
  const [isOpen, setIsOpen] = useState(false);
  const [showLauncherTeaser, setShowLauncherTeaser] = useState(true);
  const [widgetLookDark, setWidgetLookDark] = useState(false);
  const [widgetConfig, setWidgetConfig] = useState<WidgetPublicConfig | null>(
    null,
  );
  const [accessError, setAccessError] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hi! How can I help you today?" },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadForm, setLeadForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
  });
  const [pendingHandoffAfterLead, setPendingHandoffAfterLead] = useState(false);
  const [awaitingPostHandoffDecision, setAwaitingPostHandoffDecision] =
    useState(false);
  const [appointmentName, setAppointmentName] = useState("");
  const [appointmentEmail, setAppointmentEmail] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [appointmentBusy, setAppointmentBusy] = useState(false);
  const [appointmentError, setAppointmentError] = useState("");
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [handoffChatId, setHandoffChatId] = useState<string | null>(null);
  const [handoffStatus, setHandoffStatus] = useState<string | null>(null);
  const [handoffPollError, setHandoffPollError] = useState("");
  const [handoffAfterId, setHandoffAfterId] = useState(0);
  const [callStatus, setCallStatus] = useState<
    "none" | "requested" | "active" | "ended" | string
  >("none");
  const [callMode, setCallMode] = useState<"video" | "audio">("video");
  const [callRoomId, setCallRoomId] = useState<string | null>(null);
  const [callBusy, setCallBusy] = useState(false);
  const [callError, setCallError] = useState("");
  const [handoffWaitCycle, setHandoffWaitCycle] = useState(1);
  const [handoffWaitingExpiresAt, setHandoffWaitingExpiresAt] = useState<
    string | null
  >(null);
  const [handoffWaitTimeoutSeconds, setHandoffWaitTimeoutSeconds] =
    useState(120);
  const [handoffNowMs, setHandoffNowMs] = useState(Date.now());
  const handoffSeenMessageIdsRef = useRef<Set<number>>(new Set());
  const handoffPromptedChatIdRef = useRef<string | null>(null);
  const lastHandoffStatusRef = useRef<string | null>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: PointerEvent) => {
      if (
        chatPanelRef.current &&
        !chatPanelRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handleOutsideClick);
    return () =>
      document.removeEventListener("pointerdown", handleOutsideClick);
  }, [isOpen]);
  const [sessionEngaged, setSessionEngaged] = useState(false);
  const [sessionClosedByInactivity, setSessionClosedByInactivity] =
    useState(false);
  const [lastActivityAtMs, setLastActivityAtMs] = useState(Date.now());
  const [inactivityNowMs, setInactivityNowMs] = useState(Date.now());
  const [sessionId, setSessionId] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());

  const apiBaseUrl = appEnv.apiUrl;
  const position = widgetConfig?.position || "bottom-right";
  const primaryColor = widgetConfig?.primary_color || "#2f6bff";
  const secondaryColor = widgetConfig?.secondary_color || "#2d8ef0";
  const assistantName = widgetConfig?.name?.trim() || "AI Assistant";
  const welcomeText =
    (widgetConfig?.welcome_message || "Hi! How can I help you today?").trim() ||
    "Hi! How can I help you today?";
  const styleSelection = useMemo(
    () => parseStyleSelection(widgetConfig?.lead_fields),
    [widgetConfig?.lead_fields],
  );
  const botIconGlyph =
    BOT_ICON_GLYPHS[styleSelection.botIcon || "bot-robot"] ||
    BOT_ICON_GLYPHS["bot-robot"];
  const userIconGlyph =
    USER_ICON_GLYPHS[styleSelection.userIcon || "user-person"] ||
    USER_ICON_GLYPHS["user-person"];
  const chatHeaderFontColor =
    (styleSelection.chatHeaderFontColor || "").trim() || "#f8fafc";
  const testTokenExpiryMs = useMemo(
    () => parseJwtExpiryMs(testToken),
    [testToken],
  );
  const testTokenRemainingMs = useMemo(
    () => (testTokenExpiryMs ? testTokenExpiryMs - nowMs : null),
    [testTokenExpiryMs, nowMs],
  );
  const testTokenExpired =
    typeof testTokenRemainingMs === "number" && testTokenRemainingMs <= 0;
  const canUseChat = Boolean(
    widgetId && testToken && !accessError && !testTokenExpired,
  );
  const inactivityRemainingSeconds = useMemo(() => {
    if (sessionClosedByInactivity || !sessionEngaged) {
      return null;
    }
    const elapsed = inactivityNowMs - lastActivityAtMs;
    return Math.max(
      0,
      Math.ceil((CHAT_INACTIVITY_TIMEOUT_MS - elapsed) / 1000),
    );
  }, [
    sessionClosedByInactivity,
    sessionEngaged,
    inactivityNowMs,
    lastActivityAtMs,
  ]);
  const handoffRemainingSeconds = useMemo(() => {
    if (
      !handoffOpen ||
      handoffStatus !== "waiting_for_agent" ||
      !handoffWaitingExpiresAt
    ) {
      return null;
    }
    const expiresAtMs = parseServerDateToMs(handoffWaitingExpiresAt);
    if (expiresAtMs === null) {
      return null;
    }
    return Math.max(0, Math.ceil((expiresAtMs - handoffNowMs) / 1000));
  }, [handoffOpen, handoffStatus, handoffWaitingExpiresAt, handoffNowMs]);
  const handoffCountdownText = useMemo(() => {
    if (handoffStatus !== "waiting_for_agent") {
      return null;
    }
    if (handoffRemainingSeconds === null) {
      const cycleMinutes = Math.max(
        1,
        Math.round(handoffWaitTimeoutSeconds / 60),
      );
      return `Each wait cycle is about ${cycleMinutes} minute${cycleMinutes > 1 ? "s" : ""}.`;
    }
    if (handoffRemainingSeconds <= 0) {
      return "Checking live user availability...";
    }
    return `Round ${Math.max(1, handoffWaitCycle)} time left: ${formatCountdownSeconds(handoffRemainingSeconds)}`;
  }, [
    handoffStatus,
    handoffRemainingSeconds,
    handoffWaitCycle,
    handoffWaitTimeoutSeconds,
  ]);
  const handoffProgressPercent = useMemo(() => {
    if (
      handoffStatus !== "waiting_for_agent" ||
      handoffRemainingSeconds === null ||
      handoffWaitTimeoutSeconds <= 0
    ) {
      return null;
    }
    const ratio = handoffRemainingSeconds / handoffWaitTimeoutSeconds;
    return Math.max(0, Math.min(100, Math.round(ratio * 100)));
  }, [handoffStatus, handoffRemainingSeconds, handoffWaitTimeoutSeconds]);

  const getMeetingUrl = (roomId: string, mode: "video" | "audio") => {
    const safeRoom = encodeURIComponent(roomId);
    const videoMuted = mode === "audio" ? "true" : "false";
    return `https://meet.jit.si/${safeRoom}#config.prejoinPageEnabled=false&config.startWithVideoMuted=${videoMuted}`;
  };

  const sessionStorageKey = useMemo(
    () => `public_agent_session_${widgetId || "unknown"}`,
    [widgetId],
  );

  useEffect(() => {
    if (!testTokenExpiryMs) return;

    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [testTokenExpiryMs]);

  useEffect(() => {
    const existing = localStorage.getItem(sessionStorageKey);
    if (existing) {
      setSessionId(existing);
      return;
    }

    const created = createPublicSessionId();
    localStorage.setItem(sessionStorageKey, created);
    setSessionId(created);
  }, [sessionStorageKey]);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "auto",
      });
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages, showLeadForm, showAppointmentForm, sending]);

  const loadWidgetConfig = useCallback(
    async (silent = false) => {
      if (!widgetId) return;
      if (!testToken) {
        if (!silent) {
          setAccessError(
            "Missing test access token. Please request a new share link.",
          );
        }
        return;
      }

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/admin/widget/test/config/${encodeURIComponent(widgetId)}?token=${encodeURIComponent(testToken)}`,
        );
        if (!response.ok) {
          if (silent) {
            return;
          }
          if (response.status === 401) {
            setAccessError(
              "This test link is invalid or has expired. Please request a new one.",
            );
          } else if (response.status === 404) {
            setAccessError(
              "This test link points to a widget that no longer exists.",
            );
          } else {
            setAccessError(
              "Unable to validate this test link right now. Please try again later.",
            );
          }
          return;
        }

        setAccessError("");
        const config = (await response.json()) as WidgetPublicConfig;
        setWidgetConfig(config);
        setMessages((prev) => {
          if (prev.length === 1 && prev[0]?.role === "assistant") {
            const resolvedWelcome =
              (config.welcome_message || "").trim() ||
              "Hi! How can I help you today?";
            return [{ role: "assistant", content: resolvedWelcome }];
          }
          return prev;
        });
      } catch {
        if (!silent) {
          setAccessError(
            "Unable to validate this test link right now. Please try again later.",
          );
        }
        // Keep existing style/config when refresh fails.
      }
    },
    [apiBaseUrl, testToken, widgetId],
  );

  useEffect(() => {
    loadWidgetConfig(false);
  }, [loadWidgetConfig]);

  useEffect(() => {
    if (!widgetId || !testToken || accessError) return;

    const timer = window.setInterval(() => {
      loadWidgetConfig(true);
    }, 10000);

    return () => window.clearInterval(timer);
  }, [accessError, loadWidgetConfig, testToken, widgetId]);

  const startFreshSession = () => {
    const created = createPublicSessionId();
    localStorage.setItem(sessionStorageKey, created);
    setSessionId(created);
    setMessages([{ role: "assistant", content: welcomeText }]);
    setInput("");
    setShowLeadForm(false);
    setLeadSubmitting(false);
    setLeadForm({ name: "", email: "", phone: "", company: "" });
    setPendingHandoffAfterLead(false);
    setAwaitingPostHandoffDecision(false);
    setShowAppointmentForm(false);
    setAppointmentError("");
    setHandoffOpen(false);
    setHandoffChatId(null);
    setHandoffStatus(null);
    setHandoffPollError("");
    setHandoffAfterId(0);
    setCallStatus("none");
    setCallMode("video");
    setCallRoomId(null);
    setCallBusy(false);
    setCallError("");
    handoffSeenMessageIdsRef.current.clear();
    handoffPromptedChatIdRef.current = null;
    lastHandoffStatusRef.current = null;
    setSessionClosedByInactivity(false);
    setSessionEngaged(false);
    setLastActivityAtMs(Date.now());
    return created;
  };

  useEffect(() => {
    if (
      !isOpen ||
      !canUseChat ||
      sessionClosedByInactivity ||
      !sessionEngaged ||
      sending ||
      handoffOpen
    )
      return;

    const timeoutId = window.setTimeout(() => {
      setMessages((prev) => {
        if (prev.length > 0) {
          const last = prev[prev.length - 1];
          if (
            last.role === "assistant" &&
            last.content === CHAT_INACTIVITY_CLOSE_MESSAGE
          ) {
            return prev;
          }
        }
        return [
          ...prev,
          { role: "assistant", content: CHAT_INACTIVITY_CLOSE_MESSAGE },
        ];
      });
      setSessionClosedByInactivity(true);
      setSessionEngaged(false);
      setHandoffOpen(false);
      setHandoffChatId(null);
      setHandoffStatus(null);
      setHandoffPollError("");
      setHandoffAfterId(0);
      setCallStatus("none");
      setCallMode("video");
      setCallRoomId(null);
      setCallBusy(false);
      setCallError("");
      handoffSeenMessageIdsRef.current.clear();
      handoffPromptedChatIdRef.current = null;
      lastHandoffStatusRef.current = null;
      setPendingHandoffAfterLead(false);
      setAwaitingPostHandoffDecision(false);
      setSending(false);
    }, CHAT_INACTIVITY_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [
    isOpen,
    canUseChat,
    sessionClosedByInactivity,
    sessionEngaged,
    sending,
    handoffOpen,
    lastActivityAtMs,
  ]);

  useEffect(() => {
    if (
      !isOpen ||
      !canUseChat ||
      sessionClosedByInactivity ||
      !sessionEngaged ||
      handoffOpen
    )
      return;

    setInactivityNowMs(Date.now());
    const timer = window.setInterval(() => {
      setInactivityNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [
    isOpen,
    canUseChat,
    sessionClosedByInactivity,
    sessionEngaged,
    handoffOpen,
    lastActivityAtMs,
  ]);

  const appendHandoffMessages = (
    items: HandoffMessageResponse["items"],
    includeBotMessages: boolean,
  ) => {
    const visibleMessages = items.filter((item) => {
      const isBotUpdate = includeBotMessages && item.sender_type === "bot";
      if (
        item.sender_type !== "agent" &&
        item.sender_type !== "system" &&
        !isBotUpdate
      )
        return false;
      if (handoffSeenMessageIdsRef.current.has(item.id)) return false;
      handoffSeenMessageIdsRef.current.add(item.id);
      return true;
    });
    if (visibleMessages.length === 0) return;
    setMessages((prev) => [
      ...prev,
      ...visibleMessages.map((item) => ({
        role: "assistant" as const,
        content: item.message,
      })),
    ]);
  };

  const loadHandoffSession = async () => {
    if (!widgetId || !canUseChat || !sessionId) return;
    try {
      const params = new URLSearchParams({
        session_id: sessionId,
        widget_id: widgetId,
      });
      if (handoffChatId) {
        params.set("chat_id", handoffChatId);
      }
      const response = await fetch(
        `${apiBaseUrl}/api/chat/handoff/session?${params.toString()}`,
      );
      if (!response.ok) return;
      const data = (await response.json()) as HandoffSessionResponse;
      if (!data?.chat_id) return;

      const nextStatus = data.status || null;
      const wasActive =
        lastHandoffStatusRef.current === "waiting_for_agent" ||
        lastHandoffStatusRef.current === "assigned";
      const isActive =
        nextStatus === "waiting_for_agent" || nextStatus === "assigned";

      setHandoffChatId(data.chat_id);
      setHandoffStatus(nextStatus);
      setHandoffOpen(isActive);
      setCallStatus(data.call_status || "none");
      setCallMode((data.call_mode as "video" | "audio") || "video");
      setCallRoomId(data.call_room_id || null);
      setHandoffWaitCycle(Math.max(1, data.wait_cycle || 1));
      setHandoffWaitingExpiresAt(data.waiting_expires_at || null);
      if (
        typeof data.wait_timeout_seconds === "number" &&
        data.wait_timeout_seconds > 0
      ) {
        setHandoffWaitTimeoutSeconds(data.wait_timeout_seconds);
      }
      setHandoffNowMs(Date.now());
      lastHandoffStatusRef.current = nextStatus;

      if (
        wasActive &&
        !isActive &&
        data.chat_id &&
        handoffPromptedChatIdRef.current !== data.chat_id
      ) {
        handoffPromptedChatIdRef.current = data.chat_id;
        setAwaitingPostHandoffDecision(true);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: POST_HANDOFF_FOLLOWUP_MESSAGE },
        ]);
      }
      if (isActive) {
        setAwaitingPostHandoffDecision(false);
      }
    } catch {
      // Non-blocking for normal chat.
    }
  };

  const loadHandoffMessages = async (chatId: string, reset = false) => {
    if (!widgetId || !chatId || !canUseChat || !sessionId) return;
    try {
      const params = new URLSearchParams({
        chat_id: chatId,
        session_id: sessionId,
        widget_id: widgetId,
        after_id: String(reset ? 0 : handoffAfterId),
      });
      const response = await fetch(
        `${apiBaseUrl}/api/chat/handoff/messages?${params.toString()}`,
      );
      if (!response.ok) return;

      const data = (await response.json()) as HandoffMessageResponse;
      if (reset) {
        handoffSeenMessageIdsRef.current.clear();
        setHandoffAfterId(0);
      }
      const nextStatus = data?.status || null;
      const wasActive =
        lastHandoffStatusRef.current === "waiting_for_agent" ||
        lastHandoffStatusRef.current === "assigned";
      const isActive =
        nextStatus === "waiting_for_agent" || nextStatus === "assigned";

      setHandoffStatus(nextStatus);
      setHandoffOpen(isActive);
      setCallStatus(data.call_status || "none");
      setCallMode((data.call_mode as "video" | "audio") || "video");
      setCallRoomId(data.call_room_id || null);
      setHandoffWaitCycle(Math.max(1, data.wait_cycle || 1));
      setHandoffWaitingExpiresAt(data.waiting_expires_at || null);
      if (
        typeof data.wait_timeout_seconds === "number" &&
        data.wait_timeout_seconds > 0
      ) {
        setHandoffWaitTimeoutSeconds(data.wait_timeout_seconds);
      }
      setHandoffNowMs(Date.now());
      lastHandoffStatusRef.current = nextStatus;

      if (
        wasActive &&
        !isActive &&
        chatId &&
        handoffPromptedChatIdRef.current !== chatId
      ) {
        handoffPromptedChatIdRef.current = chatId;
        setAwaitingPostHandoffDecision(true);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: POST_HANDOFF_FOLLOWUP_MESSAGE },
        ]);
      }
      if (isActive) {
        setAwaitingPostHandoffDecision(false);
      }

      if (Array.isArray(data?.items) && data.items.length > 0) {
        appendHandoffMessages(data.items, !reset);
        const maxId = data.items.reduce(
          (acc, item) => Math.max(acc, item.id),
          0,
        );
        setHandoffAfterId((prev) => Math.max(prev, maxId));
        setSessionEngaged(true);
        setLastActivityAtMs(Date.now());
      }
      setHandoffPollError("");
    } catch {
      setHandoffPollError("Live agent updates are temporarily unavailable.");
    }
  };

  useEffect(() => {
    if (!canUseChat) return;
    loadHandoffSession();
  }, [canUseChat, widgetId, sessionId]);

  useEffect(() => {
    if (
      !handoffOpen ||
      handoffStatus !== "waiting_for_agent" ||
      !handoffWaitingExpiresAt
    )
      return;
    setHandoffNowMs(Date.now());
    const timer = window.setInterval(() => {
      setHandoffNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [handoffOpen, handoffStatus, handoffWaitingExpiresAt]);

  useEffect(() => {
    handoffSeenMessageIdsRef.current.clear();
    setHandoffAfterId(0);
  }, [handoffChatId]);

  useEffect(() => {
    if (!canUseChat || !handoffChatId || !handoffOpen) return;
    const timer = window.setInterval(() => {
      loadHandoffSession();
      loadHandoffMessages(handoffChatId, false);
    }, 2500);

    return () => window.clearInterval(timer);
  }, [canUseChat, handoffChatId, handoffOpen, handoffAfterId]);

  const launcherPositionSx = useMemo(() => {
    if (position === "bottom-left") return { left: 24, bottom: 24 };
    if (position === "top-right") return { right: 24, top: 24 };
    if (position === "top-left") return { left: 24, top: 24 };
    return { right: 24, bottom: 24 };
  }, [position]);

  const panelPositionSx = useMemo(() => {
    if (position === "bottom-left") return { left: 16, bottom: 16 };
    if (position === "top-right") return { right: 16, top: 16 };
    if (position === "top-left") return { left: 16, top: 16 };
    return { right: 16, bottom: 16 };
  }, [position]);

  const getHeaderIconButtonSx = (highlight = false) => ({
    color: chatHeaderFontColor,
    minWidth: 30,
    width: 30,
    height: 30,
    borderRadius: "10px",
    border: highlight
      ? "1px solid rgba(255,255,255,0.95)"
      : "1px solid rgba(255,255,255,0.35)",
    bgcolor: highlight ? "rgba(16,185,129,0.35)" : "rgba(255,255,255,0.16)",
    backdropFilter: "blur(4px)",
    fontSize: "1.05rem",
    fontWeight: 700,
    boxShadow: highlight
      ? "0 0 0 2px rgba(255,255,255,0.22), 0 0 14px rgba(16,185,129,0.55)"
      : "none",
    transition: "all 180ms ease",
    "&:hover": {
      bgcolor: highlight ? "rgba(16,185,129,0.42)" : "rgba(255,255,255,0.3)",
      transform: "translateY(-1px)",
    },
    "&.Mui-disabled": {
      color: "rgba(255,255,255,0.72)",
      opacity: 0.62,
      borderColor: "rgba(255,255,255,0.28)",
      bgcolor: "rgba(255,255,255,0.12)",
    },
  });

  const sendMessage = async (
    overrideText?: string,
    options?: {
      silentUserMessage?: boolean;
      skipLeadCaptureCheck?: boolean;
      forceSessionId?: string;
    },
  ) => {
    const opts = options || {};
    let activeSessionId = opts.forceSessionId || sessionId;
    if (sessionClosedByInactivity || !activeSessionId) {
      activeSessionId = startFreshSession();
    }

    const text = (overrideText ?? input).trim();
    if (!text || sending || !canUseChat) return;

    if (!overrideText) {
      setInput("");
    }

    if (awaitingPostHandoffDecision && !opts.silentUserMessage) {
      if (wantsMeetingSetup(text)) {
        setMessages((prev) => [
          ...prev,
          { role: "user", content: text },
          { role: "assistant", content: APPOINTMENT_FORM_PROMPT },
        ]);
        setAwaitingPostHandoffDecision(false);
        openAppointmentDialog();
        return;
      }
      if (isSatisfiedResponse(text)) {
        setMessages((prev) => [
          ...prev,
          { role: "user", content: text },
          {
            role: "assistant",
            content:
              "Great to hear that. If you need anything else, I am here to help.",
          },
        ]);
        setAwaitingPostHandoffDecision(false);
        return;
      }
    }

    setSending(true);
    setSessionEngaged(true);
    setSessionClosedByInactivity(false);
    setLastActivityAtMs(Date.now());
    let assistantIndex = -1;
    if (!opts.silentUserMessage) {
      setMessages((prev) => [...prev, { role: "user", content: text }]);
    }

    setMessages((prev) => {
      assistantIndex = prev.length;
      return [...prev, { role: "assistant", content: "" }];
    });

    const replaceAssistantMessage = (content: string) => {
      setMessages((prev) =>
        prev.map((msg, index) =>
          index === assistantIndex ? { ...msg, content } : msg,
        ),
      );
    };

    const appendAssistantToken = (delta: string) => {
      setMessages((prev) =>
        prev.map((msg, index) =>
          index === assistantIndex
            ? { ...msg, content: `${msg.content}${delta}` }
            : msg,
        ),
      );
    };

    const removeAssistantPlaceholder = () => {
      setMessages((prev) =>
        prev.filter((_, index) => index !== assistantIndex),
      );
    };

    const applyUiAction = (payload?: {
      ui_action?: string;
      handoff_chat_id?: string;
      handoff_status?: string;
    }) => {
      const shouldOpenAppointmentForm =
        payload?.ui_action === "open_appointment_form";
      const shouldOpenHandoff = payload?.ui_action === "open_human_handoff";
      const shouldOpenLeadForm = payload?.ui_action === "open_lead_form";

      if (shouldOpenAppointmentForm) {
        replaceAssistantMessage(APPOINTMENT_FORM_PROMPT);
        openAppointmentDialog();
      }

      if (shouldOpenLeadForm) {
        replaceAssistantMessage(HANDOFF_LEAD_CAPTURE_MESSAGE);
        setShowLeadForm(true);
        setPendingHandoffAfterLead(true);
      }

      if (shouldOpenHandoff) {
        replaceAssistantMessage(HANDOFF_WAITING_MESSAGE);
        setPendingHandoffAfterLead(false);
        setShowLeadForm(false);
        setHandoffOpen(true);
        if (payload?.handoff_chat_id) {
          const isNewChat = payload.handoff_chat_id !== handoffChatId;
          setHandoffChatId(payload.handoff_chat_id);
          if (isNewChat) {
            setHandoffAfterId(0);
            handoffSeenMessageIdsRef.current.clear();
            loadHandoffMessages(payload.handoff_chat_id, true);
          } else {
            loadHandoffMessages(payload.handoff_chat_id, false);
          }
        }
        if (payload?.handoff_status) {
          setHandoffStatus(payload.handoff_status);
        }
        setAwaitingPostHandoffDecision(false);
      }
    };

    try {
      let streamDonePayload: any = null;
      let receivedToken = false;

      try {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(
          () => controller.abort(),
          STREAM_FALLBACK_TIMEOUT_MS,
        );

        const streamResponse = await fetch(`${apiBaseUrl}/api/chat/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            session_id: activeSessionId,
            widget_id: widgetId,
          }),
          signal: controller.signal,
        });

        if (!streamResponse.ok) {
          throw new Error("Failed to stream chatbot response");
        }

        const reader = streamResponse.body?.getReader();
        if (!reader) {
          throw new Error("Streaming not supported");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            const lines = part.split("\n");
            for (const line of lines) {
              if (!line.startsWith("data:")) continue;
              const data = line.replace(/^data:\s?/, "");
              if (!data) continue;

              let payload: any;
              try {
                payload = JSON.parse(data);
              } catch {
                continue;
              }

              if (payload?.type === "ready") {
                window.clearTimeout(timeoutId);
                continue;
              }

              if (
                payload?.type === "token" &&
                typeof payload?.text === "string"
              ) {
                if (!receivedToken) {
                  receivedToken = true;
                  window.clearTimeout(timeoutId);
                }
                appendAssistantToken(payload.text);
              }

              if (payload?.type === "done") {
                streamDonePayload = payload;
              }
            }
          }
        }

        const trailing = buffer.trim();
        if (trailing.startsWith("data:")) {
          const data = trailing.replace(/^data:\s?/, "");
          try {
            const payload = JSON.parse(data);
            if (
              payload?.type === "token" &&
              typeof payload?.text === "string"
            ) {
              receivedToken = true;
              appendAssistantToken(payload.text);
            }
            if (payload?.type === "done") {
              streamDonePayload = payload;
            }
          } catch {
            // Ignore malformed trailing event chunk.
          }
        }

        window.clearTimeout(timeoutId);
      } catch {
        const response = await fetch(`${apiBaseUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            session_id: activeSessionId,
            widget_id: widgetId,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to get response from chatbot");
        }

        const data = (await response.json()) as ChatApiResponse;
        const hasHandoffMeta = Boolean(
          data?.handoff_chat_id || data?.handoff_status,
        );
        const rawReply =
          typeof data?.response === "string" ? data.response.trim() : "";
        const reply =
          data?.ui_action === "open_appointment_form"
            ? APPOINTMENT_FORM_PROMPT
            : rawReply || "I could not generate a response right now.";

        if (!rawReply && hasHandoffMeta && !data?.ui_action) {
          removeAssistantPlaceholder();
        } else {
          replaceAssistantMessage(reply);
        }
        applyUiAction(data);
      }

      applyUiAction(streamDonePayload);

      const streamIndicatesHandoff = Boolean(
        streamDonePayload?.handoff_chat_id || streamDonePayload?.handoff_status,
      );
      if (
        !receivedToken &&
        streamDonePayload &&
        !streamDonePayload?.ui_action &&
        streamIndicatesHandoff
      ) {
        removeAssistantPlaceholder();
      } else if (
        !receivedToken &&
        streamDonePayload &&
        !streamDonePayload?.ui_action &&
        !streamIndicatesHandoff
      ) {
        replaceAssistantMessage("I could not generate a response right now.");
      }

      setLastActivityAtMs(Date.now());
    } catch {
      replaceAssistantMessage(
        "Sorry, the chatbot is temporarily unavailable. Please try again in a moment.",
      );
      setLastActivityAtMs(Date.now());
    } finally {
      setSending(false);
    }
  };

  const requestVideoCall = async () => {
    if (!canUseChat || !widgetId || !sessionId || callBusy) return;
    setCallBusy(true);
    setCallError("");
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/chat/handoff/request-video-call`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            widget_id: widgetId,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.detail || "Failed to request video call");
      }

      const data = (await response.json()) as HandoffSessionResponse;
      setHandoffChatId(data.chat_id || null);
      setHandoffStatus(data.status || null);
      setHandoffOpen(
        data.status === "waiting_for_agent" || data.status === "assigned",
      );
      setCallStatus(data.call_status || "requested");
      setCallMode((data.call_mode as "video" | "audio") || "video");
      setCallRoomId(data.call_room_id || null);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Video call request sent. A handoff user will join shortly.",
        },
      ]);
      if (data.chat_id) {
        await loadHandoffMessages(data.chat_id, true);
      }
    } catch (err: any) {
      setCallError(err?.message || "Failed to request video call");
    } finally {
      setCallBusy(false);
    }
  };

  const endLiveCall = async () => {
    if (
      !canUseChat ||
      !widgetId ||
      !sessionId ||
      callBusy ||
      callStatus === "none"
    )
      return;
    setCallBusy(true);
    setCallError("");
    try {
      const response = await fetch(`${apiBaseUrl}/api/chat/handoff/end-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          widget_id: widgetId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.detail || "Failed to end call");
      }

      const data = (await response.json()) as HandoffSessionResponse;
      setCallStatus(data.call_status || "ended");
      setCallMode((data.call_mode as "video" | "audio") || callMode);
      setCallRoomId(data.call_room_id || callRoomId);
    } catch (err: any) {
      setCallError(err?.message || "Failed to end call");
    } finally {
      setCallBusy(false);
    }
  };

  const joinLiveCall = () => {
    if (!callRoomId) return;
    window.open(
      getMeetingUrl(callRoomId, callMode),
      "_blank",
      "noopener,noreferrer",
    );
  };

  const handleLeadSubmit = async () => {
    if (!canUseChat || leadSubmitting) return;
    if (
      !leadForm.name.trim() &&
      !leadForm.email.trim() &&
      !leadForm.phone.trim()
    ) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Please add at least one contact field so we can follow up.",
        },
      ]);
      return;
    }

    try {
      setLeadSubmitting(true);
      const response = await fetch(`${apiBaseUrl}/api/admin/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          widget_id: widgetId,
          name: leadForm.name.trim() || undefined,
          email: leadForm.email.trim() || undefined,
          phone: leadForm.phone.trim() || undefined,
          company: leadForm.company.trim() || undefined,
          source: "chat",
        }),
      });

      if (!response.ok) {
        throw new Error("Lead submission failed");
      }

      setShowLeadForm(false);
      setLeadForm({ name: "", email: "", phone: "", company: "" });

      if (pendingHandoffAfterLead) {
        setPendingHandoffAfterLead(false);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "Thanks, your details are captured. I am now transferring your handoff request to a live agent.",
          },
        ]);
        await sendMessage("yes connect me", {
          silentUserMessage: true,
          skipLeadCaptureCheck: true,
          forceSessionId: sessionId,
        });
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Thanks. Your details have been received.",
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, failed to submit your details. Please try again.",
        },
      ]);
    } finally {
      setLeadSubmitting(false);
    }
  };

  const openAppointmentDialog = () => {
    if (!canUseChat) return;
    const defaults = getDefaultAppointmentDateTime();
    if (!appointmentDate) setAppointmentDate(defaults.date);
    if (!appointmentTime) setAppointmentTime(defaults.time);
    setAppointmentError("");
    setShowAppointmentForm(true);
  };

  const bookAppointment = async () => {
    if (!canUseChat) return;
    if (!appointmentName.trim()) {
      setAppointmentError("Please enter your name.");
      return;
    }
    if (!appointmentEmail.trim()) {
      setAppointmentError("Please enter your email.");
      return;
    }
    if (!appointmentDate || !appointmentTime) {
      setAppointmentError("Please select date/time.");
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(appointmentEmail.trim())) {
      setAppointmentError("Please enter a valid email.");
      return;
    }

    const dateValue = buildIstIsoDateTime(appointmentDate, appointmentTime);
    if (Number.isNaN(dateValue.getTime())) {
      setAppointmentError("Invalid date/time.");
      return;
    }

    try {
      setAppointmentBusy(true);
      setAppointmentError("");
      const response = await fetch(`${apiBaseUrl}/api/chat/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          widget_id: widgetId,
          appointment_at: dateValue.toISOString(),
          name: appointmentName.trim(),
          email: appointmentEmail.trim(),
          timezone: IST_TIMEZONE,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.detail || "Failed to book appointment");
      }

      const data = await response.json();
      const confirmation =
        typeof data?.message === "string"
          ? data.message
          : "Appointment booked successfully.";
      const istTimeLabel = new Intl.DateTimeFormat("en-IN", {
        timeZone: IST_TIMEZONE,
        dateStyle: "medium",
        timeStyle: "short",
      }).format(dateValue);
      setMessages((prev) => [
        ...prev,
        {
          role: "user",
          content: `Please book an appointment for ${istTimeLabel} (IST).`,
        },
        { role: "assistant", content: confirmation },
      ]);
      setShowAppointmentForm(false);
    } catch (err: any) {
      setAppointmentError(err?.message || "Failed to book appointment");
    } finally {
      setAppointmentBusy(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#f8fbff",
        color: "#0f172a",
        position: "relative",
        overflowX: "hidden",
        fontFamily: "Poppins, Manrope, Segoe UI, sans-serif",
        backgroundImage:
          "radial-gradient(circle at 20% 10%, rgba(14,165,233,0.15), transparent 35%), radial-gradient(circle at 80% 20%, rgba(56,109,255,0.14), transparent 34%), linear-gradient(180deg, #f8fbff 0%, #eef6ff 100%)",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          top: -120,
          right: -80,
          width: 320,
          height: 320,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(54,196,255,0.28) 0%, rgba(54,196,255,0) 70%)",
          pointerEvents: "none",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          bottom: 120,
          left: -120,
          width: 300,
          height: 300,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(56,189,248,0.25) 0%, rgba(56,189,248,0) 70%)",
          pointerEvents: "none",
        }}
      />

      <Box
        sx={{
          p: { xs: 2.5, md: 6 },
          maxWidth: 1200,
          mx: "auto",
          position: "relative",
          zIndex: 1,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 4 },
            borderRadius: 4,
            border: "1px solid rgba(148,163,184,0.25)",
            background:
              "linear-gradient(125deg, rgba(15,23,42,0.95) 0%, rgba(15,118,110,0.9) 35%, rgba(14,116,144,0.88) 100%)",
            color: "white",
            mb: 3,
            boxShadow: "0 20px 60px rgba(2,6,23,0.25)",
          }}
        >
          <Stack spacing={2.5}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              alignItems={{ xs: "flex-start", sm: "center" }}
            >
              <Chip
                icon={<AutoAwesomeIcon />}
                label="Live Demo Experience"
                sx={{
                  bgcolor: "rgba(255,255,255,0.18)",
                  color: "white",
                  "& .MuiChip-icon": { color: "white" },
                }}
              />
              <Chip
                icon={<VerifiedUserIcon />}
                label="Enterprise-ready AI"
                sx={{
                  bgcolor: "rgba(255,255,255,0.12)",
                  color: "white",
                  "& .MuiChip-icon": { color: "white" },
                }}
              />
            </Stack>

            <Typography
              variant="h3"
              sx={{
                fontWeight: 800,
                letterSpacing: "-0.03em",
                fontSize: { xs: "2rem", md: "3rem" },
              }}
            >
              Zentrixel AI Platform
            </Typography>

            <Typography
              variant="h6"
              sx={{
                fontWeight: 400,
                maxWidth: 850,
                color: "rgba(236,253,245,0.95)",
              }}
            >
              Zentrixel builds practical AI products for support, commerce, and
              operations. This page is a live sandbox where anyone can test your
              chatbot in a real website layout.
            </Typography>

            <Box>
              <Button
                variant="contained"
                size="large"
                startIcon={<RocketLaunchIcon />}
                onClick={() => setIsOpen(true)}
                disabled={!canUseChat}
                sx={{
                  bgcolor: "#f8fafc",
                  color: "#0f172a",
                  fontWeight: 700,
                  "&:hover": { bgcolor: "#e2e8f0" },
                }}
              >
                Launch Chat Demo
              </Button>
            </Box>
          </Stack>
        </Paper>

        {!widgetId && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            Missing widget ID in URL. Share links should look like
            `/agent-test/&lt;widgetId&gt;?token=&lt;signedToken&gt;`.
          </Alert>
        )}

        {accessError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {accessError}
          </Alert>
        )}

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "1.5fr 1fr" },
            gap: 3,
            mb: 3,
          }}
        >
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, md: 3 },
              borderRadius: 3,
              border: "1px solid #dbeafe",
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1.5 }}>
              What Zentrixel Is Building
            </Typography>
            <Typography sx={{ color: "#334155", mb: 2.5 }}>
              Zentrixel focuses on AI systems that deliver business outcomes,
              not just demos. The product philosophy is simple: grounded
              answers, fast integrations, clear analytics, and user experiences
              people actually enjoy using.
            </Typography>
            <Stack spacing={1.5}>
              {deliveryFlow.map((item) => (
                <Box
                  key={item.step}
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>
                    {item.step}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#475569" }}>
                    {item.detail}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, md: 3 },
              borderRadius: 3,
              border: "1px solid #c7d2fe",
              background: "linear-gradient(180deg, #eff6ff 0%, #ffffff 100%)",
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
              Demo Context
            </Typography>
            <Stack spacing={1}>
              <Typography variant="body2" sx={{ color: "#64748b" }}>
                Widget ID
              </Typography>
              <Typography
                sx={{
                  fontFamily: "Consolas, Menlo, monospace",
                  wordBreak: "break-all",
                  color: "#0f172a",
                }}
              >
                {widgetId || "Missing widget ID"}
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Typography variant="body2" sx={{ color: "#64748b" }}>
                API URL
              </Typography>
              <Typography
                sx={{
                  fontFamily: "Consolas, Menlo, monospace",
                  wordBreak: "break-all",
                  color: "#0f172a",
                }}
              >
                {apiBaseUrl}
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Typography variant="body2" sx={{ color: "#64748b" }}>
                Link Expiry
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                <Chip
                  size="small"
                  color={testTokenExpired ? "error" : "success"}
                  label={
                    testTokenExpiryMs
                      ? testTokenExpired
                        ? "Expired"
                        : `Expires in ${formatTimeRemaining(testTokenRemainingMs || 0)}`
                      : "Unknown expiry"
                  }
                />
              </Stack>
              <Typography sx={{ color: "#0f172a", fontSize: "0.82rem" }}>
                {testTokenExpiryMs
                  ? new Date(testTokenExpiryMs).toLocaleString()
                  : "Could not read token expiry"}
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Typography variant="body2" sx={{ color: "#64748b" }}>
                Welcome Message
              </Typography>
              <Typography sx={{ color: "#0f172a", fontSize: "0.9rem" }}>
                {welcomeText}
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Typography variant="body2" sx={{ color: "#334155" }}>
                Open the floating chat to interact with the live assistant.
                Position is set to {position}.
              </Typography>
            </Stack>
          </Paper>
        </Box>

        <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
          AI Product Portfolio
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "1fr 1fr",
              lg: "1fr 1fr 1fr 1fr",
            },
            gap: 2,
            mb: 2,
          }}
        >
          {productTracks.map((item) => (
            <Paper
              key={item.title}
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 3,
                border: `1px solid ${item.accent}33`,
                background: "rgba(255,255,255,0.85)",
                backdropFilter: "blur(6px)",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                "&:hover": {
                  transform: "translateY(-4px)",
                  boxShadow: "0 18px 35px rgba(15,23,42,0.08)",
                },
              }}
            >
              <Box sx={{ color: item.accent, mb: 1 }}>{item.icon}</Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                {item.title}
              </Typography>
              <Typography variant="body2" sx={{ color: "#475569", mb: 1.2 }}>
                {item.description}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: item.accent, fontWeight: 600 }}
              >
                {item.outcome}
              </Typography>
            </Paper>
          ))}
        </Box>
      </Box>

      {!isOpen && (
        <Box
          sx={{
            position: "fixed",
            ...launcherPositionSx,
            zIndex: 1200,
            display: "flex",
            alignItems: "center",
            gap: 1.1,
            flexDirection: position.includes("left") ? "row-reverse" : "row",
          }}
        >
          {showLauncherTeaser && (
            <Box
              onClick={() => canUseChat && setIsOpen(true)}
              sx={{
                position: "relative",
                width: "fit-content",
                maxWidth: 220,
                minHeight: 58,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                pl: 1.5,
                pr: 1,
                py: 1.15,
                borderRadius: "16px",
                bgcolor: "#ffffff",
                boxShadow: "0 12px 28px rgba(15,23,42,0.18)",
                border: "1px solid #e2e8f0",
                cursor: canUseChat ? "pointer" : "default",
                transition: "transform 160ms ease, box-shadow 160ms ease",
                "&:hover": canUseChat
                  ? {
                      transform: "translateY(-1px)",
                      boxShadow: "0 16px 32px rgba(15,23,42,0.22)",
                    }
                  : undefined,
              }}
            >
              <IconButton
                size="small"
                aria-label="Dismiss greeting"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLauncherTeaser(false);
                }}
                sx={{
                  position: "absolute",
                  top: -8,
                  left: -8,
                  width: 22,
                  height: 22,
                  background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                  color: "#ffffff",
                  boxShadow: `0 4px 10px ${primaryColor}59`,
                  "&:hover": {
                    background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                    opacity: 0.92,
                  },
                }}
              >
                <CloseRoundedIcon sx={{ fontSize: 14 }} />
              </IconButton>
              <Typography
                sx={{
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: "#334155",
                  lineHeight: 1.35,
                  pr: 0.5,
                }}
              >
                Hey! I am your AI assistant.
              </Typography>
            </Box>
          )}
          <Button
            onClick={() => setIsOpen(true)}
            disabled={!canUseChat}
            variant="contained"
            sx={{
              borderRadius: "15px",
              minWidth: 56,
              height: 56,
              fontSize: 24,
              background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
              boxShadow: "0 18px 36px rgba(15,23,42,0.32)",
              border: "1px solid rgba(255,255,255,0.35)",
              "&:hover": {
                transform: "translateY(-1px)",
                boxShadow: "0 22px 42px rgba(15,23,42,0.36)",
              },
            }}
          >
            <Box
              sx={{
                position: "relative",
                width: 24,
                height: 24,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChatBubbleRoundedIcon
                sx={{ fontSize: 24, color: "rgba(255,255,255,0.95)" }}
              />
              <Typography
                component="span"
                sx={{
                  position: "absolute",
                  fontSize: "0.6rem",
                  fontWeight: 800,
                  color: primaryColor,
                  lineHeight: 1,
                  mt: "1px",
                }}
              >
                Z
              </Typography>
            </Box>
          </Button>
        </Box>
      )}

      {isOpen && (
        <Paper
          ref={chatPanelRef}
          elevation={6}
          sx={{
            position: "fixed",
            ...panelPositionSx,
            width: { xs: "calc(100vw - 32px)", sm: 420 },
            height: { xs: "66vh", sm: 550 },
            borderRadius: 4,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            zIndex: 1300,
            border: widgetLookDark
              ? "1px solid rgba(148,163,184,0.22)"
              : "1px solid #cbd5e1",
            boxShadow: widgetLookDark
              ? "0 24px 54px rgba(2,6,23,0.5)"
              : "0 28px 62px rgba(15,23,42,0.34)",
            backdropFilter: "blur(8px)",
            fontFamily: "inherit",
            backgroundColor: widgetLookDark ? "#111827" : "#ffffff",
          }}
        >
          <Box
            sx={{
              background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
              color: chatHeaderFontColor,
              px: 1.6,
              py: 1.6,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid rgba(255,255,255,0.22)",
            }}
          >
            <Box>
              <Typography
                sx={{
                  color: "inherit",
                  fontWeight: 800,
                  lineHeight: 1.2,
                  letterSpacing: "0.01em",
                  fontSize: "0.92rem",
                }}
              >
                {assistantName}
              </Typography>
              <Typography
                sx={{
                  color: "inherit",
                  fontSize: "0.62rem",
                  opacity: 0.9,
                  mt: 0.3,
                  fontFamily: "Consolas, Menlo, monospace",
                }}
              >
                session: {sessionId ? sessionId.slice(-10) : "n/a"}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.85}>
              {/* <Button
                size="small"
                onClick={requestVideoCall}
                sx={getHeaderIconButtonSx(false)}
                disabled={callBusy || sending || callStatus === 'requested' || callStatus === 'active'}
                title="Request video call"
              >
                📹
              </Button>
              <Button
                size="small"
                onClick={joinLiveCall}
                sx={getHeaderIconButtonSx(Boolean(callRoomId && callStatus === 'active'))}
                disabled={!callRoomId || callStatus !== 'active'}
                title="Join live call"
              >
                🔗
              </Button>
              <Button
                size="small"
                onClick={endLiveCall}
                sx={getHeaderIconButtonSx(false)}
                disabled={callBusy || callStatus !== 'active'}
                title="End live call"
              >
                📵
              </Button> */}
              <Tooltip title="New session" arrow>
                <IconButton
                  size="small"
                  onClick={startFreshSession}
                  aria-label="New session"
                  sx={getHeaderIconButtonSx()}
                >
                  <RefreshRoundedIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Book appointment" arrow>
                <IconButton
                  size="small"
                  onClick={openAppointmentDialog}
                  aria-label="Book appointment"
                  sx={getHeaderIconButtonSx()}
                >
                  <EventAvailableRoundedIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </Tooltip>
              <Tooltip
                title={widgetLookDark ? "Light mode" : "Dark mode"}
                arrow
              >
                <IconButton
                  size="small"
                  onClick={() => setWidgetLookDark((v) => !v)}
                  aria-label={
                    widgetLookDark
                      ? "Switch to light mode"
                      : "Switch to dark mode"
                  }
                  sx={getHeaderIconButtonSx()}
                >
                  {widgetLookDark ? (
                    <LightModeRoundedIcon sx={{ fontSize: 17 }} />
                  ) : (
                    <DarkModeRoundedIcon sx={{ fontSize: 17 }} />
                  )}
                </IconButton>
              </Tooltip>
              <Tooltip title="Minimize chat" arrow>
                <IconButton
                  size="small"
                  onClick={() => setIsOpen(false)}
                  aria-label="Minimize chat"
                  sx={getHeaderIconButtonSx()}
                >
                  <CloseRoundedIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>

          {handoffOpen && (
            <Box
              sx={{
                px: 1.4,
                py: 1,
                borderBottom: "1px solid #dbeafe",
                background: "linear-gradient(120deg, #eff6ff 0%, #f8fafc 100%)",
              }}
            >
              <Stack spacing={0.8}>
                <Stack
                  direction="row"
                  spacing={0.8}
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Typography
                    sx={{
                      fontWeight: 700,
                      fontSize: "0.86rem",
                      color: "#0f172a",
                    }}
                  >
                    Human handoff in progress
                  </Typography>
                  <Chip
                    size="small"
                    color={handoffStatus === "assigned" ? "success" : "warning"}
                    label={
                      handoffStatus === "assigned"
                        ? "Agent assigned"
                        : "Waiting for agent"
                    }
                  />
                </Stack>
                <Typography sx={{ fontSize: "0.74rem", color: "#475569" }}>
                  Keep chatting here. Your messages are routed to live support
                  while handoff is active.
                </Typography>
                {handoffCountdownText ? (
                  <Typography
                    sx={{
                      fontSize: "0.72rem",
                      color: "#1d4ed8",
                      fontWeight: 600,
                    }}
                  >
                    {handoffCountdownText}
                  </Typography>
                ) : null}
                {handoffStatus === "waiting_for_agent" &&
                typeof handoffProgressPercent === "number" ? (
                  <Stack spacing={0.4}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Typography
                        sx={{
                          fontSize: "0.68rem",
                          color: "#334155",
                          fontWeight: 600,
                        }}
                      >
                        {Math.max(
                          0,
                          handoffRemainingSeconds ?? handoffWaitTimeoutSeconds,
                        )}{" "}
                        sec
                      </Typography>
                      <Typography
                        sx={{ fontSize: "0.68rem", color: "#475569" }}
                      >
                        {`${handoffWaitTimeoutSeconds} sec -> 0 sec`}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={handoffProgressPercent}
                      sx={{
                        height: 7,
                        borderRadius: 999,
                        backgroundColor: "rgba(37, 99, 235, 0.16)",
                        "& .MuiLinearProgress-bar": {
                          borderRadius: 999,
                          background:
                            "linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%)",
                        },
                      }}
                    />
                  </Stack>
                ) : null}
                <Stack direction="row" spacing={0.8}>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`Call: ${callStatus}${callStatus === "active" ? ` (${callMode})` : ""}`}
                    sx={{ fontWeight: 600 }}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      loadHandoffSession();
                      if (handoffChatId) {
                        loadHandoffMessages(handoffChatId, false);
                      }
                    }}
                  >
                    Refresh status
                  </Button>
                  {handoffPollError ? (
                    <Typography
                      sx={{
                        fontSize: "0.72rem",
                        color: "#dc2626",
                        alignSelf: "center",
                      }}
                    >
                      {handoffPollError}
                    </Typography>
                  ) : null}
                  {callError ? (
                    <Typography
                      sx={{
                        fontSize: "0.72rem",
                        color: "#dc2626",
                        alignSelf: "center",
                      }}
                    >
                      {callError}
                    </Typography>
                  ) : null}
                </Stack>
              </Stack>
            </Box>
          )}

          <Box
            ref={messagesContainerRef}
            sx={{
              flex: 1,
              p: 1.45,
              overflowY: "auto",
              bgcolor: widgetLookDark ? "#0f172a" : "#eef2f7",
            }}
          >
            <Stack spacing={0.95}>
              {messages.map((message, index) => (
                <Box
                  key={`${message.role}-${index}`}
                  sx={{
                    alignSelf:
                      message.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "96%",
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 0.78,
                    flexDirection:
                      message.role === "user" ? "row-reverse" : "row",
                  }}
                >
                  {(() => {
                    const isPendingAssistantMessage =
                      message.role === "assistant" &&
                      sending &&
                      index === messages.length - 1 &&
                      !message.content.trim();

                    return (
                      <>
                        <Box
                          sx={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            border: widgetLookDark
                              ? "1px solid #64748b"
                              : "1px solid #cbd5e1",
                            bgcolor: "#ffffff",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.95rem",
                            flex: "0 0 28px",
                          }}
                        >
                          {message.role === "assistant"
                            ? botIconGlyph
                            : userIconGlyph}
                        </Box>
                        <Box
                          sx={{
                            px: 1.45,
                            py: 1.05,
                            borderRadius:
                              message.role === "user"
                                ? "16px 16px 6px 16px"
                                : "16px 16px 16px 6px",
                            bgcolor:
                              message.role === "user"
                                ? undefined
                                : widgetLookDark
                                  ? "#1f2937"
                                  : "#f8fafc",
                            background:
                              message.role === "user"
                                ? `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
                                : undefined,
                            color:
                              message.role === "user"
                                ? "#ffffff"
                                : widgetLookDark
                                  ? "#e2e8f0"
                                  : "#1e293b",
                            border:
                              message.role === "assistant"
                                ? widgetLookDark
                                  ? "1px solid #334155"
                                  : "1px solid #cbd5e1"
                                : "none",
                            whiteSpace: "pre-wrap",
                            fontSize: { xs: "0.8rem", md: "0.86rem" },
                            lineHeight: 1.45,
                            boxShadow: "0 2px 6px rgba(15,23,42,0.06)",
                            minHeight: isPendingAssistantMessage
                              ? 30
                              : undefined,
                            minWidth: isPendingAssistantMessage
                              ? 46
                              : undefined,
                            display: isPendingAssistantMessage
                              ? "flex"
                              : "block",
                            alignItems: isPendingAssistantMessage
                              ? "center"
                              : undefined,
                            justifyContent: isPendingAssistantMessage
                              ? "center"
                              : undefined,
                          }}
                        >
                          {isPendingAssistantMessage ? (
                            <TypingDots
                              color={widgetLookDark ? "#94a3b8" : "#64748b"}
                            />
                          ) : (
                            renderInlineMarkdown(
                              message.content,
                              `msg-${index}`,
                            )
                          )}
                        </Box>
                      </>
                    );
                  })()}
                </Box>
              ))}
              {showLeadForm && (
                <Box
                  sx={{
                    alignSelf: "flex-start",
                    maxWidth: "92%",
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 0.9,
                  }}
                >
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      border: "1px solid #d1d5db",
                      bgcolor: "#fff",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.95rem",
                      flex: "0 0 28px",
                    }}
                  >
                    {botIconGlyph}
                  </Box>
                  <Box
                    sx={{
                      px: 1.3,
                      py: 1,
                      borderRadius: 2,
                      bgcolor: "#f8fbff",
                      border: "1px solid #cfe3ff",
                      boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
                      width: "100%",
                      maxWidth: 308,
                    }}
                  >
                    <Typography
                      sx={{
                        fontWeight: 700,
                        color: "#0f172a",
                        fontSize: "0.78rem",
                        mb: 0.2,
                      }}
                    >
                      Quick contact form
                    </Typography>
                    <Typography
                      sx={{ color: "#64748b", fontSize: "0.68rem", mb: 0.8 }}
                    >
                      Small details now help us connect you faster with live
                      support.
                    </Typography>

                    <Stack spacing={0.6}>
                      <TextField
                        placeholder="Name"
                        value={leadForm.name}
                        onChange={(e) =>
                          setLeadForm((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        size="small"
                        fullWidth
                        sx={{
                          "& .MuiInputBase-input": {
                            fontSize: "0.78rem",
                            py: 0.8,
                          },
                        }}
                      />
                      <TextField
                        placeholder="Email"
                        type="email"
                        value={leadForm.email}
                        onChange={(e) =>
                          setLeadForm((prev) => ({
                            ...prev,
                            email: e.target.value,
                          }))
                        }
                        size="small"
                        fullWidth
                        sx={{
                          "& .MuiInputBase-input": {
                            fontSize: "0.78rem",
                            py: 0.8,
                          },
                        }}
                      />
                      <TextField
                        placeholder="Phone"
                        type="tel"
                        value={leadForm.phone}
                        onChange={(e) =>
                          setLeadForm((prev) => ({
                            ...prev,
                            phone: e.target.value,
                          }))
                        }
                        size="small"
                        fullWidth
                        sx={{
                          "& .MuiInputBase-input": {
                            fontSize: "0.78rem",
                            py: 0.8,
                          },
                        }}
                      />
                      <TextField
                        placeholder="Company"
                        value={leadForm.company}
                        onChange={(e) =>
                          setLeadForm((prev) => ({
                            ...prev,
                            company: e.target.value,
                          }))
                        }
                        size="small"
                        fullWidth
                        sx={{
                          "& .MuiInputBase-input": {
                            fontSize: "0.78rem",
                            py: 0.8,
                          },
                        }}
                      />
                      <Stack direction="row" spacing={0.75}>
                        <Button
                          variant="contained"
                          onClick={handleLeadSubmit}
                          disabled={leadSubmitting}
                          fullWidth
                          size="small"
                          sx={{
                            borderRadius: "10px",
                            minHeight: 32,
                            fontSize: "0.78rem",
                            background: `linear-gradient(120deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                          }}
                        >
                          {leadSubmitting ? "Submitting..." : "Submit"}
                        </Button>
                        <Button
                          variant="outlined"
                          onClick={() => {
                            setShowLeadForm(false);
                            setPendingHandoffAfterLead(false);
                          }}
                          disabled={leadSubmitting}
                          fullWidth
                          size="small"
                          sx={{
                            borderRadius: "10px",
                            minHeight: 32,
                            fontSize: "0.78rem",
                          }}
                        >
                          Later
                        </Button>
                      </Stack>
                    </Stack>
                  </Box>
                </Box>
              )}
              {showAppointmentForm && (
                <Box
                  sx={{
                    alignSelf: "flex-start",
                    maxWidth: "92%",
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 0.9,
                  }}
                >
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      border: "1px solid #d1d5db",
                      bgcolor: "#fff",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.95rem",
                      flex: "0 0 28px",
                    }}
                  >
                    {botIconGlyph}
                  </Box>
                  <Box
                    sx={{
                      px: 1.5,
                      py: 1,
                      borderRadius: 2,
                      bgcolor: "#ffffff",
                      border: "1px solid #dbeafe",
                      boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
                      width: "100%",
                      maxWidth: 308,
                    }}
                  >
                    <Typography
                      sx={{
                        fontWeight: 700,
                        color: "#0f172a",
                        fontSize: "0.82rem",
                        mb: 0.2,
                      }}
                    >
                      Set up your meeting
                    </Typography>
                    <Typography
                      sx={{ color: "#64748b", fontSize: "0.7rem", mb: 0.9 }}
                    >
                      Please fill this short form and I will set the meeting for
                      you.
                    </Typography>

                    {appointmentError && (
                      <Alert severity="error" sx={{ mb: 1, py: 0.2 }}>
                        {appointmentError}
                      </Alert>
                    )}

                    <Stack spacing={0.75}>
                      <TextField
                        placeholder="Full name"
                        value={appointmentName}
                        onChange={(e) => setAppointmentName(e.target.value)}
                        size="small"
                        fullWidth
                        sx={{
                          "& .MuiInputBase-input": {
                            fontSize: "0.85rem",
                            py: 0.9,
                          },
                        }}
                      />
                      <TextField
                        placeholder="Email address"
                        type="email"
                        value={appointmentEmail}
                        onChange={(e) => setAppointmentEmail(e.target.value)}
                        size="small"
                        fullWidth
                        sx={{
                          "& .MuiInputBase-input": {
                            fontSize: "0.85rem",
                            py: 0.9,
                          },
                        }}
                      />
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                          gap: 0.9,
                        }}
                      >
                        <Box>
                          <Typography
                            sx={{
                              fontSize: "0.68rem",
                              color: "#64748b",
                              mb: 0.2,
                            }}
                          >
                            Date (IST)
                          </Typography>
                          <TextField
                            type="date"
                            value={appointmentDate}
                            onChange={(e) => setAppointmentDate(e.target.value)}
                            size="small"
                            fullWidth
                            sx={{
                              "& .MuiInputBase-input": {
                                fontSize: "0.83rem",
                                py: 0.75,
                              },
                            }}
                          />
                        </Box>
                        <Box>
                          <Typography
                            sx={{
                              fontSize: "0.68rem",
                              color: "#64748b",
                              mb: 0.2,
                            }}
                          >
                            Time (IST)
                          </Typography>
                          <TextField
                            type="time"
                            value={appointmentTime}
                            onChange={(e) => setAppointmentTime(e.target.value)}
                            size="small"
                            fullWidth
                            sx={{
                              "& .MuiInputBase-input": {
                                fontSize: "0.83rem",
                                py: 0.75,
                              },
                            }}
                          />
                        </Box>
                      </Box>
                      <Stack direction="row" spacing={0.75}>
                        <Button
                          variant="contained"
                          onClick={bookAppointment}
                          disabled={appointmentBusy}
                          fullWidth
                          size="small"
                          sx={{
                            borderRadius: "10px",
                            minHeight: 34,
                            fontSize: "0.82rem",
                            background: `linear-gradient(120deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                          }}
                        >
                          {appointmentBusy ? "Creating..." : "Create meeting"}
                        </Button>
                        <Button
                          variant="outlined"
                          onClick={() => setShowAppointmentForm(false)}
                          disabled={appointmentBusy}
                          fullWidth
                          size="small"
                          sx={{
                            borderRadius: "10px",
                            minHeight: 34,
                            fontSize: "0.82rem",
                          }}
                        >
                          Cancel
                        </Button>
                      </Stack>
                    </Stack>
                  </Box>
                </Box>
              )}
              <div ref={messagesEndRef} />
            </Stack>
          </Box>

          <Box
            sx={{
              p: 1.35,
              borderTop: widgetLookDark
                ? "1px solid #334155"
                : "1px solid #d1d5db",
              bgcolor: widgetLookDark ? "#111827" : "#ffffff",
            }}
          >
            <Stack spacing={0.7}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <TextField
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    setLastActivityAtMs(Date.now());
                  }}
                  placeholder={
                    sessionClosedByInactivity
                      ? "Session closed due to inactivity. Type a message to start a new session..."
                      : "Type your message..."
                  }
                  fullWidth
                  size="small"
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "14px",
                      bgcolor: widgetLookDark ? "#0f172a" : "#f8fafc",
                      boxShadow: "none !important",
                      outline: "none !important",
                      filter: "none",
                      "& fieldset, & .MuiOutlinedInput-notchedOutline": {
                        borderColor: widgetLookDark ? "#334155" : "#cbd5e1",
                        borderWidth: "1px !important",
                        boxShadow: "none !important",
                      },
                      "&:hover fieldset, &:hover .MuiOutlinedInput-notchedOutline":
                        {
                          borderColor: widgetLookDark ? "#475569" : "#94a3b8",
                          borderWidth: "1px !important",
                          boxShadow: "none !important",
                        },
                      "&.Mui-focused": {
                        boxShadow: "none !important",
                        outline: "none !important",
                        filter: "none",
                      },
                      "&.Mui-focused fieldset, &.Mui-focused .MuiOutlinedInput-notchedOutline":
                        {
                          borderColor: widgetLookDark
                            ? "#334155"
                            : "#cbd5e1",
                          borderWidth: "1px !important",
                          boxShadow: "none !important",
                        },
                    },
                    "& .MuiInputBase-input": {
                      fontSize: "0.94rem",
                      color: widgetLookDark ? "#e2e8f0" : "#334155",
                    },
                    "& .MuiInputBase-input:focus": {
                      outline: "none !important",
                      boxShadow: "none !important",
                    },
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <IconButton
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || sending || !canUseChat}
                  aria-label="Send message"
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                    boxShadow: "0 8px 16px rgba(15,23,42,0.18)",
                    color: "#ffffff",
                    "&:hover": {
                      background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                      opacity: 0.92,
                    },
                    "&.Mui-disabled": {
                      background: widgetLookDark ? "#334155" : "#cbd5e1",
                      color: widgetLookDark ? "#94a3b8" : "#ffffff",
                    },
                  }}
                >
                  <SendRoundedIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Box>
              <Typography
                variant="caption"
                sx={{
                  color: widgetLookDark ? "#94a3b8" : "#64748b",
                  fontWeight: 500,
                  fontSize: "0.68rem",
                }}
              >
                Press Enter to send. Appointment booking is available anytime.
              </Typography>
              {typeof inactivityRemainingSeconds === "number" ? (
                <Typography
                  variant="caption"
                  sx={{
                    color:
                      inactivityRemainingSeconds <= 15 ? "#dc2626" : "#334155",
                    fontWeight: inactivityRemainingSeconds <= 15 ? 700 : 500,
                  }}
                >
                  Session auto-closes in{" "}
                  {formatCountdownSeconds(inactivityRemainingSeconds)} if no
                  activity.
                </Typography>
              ) : null}
            </Stack>
          </Box>

          <Box
            sx={{
              py: 0.6,
              textAlign: "center",
              fontSize: "0.72rem",
              color: widgetLookDark ? "#94a3b8" : "#64748b",
              borderTop: widgetLookDark
                ? "1px solid #334155"
                : "1px solid #e2e8f0",
              bgcolor: widgetLookDark ? "#0f172a" : "#f8fafc",
            }}
          >
            Powered by{" "}
            <Box
              component="a"
              href="https://zentrixel.com/"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: "inherit",
                textDecoration: "none",
                fontWeight: 600,
                "&:hover": { textDecoration: "underline" },
              }}
            >
              zentrixel.com
            </Box>
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default AgentTestPage;
