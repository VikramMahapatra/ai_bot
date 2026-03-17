import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Container,
  Alert,
  Tab,
  Tabs,
  InputAdornment,
  Avatar,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress
} from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import InsightsIcon from '@mui/icons-material/Insights';
import SecurityIcon from '@mui/icons-material/Security';
import BoltIcon from '@mui/icons-material/Bolt';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { Organization } from '../types';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2.2 }}>{children}</Box>}
    </div>
  );
}

const LoginPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [organizationId, setOrganizationId] = useState<number | ''>('');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [email, setEmail] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [error, setError] = useState('');
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const sharedFieldSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: 2.2,
      backgroundColor: 'rgba(240,247,255,0.78)',
      transition: 'all 180ms ease',
      '&:hover': {
        backgroundColor: 'rgba(236,245,255,0.95)',
      },
      '&.Mui-focused': {
        backgroundColor: '#ffffff',
        boxShadow: '0 0 0 3px rgba(45,122,240,0.14)',
      },
    },
  };

  // Fetch organizations when username changes
  useEffect(() => {
    if (username && tabValue === 0) {
      const fetchOrganizations = async () => {
        try {
          setLoadingOrgs(true);
          const orgs = await authService.getOrganizationsByUsername(username);
          setOrganizations(orgs);
          setShowOrgDropdown(orgs.length > 0);
          if (orgs.length === 1) {
            setOrganizationId(orgs[0].id);
          } else {
            setOrganizationId('');
          }
        } catch (err) {
          setShowOrgDropdown(false);
          setOrganizations([]);
        } finally {
          setLoadingOrgs(false);
        }
      };

      const timer = setTimeout(fetchOrganizations, 500); // Debounce
      return () => clearTimeout(timer);
    } else {
      setShowOrgDropdown(false);
      setOrganizations([]);
    }
  }, [username, tabValue]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // If org dropdown is shown but not selected, show error
    if (showOrgDropdown && !organizationId) {
      setError('Please select an organization');
      return;
    }

    // If no organizations found for this user
    if (!showOrgDropdown && !organizationId) {
      setError('No organizations found for this user');
      return;
    }

    try {
      await login(username, password, Number(organizationId));
      navigate('/admin');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await authService.register(organizationName, username, email, password);
      setTabValue(0);
      setOrganizationName('');
      setUsername('');
      setEmail('');
      setPassword('');
      setError('');
      alert('Organization and admin account created successfully! Please login.');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        py: { xs: 3, md: 6 },
        background:
          'radial-gradient(circle at 11% 14%, rgba(93,203,255,0.25) 0%, transparent 42%), radial-gradient(circle at 87% 12%, rgba(50,111,245,0.25) 0%, transparent 38%), linear-gradient(160deg, #eaf3ff 0%, #e0edff 44%, #edf5ff 100%)',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'repeating-linear-gradient(120deg, rgba(38,104,206,0.06) 0 1px, transparent 1px 26px), repeating-linear-gradient(45deg, rgba(74,176,237,0.05) 0 1px, transparent 1px 24px)',
        },
      }}
    >
      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
        <Paper
          sx={{
            borderRadius: { xs: 3.2, md: 5 },
            border: '1px solid rgba(37,101,201,0.22)',
            background: 'linear-gradient(140deg, rgba(255,255,255,0.86) 0%, rgba(236,245,255,0.8) 100%)',
            boxShadow: '0 34px 84px rgba(10,41,104,0.2)',
            backdropFilter: 'blur(14px)',
            overflow: 'hidden',
            animation: 'loginReveal 500ms cubic-bezier(0.2, 0.8, 0.2, 1)',
            '@keyframes loginReveal': {
              from: { opacity: 0, transform: 'translateY(16px) scale(0.985)' },
              to: { opacity: 1, transform: 'translateY(0) scale(1)' },
            },
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1.03fr 0.97fr' },
              minHeight: { md: 620 },
            }}
          >
            <Box
              sx={{
                position: 'relative',
                overflow: 'hidden',
                p: { xs: 3, sm: 4, md: 5 },
                color: '#f7faff',
                background:
                  'linear-gradient(160deg, #0a1d4b 0%, #10316f 46%, #17528f 100%)',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: -60,
                  right: -60,
                  width: 220,
                  height: 220,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(91,187,255,0.42) 0%, rgba(91,187,255,0.01) 68%)',
                  animation: 'pulseFloat 8s ease-in-out infinite',
                  '@keyframes pulseFloat': {
                    '0%,100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-12px)' },
                  },
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  bottom: -70,
                  left: -56,
                  width: 230,
                  height: 230,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(56,196,255,0.3) 0%, rgba(56,196,255,0) 72%)',
                }}
              />

              <Stack spacing={2.3} sx={{ position: 'relative', zIndex: 1 }}>
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.2 }}>
                  <Avatar
                    sx={{
                      width: 46,
                      height: 46,
                      background: 'linear-gradient(145deg, #2f8fff 0%, #57c7ff 100%)',
                      boxShadow: '0 10px 26px rgba(59,168,255,0.38)',
                    }}
                  >
                    <SmartToyIcon />
                  </Avatar>
                  <Box>
                    <Typography sx={{ fontSize: 12, letterSpacing: 1.6, fontWeight: 800, opacity: 0.84 }}>
                      ZENTRIXEL AI PLATFORM
                    </Typography>
                    <Typography sx={{ fontSize: 14, opacity: 0.88 }}>
                      Enterprise Conversational Suite
                    </Typography>
                  </Box>
                </Box>

                <Typography
                  variant="h3"
                  sx={{
                    fontWeight: 850,
                    lineHeight: 1.14,
                    maxWidth: 430,
                    letterSpacing: '-0.02em',
                  }}
                >
                  Build trusted AI conversations that convert, support, and scale.
                </Typography>

                <Typography sx={{ fontSize: 15.5, color: 'rgba(238,245,255,0.9)', maxWidth: 460 }}>
                  Zentrixel AI is the base company behind this product, delivering secure chat intelligence,
                  lead capture workflows, and measurable automation for modern teams.
                </Typography>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2}>
                  <Box sx={{ px: 1.5, py: 1, borderRadius: 2, background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.22)' }}>
                    <Typography sx={{ fontSize: 11, opacity: 0.82 }}>Average resolution</Typography>
                    <Typography sx={{ fontWeight: 800, fontSize: 17 }}>45% faster</Typography>
                  </Box>
                  <Box sx={{ px: 1.5, py: 1, borderRadius: 2, background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.22)' }}>
                    <Typography sx={{ fontSize: 11, opacity: 0.82 }}>Operational uptime</Typography>
                    <Typography sx={{ fontWeight: 800, fontSize: 17 }}>99.95%</Typography>
                  </Box>
                </Stack>

                <Stack spacing={1.1} sx={{ pt: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <InsightsIcon sx={{ fontSize: 19, color: '#7fe0ff' }} />
                    <Typography sx={{ fontSize: 14.4 }}>Actionable analytics with source-level visibility</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SecurityIcon sx={{ fontSize: 19, color: '#7fe0ff' }} />
                    <Typography sx={{ fontSize: 14.4 }}>Role-based controls and audited access patterns</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BoltIcon sx={{ fontSize: 19, color: '#7fe0ff' }} />
                    <Typography sx={{ fontSize: 14.4 }}>Fast deployment with widget-driven integrations</Typography>
                  </Box>
                </Stack>
              </Stack>
            </Box>

            <Box
              sx={{
                p: { xs: 2.6, sm: 3.2, md: 4.2 },
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(245,250,255,0.85))',
              }}
            >
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#133a80', mb: 0.3, fontSize: { xs: 28, sm: 32 } }}>
                Welcome back
              </Typography>
              <Typography sx={{ color: 'text.secondary', mb: 2.1, fontSize: 14.6 }}>
                Access your Zentrixel AI admin workspace.
              </Typography>

              <Tabs
                value={tabValue}
                onChange={(_, v) => setTabValue(v)}
                variant="fullWidth"
                sx={{
                  mb: 1,
                  p: 0.5,
                  borderRadius: 2.4,
                  background: 'rgba(226,236,252,0.75)',
                  minHeight: 46,
                  '& .MuiTabs-indicator': { display: 'none' },
                  '& .MuiTab-root': {
                    textTransform: 'none',
                    borderRadius: 2,
                    fontWeight: 800,
                    minHeight: 40,
                    color: 'text.secondary',
                  },
                  '& .Mui-selected': {
                    color: '#1d4eb8',
                    backgroundColor: '#ffffff',
                    boxShadow: '0 6px 12px rgba(19,58,128,0.12)',
                  },
                }}
              >
                <Tab label="Login" />
                <Tab label="Register" />
              </Tabs>

              {error && <Alert severity="error" sx={{ mt: 1.2 }}>{error}</Alert>}

              <TabPanel value={tabValue} index={0}>
                <form onSubmit={handleLogin}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.45 }}>
                    <TextField
                      label="Username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      sx={sharedFieldSx}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <PersonIcon color="primary" />
                          </InputAdornment>
                        ),
                      }}
                    />

                    {showOrgDropdown && (
                      <Box sx={{ position: 'relative' }}>
                        {loadingOrgs ? (
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              p: 1.25,
                              borderRadius: 2,
                              border: '1px solid rgba(53,108,255,0.2)',
                              background: 'rgba(236,245,255,0.82)',
                            }}
                          >
                            <CircularProgress size={18} />
                            <Typography variant="body2">Loading organizations...</Typography>
                          </Box>
                        ) : (
                          <FormControl fullWidth required>
                            <InputLabel>Organization</InputLabel>
                            <Select
                              value={organizationId}
                              onChange={(e) => setOrganizationId(e.target.value as number)}
                              label="Organization"
                              sx={sharedFieldSx}
                            >
                              {organizations.map((org) => (
                                <MenuItem key={org.id} value={org.id}>
                                  {org.name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        )}
                      </Box>
                    )}

                    <TextField
                      label="Password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      sx={sharedFieldSx}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LockIcon color="primary" />
                          </InputAdornment>
                        ),
                      }}
                    />

                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      disabled={loadingOrgs}
                      sx={{
                        mt: 0.6,
                        py: 1.2,
                        borderRadius: 2.2,
                        textTransform: 'none',
                        fontWeight: 800,
                        letterSpacing: 0.2,
                        background: 'linear-gradient(135deg, #2f5ce0 0%, #2d8ef0 55%, #39b6ff 100%)',
                        boxShadow: '0 14px 30px rgba(45,122,240,0.33)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #224ccb 0%, #2578cf 55%, #2a9fe5 100%)',
                        },
                      }}
                    >
                      Login to dashboard
                    </Button>
                  </Box>
                </form>
              </TabPanel>

              <TabPanel value={tabValue} index={1}>
                <form onSubmit={handleRegister}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.45 }}>
                    <TextField
                      label="Organization Name"
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      required
                      sx={sharedFieldSx}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SmartToyIcon color="primary" />
                          </InputAdornment>
                        ),
                      }}
                    />
                    <TextField
                      label="Admin Username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      sx={sharedFieldSx}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <PersonIcon color="primary" />
                          </InputAdornment>
                        ),
                      }}
                    />
                    <TextField
                      label="Email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      sx={sharedFieldSx}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <EmailIcon color="primary" />
                          </InputAdornment>
                        ),
                      }}
                    />
                    <TextField
                      label="Password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      sx={sharedFieldSx}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LockIcon color="primary" />
                          </InputAdornment>
                        ),
                      }}
                    />
                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      sx={{
                        mt: 0.6,
                        py: 1.2,
                        borderRadius: 2.2,
                        textTransform: 'none',
                        fontWeight: 800,
                        letterSpacing: 0.2,
                        background: 'linear-gradient(135deg, #154ab3 0%, #1f66c5 55%, #2c94e6 100%)',
                        boxShadow: '0 14px 30px rgba(32,103,201,0.29)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #123f98 0%, #1a57ad 55%, #1f7ac2 100%)',
                        },
                      }}
                    >
                      Create organization
                    </Button>
                  </Box>
                </form>
              </TabPanel>
            </Box>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default LoginPage;
