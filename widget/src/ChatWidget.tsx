import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChatAPI } from "./api";
import "./styles.css";

interface Message {
  role: "user" | "assistant";
  content: string;
}

type RichTextBlock =
  | { type: "paragraph"; text: string }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] };

interface ContactFieldDefinition {
  key: string;
  label: string;
  type?: "text" | "email" | "tel" | "number" | "date";
  required?: boolean;
}

interface WidgetConfig {
  widgetId: string;
  apiUrl: string;
  name?: string;
  welcomeMessage?: string;
  primaryColor?: string;
  secondaryColor?: string;
  chatHeaderFontColor?: string;
  position?: string;
  botIcon?: string;
  userIcon?: string;
  contactFields?: ContactFieldDefinition[];
  shop?: any;
  user?: any;
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

const IconSvg: React.FC<{ children: React.ReactNode; size?: number }> = ({
  children,
  size = 17,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

const RefreshIcon = () => (
  <IconSvg>
    <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
  </IconSvg>
);

// const EmailIcon = () => (
//   <IconSvg>
//     <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
//   </IconSvg>
// );

const CalendarIcon = () => (
  <IconSvg>
    <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z" />
  </IconSvg>
);

const DarkModeIcon = () => (
  <IconSvg>
    <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z" />
  </IconSvg>
);

const LightModeIcon = () => (
  <IconSvg>
    <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 0 0 0-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z" />
  </IconSvg>
);

const CloseIcon = ({ size = 17 }: { size?: number }) => (
  <IconSvg size={size}>
    <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </IconSvg>
);

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <IconSvg size={16}>
    {expanded ? (
      <path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z" />
    ) : (
      <path d="M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z" />
    )}
  </IconSvg>
);

const SendIcon = () => (
  <IconSvg size={20}>
    <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
  </IconSvg>
);

const ChatBubbleIcon = () => (
  <IconSvg size={24}>
    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
  </IconSvg>
);

const TypingDots: React.FC = () => (
  <span className="chatbot-typing" aria-label="Assistant is typing">
    <span className="chatbot-typing-dot" />
    <span className="chatbot-typing-dot" />
    <span className="chatbot-typing-dot" />
  </span>
);

const createSessionId = () =>
  `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const APPOINTMENT_FORM_PROMPT =
  "If you would like to set a meeting, please fill this short form and I will set it up for you.";

const CHAT_INACTIVITY_TIMEOUT_MS = 120000;
const CHAT_INACTIVITY_CLOSE_MESSAGE =
  "Closing this chat session as no activity happened in the last 120 seconds.";
const STREAM_FALLBACK_TIMEOUT_MS = 12000;
const POST_HANDOFF_FOLLOWUP_MESSAGE =
  "Welcome back from live support. Are you satisfied with the help, or should I set up a meeting for you?";

const IST_TIMEZONE = "Asia/Kolkata";

const getIstTodayDate = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
};

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

const buildIstIsoDateTime = (date: string, time: string): Date =>
  new Date(`${date}T${time}:00+05:30`);

const formatCountdownSeconds = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};

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

const isDirectLiveAgentIntent = (value: string): boolean => {
  const normalized = normalizeIntentText(value);
  if (!normalized) return false;

  if (
    /(live|human|real)\s+(agent|support)|support\s+agent|representative/.test(
      normalized,
    )
  ) {
    return true;
  }

  if (
    /(connect|transfer|handoff|talk|chat|speak)\s+(me\s+)?(to\s+)?(a\s+)?(live|human|support|agent)/.test(
      normalized,
    )
  ) {
    return true;
  }

  return false;
};

const assistantMessageOffersHandoff = (value: string): boolean => {
  const normalized = normalizeIntentText(value);
  if (!normalized) return false;

  const markers = [
    "escalation contacts",
    "would you like me to connect you",
    "if you're interested, i can connect you",
    "if you're interested i can connect you",
    "i can connect you",
    "human expert",
    "live agent",
    "reach them",
    "let me know",
  ];

  return markers.some((marker) => normalized.includes(marker));
};

const normalizeInlineMarkdown = (text: string): string => {
  let normalized = String(text || "");
  // Bold "Label: description" when no markdown markers are present
  const labelMatch = normalized.match(/^([A-Z][^:\n*]{1,70}):\s+(.+)$/);
  if (labelMatch && !normalized.includes("**") && !normalized.includes("*")) {
    normalized = `**${labelMatch[1]}:** ${labelMatch[2]}`;
  }
  // Collapse malformed closings: **text**** / **text*** → **text**
  normalized = normalized.replace(/\*\*([^*]+)\*\*(\*{1,})/g, "**$1**");
  // Collapse duplicate openings: ****text** → **text**
  normalized = normalized.replace(/(\*{1,})\*\*([^*]+)\*\*/g, "**$2**");
  return normalized;
};

const renderInlineRichText = (
  text: string,
  keyPrefix: string,
): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  const normalized = normalizeInlineMarkdown(text);
  let partIndex = 0;

  const pushPlain = (value: string) => {
    const cleaned = value.replace(/\*{2,}/g, "");
    if (!cleaned) return;
    parts.push(
      <React.Fragment key={`${keyPrefix}-t-${partIndex++}`}>
        {cleaned}
      </React.Fragment>,
    );
  };

  if (normalized.includes("**")) {
    let cursor = 0;
    while (cursor < normalized.length) {
      const openIdx = normalized.indexOf("**", cursor);
      if (openIdx === -1) {
        pushPlain(normalized.slice(cursor));
        break;
      }

      if (openIdx > cursor) {
        pushPlain(normalized.slice(cursor, openIdx));
      }

      const closeIdx = normalized.indexOf("**", openIdx + 2);
      if (closeIdx === -1) {
        pushPlain(normalized.slice(openIdx + 2));
        break;
      }

      const boldText = normalized.slice(openIdx + 2, closeIdx);
      if (boldText) {
        parts.push(
          <strong key={`${keyPrefix}-b-${partIndex++}`}>{boldText}</strong>,
        );
      }
      cursor = closeIdx + 2;
      while (normalized[cursor] === "*") cursor += 1;
    }
    return parts;
  }

  const singleTokens = normalized.split(/(\*[^*]+\*)/g);
  singleTokens.forEach((token, index) => {
    if (!token) return;
    if (token.startsWith("*") && token.endsWith("*") && token.length > 2) {
      parts.push(
        <strong key={`${keyPrefix}-s-${index}`}>{token.slice(1, -1)}</strong>,
      );
      return;
    }
    pushPlain(token);
  });

  return parts;
};

const parseTableRow = (line: string): string[] => {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return [];
  const normalized = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  return normalized.split("|").map((cell) => cell.trim());
};

const isTableSeparator = (line: string): boolean => {
  const cells = parseTableRow(line);
  if (cells.length === 0) return false;
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
};

const parseRichTextBlocks = (content: string): RichTextBlock[] => {
  const lines = (content || "").replace(/\r\n/g, "\n").split("\n");
  const blocks: RichTextBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const current = lines[index].trim();
    if (!current) {
      index += 1;
      continue;
    }

    if (
      index + 1 < lines.length &&
      lines[index].includes("|") &&
      isTableSeparator(lines[index + 1])
    ) {
      const headers = parseTableRow(lines[index]);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length) {
        const candidate = lines[index].trim();
        if (!candidate || !candidate.includes("|")) break;
        const row = parseTableRow(lines[index]);
        if (row.length) rows.push(row);
        index += 1;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    if (/^#{1,6}\s+/.test(current)) {
      const headingText = current
        .replace(/^#{1,6}\s+/, "")
        .replace(/\s+#+\s*$/, "")
        .trim();
      blocks.push({
        type: "paragraph",
        text: headingText ? `**${headingText}**` : "",
      });
      index += 1;
      continue;
    }

    // Section titles like "Overview:" / "Industries Served:" → bold, same bubble
    if (/^[^#\n]{1,80}:\s*$/.test(current)) {
      blocks.push({
        type: "paragraph",
        text: `**${current.trim()}**`,
      });
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(current)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "unordered-list", items });
      continue;
    }

    if (/^\*{0,2}\d+\.\s+/.test(current)) {
      const items: string[] = [];
      while (index < lines.length && /^\*{0,2}\d+\.\s+/.test(lines[index].trim())) {
        items.push(
          lines[index]
            .trim()
            .replace(/^\*{0,2}\d+\.\s+/, "")
            .replace(/\*{2,}$/g, ""),
        );
        index += 1;
      }
      // Show numbered markdown as bold-dot bullets (not 1. 2. 3.)
      blocks.push({ type: "unordered-list", items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const candidate = lines[index].trim();
      if (!candidate) break;
      if (
        /^#{1,6}\s+/.test(candidate) ||
        /^[^#\n]{1,80}:\s*$/.test(candidate) ||
        /^[-*]\s+/.test(candidate) ||
        /^\*{0,2}\d+\.\s+/.test(candidate)
      )
        break;
      if (
        index + 1 < lines.length &&
        lines[index].includes("|") &&
        isTableSeparator(lines[index + 1])
      ) {
        break;
      }
      paragraphLines.push(candidate);
      index += 1;
    }
    if (paragraphLines.length) {
      blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
    }
  }

  return blocks;
};

const renderMessageContent = (
  content: string,
  keyPrefix: string,
): React.ReactNode => {
  const blocks = parseRichTextBlocks(content);
  if (blocks.length === 0) {
    return <p>{content}</p>;
  }

  return (
    <div className="chatbot-rich-text">
      {blocks.map((block, blockIndex) => {
        const blockKey = `${keyPrefix}-block-${blockIndex}`;
        if (block.type === "paragraph") {
          return (
            <p key={blockKey}>{renderInlineRichText(block.text, blockKey)}</p>
          );
        }

        if (block.type === "unordered-list") {
          return (
            <ul key={blockKey} className="chatbot-rich-bullets">
              {block.items.map((item, itemIndex) => (
                <li key={`${blockKey}-item-${itemIndex}`}>
                  {renderInlineRichText(item, `${blockKey}-item-${itemIndex}`)}
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "ordered-list") {
          return (
            <ul key={blockKey} className="chatbot-rich-bullets">
              {block.items.map((item, itemIndex) => (
                <li key={`${blockKey}-item-${itemIndex}`}>
                  {renderInlineRichText(item, `${blockKey}-item-${itemIndex}`)}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <div key={blockKey} className="chatbot-rich-table-wrap">
            <table className="chatbot-rich-table">
              <thead>
                <tr>
                  {block.headers.map((header, headerIndex) => (
                    <th key={`${blockKey}-h-${headerIndex}`}>
                      {renderInlineRichText(
                        header,
                        `${blockKey}-h-${headerIndex}`,
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={`${blockKey}-r-${rowIndex}`}>
                    {row.map((cell, cellIndex) => (
                      <td key={`${blockKey}-c-${rowIndex}-${cellIndex}`}>
                        {renderInlineRichText(
                          cell,
                          `${blockKey}-c-${rowIndex}-${cellIndex}`,
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
};

const ChatWidget: React.FC<WidgetConfig> = ({
  widgetId,
  apiUrl,
  name = "AI Assistant",
  welcomeMessage = "Hi! How can I help you?",
  primaryColor = "#269b9f",
  secondaryColor = "#34d399",
  chatHeaderFontColor,
  position = "bottom-right",
  botIcon = "bot-robot",
  userIcon = "user-person",
  contactFields = [],
  shop,
  user,
}) => {
  const storageKey = `chatbot_session_id_${widgetId || "default"}`;
  const headerFontColor = (chatHeaderFontColor || "").trim() || "#f8fafc";

  const [darkMode, setDarkMode] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showLauncherTeaser, setShowLauncherTeaser] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadForm, setLeadForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
  });
  const [leadCustomFields, setLeadCustomFields] = useState<Record<string, string>>({});

  const extraContactFields = useMemo(
    () =>
      contactFields.filter(
        (field) => field.key && field.label && !["name", "email", "phone", "company"].includes(field.key),
      ),
    [contactFields],
  );

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [emailSending, setEmailSending] = useState(false);

  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [appointmentSubmitting, setAppointmentSubmitting] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState({
    name: "",
    email: "",
    phone: "",
    appointment_date: "",
    appointment_time: "",
  });
  const [appointmentError, setAppointmentError] = useState("");
  const [handoffActive, setHandoffActive] = useState(false);
  const [handoffPanelExpanded, setHandoffPanelExpanded] = useState(false);
  const [handoffChatId, setHandoffChatId] = useState<string | null>(null);
  const [handoffStatus, setHandoffStatus] = useState<string | null>(null);
  const [handoffAfterId, setHandoffAfterId] = useState(0);
  const [handoffError, setHandoffError] = useState("");
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
  const [pendingHandoffAfterLead, setPendingHandoffAfterLead] = useState(false);
  const [awaitingPostHandoffDecision, setAwaitingPostHandoffDecision] =
    useState(false);
  const handoffSeenIdsRef = useRef<Set<number>>(new Set());
  const handoffPromptedChatIdRef = useRef<string | null>(null);
  const lastHandoffStatusRef = useRef<string | null>(null);

  const [suggestedQuestions, setSuggestedQuestions] = useState<Array<{ question: string; answer: string }>>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [sessionEngaged, setSessionEngaged] = useState(false);
  const [sessionClosedByInactivity, setSessionClosedByInactivity] =
    useState(false);
  const [lastActivityAtMs, setLastActivityAtMs] = useState(Date.now());
  const [inactivityNowMs, setInactivityNowMs] = useState(Date.now());

  const [sessionId, setSessionId] = useState(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) return stored;
    const created = createSessionId();
    localStorage.setItem(storageKey, created);
    return created;
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatAPI = useRef(new ChatAPI(apiUrl));
  const botIconGlyph = BOT_ICON_GLYPHS[botIcon] || BOT_ICON_GLYPHS["bot-robot"];
  const userIconGlyph =
    USER_ICON_GLYPHS[userIcon] || USER_ICON_GLYPHS["user-person"];

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

  const getMeetingUrl = (roomId: string, mode: "video" | "audio") => {
    const safeRoom = encodeURIComponent(roomId);
    const videoMuted = mode === "audio" ? "true" : "false";
    return `https://meet.jit.si/${safeRoom}#config.prejoinPageEnabled=false&config.startWithVideoMuted=${videoMuted}`;
  };

