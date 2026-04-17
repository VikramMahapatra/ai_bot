import { useState } from "react";
import {
    Box
} from "@mui/material";

import AdminLayout from "../components/Layout/AdminLayout";

import WorkflowFlowBuilder from "../components/FollowUpWorkflow/components/WorkflowBuilder";
import WorkflowList from "../components/FollowUpWorkflow/components/FollowUpWorkflowList";

export default function FollowUpWorkflowPage() {
    const [view, setView] = useState("list");

    return (
        <AdminLayout>
            <Box sx={{ maxWidth: 1380, mx: 'auto', px: { xs: 0, md: 0.5 }, position: 'relative' }}>
                {view === "list" ? (
                    <WorkflowList onCreate={() => setView("create")} />
                ) : (
                    <WorkflowFlowBuilder onBack={() => setView("list")} />
                )}
            </Box>
        </AdminLayout>
    );
}
