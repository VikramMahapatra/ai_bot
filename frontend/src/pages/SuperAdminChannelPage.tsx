import React, { useEffect, useState } from "react";
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
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Typography,
  TablePagination,
  LinearProgress,
  InputAdornment,
  FormControlLabel,
  Switch,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import SuperAdminLayout from "../components/Layout/SuperAdminLayout";
import { ConfirmDialog } from "../components/Common/ConfirmDialog";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import { ChannelFormData, ChannelFormErrors, ChannelList, channelService } from "../services/channelService";

const SuperAdminChannelPage: React.FC = () => {
  const theme = useTheme();

  const [channels, setChannels] = useState<ChannelList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openDialog, setOpenDialog] = useState(false);
  const [editingChannel, setEditingChannel] =
    useState<ChannelList | null>(null);

  const [search, setSearch] = useState("");
  const [channelTotal, setChannelTotal] = useState(0);
  const [channelPage, setChannelPage] = useState(0);
  const [channelRowsPerPage, setChannelRowsPerPage] = useState(10);

  const [formData, setFormData] = useState<ChannelFormData>({
    name: "",
    isActive: true,
  });

  const [formErrors, setFormErrors] = useState<ChannelFormErrors>({
    name: "",
  });

  const [channelError, setChannelError] = useState<string | null>(null);
  const [channelToDelete, setChannelToDelete] = useState<ChannelList | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    fetchChannels();
  }, [search, channelPage, channelRowsPerPage]);

  const fetchChannels = async () => {
    setLoading(true);
    try {
      setLoading(true);
      
      const data = await channelService.listChannels({
        search: search || undefined,
        skip: channelPage * channelRowsPerPage,
        limit: channelRowsPerPage,
      });
      setChannels(data.items || []);
      setChannelTotal(data.pagination?.total || 0);
    } catch (err) {
      setError("Failed to load channels");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (channel?: ChannelList) => {
    setChannelError("");
    if (channel) {
      setEditingChannel(channel);
      setFormData({
        name: channel.name,
        isActive: channel.is_active,
      });
    } else {
      setEditingChannel(null);
      setFormData({
        name: "",
        isActive: true,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingChannel(null);
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    try {
      const response = await channelService.createChannel({
        ...formData,
      });
      if (response.success) {
        fetchChannels();
        handleCloseDialog();
      } else {
        setChannelError(response.message);
      }
    } catch {
      setChannelError("Failed to create channel");
    }
  };

  const handleUpdate = async () => {
    if (!editingChannel) return;

    if (!validateForm()) return;

    try {
      const response = await channelService.updateChannel(editingChannel.channel_id, {
        ...formData,
      });
      if (response.success) {
        fetchChannels();
        handleCloseDialog();
      } else {
        setChannelError(response.message);
      }
    } catch {
      setChannelError("Failed to update channel");
    }
  };

  const handleConfirmDeleteChannel = async () => {
    if (!channelToDelete?.channel_id) return;

    setDeleteSubmitting(true);
    setError(null);
    await channelService.deleteChannel(channelToDelete.channel_id);
    setChannelToDelete(null);
    await fetchChannels();
    setDeleteSubmitting(false);
  };

  const validateForm = () => {
    const errors: ChannelFormErrors = {
      name: "",
    };

    if (!formData.name?.trim()) {
      errors.name = "Channel name is required";
    }

    setFormErrors(errors);

    return !errors.name;
  };

  return (
    <SuperAdminLayout>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Card
          sx={{
            mb: 3,
            p: 2.5,
            borderRadius: "22px",
            border: `1px solid ${alpha(theme.palette.common.white, 0.65)}`,
            background: `linear-gradient(125deg, ${alpha(
              "#deebfb",
              0.92,
            )} 0%, ${alpha(
              theme.palette.background.paper,
              0.84,
            )} 72%, ${alpha("#a9bfdc", 0.98)} 100%)`,
            boxShadow: `0 18px 36px ${alpha(theme.palette.primary.dark, 0.24)}`,
          }}
        >
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Box>
              <Typography variant="h4" fontWeight={800}>
                Channel Management
              </Typography>

              <Typography variant="body2" color="text.secondary">
                Manage all system channels
              </Typography>
            </Box>

            {/* Right Side */}
            <Box display="flex" alignItems="center" gap={2}>
              <TextField
                size="small"
                label="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                sx={{ width: 260 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleOpenDialog()}
                sx={{
                  background: "linear-gradient(135deg,#2f6bff 0%,#2d8ef0 100%)",
                  textTransform: "none",
                  fontWeight: 700,
                }}
              >
                Create Channel
              </Button>
            </Box>
          </Box>
        </Card>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading && (
          <Box mb={3}>
            <LinearProgress sx={{ borderRadius: 1.2 }} />
          </Box>
        )}

        {/* Table */}

        <Card>
          <CardContent sx={{ p: 0 }}>
            {loading ? (
              <Box textAlign="center" p={4}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow
                      sx={{
                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                      }}
                    >
                      <TableCell>Name</TableCell>
                      <TableCell>Is Active</TableCell>
                      <TableCell>Organization</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {channels.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          sx={{ py: 8, textAlign: "center" }}
                        >
                          <SearchIcon
                            sx={{ fontSize: 40, color: "text.secondary" }}
                          />
                          <Typography>No channels found</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      channels.map((channel) => (
                        <TableRow key={channel.channel_id}>
                          <TableCell>{channel.name}</TableCell>

                          <TableCell>
                            <Switch
                              checked={channel.is_active}
                              onChange={() => {
                                // Toggle the active status
                                const updatedChannels = channels.map((p) =>
                                  p.channel_id === channel.channel_id
                                    ? { ...p, isActive: !p.is_active }
                                    : p,
                                );
                                setChannels(updatedChannels);
                              }}
                              color="primary"
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
  {channel.organizations && channel.organizations.length > 0
    ? channel.organizations.map((org) => org.name).join(", ")
    : "-"}
</TableCell>

                          <TableCell align="right">
                            <Tooltip title="Edit">
                              <IconButton
                                onClick={() => handleOpenDialog(channel)}
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton
                                color="error"
                                onClick={() => setChannelToDelete(channel)}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <TablePagination
                  component="div"
                  count={channelTotal}
                  page={channelPage}
                  onPageChange={(_, value) => setChannelPage(value)}
                  rowsPerPage={channelRowsPerPage}
                  onRowsPerPageChange={(event) => {
                    setChannelRowsPerPage(parseInt(event.target.value, 10));
                    setChannelPage(0);
                  }}
                  rowsPerPageOptions={[10, 25, 50]}
                />
              </TableContainer>
            )}
          </CardContent>
        </Card>

        {/* Dialog */}

        <Dialog
          open={openDialog}
          onClose={handleCloseDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            {editingChannel ? "Edit Channel" : "Create Channel"}
          </DialogTitle>

          <DialogContent>
            {channelError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {channelError}
              </Alert>
            )}

            <TextField
              required
              fullWidth
              label="Name"
              margin="normal"
              value={formData.name}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  name: e.target.value,
                })
              }
              error={!!formErrors.name}
              helperText={formErrors.name}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      isActive: e.target.checked,
                    })
                  }
                  color="primary"
                />
              }
              label="Is Active"
              sx={{ mt: 2, mb: 1 }}
            />
          </DialogContent>

          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>

            <Button
              variant="contained"
              onClick={editingChannel ? handleUpdate : handleCreate}
            >
              {editingChannel ? "Update" : "Create"}
            </Button>
          </DialogActions>
        </Dialog>

        <ConfirmDialog
          open={Boolean(channelToDelete)}
          title="Delete channel?"
          description={
            channelToDelete
              ? `This will permanently remove "${channelToDelete.name}". This action cannot be undone.`
              : undefined
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          confirmColor="error"
          loading={deleteSubmitting}
          onCancel={() => !deleteSubmitting && setChannelToDelete(null)}
          onConfirm={handleConfirmDeleteChannel}
        />
      </Box>
    </SuperAdminLayout>
  );
};

export default SuperAdminChannelPage;
