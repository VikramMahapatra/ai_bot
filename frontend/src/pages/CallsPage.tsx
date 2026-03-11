import React, { useState } from 'react';
import {
    Box,
    Tabs,
    Tab,
    Typography,
    Paper,
} from '@mui/material';

import AnalyticsIcon from '@mui/icons-material/Analytics';
import ContactsIcon from '@mui/icons-material/Contacts';
import CampaignIcon from '@mui/icons-material/Campaign';
import ListAltIcon from '@mui/icons-material/ListAlt';
import GroupIcon from '@mui/icons-material/Group';

import AdminLayout from '../components/Layout/AdminLayout';
import CampaignAnalytics from '../components/calls/CampaignAnalytics';
import CampaignContacts from '../components/calls/CampaignContacts';
import CampaignBuilder from '../components/calls/CampaignBuilder';
import { CallLogsTab } from '../components/calls/CallLogs';
import { CallingAgentTab } from '../components/calls/CallingAgentTab'; // <- new tab component

const CampaignManager: React.FC = () => {
    const [tab, setTab] = useState(0);

    const handleChange = (event: React.SyntheticEvent, newValue: number) => {
        setTab(newValue);
    };

    return (
        <AdminLayout>
            <Box>

                {/* Page Header */}
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', mb: 1 }}>
                        Campaign Manager
                    </Typography>
                    <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                        Create, manage, and schedule AI-powered calling campaigns using your agent.
                    </Typography>
                </Box>

                {/* Tabs */}
                <Paper sx={{ mb: 3 }}>
                    <Tabs
                        value={tab}
                        onChange={handleChange}
                        indicatorColor="primary"
                        textColor="primary"
                        variant="scrollable"
                        scrollButtons="auto"
                    >
                        <Tab icon={<AnalyticsIcon />} iconPosition="start" label="Analytics" />
                        <Tab icon={<ContactsIcon />} iconPosition="start" label="Contacts" />
                        <Tab icon={<GroupIcon />} iconPosition="start" label="Calling Agent" /> {/* NEW */}
                        <Tab icon={<CampaignIcon />} iconPosition="start" label="Campaign Builder" />
                        <Tab icon={<ListAltIcon />} iconPosition="start" label="Call Logs" />
                    </Tabs>
                </Paper>

                {/* Tab Content */}
                <Box>
                    {tab === 0 && <CampaignAnalytics />}
                    {tab === 1 && <CampaignContacts />}
                    {tab === 2 && <CallingAgentTab />} {/* NEW */}
                    {tab === 3 && <CampaignBuilder />}
                    {tab === 4 && <CallLogsTab />}
                </Box>

            </Box>
        </AdminLayout>
    );
};

export default CampaignManager;