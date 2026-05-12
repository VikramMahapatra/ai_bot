// src/utils/dateUtils.ts

export const parseDate = (date?: string | Date): Date | null => {
    if (!date) return null;
    return typeof date === "string" ? new Date(date) : date;
};

export const formatDate = (date?: string | Date): string => {
    const d = parseDate(date);
    if (!d) return "-";

    return d.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};

export const formatDateTime = (
    date?: string | Date | null,
    timeZone: string = "Asia/Kolkata"
): string => {
    if (!date) return '-';

    const d = parseDate(date);
    if (!d) return "-";

    return new Intl.DateTimeFormat("en-IN", {
        timeZone,
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(d);
};


export const formatTime = (
    value?: string | Date | null,
    timeZone: string = "Asia/Kolkata"
): string => {
    if (!value) return "-";

    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return "-";

    return new Intl.DateTimeFormat("en-IN", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: true, // optional (AM/PM)
    }).format(dt);
};