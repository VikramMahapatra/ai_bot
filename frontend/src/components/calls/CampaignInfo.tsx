import { Grid, TextField, Button, MenuItem } from "@mui/material";

interface CampaignInfoProps {
    nextStep: () => void;
}

const CampaignInfo = ({ nextStep }: CampaignInfoProps) => {

    return (
        <Grid container spacing={3}>

            <Grid item xs={12}>
                <TextField
                    label="Campaign Name"
                    fullWidth
                />
            </Grid>

            <Grid item xs={12}>
                <TextField
                    label="Description"
                    multiline
                    rows={4}
                    fullWidth
                />
            </Grid>

            <Grid item xs={6}>
                <TextField
                    label="Category"
                    select
                    fullWidth
                >
                    <MenuItem value="sales">Sales Outreach</MenuItem>
                    <MenuItem value="support">Support</MenuItem>
                </TextField>
            </Grid>

            <Grid item xs={6}>
                <TextField
                    label="Priority"
                    select
                    fullWidth
                >
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                </TextField>
            </Grid>

            <Grid item xs={12} textAlign="right">
                <Button
                    variant="contained"
                    onClick={nextStep}
                >
                    Continue
                </Button>
            </Grid>

        </Grid>
    );
};

export default CampaignInfo;