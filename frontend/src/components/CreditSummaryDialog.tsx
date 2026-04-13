import {
    Dialog,
    DialogTitle,
    DialogContent,
    Typography,
    Box,
    Grid,
    Divider,
    Chip,
    Stack
} from "@mui/material";

import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import LockIcon from "@mui/icons-material/Lock";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

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
            <DialogTitle sx={{ fontWeight: 700 }}>
                Credit Summary — {monthlySummary?.month}
            </DialogTitle>

            <DialogContent>

                {/* Monthly Summary */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={6} md={3}>
                        <SummaryCard
                            label="Allocated"
                            value={monthlySummary?.allocated}
                            icon={<AccountBalanceWalletIcon />}
                        />
                    </Grid>

                    <Grid item xs={6} md={3}>
                        <SummaryCard
                            label="Reserved"
                            value={monthlySummary?.reserved}
                            icon={<LockIcon />}
                        />
                    </Grid>

                    <Grid item xs={6} md={3}>
                        <SummaryCard
                            label="Used"
                            value={monthlySummary?.used}
                            icon={<TrendingUpIcon />}
                        />
                    </Grid>

                    <Grid item xs={6} md={3}>
                        <SummaryCard
                            label="Remaining"
                            value={monthlySummary?.remaining}
                            highlight
                            icon={<CheckCircleIcon />}
                        />
                    </Grid>
                </Grid>

                <Divider sx={{ mb: 2 }} />

                {/* Breakdown */}

                <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 700, mb: 1.5 }}
                >
                    Used Credit Breakdown
                </Typography>

                {credits
                    ?.filter((c: any) => c.used > 0)
                    .map((c: any) => (

                        <Box
                            key={c.feature_code}
                            sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                mb: 1,
                                p: 1.5,
                                borderRadius: 2,
                                background: "#f8f9fb",
                                border: "1px solid #eef0f3"
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

                            <Chip
                                size="small"
                                label={`${c.used} Used`}
                                color="primary"
                            />

                        </Box>
                    ))}

            </DialogContent>
        </Dialog>
    );
};

export default CreditSummaryDialog;


const SummaryCard = ({ label, value, icon, highlight }: any) => {

    const getColor = () => {
        switch (label) {
            case "Allocated":
                return {
                    bg: "#eef2ff",
                    iconBg: "#e0e7ff",
                    color: "#4f46e5"
                };

            case "Reserved":
                return {
                    bg: "#fff7ed",
                    iconBg: "#ffedd5",
                    color: "#ea580c"
                };

            case "Used":
                return {
                    bg: "#fef2f2",
                    iconBg: "#fee2e2",
                    color: "#dc2626"
                };

            case "Remaining":
                return {
                    bg: "#ecfdf5",
                    iconBg: "#d1fae5",
                    color: "#059669"
                };

            default:
                return {
                    bg: "#f8f9fb",
                    iconBg: "#eef0f3",
                    color: "#334155"
                };
        }
    };

    const theme = getColor();

    return (
        <Box
            sx={{
                p: 2,
                borderRadius: 2.5,
                background: theme.bg,
                border: "1px solid #eef0f3",
                transition: "0.2s",
                '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 14px rgba(0,0,0,0.06)'
                }
            }}
        >
            <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
            >
                <Box>
                    <Typography
                        variant="caption"
                        color="text.secondary"
                    >
                        {label}
                    </Typography>

                    <Typography
                        variant="h5"
                        fontWeight={700}
                        sx={{ color: theme.color }}
                    >
                        {value || 0}
                    </Typography>
                </Box>

                <Box
                    sx={{
                        background: theme.iconBg,
                        borderRadius: 2,
                        p: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: theme.color
                    }}
                >
                    {icon}
                </Box>

            </Stack>

        </Box>
    );
};

