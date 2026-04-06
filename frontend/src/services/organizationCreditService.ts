import api from './api';



export const organizationCreditService = {

    async getOrgCredits() {
        const res = await api.get("/api/organizations/credits/summary");
        return res.data;
    },

    async validateCredits(feature_code: string) {
        const res = await api.get("/api/organizations/credits/validate", {
            params: {
                feature_code
            }
        });
        return res.data;
    },

    async deductCredits(feature_code: string, requiredCredits: number) {
        const res = await api.post("/api/organizations/credits/deduct", {
            feature_code,
            required_credits: requiredCredits
        });
        return res.data;
    },

    async reserveCredits(feature_code: string, referenceType: string, referenceId: string, requiredCredits: number) {
        const res = await api.post("/api/organizations/credits/reserve", {
            feature_code,
            reference_type: referenceType,
            reference_id: referenceId,
            required_credits: requiredCredits
        });
        return res.data;
    },

    async consumeCredits(feature_code: string, referenceType: string, referenceId: string, actual_quantity: number) {
        const res = await api.post("/api/organizations/credits/consume", {
            feature_code,
            reference_type: referenceType,
            reference_id: referenceId,
            actual_quantity
        });
        return res.data;
    },
};
