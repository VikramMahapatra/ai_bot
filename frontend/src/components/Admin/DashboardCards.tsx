import React from 'react';
import { Box, Grid, Card, CardContent, Typography, Avatar, Chip } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
// import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const stats = [
  {
    label: 'Total Leads',
    value: 128,
    change: '+12%',
    changeType: 'increase',
    icon: <PeopleAltIcon fontSize="large" />,
    color: '#269b9f',
    bgGradient: 'linear-gradient(135deg, #e0f2f7 0%, #b3dfe9 100%)',
  },
  {
    label: 'Knowledge Sources',
    value: 42,
    change: '+8%',
    changeType: 'increase',
    icon: <MenuBookIcon fontSize="large" />,
    color: '#2db3a0',
    bgGradient: 'linear-gradient(135deg, #d9f0ef 0%, #b3dfe9 100%)',
  },
  {
    label: 'Active Users',
    value: 17,
    change: '+23%',
    changeType: 'increase',
    icon: <TrendingUpIcon fontSize="large" />,
    color: '#2ba876',
    bgGradient: 'linear-gradient(135deg, #e8f5f1 0%, #c8e6dd 100%)',
  },
  {
    label: 'AI Bots',
    value: 3,
    change: 'Stable',
    changeType: 'neutral',
    icon: <SmartToyIcon fontSize="large" />,
    color: '#ffd700',
    bgGradient: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
  },
];

const DashboardCards: React.FC = () => {
  return (
    <Box sx={{ mb: 4 }}>
      <Grid container spacing={3}>
        {stats.map((stat) => (
          <Grid item xs={12} sm={6} md={3} key={stat.label}>
            <Card 
              sx={{ 
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 4px 20px 0 rgba(38,155,159,0.12)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 30px 0 rgba(38,155,159,0.2)',
                },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: stat.color,
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Avatar 
                    sx={{ 
                      bgcolor: 'transparent',
                      background: stat.bgGradient,
                      width: 56, 
                      height: 56,
                      color: stat.color,
                      boxShadow: `0 4px 14px 0 ${stat.color}30`,
                    }}
                  >
                    {stat.icon}
                  </Avatar>
                  <Chip 
                    icon={stat.changeType === 'increase' ? <ArrowUpwardIcon fontSize="small" /> : undefined}
                    label={stat.change}
                    size="small"
                    sx={{ 
                      bgcolor: stat.changeType === 'increase' ? 'rgba(43, 168, 118, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                      color: stat.changeType === 'increase' ? 'success.main' : 'text.secondary',
                      fontWeight: 600,
                      border: 'none',
                    }}
                  />
                </Box>
                
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5, color: 'text.primary' }}>
                  {stat.value.toLocaleString()}
                </Typography>
                
                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  {stat.label}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default DashboardCards;
