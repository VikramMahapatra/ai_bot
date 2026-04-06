import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    ReactNode,
} from "react";
import axios from "axios";
import { organizationCreditService } from "../services/organizationCreditService";

// Types
export interface CreditItem {
    feature_code: string;
    allocated: number;
    used: number;
    remaining: number;
}

interface CreditsContextType {
    credits: CreditItem[];
    totalCredits: number;
    loading: boolean;
    refreshCredits: () => Promise<void>;
    reserveCredits: (feature_code: string, referenceType: string, referenceId: string, requiredCredits: number) => Promise<void>;
    consumeCredits: (feature_code: string, referenceType: string, referenceId: string, quantity: number) => Promise<void>;
    useCreditAction: (feature_code: string, requiredCredits: number) => Promise<boolean>;
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

            const data = await organizationCreditService.getOrgCredits();

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

    const reserveCredits = async (
        featureCode: string,
        referenceType: string,
        referenceId: string,
        quantity: number
    ) => {

        const credit = credits.find(c => c.feature_code === featureCode);

        // Quick frontend validation
        if (!credit || credit.remaining < quantity) {
            return false;
        }

        try {
            const success = await organizationCreditService.reserveCredits(
                featureCode,
                referenceType,
                referenceId,
                quantity
            );

            if (success) {
                await fetchCredits();
            }

            return success;

        } catch (err) {
            console.error("Reserve credits failed", err);
            return false;
        }
    };

    const consumeCredits = async (
        feature_code: string,
        referenceType: string,
        referenceId: string,
        quantity: number
    ) => {

        try {

            const success = await organizationCreditService.consumeCredits(
                feature_code,
                referenceType,
                referenceId,
                quantity
            );

            if (success) {
                await fetchCredits();
            }

            return success;

        } catch (err) {
            console.error("Consume credits failed", err);
            return false;
        }
    };

    const useCreditAction = async (
        featureCode: string,
        quantity: number
    ) => {

        const credit = credits.find(c => c.feature_code === featureCode);

        if (!credit || credit.remaining < quantity) {
            return false;
        }

        try {
            const success = await organizationCreditService.deductCredits(
                featureCode,
                quantity
            );

            if (success) {
                await fetchCredits();
            }

            return success;

        } catch (err) {
            console.error("Credit deduction failed", err);
            return false;
        }
    };
    return (
        <CreditsContext.Provider
            value={{
                credits,
                totalCredits,
                loading,
                refreshCredits: fetchCredits,
                reserveCredits,
                consumeCredits,
                useCreditAction
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

