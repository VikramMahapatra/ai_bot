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
import BusinessIcon from '@mui/icons-material/Business';
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
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
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
    <Container maxWidth="sm">
      <Box sx={{ mt: 8 }}>
        <Paper sx={{ p: 4, boxShadow: '0 4px 24px 0 rgba(38,155,159,0.08)' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2 }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 64, height: 64, mb: 1 }}>
              <SmartToyIcon fontSize="large" />
            </Avatar>
            <Typography variant="h4" align="center" gutterBottom sx={{ fontWeight: 700, color: 'primary.main' }}>
              Welcome to Zentrixel AI
            </Typography>
            <Typography variant="subtitle1" align="center" sx={{ color: 'text.secondary', mb: 1 }}>
              Your Conversational Intelligence Platform
            </Typography>
            <Typography variant="body2" align="center" sx={{ color: 'text.secondary', mb: 2 }}>
              Sign in to manage your knowledge, leads, and chat with AI.<br />New here? Register to get started!
            </Typography>
          </Box>

          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} centered sx={{ mb: 2 }}>
            <Tab label="Login" />
            <Tab label="Register" />
          </Tabs>

          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

          <TabPanel value={tabValue} index={0}>
            <form onSubmit={handleLogin}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2 }}>
                        <CircularProgress size={20} />
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
                <Button type="submit" variant="contained" size="large" disabled={loadingOrgs}>
                  Login
                </Button>
              </Box>
            </form>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <form onSubmit={handleRegister}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                <Button type="submit" variant="contained" size="large">
                  Create Organization
                </Button>
              </Box>
            </form>
          </TabPanel>
        </Paper>
      </Box>
    </Container>
  );
};

export default LoginPage;
