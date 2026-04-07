// src/constants/creditModules.ts
export const CREDIT_MODULES = {
    CHATBOT: {
        WEBSITE: "Website Chatbot",
        WHATSAPP: "WhatsApp Chatbot",
    },
    VIDEO_CALL: {
        WEBSITE_CHATBOT: "Video Calling on Website Chatbot",
    },
    CALLBOT: {
        INBOUND: "Call Attempts (Inbound)",
        OUTBOUND: "Call Attempts (Outbound)",
        INBOUND_MINUTES: "Call per Mins (Inbound)",
        OUTBOUND_MINUTES: "Call per Mins (Outbound)",
        INBOUND_AGENT: "Inbound Agent",
        OUTBOUND_AGENT: "Outbound Agent",
    },
    CAMPAIGN: {
        MODULE: "Campaign Module",
        EMAIL: "Email Sends",
        SMS: "SMS Sends",
        WHATSAPP: "WhatsApp",
        CREATION: "Campaign Creation",
        AI_SPAM: "AI Spam Checker",
        AI_CONTENT: "AI Campaign Content Generation",
    },
    APPOINTMENT: {
        BOOKING: "Booking",
    },
    AI_ENGINE: {
        SENTIMENT_ANALYSIS: "Sentiment Analysis",
    },
    LEAD_ENGINE: {
        LEAD_GENERATION: "Lead Generation",
    },
    KNOWLEDGE: {
        DOCUMENT_UPLOAD: "Website Crawling / Document Upload",
        STORAGE: "Storage",
    },
    PLATFORM_ACCESS: {
        USERS: "Users",
    },
    HANDOFF: {
        HUMAN_ESCALATION: "Human Escalation",
    },
    CALL_FORWARDING: {
        MODULE: "Call Forwarding",
    },
    DATA_RETENTION: {
        CHAT_LOGS: "Chat Logs",
        CALL_LOGS: "Call Logs",
    },
    ANALYTICS: {
        ADVANCED: "Advanced Analytics",
        REPORTS: "Advanced Reports",
    },
};

export const FEATURE_CODES = {
    CORE_CHATBOT_WEB_MESSAGE: "CORE_CHATBOT_WEB_MESSAGE",
    CORE_CHATBOT_WA_MESSAGE: "CORE_CHATBOT_WA_MESSAGE",
    CORE_VIDEO_SESSION_MINUTE: "CORE_VIDEO_SESSION_MINUTE",
    CORE_CALL_IN_ATTEMPT: "CORE_CALL_IN_ATTEMPT",
    CORE_CALL_OUT_ATTEMPT: "CORE_CALL_OUT_ATTEMPT",
    CORE_CALL_IN_MINUTE: "CORE_CALL_IN_MINUTE",
    CORE_CALL_OUT_MINUTE: "CORE_CALL_OUT_MINUTE",
    CORE_CALL_AGENT_IN: "CORE_CALL_AGENT_IN",
    CORE_CALL_AGENT_OUT: "CORE_CALL_AGENT_OUT",
    CMP_MODULE_ACCESS: "CMP_MODULE_ACCESS",
    CMP_EMAIL_SEND: "CMP_EMAIL_SEND",
    CMP_SMS_SEGMENT: "CMP_SMS_SEGMENT",
    CMP_WA_CONVERSATION: "CMP_WA_CONVERSATION",
    CMP_CREATE: "CMP_CREATE",
    CMP_AI_SPAM_CHECK: "CMP_AI_SPAM_CHECK",
    CMP_AI_CONTENT_GEN: "CMP_AI_CONTENT_GEN",
    AI_BOOKING: "AI_BOOKING",
    AI_SENTIMENT: "AI_SENTIMENT",
    AI_LEAD_GEN: "AI_LEAD_GEN",
    KB_CHUNK: "KB_CHUNK",
    KB_STORAGE_MB: "KB_STORAGE_MB",
    PLATFORM_USER: "PLATFORM_USER",
    COMM_ESCALATION: "COMM_ESCALATION",
    COMM_CALL_FORWARD: "COMM_CALL_FORWARD",
    DATA_CHAT_LOG_GB_MONTH: "DATA_CHAT_LOG_GB_MONTH",
    DATA_CALL_LOG_GB_MONTH: "DATA_CALL_LOG_GB_MONTH",
    ANALYTICS_ADVANCED: "ANALYTICS_ADVANCED",
    ANALYTICS_REPORT: "ANALYTICS_REPORT"
} as const;
