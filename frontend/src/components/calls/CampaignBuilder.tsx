import { useState } from "react";
import {
    Box,
    Paper,
    Typography,
    Stepper,
    Step,
    StepLabel,
    Button,
} from "@mui/material";

import CampaignInfo from "./CampaignInfo";
import Contacts from "./Contacts";
import Schedule from "./Schedule";
import CampaignList from "./CampaignList";

const steps = [
    "Campaign Info",
    "Contacts",
    "Schedule"
];

const CampaignBuilder = () => {
    const [view, setView] = useState<"list" | "form">("list");
    const [activeStep, setActiveStep] = useState(0);

    const nextStep = () => setActiveStep((prev) => prev + 1);
    const prevStep = () => setActiveStep((prev) => prev - 1);

    const handleAddCampaign = () => {
        setView("form");
        setActiveStep(0);
    };

    const handleBackToList = () => {
        setView("list");
    };

    const renderStep = () => {
        switch (activeStep) {
            case 0:
                return <CampaignInfo nextStep={nextStep} />;
            case 1:
                return <Contacts nextStep={nextStep} prevStep={prevStep} />;
            case 2:
                return <Schedule prevStep={prevStep} />;
            default:
                return null;
        }
    };

    if (view === "list") {
        return (
            <CampaignList onAddCampaign={handleAddCampaign} />
        );
    }

    return (
        <Paper sx={{ p: 4 }}>
            <Box display="flex" justifyContent="space-between" mb={2}>
                <Typography variant="h5">
                    Create Campaign
                </Typography>

                <Button variant="outlined" onClick={handleBackToList}>
                    Cancel
                </Button>
            </Box>

            <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                {steps.map((label) => (
                    <Step key={label}>
                        <StepLabel>{label}</StepLabel>
                    </Step>
                ))}
            </Stepper>

            <Box>
                {renderStep()}
            </Box>
        </Paper>
    );
};

export default CampaignBuilder;