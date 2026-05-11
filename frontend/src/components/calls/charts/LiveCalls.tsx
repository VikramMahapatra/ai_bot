import { Avatar, Box, Chip, Stack, Typography } from "@mui/material";
import CallMissedOutgoingOutlinedIcon from "@mui/icons-material/CallMissedOutgoingOutlined";
import CallIcon from '@mui/icons-material/Call';
import { RecentCall } from "../../../services/callService";
import { titleCase } from "../../Common/StatusChips";

type Props = {
    recentCalls: RecentCall[];
};

export default function LiveCalls({ recentCalls }: Props) {
    return (
        <Box
            sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                minHeight: 0,   // 🔥 REQUIRED
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
                <Box
                    sx={{
                        flex: 1,
                        minHeight: 0,
                        overflowY: "auto",
                        pr: 1,
                    }}
                >
                    <Stack spacing={2}>
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
                                        {call.campaign}
                                    </Typography>
                                    {call.phone && (
                                        <Typography variant="body2" color="text.secondary">
                                            📞 {call.phone}
                                        </Typography>
                                    )}
                                </Box>

                                <Box
                                    sx={{
                                        textAlign: "right",
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "flex-end",
                                        gap: 0.5,
                                        minWidth: 80,
                                    }}
                                >
                                    <Chip
                                        label={titleCase(call.status)}
                                        color={
                                            call.status === "live"
                                                ? "success"
                                                : call.status === "queued"
                                                    ? "warning"
                                                    : "default"
                                        }
                                        size="small"
                                        variant="outlined"
                                        sx={{ mb: 0.5 }}
                                    />

                                    <Typography
                                        variant="caption"
                                        sx={{
                                            color: "text.secondary",
                                            fontSize: "0.72rem",
                                        }}
                                    >
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