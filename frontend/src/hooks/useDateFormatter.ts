import { useAuth } from "../context/AuthContext";
import { formatDate, formatDateTime, formatTime } from "../utils/dateUtils";

export const useDateFormatter = () => {
    const { user } = useAuth();
    return (date?: string | Date | null) => formatDateTime(date, user?.timezone || "Asia/Kolkata");
};

export const useOnlyDateFormatter = () => {
    const { user } = useAuth();
    return (date?: string | Date | null) => formatDate(date);
};

export const useTimeFormatter = () => {
    const { user } = useAuth();

    return (date?: string | Date | null) =>
        formatTime(date, user?.timezone || "Asia/Kolkata");
};