  const shopDomain = useMemo(
    () => shop?.domain || shop?.shop_domain || undefined,
    [shop],
  );
  const customerId = useMemo(
    () => user?.id || user?.customer_id || undefined,
    [user],
  );

  const showSuggestions =
    isOpen &&
    !loading &&
    !showLeadForm &&
    !showEmailForm &&
    !showAppointmentForm &&
    input.trim().length === 0 &&
    messages.length <= 1;

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
      !handoffActive ||
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
  }, [handoffActive, handoffStatus, handoffWaitingExpiresAt, handoffNowMs]);

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

  useEffect(() => {
    chatAPI.current = new ChatAPI(apiUrl);
  }, [apiUrl]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, showAppointmentForm, loading]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content: welcomeMessage,
        },
      ]);
    }
  }, [isOpen, messages.length, welcomeMessage]);

  useEffect(() => {
    const loadSuggestions = async () => {
      if (!isOpen || !widgetId) return;
      setSuggestionsLoading(true);
      try {
        const questions = await chatAPI.current.getSuggestedQuestions(widgetId);
        setSuggestedQuestions(questions);
      } catch {
        setSuggestedQuestions([]);
      } finally {
        setSuggestionsLoading(false);
      }
    };

    loadSuggestions();
  }, [isOpen, widgetId]);

  const resetChat = () => {
    const created = createSessionId();
    localStorage.setItem(storageKey, created);
    setSessionId(created);
    setMessages([
      {
        role: "assistant",
        content: welcomeMessage,
      },
    ]);
    setInput("");
    setShowLeadForm(false);
    setLeadSubmitted(false);
    setShowEmailForm(false);
    setEmailValue("");
    setShowAppointmentForm(false);
    setHandoffActive(false);
    setHandoffChatId(null);
    setHandoffStatus(null);
    setHandoffAfterId(0);
    setHandoffError("");
    setCallStatus("none");
    setCallMode("video");
    setCallRoomId(null);
    setCallBusy(false);
    setCallError("");
    setHandoffWaitCycle(1);
    setHandoffWaitingExpiresAt(null);
    setHandoffWaitTimeoutSeconds(120);
    setHandoffNowMs(Date.now());
    setPendingHandoffAfterLead(false);
    setAwaitingPostHandoffDecision(false);
    handoffSeenIdsRef.current.clear();
    handoffPromptedChatIdRef.current = null;
    lastHandoffStatusRef.current = null;
    setSessionEngaged(false);
    setSessionClosedByInactivity(false);
    setLastActivityAtMs(Date.now());
    setAppointmentForm({
      name: "",
      email: "",
      phone: "",
      appointment_date: "",
      appointment_time: "",
    });
    setAppointmentError("");
    return created;
  };

  const handleQuickQuestion = (item: { question: string; answer: string }) => {
    setMessages((prev) => [
      ...prev,
      { role: "user", content: item.question },
      { role: "assistant", content: item.answer },
    ]);
    setSessionEngaged(true);
    setLastActivityAtMs(Date.now());
  };

  const loadHandoffSession = async () => {
    if (!widgetId) return;
    try {
      const data = await chatAPI.current.getHandoffSession(
        sessionId,
        widgetId,
        handoffChatId || undefined,
      );
      if (!data?.chat_id) return;
      const nextStatus = data.status || null;
      const wasActive =
        lastHandoffStatusRef.current === "waiting_for_agent" ||
        lastHandoffStatusRef.current === "assigned";
      const isActive =
        nextStatus === "waiting_for_agent" || nextStatus === "assigned";

      setHandoffChatId(data.chat_id);
      setHandoffStatus(nextStatus);
      setHandoffActive(isActive);
      setHandoffWaitCycle(Math.max(1, data.wait_cycle || 1));
      setHandoffWaitingExpiresAt(data.waiting_expires_at || null);
      setCallStatus(data.call_status || "none");
      setCallMode((data.call_mode as "video" | "audio") || "video");
      setCallRoomId(data.call_room_id || null);
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
      // Do not block chat on handoff polling failures.
    }
  };

  const loadHandoffMessages = async (chatId: string, reset = false) => {
    if (!widgetId || !chatId) return;
    try {
      if (reset) {
        handoffSeenIdsRef.current.clear();
        setHandoffAfterId(0);
      }
      const data = await chatAPI.current.getHandoffMessages(
        chatId,
        sessionId,
        widgetId,
        reset ? 0 : handoffAfterId,
      );
      if (!data) return;

      const nextStatus = data.status || null;
      const wasActive =
        lastHandoffStatusRef.current === "waiting_for_agent" ||
        lastHandoffStatusRef.current === "assigned";
      const isActive =
        nextStatus === "waiting_for_agent" || nextStatus === "assigned";

      setHandoffStatus(nextStatus);
      setHandoffActive(isActive);
      setHandoffWaitCycle(Math.max(1, data.wait_cycle || 1));
      setHandoffWaitingExpiresAt(data.waiting_expires_at || null);
      setCallStatus(data.call_status || "none");
      setCallMode((data.call_mode as "video" | "audio") || "video");
      setCallRoomId(data.call_room_id || null);
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

      const visible = (data.items || []).filter((item) => {
        const isBotUpdate = item.sender_type === "bot" && !reset;
        if (
          item.sender_type !== "agent" &&
          item.sender_type !== "system" &&
          !isBotUpdate
        )
          return false;
        if (handoffSeenIdsRef.current.has(item.id)) return false;
        handoffSeenIdsRef.current.add(item.id);
        return true;
      });

      if (visible.length > 0) {
        setMessages((prev) => [
          ...prev,
          ...visible.map((item) => ({
            role: "assistant" as const,
            content: item.message,
          })),
        ]);
        setSessionEngaged(true);
        setLastActivityAtMs(Date.now());
      }

      const maxId = (data.items || []).reduce(
        (acc, item) => Math.max(acc, item.id),
        handoffAfterId,
      );
      setHandoffAfterId(maxId);
      setHandoffError("");
    } catch {
      setHandoffError("Live agent updates are temporarily unavailable.");
    }
  };

  useEffect(() => {
    if (!isOpen || !widgetId) return;
    loadHandoffSession();
  }, [isOpen, widgetId, sessionId]);

  useEffect(() => {
    if (
      !handoffActive ||
      handoffStatus !== "waiting_for_agent" ||
      !handoffWaitingExpiresAt
    )
      return;
    setHandoffNowMs(Date.now());
    const timer = window.setInterval(() => {
      setHandoffNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [handoffActive, handoffStatus, handoffWaitingExpiresAt]);

  useEffect(() => {
    if (!handoffActive) {
      setHandoffPanelExpanded(false);
    }
  }, [handoffActive]);

  useEffect(() => {
    if (!isOpen || !handoffActive || !handoffChatId) return;

    const timer = window.setInterval(() => {
      loadHandoffSession();
      loadHandoffMessages(handoffChatId, false);
    }, 2500);

    return () => window.clearInterval(timer);
  }, [isOpen, handoffActive, handoffChatId, handoffAfterId]);

  useEffect(() => {
    if (!isOpen || sessionClosedByInactivity || !sessionEngaged || loading)
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
      setHandoffActive(false);
      setHandoffChatId(null);
      setHandoffStatus(null);
      setHandoffAfterId(0);
      setHandoffError("");
      handoffSeenIdsRef.current.clear();
      setLoading(false);
    }, CHAT_INACTIVITY_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [
    isOpen,
    sessionClosedByInactivity,
    sessionEngaged,
    loading,
    lastActivityAtMs,
  ]);

  useEffect(() => {
    if (!isOpen || sessionClosedByInactivity || !sessionEngaged) return;

    setInactivityNowMs(Date.now());
    const timer = window.setInterval(() => {
      setInactivityNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isOpen, sessionClosedByInactivity, sessionEngaged, lastActivityAtMs]);

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
    if (sessionClosedByInactivity) {
      activeSessionId = resetChat();
    }

    const text = (overrideText ?? input).trim();
    if (!text || loading) return;

    const shouldForceLeadBeforeDirectHandoff =
      !opts.skipLeadCaptureCheck &&
      !opts.silentUserMessage &&
      !leadSubmitted &&
      !showLeadForm &&
      !handoffActive &&
      isDirectLiveAgentIntent(text);

    if (shouldForceLeadBeforeDirectHandoff) {
      if (!overrideText) {
        setInput("");
      }
      setShowLeadForm(true);
      setPendingHandoffAfterLead(true);
      setMessages((prev) => [
        ...prev,
        { role: "user", content: text },
        {
          role: "assistant",
          content:
            "Before I transfer this handoff request to a live agent, please fill the quick contact form in chat so we can reach you if needed.",
        },
      ]);
      setSessionEngaged(true);
      setSessionClosedByInactivity(false);
      setLastActivityAtMs(Date.now());
      return;
    }

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
        openAppointmentForm();
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

    setLoading(true);
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
      response?: string;
    }) => {
      const shouldOpenAppointmentForm =
        payload?.ui_action === "open_appointment_form";
      const shouldOpenHandoff = payload?.ui_action === "open_human_handoff";
      const shouldOpenLeadForm = payload?.ui_action === "open_lead_form";

      if (shouldOpenAppointmentForm) {
        replaceAssistantMessage(APPOINTMENT_FORM_PROMPT);
        openAppointmentForm();
      }

      if (shouldOpenLeadForm) {
        setShowLeadForm(true);
        setPendingHandoffAfterLead(true);
      }

      if (shouldOpenHandoff) {
        setPendingHandoffAfterLead(false);
        setShowLeadForm(false);
        setHandoffActive(true);
        if (payload?.handoff_chat_id) {
          const isNewChat = payload.handoff_chat_id !== handoffChatId;
          setHandoffChatId(payload.handoff_chat_id);
          if (isNewChat) {
            setHandoffAfterId(0);
            handoffSeenIdsRef.current.clear();
            loadHandoffMessages(payload.handoff_chat_id, true);
          } else {
            loadHandoffMessages(payload.handoff_chat_id, false);
          }
        }
        if (payload?.handoff_status) {
          setHandoffStatus(payload.handoff_status);
        }
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

        const streamResponse = await chatAPI.current.sendMessageStream(
          text,
          activeSessionId,
          widgetId,
          shopDomain,
          customerId ? String(customerId) : undefined,
          controller.signal,
        );

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

        window.clearTimeout(timeoutId);
      } catch (streamError) {
        if (!receivedToken) {
          const response = await chatAPI.current.sendMessage(
            text,
            activeSessionId,
            widgetId,
            shopDomain,
            customerId ? String(customerId) : undefined,
          );

          const hasHandoffMeta = Boolean(
            response?.handoff_chat_id || response?.handoff_status,
          );
          const rawAssistantText =
            typeof response?.response === "string"
              ? response.response.trim()
              : "";
          if (!rawAssistantText && hasHandoffMeta && !response?.ui_action) {
            removeAssistantPlaceholder();
          } else {
            replaceAssistantMessage(
              rawAssistantText || "I could not generate a response right now.",
            );
          }
          applyUiAction(response);
        } else if (streamError instanceof Error && streamError.message.trim()) {
          console.warn(
            "Streaming ended after partial response:",
            streamError.message,
          );
        }
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

      if (!opts.skipLeadCaptureCheck) {
        try {
          const shouldCapture = await chatAPI.current.shouldCaptureLead(
            activeSessionId,
            widgetId,
          );
          if (
            shouldCapture &&
            !leadSubmitted &&
            !pendingHandoffAfterLead &&
            !handoffActive
          ) {
            const latestAssistant =
              [...messages].reverse().find((item) => item.role === "assistant")
                ?.content || "";
            setPendingHandoffAfterLead(
              assistantMessageOffersHandoff(latestAssistant),
            );
            setShowLeadForm(true);
          }
        } catch {
          // Ignore lead-capture check failures.
        }
      }
    } catch (error) {
      const detail =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "Sorry, something went wrong. Please try again.";
      replaceAssistantMessage(detail);
      setLastActivityAtMs(Date.now());
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSend = () => {
    sendMessage();
  };

  const handleLeadSubmit = async () => {
    if (leadSubmitting) return;
    const hasName = Boolean(leadForm.name.trim());
    const hasContact = Boolean(leadForm.email.trim() || leadForm.phone.trim());
    if (!hasName) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Please share your name so we can proceed with human handoff.",
        },
      ]);
      return;
    }
    if (!hasContact) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Please add an email or phone number so we can follow up.",
        },
      ]);
      return;
    }

    const missingRequiredField = extraContactFields.find(
      (field) => field.required && !String(leadCustomFields[field.key] || "").trim(),
    );
    if (missingRequiredField) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Please add ${missingRequiredField.label} so we can follow up properly.`,
        },
      ]);
      return;
    }

    const customFields = extraContactFields.reduce<Record<string, string>>(
      (fields, field) => {
        const value = String(leadCustomFields[field.key] || "").trim();
        if (value) fields[field.key] = value;
        return fields;
      },
      {},
    );

    setLeadSubmitting(true);
    try {
      const latestAssistant =
        [...messages].reverse().find((item) => item.role === "assistant")
          ?.content || "";
      const shouldAutoStartHandoff =
        pendingHandoffAfterLead ||
        assistantMessageOffersHandoff(latestAssistant);

      await chatAPI.current.submitLead({
        session_id: sessionId,
        widget_id: widgetId,
        name: leadForm.name.trim() || undefined,
        email: leadForm.email.trim() || undefined,
        phone: leadForm.phone.trim() || undefined,
        company: leadForm.company.trim() || undefined,
        custom_fields:
          Object.keys(customFields).length > 0
            ? JSON.stringify(customFields)
            : undefined,
      });

      setLeadSubmitted(true);
      setShowLeadForm(false);
      setLeadForm({ name: "", email: "", phone: "", company: "" });
      setLeadCustomFields({});

      if (shouldAutoStartHandoff) {
        setPendingHandoffAfterLead(false);
        setHandoffActive(true);
        setHandoffStatus("waiting_for_agent");
        setHandoffWaitCycle(1);
        setHandoffWaitingExpiresAt(
          new Date(Date.now() + handoffWaitTimeoutSeconds * 1000).toISOString(),
        );
        setHandoffNowMs(Date.now());
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

  const handleEmailSubmit = async () => {
    if (!emailValue.trim() || emailSending) return;
    setEmailSending(true);
    try {
      await chatAPI.current.emailConversation(
        sessionId,
        emailValue.trim(),
        widgetId,
      );
      setShowEmailForm(false);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Transcript sent to ${emailValue.trim()}.`,
        },
      ]);
      setEmailValue("");
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, failed to send the transcript. Please try again.",
        },
      ]);
    } finally {
      setEmailSending(false);
    }
  };

  const openAppointmentForm = () => {
    const defaults = getDefaultAppointmentDateTime();
    setAppointmentForm((prev) => ({
      name: prev.name || leadForm.name || "",
      email: prev.email || leadForm.email || "",
      phone: prev.phone || leadForm.phone || "",
      appointment_date: prev.appointment_date || defaults.date,
      appointment_time: prev.appointment_time || defaults.time,
    }));
    setAppointmentError("");
    setShowAppointmentForm(true);
  };

  const handleAppointmentSubmit = async () => {
    if (appointmentSubmitting) return;
    if (!appointmentForm.name.trim()) {
      setAppointmentError("Please enter your name.");
      return;
    }
    if (!appointmentForm.email.trim()) {
      setAppointmentError("Please enter your email.");
      return;
    }
    if (!appointmentForm.phone.trim()) {
      setAppointmentError("Please enter your mobile number.");
      return;
    }
    if (
      !appointmentForm.appointment_date ||
      !appointmentForm.appointment_time
    ) {
      setAppointmentError("Please select date/time.");
      return;
    }
    if (appointmentForm.appointment_date < getIstTodayDate()) {
      setAppointmentError("Please select today or a future date.");
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(appointmentForm.email.trim())) {
      setAppointmentError("Please enter a valid email.");
      return;
    }

    const phoneDigits = appointmentForm.phone.replace(/\D/g, "");
    if (phoneDigits.length < 8 || phoneDigits.length > 15) {
      setAppointmentError("Please enter a valid mobile number.");
      return;
    }

    const selectedDate = buildIstIsoDateTime(
      appointmentForm.appointment_date,
      appointmentForm.appointment_time,
    );
    if (Number.isNaN(selectedDate.getTime())) {
      setAppointmentError("Invalid date/time.");
      return;
    }

    setAppointmentSubmitting(true);
    setAppointmentError("");
    try {
      const result = await chatAPI.current.bookAppointment({
        session_id: sessionId,
        widget_id: widgetId,
        appointment_at: selectedDate.toISOString(),
        name: appointmentForm.name.trim(),
        email: appointmentForm.email.trim(),
        phone: appointmentForm.phone.trim(),
        timezone: IST_TIMEZONE,
      });

      setShowAppointmentForm(false);
      setAppointmentForm((prev) => ({
        ...prev,
        appointment_date: "",
        appointment_time: "",
      }));

      const istTimeLabel = new Intl.DateTimeFormat("en-IN", {
        timeZone: IST_TIMEZONE,
        dateStyle: "medium",
        timeStyle: "short",
      }).format(selectedDate);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            result?.message || `Appointment booked for ${istTimeLabel} (IST).`,
        },
      ]);
    } catch (err: any) {
      setAppointmentError(err?.message || "Failed to book appointment");
    } finally {
      setAppointmentSubmitting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleRequestVideoCall = async () => {
    if (!widgetId || callBusy || loading) return;
    setCallBusy(true);
    setCallError("");
    try {
      const data = await chatAPI.current.requestVideoCall(sessionId, widgetId);
      if (!data) {
        setCallError("Could not request video call right now.");
        return;
      }

      setHandoffChatId(data.chat_id || null);
      setHandoffStatus(data.status || null);
      setHandoffActive(
        data.status === "waiting_for_agent" || data.status === "assigned",
      );
      setCallStatus(data.call_status || "requested");
      setCallMode((data.call_mode as "video" | "audio") || "video");
      setCallRoomId(data.call_room_id || null);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Video call request sent. A live user will join shortly.",
        },
      ]);
      if (data.chat_id) {
        await loadHandoffMessages(data.chat_id, true);
      }
    } catch {
      setCallError("Could not request video call right now.");
    } finally {
      setCallBusy(false);
    }
  };

  const handleEndCall = async () => {
    if (!widgetId || callBusy || callStatus === "none") return;
    setCallBusy(true);
    setCallError("");
    try {
      const data = await chatAPI.current.endHandoffCall(sessionId, widgetId);
      if (!data) {
        setCallError("Could not end call right now.");
        return;
      }
      setCallStatus(data.call_status || "ended");
      setCallMode((data.call_mode as "video" | "audio") || callMode);
      setCallRoomId(data.call_room_id || callRoomId);
    } catch {
      setCallError("Could not end call right now.");
    } finally {
      setCallBusy(false);
    }
  };

  const handleJoinCall = () => {
    if (!callRoomId) return;
    window.open(
      getMeetingUrl(callRoomId, callMode),
      "_blank",
      "noopener,noreferrer",
    );
  };

  const basePositionMap: Record<string, React.CSSProperties> = {
    "bottom-left": { left: 0, bottom: 0 },
    "bottom-right": { right: 0, bottom: 0 },
    "top-left": { left: 0, top: 0 },
    "top-right": { right: 0, top: 0 },
  };
  const launcherPositionSx = {
    ...basePositionMap[position],
    bottom: position.includes("bottom") ? 24 : undefined,
    top: position.includes("top") ? 24 : undefined,
    left: position.includes("left") ? 24 : undefined,
    right: position.includes("right") ? 24 : undefined,
  };

  const panelPositionMap: Record<string, React.CSSProperties> = {
    "bottom-left": { left: 16, bottom: 16 },
    "bottom-right": { right: 16, bottom: 16 },
    "top-left": { left: 16, top: 16 },
    "top-right": { right: 16, top: 16 },
  };

  const panelPositionSx =
    panelPositionMap[position] || panelPositionMap["bottom-right"];

  const isLeftPosition = position.includes("left");

  return (
    <div
      className={`chatbot-widget-container ${position}${darkMode ? " dark" : ""}`}
      style={
        {
          "--primary-color": primaryColor,
          "--secondary-color": secondaryColor,
        } as React.CSSProperties
      }
    >
      {!isOpen && (
        <div
          className="chat-launcher-wrap"
          style={{
            position: "fixed",
            ...launcherPositionSx,
            zIndex: 1200,
            display: "flex",
            alignItems: "center",
            gap: 9,
            flexDirection: isLeftPosition ? "row-reverse" : "row",
          }}
        >
          {showLauncherTeaser && (
            <div
              className="chat-launcher-teaser"
              onClick={() => setIsOpen(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setIsOpen(true);
                }
              }}
            >
              <button
                type="button"
                className="chat-launcher-teaser-close"
                aria-label="Dismiss greeting"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLauncherTeaser(false);
                }}
                style={{
                  background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                  boxShadow: `0 4px 10px ${primaryColor}59`,
                }}
              >
                <CloseIcon size={14} />
              </button>
              <div className="chat-launcher-teaser-text">
                Hey! I am {"your AI assistant"}.
              </div>
            </div>
          )}
          <button
            onClick={() => setIsOpen(true)}
            className="chat-launcher"
            style={{
              background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
            }}
          >
            <div className="icon-wrapper">
              <ChatBubbleIcon />
              <span className="badge" style={{ color: primaryColor }}>
                Z
              </span>
            </div>
          </button>
        </div>
      )}

      {isOpen && (
        <div
          ref={chatPanelRef}
          className={`chatbot-widget-window ${darkMode ? "dark" : ""}`}
          style={{
            position: "fixed",
            ...panelPositionSx,
            width: window.innerWidth < 600 ? "calc(100vw - 32px)" : 400,
            height: window.innerWidth < 600 ? "66vh" : 600,
            borderRadius: 16,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            zIndex: 1300,
            backgroundColor: darkMode ? "#111827" : "#ffffff",
            boxShadow: darkMode
              ? "0 24px 54px rgba(2,6,23,0.5)"
              : "0 28px 62px rgba(15,23,42,0.34)",
            backdropFilter: "blur(8px)",
            fontFamily: "inherit",
            border: darkMode
              ? "1px solid rgba(148,163,184,0.22)"
              : "1px solid #cbd5e1",
          }}
        >
          <div
            className="chatbot-widget-header"
            style={{
              background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
              color: headerFontColor,
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 14.7,
                fontWeight: 800,
                letterSpacing: "0.01em",
                color: "inherit",
              }}
            >
              {name} Assistant
            </h3>
            <div className="chatbot-widget-header-actions">
              <button
                className="chatbot-widget-header-btn"
                onClick={resetChat}
                title="New chat"
                aria-label="New chat"
              >
                <RefreshIcon />
              </button>
              {/* <button className="chatbot-widget-header-btn" onClick={() => setShowEmailForm((v) => !v)} title="Email this conversation" aria-label="Email conversation">
                <EmailIcon />
              </button> */}
              <button
                className="chatbot-widget-header-btn"
                onClick={openAppointmentForm}
                title="Book appointment"
                aria-label="Book appointment"
              >
                <CalendarIcon />
              </button>
              <button
                className="chatbot-widget-header-btn"
                onClick={() => setDarkMode((d) => !d)}
                title={darkMode ? "Light mode" : "Dark mode"}
                aria-label={
                  darkMode ? "Switch to light mode" : "Switch to dark mode"
                }
              >
                {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
              </button>
              <button
                className="chatbot-widget-header-btn"
                onClick={() => setIsOpen(false)}
                title="Minimize chat"
                aria-label="Minimize chat"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          {handoffActive && (
            <div className="chatbot-handoff-slider">
              <button
                type="button"
                className="chatbot-handoff-slider-toggle"
                onClick={() => setHandoffPanelExpanded((prev) => !prev)}
                aria-expanded={handoffPanelExpanded}
                aria-controls="chatbot-handoff-slider-panel"
              >
                <span className="chatbot-handoff-slider-toggle-main">
                  <span className="chatbot-handoff-title">
                    Human handoff in progress
                  </span>
                  <span
                    className={`chatbot-handoff-chip ${handoffStatus === "assigned" ? "assigned" : "waiting"}`}
                  >
                    {handoffStatus === "assigned"
                      ? "Agent assigned"
                      : "Waiting for agent"}
                  </span>
                </span>
                <span className="chatbot-handoff-slider-chevron" aria-hidden="true">
                  <ChevronIcon expanded={handoffPanelExpanded} />
                </span>
              </button>
              <div
                id="chatbot-handoff-slider-panel"
                className={`chatbot-handoff-slider-panel${handoffPanelExpanded ? " open" : ""}`}
              >
                <div className="chatbot-handoff-slider-panel-inner">
                  <div className="chatbot-handoff-subtitle">
                    Keep chatting here. Your messages are routed to live support
                    while handoff is active.
                  </div>
                  {handoffCountdownText ? (
                    <div className="chatbot-handoff-countdown">
                      {handoffCountdownText}
                    </div>
                  ) : null}
                  {handoffStatus === "waiting_for_agent" &&
                  typeof handoffProgressPercent === "number" ? (
                    <div className="chatbot-handoff-timer-graphic">
                      <div className="chatbot-handoff-timer-row">
                        <span className="chatbot-handoff-timer-seconds">
                          {Math.max(
                            0,
                            handoffRemainingSeconds ?? handoffWaitTimeoutSeconds,
                          )}{" "}
                          sec
                        </span>
                        <span className="chatbot-handoff-timer-scale">{`${handoffWaitTimeoutSeconds} sec -> 0 sec`}</span>
                      </div>
                      <div className="chatbot-handoff-progress-track">
                        <div
                          className="chatbot-handoff-progress-fill"
                          style={{ width: `${handoffProgressPercent}%` }}
                        />
                      </div>
                    </div>
                  ) : null}
                  {handoffError ? (
                    <div className="chatbot-handoff-error">{handoffError}</div>
                  ) : null}
                  {callError ? (
                    <div className="chatbot-handoff-error">{callError}</div>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          <div className="chatbot-widget-messages">
            {showSuggestions &&
              (suggestionsLoading || suggestedQuestions.length > 0) && (
                <div className="chatbot-suggestions">
                  <div className="chatbot-suggestions-title">Try asking</div>
                  <div className="chatbot-suggestions-list">
                    {suggestionsLoading && (
                      <div className="chatbot-suggestions-loading">
                        Loading suggestions...
                      </div>
                    )}
                    {!suggestionsLoading &&
                      suggestedQuestions.map((item, index) => (
                        <button
                          key={`${item.question}-${index}`}
                          type="button"
                          className="chatbot-suggestion-chip"
                          onClick={() => handleQuickQuestion(item)}
                        >
                          {item.question}
                        </button>
                      ))}
                  </div>
                </div>
              )}

            {messages.map((message, index) => {
              const isPendingAssistantMessage =
                message.role === "assistant" &&
                loading &&
                index === messages.length - 1 &&
                !message.content.trim();

              return (
                <div
                  key={index}
                  className={`chatbot-message ${message.role} chatbot-fade-in`}
                >
                  {message.role === "assistant" && (
                    <div className="chatbot-message-avatar assistant">
                      {botIconGlyph}
                    </div>
                  )}
                  <div
                    className={`chatbot-message-bubble${isPendingAssistantMessage ? " chatbot-typing-bubble" : ""}`}
                  >
                    {isPendingAssistantMessage ? (
                      <TypingDots />
                    ) : (
                      renderMessageContent(message.content, `msg-${index}`)
                    )}
                  </div>
                  {message.role === "user" && (
                    <div className="chatbot-message-avatar user">
                      {userIconGlyph}
                    </div>
                  )}
                </div>
              );
            })}

            {showAppointmentForm && (
              <div className="chatbot-message assistant chatbot-fade-in">
                <div className="chatbot-message-avatar assistant">
                  {botIconGlyph}
                </div>
                <div className="chatbot-message-bubble chatbot-appointment-bubble">
                  <div className="chatbot-appointment-title">
                    Set up your meeting
                  </div>
                  <div className="chatbot-appointment-subtitle">
                    Please fill this short form and I will set the meeting for
                    you.
                  </div>

                  {appointmentError && (
                    <div className="chatbot-appointment-error" role="alert">
                      {appointmentError}
                    </div>
                  )}

                  <div className="chatbot-appointment-fields">
                    <input
                      type="text"
                      className="chatbot-appointment-input"
                      placeholder="Full name"
                      value={appointmentForm.name}
                      onChange={(e) =>
                        setAppointmentForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                    />

                    <input
                      type="email"
                      className="chatbot-appointment-input"
                      placeholder="Email address"
                      value={appointmentForm.email}
                      onChange={(e) =>
                        setAppointmentForm((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                    />

                    <input
                      type="tel"
                      className="chatbot-appointment-input"
                      placeholder="Mobile number"
                      value={appointmentForm.phone}
                      onChange={(e) =>
                        setAppointmentForm((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
                    />

                    <div className="chatbot-appointment-grid">
                      <label className="chatbot-appointment-field">
                        <span className="chatbot-appointment-label">
                          Date (IST)
                        </span>
                        <input
                          type="date"
                          className="chatbot-appointment-input"
                          min={getIstTodayDate()}
                          value={appointmentForm.appointment_date}
                          onChange={(e) =>
                            setAppointmentForm((prev) => ({
                              ...prev,
                              appointment_date: e.target.value,
                            }))
                          }
                        />
                      </label>

                      <label className="chatbot-appointment-field">
                        <span className="chatbot-appointment-label">
                          Time (IST)
                        </span>
                        <input
                          type="time"
                          className="chatbot-appointment-input"
                          value={appointmentForm.appointment_time}
                          onChange={(e) =>
                            setAppointmentForm((prev) => ({
                              ...prev,
                              appointment_time: e.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>

                    <div className="chatbot-appointment-actions">
                      <button
                        className="chatbot-appointment-button primary"
                        onClick={handleAppointmentSubmit}
                        disabled={appointmentSubmitting}
                        style={{
                          background: `linear-gradient(120deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                        }}
                      >
                        {appointmentSubmitting
                          ? "Creating..."
                          : "Create meeting"}
                      </button>
                      <button
                        className="chatbot-appointment-button outlined"
                        onClick={() => setShowAppointmentForm(false)}
                        disabled={appointmentSubmitting}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {showLeadForm && (
              <div className="chatbot-message assistant chatbot-fade-in">
                <div className="chatbot-message-avatar assistant">
                  {botIconGlyph}
                </div>
                <div className="chatbot-message-bubble chatbot-lead-bubble">
                  <div className="chatbot-inline-title chatbot-lead-title">
                    Quick contact form
                  </div>
                  <div className="chatbot-lead-subtitle">
                    Small details now help us connect you faster with live
                    support.
                  </div>
                  <input
                    type="text"
                    className="chatbot-inline-input chatbot-lead-input"
                    placeholder="Name"
                    value={leadForm.name}
                    onChange={(e) =>
                      setLeadForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                  />
                  <input
                    type="email"
                    className="chatbot-inline-input chatbot-lead-input"
                    placeholder="Email"
                    value={leadForm.email}
                    onChange={(e) =>
                      setLeadForm((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="tel"
                    className="chatbot-inline-input chatbot-lead-input"
                    placeholder="Phone"
                    value={leadForm.phone}
                    onChange={(e) =>
                      setLeadForm((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="text"
                    className="chatbot-inline-input chatbot-lead-input"
                    placeholder="Company"
                    value={leadForm.company}
                    onChange={(e) =>
                      setLeadForm((prev) => ({
                        ...prev,
                        company: e.target.value,
                      }))
                    }
                  />
                  {extraContactFields.map((field) => (
                    <input
                      key={field.key}
                      type={field.type || "text"}
                      className="chatbot-inline-input chatbot-lead-input"
                      placeholder={`${field.label}${field.required ? " *" : ""}`}
                      value={leadCustomFields[field.key] || ""}
                      onChange={(e) =>
                        setLeadCustomFields((prev) => ({
                          ...prev,
                          [field.key]: e.target.value,
                        }))
                      }
                    />
                  ))}
                  <div className="chatbot-inline-actions">
                    <button
                      className="chatbot-inline-button"
                      onClick={handleLeadSubmit}
                      disabled={leadSubmitting}
                      style={{
                        background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                      }}
                    >
                      {leadSubmitting ? "Submitting..." : "Submit"}
                    </button>
                    <button
                      className="chatbot-inline-button secondary"
                      onClick={() => setShowLeadForm(false)}
                      disabled={leadSubmitting}
                    >
                      Later
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {!showLeadForm && (
            <>
              <div className="chatbot-widget-input-container">
                <div className="chatbot-widget-input-shell">
                  <input
                    type="text"
                    className="chatbot-widget-input"
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      setLastActivityAtMs(Date.now());
                    }}
                    onKeyDown={handleKeyPress}
                    placeholder={
                      sessionClosedByInactivity
                        ? "Session closed due to inactivity. Type a message to start a new session..."
                        : "Type your message..."
                    }
                    disabled={loading}
                    ref={inputRef}
                  />
                </div>
                <button
                  className="chatbot-widget-send"
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  aria-label="Send message"
                  style={{
                    background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                  }}
                >
                  <SendIcon />
                </button>
              </div>
              {typeof inactivityRemainingSeconds === "number" ? (
                <div
                  className={`chatbot-inactivity-countdown${inactivityRemainingSeconds <= 15 ? " warning" : ""}`}
                >
                  Session auto-closes in{" "}
                  {formatCountdownSeconds(inactivityRemainingSeconds)} if no
                  activity.
                </div>
              ) : null}
            </>
          )}

          {/* {showEmailForm && (
            <div className="chatbot-inline-card chatbot-fade-in">
              <div className="chatbot-inline-title">Email Conversation</div>
              <input
                type="email"
                className="chatbot-inline-input"
                placeholder="you@example.com"
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
              />
              <div className="chatbot-inline-actions">
                <button
                  className="chatbot-inline-button"
                  onClick={handleEmailSubmit}
                  disabled={emailSending || !emailValue.trim()}
                  style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
                >
                  {emailSending ? 'Sending...' : 'Send'}
                </button>
                <button
                  className="chatbot-inline-button secondary"
                  onClick={() => setShowEmailForm(false)}
                  disabled={emailSending}
                >
                  Cancel
                </button>
              </div>
            </div>
          )} */}

          <div className="chatbot-widget-footer">
            Powered by{" "}
            <a
              href="https://zentrixel.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="chatbot-widget-footer-link"
            >
              zentrixel.com
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
