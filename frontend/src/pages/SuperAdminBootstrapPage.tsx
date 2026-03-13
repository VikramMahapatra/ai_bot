import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  TextField,
  Typography,
  Alert,
  Avatar,
  InputAdornment,
} from '@mui/material';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import { useNavigate } from 'react-router-dom';
import { superadminService } from '../services/superadminService';

const SuperAdminBootstrapPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await superadminService.bootstrap(username, password, email || undefined);
      setSuccess('Superadmin created. You can now log in.');
      setTimeout(() => navigate('/superadmin/login'), 800);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Bootstrap failed');
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
          'radial-gradient(circle at 10% 12%, rgba(74,191,255,0.18) 0%, transparent 44%), radial-gradient(circle at 86% 26%, rgba(53,108,255,0.22) 0%, transparent 48%), linear-gradient(160deg, #f6f9ff 0%, #ecf4ff 45%, #f7fbff 100%)',
      }}
    >
      <Container maxWidth="sm">
        <Card
          sx={{
            p: 2,
            borderRadius: 3,
            border: '1px solid rgba(53,108,255,0.2)',
            background: 'linear-gradient(145deg, rgba(255,255,255,0.96) 0%, rgba(237,246,255,0.93) 100%)',
            boxShadow: '0 24px 56px rgba(19,34,77,0.14)',
          }}
        >
          <CardContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2 }}>
            <Avatar
              sx={{
                width: 62,
                height: 62,
                mb: 1,
                background: 'linear-gradient(135deg, #2f5ce0 0%, #2d8ef0 100%)',
                boxShadow: '0 14px 24px rgba(45,122,240,0.3)',
              }}
            >
              <RocketLaunchIcon />
            </Avatar>
            <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, color: 'primary.main' }}>
              Super Admin Bootstrap
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Create the initial superadmin account (one-time setup).
            </Typography>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

            <Box component="form" onSubmit={handleSubmit}>
              <TextField
                label="Username"
                fullWidth
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                margin="normal"
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
                label="Email (optional)"
                fullWidth
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                margin="normal"
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
                fullWidth
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                margin="normal"
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
                fullWidth
                sx={{
                  mt: 2,
                  py: 1.2,
                  textTransform: 'none',
                  fontWeight: 800,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #2f5ce0 0%, #2d8ef0 100%)',
                  boxShadow: '0 14px 24px rgba(45,122,240,0.3)',
                }}
              >
                Create Superadmin
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default SuperAdminBootstrapPage;
