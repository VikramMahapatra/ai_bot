import React, { useEffect, useState } from "react";

import {
    Box,
    Typography,
    Paper,
    Chip,
    Stack,
    Button
} from "@mui/material";

import { alpha, useTheme } from '@mui/material/styles';
import AdminLayout from "../components/Layout/AdminLayout";
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ListAltIcon from '@mui/icons-material/ListAlt';
import Contacts from "../components/Contacts";


export default function SuperAdminOrgCallAnalyticsReport() {
    const theme = useTheme();
    const [tab, setTab] = useState(0);

    const pageContainerSx = {
        maxWidth: 1380,
        mx: 'auto',
        px: { xs: 0, md: 0.5 },
        position: 'relative',
    } as const;

    const sectionPanelSx = {
        borderRadius: '18px',
        border: `1px solid ${alpha(theme.palette.common.white, 0.62)}`,
        background: `linear-gradient(150deg, ${alpha(theme.palette.common.white, 0.7)} 0%, ${alpha(
            theme.palette.background.paper,
            0.82
        )} 68%, ${alpha('#dce8f8', 0.78)} 100%)`,
        boxShadow: `0 14px 30px ${alpha(theme.palette.primary.dark, 0.14)}`,
        backdropFilter: 'blur(10px)',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
                'linear-gradient(138deg, rgba(255,255,255,0.22) 8%, transparent 24%), linear-gradient(28deg, transparent 56%, rgba(78,137,213,0.14) 57%, transparent 80%)',
        },
        '& > *': {
            position: 'relative',
            zIndex: 1,
        },
    } as const;

    const compactInputSx = {
        '& .MuiInputBase-root': {
            minHeight: 40,
        },
    } as const;

    const compactButtonSx = {
        minHeight: 40,
        px: 1.8,
        whiteSpace: 'nowrap',
    } as const;

    return (
        <AdminLayout>
            <Box sx={pageContainerSx}>
                <Box
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        pointerEvents: 'none',
                        zIndex: 0,
                        background:
                            'linear-gradient(132deg, transparent 16%, rgba(132,172,228,0.2) 17%, transparent 34%), linear-gradient(36deg, transparent 52%, rgba(111,165,229,0.16) 53%, transparent 72%)',
                    }}
                />
            </Box>


            <Stack spacing={3} sx={{ position: 'relative', zIndex: 1 }}>
                <Paper
                    sx={{
                        p: { xs: 2, md: 2.6 },
                        borderRadius: '24px',
                        border: `1px solid ${alpha(theme.palette.common.white, 0.65)}`,
                        background: `linear-gradient(125deg, ${alpha('#deebfb', 0.92)} 0%, ${alpha(
                            theme.palette.background.paper,
                            0.84
                        )} 72%, ${alpha('#a9bfdc', 0.98)} 100%)`,
                        boxShadow: `0 18px 36px ${alpha(theme.palette.primary.dark, 0.24)}`,
                        position: 'relative',
                        overflow: 'hidden',
                        '&::before': {
                            content: '""',
                            position: 'absolute',
                            inset: 0,
                            background:
                                'linear-gradient(115deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.06) 34%, rgba(255,255,255,0) 62%)',
                            pointerEvents: 'none',
                        },
                        '&::after': {
                            content: '""',
                            position: 'absolute',
                            top: '-24%',
                            right: '-6%',
                            width: '42%',
                            height: '150%',
                            background: 'radial-gradient(circle, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0) 72%)',
                            pointerEvents: 'none',
                        },
                        '& > *': {
                            position: 'relative',
                            zIndex: 1,
                        },
                    }}
                >
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
                        <Box>
                            <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', mb: 0.8, letterSpacing: '-0.02em' }}>
                                Contact Book
                            </Typography>
                            <Typography variant="body1" color="text.secondary">
                                Manage and organize your contacts for campaigns, calling, and engagement.
                            </Typography>
                            <Stack direction="row" spacing={1} sx={{ mt: 1.4 }} flexWrap="wrap" useFlexGap>
                                <Chip size="small" icon={<ListAltIcon />} label="Build Audience" variant="outlined" />
                                <Chip size="small" icon={<UploadFileIcon />} label="Upload Contacts" variant="outlined" />
                            </Stack>
                        </Box>

                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                            <Button size="small" sx={compactButtonSx} variant="outlined" startIcon={<UploadFileIcon />} onClick={() => setTab(1)}>
                                Upload Contacts
                            </Button>
                        </Stack>
                    </Stack>
                </Paper>
                <Contacts tab={tab} setTab={setTab} />
            </Stack>
        </AdminLayout>
    );
}