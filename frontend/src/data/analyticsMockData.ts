export const summaryStats = {
    totalCalls: 3210,
    successfulCalls: 1870,
    pickupRate: 58,
    conversionRate: 7.6,
    activeCampaigns: 5,
    duration: "12h 20m"
};

export const callVolumeTimeline = [
    { hour: "09:00", calls: 120 },
    { hour: "10:00", calls: 210 },
    { hour: "11:00", calls: 320 },
    { hour: "12:00", calls: 280 },
    { hour: "13:00", calls: 260 },
    { hour: "14:00", calls: 310 },
    { hour: "15:00", calls: 340 },
    { hour: "16:00", calls: 290 },
    { hour: "17:00", calls: 230 }
];

export const liveCalls = [
    {
        id: 1,
        contact: "Rohit Patil",
        phone: "+91 9989821211",
        campaign: "Real Estate Leads",
        duration: "02:15"
    },
    {
        id: 2,
        contact: "Priya Mehta",
        phone: "+91 9812345678",
        campaign: "Insurance Renewal",
        duration: "01:40"
    },
    {
        id: 3,
        contact: "Amit Sharma",
        phone: "+91 9876543210",
        campaign: "Loan Follow-up",
        duration: "00:55"
    }
];

export const pickupTrend = [
    { day: "Mon", rate: 52 },
    { day: "Tue", rate: 55 },
    { day: "Wed", rate: 58 },
    { day: "Thu", rate: 61 },
    { day: "Fri", rate: 59 },
    { day: "Sat", rate: 64 },
    { day: "Sun", rate: 57 }
];

export const callOutcomes = [
    { name: "Answered", value: 1870 },
    { name: "No Answer", value: 890 },
    { name: "Busy", value: 310 },
    { name: "Voicemail", value: 140 }
];

export const intentDistribution = [
    { intent: "Interested", value: 620 },
    { intent: "Not Interested", value: 430 },
    { intent: "Call Back Later", value: 300 },
    { intent: "Wrong Number", value: 90 }
];

export const campaignPerformance = [
    {
        campaign: "Real Estate Leads",
        calls: 1200,
        answered: 740,
        conversions: 85
    },
    {
        campaign: "Insurance Renewal",
        calls: 800,
        answered: 450,
        conversions: 60
    },
    {
        campaign: "Loan Follow-up",
        calls: 650,
        answered: 320,
        conversions: 42
    }
];