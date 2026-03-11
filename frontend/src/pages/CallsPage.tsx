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
import CampaignAnalytics from '../components/calls/CampaignAnalytics';
import CampaignContacts from '../components/calls/CampaignContacts';
import CampaignBuilder from '../components/calls/CampaignBuilder';
import AdminLayout from '../components/Layout/AdminLayout';


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
                    >
                        <Tab icon={<AnalyticsIcon />} iconPosition="start" label="Analytics" />
                        <Tab icon={<ContactsIcon />} iconPosition="start" label="Contacts" />
                        <Tab icon={<CampaignIcon />} iconPosition="start" label="Campaign Builder" />
                    </Tabs>
                </Paper>

                {/* Tab Content */}
                <Box>
                    {tab === 0 && <CampaignAnalytics />}
                    {tab === 1 && <CampaignContacts />}
                    {tab === 2 && <CampaignBuilder />}
                </Box>

            </Box>
        </AdminLayout>
    );
};

export default CampaignManager;