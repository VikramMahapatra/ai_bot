import { Box, Typography } from "@mui/material";

const liveCalls = [
    {
        name: "Rohit Patil",
        campaign: "Real Estate Leads",
        duration: "02:15"
    },
    {
        name: "Priya Mehta",
        campaign: "Insurance Renewal",
        duration: "01:40"
    }
];

export default function LiveCalls() {
    return (
        <Box>
            {liveCalls.map((call, i) => (
                <Box key={i} mb={2}>
                    <Typography fontWeight={600}>{call.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                        {call.campaign}
                    </Typography>
                    <Typography variant="caption">
                        Duration: {call.duration}
                    </Typography>
                </Box>
            ))}
        </Box>
    );
}