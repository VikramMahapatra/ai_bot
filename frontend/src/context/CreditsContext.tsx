import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    ReactNode,
} from "react";
import axios from "axios";
import { organizationService } from "../services/organizationService";

// Types
export interface CreditItem {
    module: string;
    sub_module?: string;
    allocated: number;
    used: number;
    remaining: number;
}

interface CreditsContextType {
    credits: CreditItem[];
    totalCredits: number;
    loading: boolean;
    refreshCredits: () => Promise<void>;
}

// Context
const CreditsContext = createContext<CreditsContextType | undefined>(undefined);

// Provider Props
interface CreditsProviderProps {
    children: ReactNode;
}

// Provider
export const CreditsProvider: React.FC<CreditsProviderProps> = ({ children }) => {
    const [credits, setCredits] = useState<CreditItem[]>([]);
    const [totalCredits, setTotalCredits] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(false);

    const fetchCredits = useCallback(async () => {
        try {
            setLoading(true);

            const data = await organizationService.getOrgCredits();

            setCredits(data);

            const total = data.reduce(
                (sum: number, item: CreditItem) => sum + (item.remaining || 0),
                0
            );

            setTotalCredits(total);

        } catch (error) {
            console.error("Failed to fetch credits", error);
        } finally {
            setLoading(false);
        }

    }, []);

    useEffect(() => {
        fetchCredits();
    }, [fetchCredits]);

    return (
        <CreditsContext.Provider
            value={{
                credits,
                totalCredits,
                loading,
                refreshCredits: fetchCredits,
            }}
        >
            {children}
        </CreditsContext.Provider>
    );
};

// Hook
export const useCredits = (): CreditsContextType => {
    const context = useContext(CreditsContext);

    if (!context) {
        throw new Error("useCredits must be used within CreditsProvider");
    }

    return context;
};
