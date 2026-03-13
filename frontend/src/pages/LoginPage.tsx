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
        display: 'flex',
        alignItems: 'center',
        py: { xs: 3, md: 5 },
        background:
          'radial-gradient(circle at 8% 14%, rgba(74,191,255,0.18) 0%, transparent 44%), radial-gradient(circle at 88% 20%, rgba(53,108,255,0.2) 0%, transparent 46%), linear-gradient(160deg, #f6f9ff 0%, #ecf4ff 45%, #f7fbff 100%)',
      }}
    >
      <Container maxWidth="sm">
        <Paper
          sx={{
            p: { xs: 2.2, md: 3 },
            borderRadius: 3,
            border: '1px solid rgba(53,108,255,0.2)',
            background: 'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(237,246,255,0.93) 100%)',
            boxShadow: '0 26px 60px rgba(19,34,77,0.14)',
            backdropFilter: 'blur(7px)',
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 1 }}>
            <Avatar
              sx={{
                width: 68,
                height: 68,
                mb: 1,
                background: 'linear-gradient(140deg, #2f5ce0 0%, #2d8ef0 100%)',
                boxShadow: '0 16px 28px rgba(45,122,240,0.32)',
              }}
            >
              <SmartToyIcon fontSize="large" />
            </Avatar>
            <Typography variant="h4" align="center" gutterBottom sx={{ fontWeight: 800, color: 'primary.main', mb: 0.4 }}>
              Welcome to Zentrixel AI
            </Typography>
            <Typography variant="body2" align="center" sx={{ color: 'text.secondary', mb: 2 }}>
              Sign in to manage your knowledge base, leads, and AI conversations.
            </Typography>
          </Box>

          <Tabs
            value={tabValue}
            onChange={(_, v) => setTabValue(v)}
            centered
            sx={{
              mb: 1,
              '& .MuiTabs-indicator': { display: 'none' },
              '& .MuiTab-root': {
                textTransform: 'none',
                minHeight: 42,
                borderRadius: 2,
                fontWeight: 700,
                color: 'text.secondary',
                mx: 0.5,
              },
              '& .Mui-selected': {
                color: 'primary.main',
                background: 'rgba(53,108,255,0.13)',
              },
            }}
          >
            <Tab label="Login" />
            <Tab label="Register" />
          </Tabs>

          {error && <Alert severity="error" sx={{ mt: 1.2 }}>{error}</Alert>}

          <TabPanel value={tabValue} index={0}>
            <form onSubmit={handleLogin}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.4 }}>
                <TextField
                  label="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
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
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.2 }}>
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
                    mt: 0.4,
                    py: 1.2,
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #2f5ce0 0%, #2d8ef0 100%)',
                    boxShadow: '0 14px 24px rgba(45,122,240,0.3)',
                  }}
                >
                  Login
                </Button>
              </Box>
            </form>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <form onSubmit={handleRegister}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.4 }}>
                <TextField
                  label="Organization Name"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  required
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
                    mt: 0.4,
                    py: 1.2,
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #2f5ce0 0%, #2d8ef0 100%)',
                    boxShadow: '0 14px 24px rgba(45,122,240,0.3)',
                  }}
                >
                  Create Organization
                </Button>
              </Box>
            </form>
          </TabPanel>
        </Paper>
      </Container>
    </Box>
  );
};

export default LoginPage;
