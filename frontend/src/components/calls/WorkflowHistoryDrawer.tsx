import {
    Drawer,
    Box,
    Typography,
    IconButton,
    Divider,
    Chip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PhoneIcon from "@mui/icons-material/Phone";
import ScheduleIcon from "@mui/icons-material/Schedule";
import MessageIcon from "@mui/icons-material/Message";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { WorkflowEvent } from "../../services/callCampaignService";
import { useDateFormatter } from "../../hooks/useDateFormatter";



interface Props {
    open: boolean;
    onClose: () => void;
    data: WorkflowEvent[];
}

const getIcon = (stepType?: string, event?: string) => {
    if (event === "workflow_completed") return <CheckCircleIcon color="success" />;
    if (event === "scheduled") return <ScheduleIcon color="warning" />;
    if (stepType === "call") return <PhoneIcon color="primary" />;
    return <MessageIcon color="secondary" />;
};

const getLabel = (item: WorkflowEvent) => {
    if (item.event === "workflow_triggered") return "Workflow Started";
    if (item.event === "workflow_completed") return "Workflow Completed";

    if (item.event === "scheduled") {
        return `Scheduled (${item.metadata?.delay || 0} ${item.metadata?.delay_unit || "min"
            })`;
    }

    if (item.event === "executed") {
        if (item.step_type === "call") {
            return `Call → ${item.call_status || ""}`;
        }
        return `${item.step_type?.toUpperCase()} Sent`;
    }

    return item.event;
};

export default function WorkflowHistoryDrawer({
    open,
    onClose,
    data,
}: Props) {

    const formatDisplayDate = useDateFormatter()

    return (
        <Drawer anchor="right" open={open} onClose={onClose}>
            <Box width={380} role="presentation">
                {/* HEADER */}
                <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    p={2}
                >
                    <Typography variant="h6">Follow-up Timeline</Typography>
                    <IconButton onClick={onClose}>
                        <CloseIcon />
                    </IconButton>
                </Box>

                <Divider />

                {/* TIMELINE */}
                <Box p={2}>
                    {data.length === 0 ? (
                        <Typography color="text.secondary">
                            No workflow history found
                        </Typography>
                    ) : (
                        data.map((item, index) => (
                            <Box key={index} display="flex" mb={3}>
                                {/* LEFT ICON + LINE */}
                                <Box display="flex" flexDirection="column" alignItems="center">
                                    {getIcon(item.step_type, item.event)}
                                    {index !== data.length - 1 && (
                                        <Box
                                            sx={{
                                                width: "2px",
                                                height: "40px",
                                                bgcolor: "grey.300",
                                                mt: 0.5,
                                            }}
                                        />
                                    )}
                                </Box>

                                {/* CONTENT */}
                                <Box ml={2} flex={1}>
                                    <Typography fontWeight={600}>
                                        {getLabel(item)}
                                    </Typography>

                                    {item.outcome && (
                                        <Chip
                                            label={item.outcome}
                                            size="small"
                                            sx={{ mt: 0.5 }}
                                        />
                                    )}

                                    <Typography variant="caption" color="text.secondary">
                                        {formatDisplayDate(item.time)}
                                    </Typography>
                                </Box>
                            </Box>
                        ))
                    )}
                </Box>
            </Box>
        </Drawer>
    );
}