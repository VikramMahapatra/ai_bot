import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    ReactNode,
} from "react";
import axios from "axios";
import { CreditItem, CreditMonthlySummary, organizationCreditService, PriceMatrixItem } from "../services/organizationCreditService";

// Types
type CreditInfo = {
    creditsPerUnit: number;
    minReservedCredits?: number;
};

export const CREDIT_ERRORS = {
    INSUFFICIENT_CREDITS: "Insufficient credit. Please add more credits to continue.",
    BELOW_MIN_RESERVED: "You don’t have enough credits to start this campaign. Please add more credits to continue.",
    RESERVE_FAILED: "Unable to reserve credits. Please try again.",
    CONSUME_FAILED: "Unable to consume credits. Please try again.",
    FETCH_FAILED: "Unable to fetch credit details.",
    GENERIC: "Something went wrong with credit validation."
};


interface CreditsContextType {
    credits: CreditItem[];
    creditMonthlySummary: CreditMonthlySummary | null;
    priceMatrix: PriceMatrixItem[];
    totalCredits: number;
    loading: boolean;
    refreshCredits: () => Promise<void>;
    getRequiredCredits: (featureCode: string) => number;
    getRequiredCreditInfo: (featureCode: string) => CreditInfo;
    reserveCredits: (feature_code: string, referenceType: string, referenceId: string, requiredCredits: number) => Promise<void>;
    consumeCredits: (feature_code: string, referenceType: string, referenceId: string, quantity: number) => Promise<void>;
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
    const [creditMonthlySummary, setCreditMonthlySummary] = useState<CreditMonthlySummary | null>(null);
    const [totalCredits, setTotalCredits] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(false);
    const [priceMatrix, setPriceMatrix] = useState<PriceMatrixItem[]>([]);

    const fetchCredits = useCallback(async () => {
        try {
            setLoading(true);

            const data = await organizationCreditService.getOrgCredits();

            setCredits(data.credits || []);
            setCreditMonthlySummary(data.monthly_summary || {})
            setPriceMatrix(data.price_matrix || [])

            const total = (data.credits || []).reduce(
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

    const getRequiredCreditInfo = useCallback(
        (featureCode: string) => {

            const item = priceMatrix.find(
                p => p.feature_code === featureCode
            );

            return {
                creditsPerUnit: item?.credits_per_unit || 1,
                minReservedCredits: item?.min_reserved_credits || 0
            };
        },
        [priceMatrix]
    );


    const getRequiredCredits = useCallback(
        (featureCode: string) => {
            return getRequiredCreditInfo(featureCode).creditsPerUnit;
        },
        [getRequiredCreditInfo]
    );

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

    return (
        <CreditsContext.Provider
            value={{
                credits,
                creditMonthlySummary,
                priceMatrix,
                totalCredits,
                loading,
                refreshCredits: fetchCredits,
                getRequiredCredits,
                getRequiredCreditInfo,
                reserveCredits,
                consumeCredits,
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

