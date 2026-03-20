import { Box, Typography } from "@mui/material";
import { LiveCall } from "../../../services/callService";

interface Props {
    liveCalls: LiveCall[];
}

export default function LiveCalls({ liveCalls }: Props) {
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