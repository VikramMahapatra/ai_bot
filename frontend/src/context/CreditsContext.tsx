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
    consumeCredits: (feature_code: string, referenceType: string, referenceId: string, actual_quantity: number) => Promise<void>;
    deductCredits: (feature_code: string, quantity: number, referenceType?: string, referenceId?: string) => Promise<void>;
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

            const total = data.monthly_summary?.remaining || 0;

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

    const deductCredits = async (
        feature_code: string,
        quantity: number,
        referenceType?: string,
        referenceId?: string
    ) => {

        try {

            const success = await organizationCreditService.deductCredits(
                feature_code,
                quantity,
                referenceType,
                referenceId
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

    const consumeCredits = async (
        feature_code: string,
        referenceType: string,
        referenceId: string,
        actual_quantity: number
    ) => {

        try {

            const success = await organizationCreditService.consumeCredits(
                feature_code,
                referenceType,
                referenceId,
                actual_quantity
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
                deductCredits
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

