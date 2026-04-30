import { useAuth } from "../context/AuthContext";
import { formatDateTime } from "../utils/dateUtils";

export const useDateFormatter = () => {
    const { user } = useAuth();
    return (date?: string | Date) => formatDateTime(date, user?.timezone || "Asia/Kolkata");
};