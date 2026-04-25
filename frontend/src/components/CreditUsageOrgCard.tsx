import { Card, Typography, Box, Grid, Stack } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import BarChartIcon from "@mui/icons-material/BarChart";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";

type OrganizationCardProps = {
  name: string;
  date: string;
  usage: string;
  invoice: number;
  credits: {
    allocated: number;
    used: number;
    remaining: number;
  };
};

const OrganizationCard = ({
  name,
  date,
  usage,
  invoice,
  credits,
}: OrganizationCardProps) => {
  return (
    <Card
      sx={{
        borderRadius: 3,
        p: 2,
        boxShadow: 3,
      }}
    >
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography fontWeight={600} variant="h5">{name}</Typography>
        </Box>

        <Box>
          <Typography fontWeight={500} variant="h6" color="text.primary">
            {date}
          </Typography>
        </Box>
      </Box>

      {/* Usage */}
      <Box mt={2} display="flex" alignItems="center" gap={1}>
        <BarChartIcon color="success" />
        <Typography>
          Usage: {usage}
          {"%"}
        </Typography>
      </Box>

      <Box mt={2} display="flex" alignItems="center" gap={1}>
        <ReceiptLongIcon color="success" />
        <Typography>Invoices: {invoice}</Typography>
      </Box>

      {/* Credit Summary */}
      <Box mt={2}>
        <Typography fontWeight={600} mb={1}>
          Credit Summary
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={4}>
            <SummaryCard
              label="Allocated"
              value={credits.allocated}
              icon={<AccountBalanceWalletIcon />}
            />
          </Grid>

          <Grid item xs={4}>
            <SummaryCard
              label="Used"
              value={credits.used}
              icon={<TrendingUpIcon />}
            />
          </Grid>

          <Grid item xs={4}>
            <SummaryCard
              label="Remaining"
              value={credits.remaining}
              highlight
              icon={<CheckCircleIcon />}
            />
          </Grid>
        </Grid>
      </Box>
    </Card>
  );
};
export default OrganizationCard;

const SummaryCard = ({ label, value, icon, highlight }: any) => {
  const getColor = () => {
    switch (label) {
      case "Allocated":
        return {
          bg: "#eef2ff",
          iconBg: "#e0e7ff",
          color: "#4f46e5",
        };

      case "Reserved":
        return {
          bg: "#fff7ed",
          iconBg: "#ffedd5",
          color: "#ea580c",
        };

      case "Used":
        return {
          bg: "#fef2f2",
          iconBg: "#fee2e2",
          color: "#dc2626",
        };

      case "Remaining":
        return {
          bg: "#ecfdf5",
          iconBg: "#d1fae5",
          color: "#059669",
        };

      default:
        return {
          bg: "#f8f9fb",
          iconBg: "#eef0f3",
          color: "#334155",
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
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: "0 6px 14px rgba(0,0,0,0.06)",
        },
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>

          <Typography variant="h5" fontWeight={700} sx={{ color: theme.color }}>
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
            color: theme.color,
          }}
        >
          {icon}
        </Box>
      </Stack>
    </Box>
  );
};
