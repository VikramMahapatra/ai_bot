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
import BoltIcon from "@mui/icons-material/Bolt";
import { titleCase } from "../Common/StatusChips";



interface Props {
    open: boolean;
    onClose: () => void;
    data: WorkflowEvent[];
}

const getIcon = (stepType?: string, event?: string) => {
    if (event === "workflow_triggered") return <PhoneIcon color="primary" />;
    if (event === "workflow_completed") return <CheckCircleIcon color="success" />;
    if (event === "workflow_scheduled") return <ScheduleIcon color="warning" />;
    if (event === "workflow_executed") return <BoltIcon color="primary" />;
    if (stepType === "call") return <PhoneIcon color="primary" />;
    if (event === "workflow_execution_failed") return <BoltIcon color="error" />;
    if (event === "workflow_schedule_failed") return <ScheduleIcon color="error" />;
    if (event === "workflow_failed") return <CloseIcon color="error" />;
    return <MessageIcon color="secondary" />;
};

const getLabel = (item: WorkflowEvent) => {
    if (item.event === "workflow_triggered") {
        return "Started";
    }

    if (item.event === "workflow_completed") {
        return "Completed";
    }

    if (item.event === "workflow_scheduled") {
        return "Scheduled";
    }

    if (item.event === "workflow_executed") {
        return "Action Executed";
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
                            <Box key={index} display="flex" mb={3} alignItems="stretch">
                                {/* LEFT ICON + LINE */}
                                <Box
                                    display="flex"
                                    flexDirection="column"
                                    alignItems="center"
                                    sx={{
                                        width: 24,
                                        position: "relative",
                                    }}
                                >
                                    {/* ICON */}
                                    {getIcon(item.step_type, item.event)}

                                    {/* LINE */}
                                    {index !== data.length - 1 && (
                                        <Box
                                            sx={{
                                                flex: 1,
                                                width: "2px",
                                                bgcolor: "grey.300",
                                                mt: 0.5,
                                                minHeight: "24px",
                                            }}
                                        />
                                    )}
                                </Box>

                                {/* CONTENT */}
                                <Box
                                    ml={2}
                                    flex={1}
                                    sx={{
                                        p: 1.5,
                                        borderRadius: 2,
                                        bgcolor: "background.paper",
                                        border: "1px solid",
                                        borderColor: "divider",
                                    }}
                                >
                                    {/* TITLE */}
                                    <Typography fontWeight={600}>
                                        {getLabel(item)}
                                    </Typography>

                                    {/* DETAILS */}
                                    <Box mt={0.5}>

                                        {/* WORKFLOW TRIGGERED */}
                                        {["workflow_triggered", "workflow_executed"].includes(item.event) && (
                                            <>
                                                {item.call_status && (
                                                    <Typography variant="body2" color="text.secondary">
                                                        <Box component="span" sx={{ fontSize: 12, opacity: 0.7 }}>
                                                            Status:
                                                        </Box>{" "}
                                                        <b>{titleCase(item.call_status?.replace(/_/g, " "))}</b>
                                                    </Typography>
                                                )}

                                                {item.outcome && (
                                                    <Typography variant="body2" color="text.secondary">
                                                        <Box component="span" sx={{ fontSize: 12, opacity: 0.7 }}>
                                                            Outcome:
                                                        </Box>{" "}
                                                        <b>{titleCase(item.outcome)}</b>
                                                    </Typography>
                                                )}
                                            </>
                                        )}

                                        {/* WORKFLOW SCHEDULED */}
                                        {item.event === "workflow_scheduled" && (
                                            <>
                                                <Typography variant="body2" color="text.secondary">
                                                    <Box component="span" sx={{ fontSize: 12, opacity: 0.7 }}>
                                                        Action:
                                                    </Box>{" "}
                                                    <b>{titleCase(item.step_type)}</b>
                                                </Typography>

                                                {item.delay && (
                                                    <Typography variant="body2" color="text.secondary">
                                                        <Box component="span" sx={{ fontSize: 12, opacity: 0.7 }}>
                                                            Delay:
                                                        </Box>{" "}
                                                        <b>{item.delay} {item.delay_unit}</b>
                                                    </Typography>
                                                )}

                                                {item.scheduled_at && (
                                                    <Typography variant="body2" color="warning.main">
                                                        <Box component="span" sx={{ fontSize: 12, opacity: 0.7 }}>
                                                            Scheduled:
                                                        </Box>{" "}
                                                        <b>{formatDisplayDate(item.scheduled_at)}</b>
                                                    </Typography>
                                                )}
                                            </>
                                        )}

                                        {/* WORKFLOW COMPLETED */}
                                        {item.event === "workflow_completed" && item.reason && (
                                            <Typography variant="body2" color="success.main">
                                                <Box component="span" sx={{ fontSize: 12, opacity: 0.7 }}>
                                                    Reason:
                                                </Box>{" "}
                                                <b>{item.reason}</b>
                                            </Typography>
                                        )}

                                        {/* FAILURE EVENTS */}
                                        {["workflow_execution_failed", "workflow_schedule_failed", "workflow_failed"].includes(item.event) && (
                                            <>
                                                {item.step_type && (
                                                    <Typography variant="body2" color="text.secondary">
                                                        <Box component="span" sx={{ fontSize: 12, opacity: 0.7 }}>
                                                            Action:
                                                        </Box>{" "}
                                                        <b>{titleCase(item.step_type)}</b>
                                                    </Typography>
                                                )}

                                                {item.error && (
                                                    <Typography variant="body2" color="error.main">
                                                        <Box component="span" sx={{ fontSize: 12, opacity: 0.7 }}>
                                                            Error:
                                                        </Box>{" "}
                                                        <b>{item.error}</b>
                                                    </Typography>
                                                )}

                                                {item.reason && (
                                                    <Typography variant="body2" color="error.main">
                                                        <Box component="span" sx={{ fontSize: 12, opacity: 0.7 }}>
                                                            Reason:
                                                        </Box>{" "}
                                                        <b>{item.reason}</b>
                                                    </Typography>
                                                )}
                                            </>
                                        )}

                                    </Box>

                                    {/* TIME */}
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{ display: "block", mt: 1 }}
                                    >
                                        {formatDisplayDate(item.scheduled_at || item.time)}
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