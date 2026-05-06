import { useState } from "react";
import {
    Box
} from "@mui/material";

import AdminLayout from "../components/Layout/AdminLayout";

import WorkflowFlowBuilder from "../components/FollowUpWorkflow/components/WorkflowBuilder";
import WorkflowList from "../components/FollowUpWorkflow/components/FollowUpWorkflowList";

export default function FollowUpWorkflowPage() {
    const [view, setView] = useState("list");
    const [selectedWorkflow, setSelectedWorkflow] = useState<number | null>(null);

    return (
        <AdminLayout>
            <Box sx={{ maxWidth: 1380, mx: 'auto', px: { xs: 0, md: 0.5 }, position: 'relative' }}>
                {view === "list" ? (
                    <WorkflowList
                        onCreate={() => {
                            setSelectedWorkflow(null);
                            setView("create");
                        }}
                        onEdit={(id) => {
                            setSelectedWorkflow(id);
                            setView("edit");
                        }}
                    />
                ) : (
                    <WorkflowFlowBuilder
                        workflowId={selectedWorkflow}
                        onBack={() => {
                            setView("list");
                        }}
                    />
                )}
            </Box>
        </AdminLayout>
    );
}
