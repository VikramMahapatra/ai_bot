import { Avatar, Box, Chip, Stack, Typography } from "@mui/material";
import CallMissedOutgoingOutlinedIcon from "@mui/icons-material/CallMissedOutgoingOutlined";
import CallIcon from '@mui/icons-material/Call';
import { RecentCall } from "../../../services/callService";

type Props = {
    recentCalls: RecentCall[];
};

export default function LiveCalls({ recentCalls }: Props) {
    return (
        <Box
            sx={{
                height: "100%", // fill parent Card
                display: "flex",
                flexDirection: "column",
                justifyContent: recentCalls.length === 0 ? "center" : "flex-start",
                alignItems: "center",
                width: "100%",
            }}
        >
            {recentCalls.length === 0 ? (
                <Box
                    sx={{
                        textAlign: "center",
                        py: 6,
                        px: 2,
                        border: "1px dashed",
                        borderColor: "grey.300",
                        borderRadius: 2,
                        backgroundColor: "grey.50",
                        width: "100%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 1.5,
                    }}
                >
                    <CallMissedOutgoingOutlinedIcon
                        sx={{ fontSize: 50, color: "grey.400" }}
                    />
                    <Typography variant="h6" color="text.secondary">
                        No recent calls
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        You don’t have any calls in the last 30 minutes.
                    </Typography>
                </Box>
            ) : (
                <Box width="100%">
                    <Stack spacing={2} width="100%">
                        {recentCalls.map((call, i) => (
                            <Box
                                key={i}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    p: 2,
                                    borderRadius: 2,
                                    border: "1px solid",
                                    borderColor: "grey.200",
                                    backgroundColor: "background.paper",
                                    boxShadow: 1,
                                    "&:hover": { boxShadow: 3 },
                                }}
                            >
                                <Avatar sx={{ bgcolor: "primary.main", mr: 2 }}>
                                    <CallIcon />
                                </Avatar>
                                <Box flex={1}>
                                    <Typography fontWeight={600}>{call.name}</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {call.campaign} {call.agent ? `- Agent: ${call.agent}` : ""}
                                    </Typography>
                                    {call.phone && (
                                        <Typography variant="body2" color="text.secondary">
                                            📞 {call.phone}
                                        </Typography>
                                    )}
                                </Box>
                                <Box textAlign="right">
                                    <Chip
                                        label={call.status.toUpperCase()}
                                        color={
                                            call.status === "live"
                                                ? "success"
                                                : call.status === "queued"
                                                    ? "warning"
                                                    : "default"
                                        }
                                        size="small"
                                        sx={{ mb: 0.5 }}
                                    />
                                    <Typography variant="caption" color="text.secondary">
                                        {call.duration}
                                    </Typography>
                                </Box>
                            </Box>
                        ))}
                    </Stack>
                </Box>
            )}
        </Box>
    );
}