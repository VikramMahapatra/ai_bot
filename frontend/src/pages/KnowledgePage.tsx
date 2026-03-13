import React from 'react';
import { Box, Typography, Chip, Stack, Paper } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import HubIcon from '@mui/icons-material/Hub';
import AdminLayout from '../components/Layout/AdminLayout';
import KnowledgeManager from '../components/Admin/KnowledgeManager';

const KnowledgePage: React.FC = () => {
  const theme = useTheme();

  return (
    <AdminLayout>
      <Box sx={{ maxWidth: 1380, mx: 'auto', px: { xs: 0, md: 0.5 }, position: 'relative' }}>
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

        <Paper
          elevation={0}
          sx={{
            position: 'relative',
            zIndex: 1,
            p: { xs: 2, md: 2.6 },
            mb: 3,
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
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', mb: 0.8, letterSpacing: '-0.02em' }}>
            Knowledge Base
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Structured workspace to ingest, manage, and verify agent knowledge quality.
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
            <Chip icon={<AutoStoriesIcon />} label="Ingest" size="small" variant="outlined" />
            <Chip icon={<ManageSearchIcon />} label="Manage" size="small" variant="outlined" />
            <Chip icon={<HubIcon />} label="Vectorize" size="small" variant="outlined" />
          </Stack>
        </Paper>

        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <KnowledgeManager />
        </Box>
      </Box>
    </AdminLayout>
  );
};

export default KnowledgePage;


