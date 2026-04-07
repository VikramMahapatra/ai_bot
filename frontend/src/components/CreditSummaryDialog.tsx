import {
    Dialog,
    DialogTitle,
    DialogContent,
    Typography,
    Box,
    Grid,
    Divider,
    Chip
} from "@mui/material";

const CreditSummaryDialog = ({
    open,
    onClose,
    credits,
    monthlySummary
}: any) => {

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
        >
            <DialogTitle>
                Credit Summary — {monthlySummary?.month}
            </DialogTitle>

            <DialogContent>

                {/* Monthly Summary */}
                <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={3}>
                        <SummaryCard
                            label="Allocated"
                            value={monthlySummary?.allocated}
                        />
                    </Grid>

                    <Grid item xs={3}>
                        <SummaryCard
                            label="Reserved"
                            value={monthlySummary?.reserved}
                        />
                    </Grid>

                    <Grid item xs={3}>
                        <SummaryCard
                            label="Used"
                            value={monthlySummary?.used}
                        />
                    </Grid>

                    <Grid item xs={3}>
                        <SummaryCard
                            label="Remaining"
                            value={monthlySummary?.remaining}
                            highlight
                        />
                    </Grid>
                </Grid>

                <Divider sx={{ mb: 2 }} />

                {/* Feature Breakdown */}

                <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 700, mb: 1 }}
                >
                    Feature Breakdown
                </Typography>

                {credits.map((c: any) => (
                    <Box
                        key={c.feature_code}
                        sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            mb: 1,
                            p: 1.2,
                            borderRadius: 1,
                            background: "#f8f9fb"
                        }}
                    >
                        <Box>
                            <Typography fontWeight={600}>
                                {c.sub_module}
                            </Typography>

                            <Typography
                                variant="caption"
                                color="text.secondary"
                            >
                                {c.module}
                            </Typography>
                        </Box>

                        <Box display="flex" gap={1} flexWrap="wrap">

                            <Chip
                                size="small"
                                label={`Allocated ${c.allocated}`}
                                variant="outlined"
                            />

                            <Chip
                                size="small"
                                label={`Used ${c.used}`}
                                color="error"
                                variant="outlined"
                            />

                            <Chip
                                size="small"
                                label={`Reserved ${c.reserved}`}
                                color="warning"
                                variant="outlined"
                            />

                            <Chip
                                size="small"
                                label={`Remaining ${c.remaining}`}
                                color="success"
                            />

                        </Box>

                    </Box>
                ))}

            </DialogContent>
        </Dialog>
    );
};

export default CreditSummaryDialog;

const SummaryCard = ({ label, value, highlight }: any) => {

    return (
        <Box
            sx={{
                p: 1.5,
                borderRadius: 2,
                textAlign: "center",
                background: highlight ? "#eef6ff" : "#f8f9fb"
            }}
        >
            <Typography
                variant="caption"
                color="text.secondary"
            >
                {label}
            </Typography>

            <Typography
                variant="h6"
                fontWeight={700}
            >
                {value || 0}
            </Typography>

        </Box>
    );
};