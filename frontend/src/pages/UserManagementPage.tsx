import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Paper,
} from '@mui/material';
import AdminLayout from '../components/Layout/AdminLayout';
import { useAuth } from '../context/AuthContext';
import { organizationService } from '../services/organizationService';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface User {
  id: number;
  username: string;
  email: string;
  role: 'ADMIN' | 'USER';
  is_active: boolean;
  organization_id: number;
}

interface CreateUserData {
  username: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'USER';
}

const UserManagementPage: React.FC = () => {
  const { isAdmin, organizationId } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<CreateUserData>({
    username: '',
    email: '',
    password: '',
    role: 'USER',
  });

  useEffect(() => {
    if (!isAdmin) {
      setError('You do not have permission to access this page');
      return;
    }
    fetchUsers();
  }, [isAdmin, organizationId]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await organizationService.listUsers();
      setUsers(response);
      setError(null);
    } catch (err) {
      setError('Failed to load users');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        email: user.email,
        password: '',
        role: user.role,
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        email: '',
        password: '',
        role: 'USER',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingUser(null);
    setFormData({
      username: '',
      email: '',
      password: '',
      role: 'USER',
    });
  };

  const handleCreateUser = async () => {
    try {
      if (!formData.username || !formData.email || !formData.password) {
        setError('All fields are required');
        return;
      }

      await organizationService.createUser({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        role: formData.role,
      });

      setError(null);
      handleCloseDialog();
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create user');
    }
  };

  const handleUpdateUser = async () => {
    try {
      if (!editingUser) return;

      await organizationService.updateUser(editingUser.id, {
        role: formData.role,
        is_active: editingUser.is_active,
      });

      setError(null);
      handleCloseDialog();
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update user');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await organizationService.deleteUser(userId);
        setError(null);
        fetchUsers();
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to delete user');
      }
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    try {
      await organizationService.updateUser(user.id, {
        role: user.role,
        is_active: !user.is_active,
      });
      setError(null);
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update user status');
    }
  };

  if (!isAdmin) {
    return (
      <AdminLayout>
        <Box sx={{ p: 3 }}>
          <Alert severity="error">
            You do not have permission to access this page. Only admins can manage users.
          </Alert>
        </Box>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <div>
            <h1 style={{ margin: '0 0 8px 0', color: '#269b9f' }}>User Management</h1>
            <p style={{ margin: 0, color: '#999', fontSize: '14px' }}>
              Create and manage users in your organization
            </p>
          </div>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            sx={{
              background: 'linear-gradient(135deg, #269b9f 0%, #2db3a0 100%)',
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Create User
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Users Table */}
        <Card>
          <CardContent sx={{ p: 0 }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : users.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                No users found. Create one to get started.
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f5f5f5', borderBottom: '2px solid #e0e0e0' }}>
                      <TableCell sx={{ fontWeight: 600, color: '#269b9f' }}>Username</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#269b9f' }}>Email</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#269b9f' }}>Role</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#269b9f' }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#269b9f' }} align="right">
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow
                        key={user.id}
                        sx={{
                          '&:hover': { bgcolor: '#f9f9f9' },
                          borderBottom: '1px solid #e0e0e0',
                        }}
                      >
                        <TableCell sx={{ fontWeight: 500 }}>{user.username}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Chip
                            label={user.role}
                            size="small"
                            color={user.role === 'ADMIN' ? 'error' : 'default'}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            icon={user.is_active ? <CheckCircleIcon /> : <BlockIcon />}
                            label={user.is_active ? 'Active' : 'Inactive'}
                            size="small"
                            color={user.is_active ? 'success' : 'default'}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Edit role">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenDialog(user)}
                              sx={{ color: '#269b9f' }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={user.is_active ? 'Deactivate' : 'Activate'}>
                            <IconButton
                              size="small"
                              onClick={() => handleToggleUserStatus(user)}
                              sx={{ color: user.is_active ? '#ff9800' : '#4caf50' }}
                            >
                              {user.is_active ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteUser(user.id)}
                              sx={{ color: '#f44336' }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit User Dialog */}
        <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ bgcolor: '#f5f5f5', fontWeight: 600, color: '#269b9f' }}>
            {editingUser ? 'Edit User' : 'Create New User'}
          </DialogTitle>
          <DialogContent sx={{ pt: 3 }}>
            <TextField
              fullWidth
              label="Username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              disabled={!!editingUser}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled={!!editingUser}
              margin="normal"
            />
            {!editingUser && (
              <TextField
                fullWidth
                label="Password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                margin="normal"
              />
            )}
            <FormControl fullWidth margin="normal">
              <InputLabel>Role</InputLabel>
              <Select
                value={formData.role}
                label="Role"
                onChange={(e) => setFormData({ ...formData, role: e.target.value as 'ADMIN' | 'USER' })}
              >
                <MenuItem value="USER">User (Chat only)</MenuItem>
                <MenuItem value="ADMIN">Admin (Full access)</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button
              onClick={editingUser ? handleUpdateUser : handleCreateUser}
              variant="contained"
              sx={{ background: 'linear-gradient(135deg, #269b9f 0%, #2db3a0 100%)' }}
            >
              {editingUser ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </AdminLayout>
  );
};

export default UserManagementPage;
