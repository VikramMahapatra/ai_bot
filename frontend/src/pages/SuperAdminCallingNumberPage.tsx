import React, { useEffect, useState } from "react";
import {
  Box,
  Card,
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
  Select,
  MenuItem,
  Paper,
  Chip,
  Autocomplete,
  FormControl,
  InputLabel,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import SuperAdminLayout from "../components/Layout/SuperAdminLayout";
import { ConfirmDialog } from "../components/Common/ConfirmDialog";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import { CallingNumberFormData, CallingNumberFormErrors, CallingNumber, callingNumberService } from "../services/callingNumberService";
import { allCountries } from "country-telephone-data";

const SuperAdminCallingNumberPage: React.FC = () => {
  const theme = useTheme();

  const [callingNumbers, setCallingNumbers] = useState<CallingNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openDialog, setOpenDialog] = useState(false);
  const [editingCallingNumber, setEditingCallingNumber] =
    useState<CallingNumber | null>(null);

  const [search, setSearch] = useState("");
  const [callingNumberTotal, setCallingNumberTotal] = useState(0);
  const [callingNumberPage, setCallingNumberPage] = useState(0);
  const [callingNumberRowsPerPage, setCallingNumberRowsPerPage] = useState(10);

  const [formData, setFormData] = useState<CallingNumberFormData>({
    type: "outbound" as any,
    country_code: "+91",
    phone_number: "",
    provider: "",
    is_active: true,
  });

  const [formErrors, setFormErrors] = useState<CallingNumberFormErrors>({
    phone_number: ""
  });

  const [callingNumberError, setCallingNumberError] = useState<string | null>(null);
  const [callingNumberToDelete, setCallingNumberToDelete] = useState<CallingNumber | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    fetchCallingNumbers();
  }, [search, callingNumberPage, callingNumberRowsPerPage]);

  const fetchCallingNumbers = async () => {
    setLoading(true);
    try {
      setLoading(true);

      const data = await callingNumberService.listCallingNumbers({
        search: search || undefined,
        skip: callingNumberPage * callingNumberRowsPerPage,
        limit: callingNumberRowsPerPage,
      });
      setCallingNumbers(data.items || []);
      setCallingNumberTotal(data.pagination?.total || 0);
    } catch (err) {
      setError("Failed to load Calling Numbers");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (callingNumber?: CallingNumber) => {
    setCallingNumberError("");
    if (callingNumber) {
      setEditingCallingNumber(callingNumber);
      setFormData({
        type: callingNumber.type,
        phone_number: callingNumber.phone_number,
        country_code: callingNumber.country_code,
        provider: callingNumber.provider || "",
        is_active: callingNumber.is_active,
      });
    } else {
      setEditingCallingNumber(null);
      setFormData({
        type: "outbound" as any,
        country_code: "+91",
        phone_number: "",
        provider: "",
        is_active: true,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingCallingNumber(null);
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    try {
      const response = await callingNumberService.createCallingNumber({
        ...formData,
      });
      if (response.success) {
        fetchCallingNumbers();
        handleCloseDialog();
      } else {
        setCallingNumberError(response.message);
      }
    } catch {
      setCallingNumberError("Failed to create CallingNumber");
    }
  };

  const handleUpdate = async () => {
    if (!editingCallingNumber) return;

    if (!validateForm()) return;

    try {
      const response = await callingNumberService.updateCallingNumber(editingCallingNumber.id, {
        ...formData,
      });
      if (response.success) {
        fetchCallingNumbers();
        handleCloseDialog();
      } else {
        setCallingNumberError(response.message);
      }
    } catch {
      setCallingNumberError("Failed to update Calling number");
    }
  };

  const handleConfirmDeleteCallingNumber = async () => {
    if (!callingNumberToDelete?.id) return;

    setDeleteSubmitting(true);
    setError(null);
    await callingNumberService.deleteCallingNumber(callingNumberToDelete.id);
    setCallingNumberToDelete(null);
    await fetchCallingNumbers();
    setDeleteSubmitting(false);
  };

  const validateForm = () => {
    const errors: CallingNumberFormErrors = {
      phone_number: "",
    };

    if (!formData.phone_number?.trim()) {
      errors.phone_number = "Phone number is required";
    }

    setFormErrors(errors);

    return !errors.phone_number;
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
                Calling Number Management
              </Typography>

              <Typography variant="body2" color="text.secondary">
                Manage all system calling numbers
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
                Create calling number
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

        {loading ? (
          <Box textAlign="center" p={4}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow
                  sx={{
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                  }}
                >
                  <TableCell>Phone Number</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Is Active</TableCell>
                  <TableCell>Organization</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {callingNumbers.length === 0 ? (
                  <TableRow >
                    <TableCell
                      colSpan={5}
                      sx={{ py: 8, textAlign: "center" }}
                    >
                      <SearchIcon
                        sx={{ fontSize: 40, color: "text.secondary" }}
                      />
                      <Typography>No calling numbers found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  callingNumbers.map((callingNumber) => (
                    <TableRow key={callingNumber.id}>
                      <TableCell>
                        {[callingNumber.country_code, callingNumber.phone_number]
                          .filter(Boolean)
                          .join(" ")}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={callingNumber.type.replace(/^./, (c) => c.toUpperCase())}
                          size="small"
                          color={
                            callingNumber.type === "inbound"
                              ? "success"
                              : "primary"
                          }
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={callingNumber.is_active}
                          onChange={() => {
                            // Toggle the active status
                            const updatedCallingNumbers = callingNumbers.map((p) =>
                              p.id === callingNumber.id
                                ? { ...p, isActive: !p.is_active }
                                : p,
                            );
                            setCallingNumbers(updatedCallingNumbers);
                          }}
                          color="primary"
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {callingNumber.organizations && callingNumber.organizations.length > 0
                          ? callingNumber.organizations.map((org) => org.name).join(", ")
                          : "-"}
                      </TableCell>

                      <TableCell align="right">
                        <Tooltip title="Edit">
                          <IconButton
                            onClick={() => handleOpenDialog(callingNumber)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            color="error"
                            onClick={() => setCallingNumberToDelete(callingNumber)}
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
              count={callingNumberTotal}
              page={callingNumberPage}
              onPageChange={(_, value) => setCallingNumberPage(value)}
              rowsPerPage={callingNumberRowsPerPage}
              onRowsPerPageChange={(event) => {
                setCallingNumberRowsPerPage(parseInt(event.target.value, 10));
                setCallingNumberPage(0);
              }}
              rowsPerPageOptions={[10, 25, 50]}
            />
          </TableContainer>
        )}
        {/* Dialog */}
        <Dialog
          open={openDialog}
          onClose={handleCloseDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            {editingCallingNumber
              ? "Edit Calling Number"
              : "Create Calling Number"}
          </DialogTitle>

          <DialogContent sx={{ paddingTop: "10px !important" }}>
            <Autocomplete
              size="small"
              options={allCountries}
              autoHighlight
              getOptionLabel={(option: any) =>
                `${option.name} (+${option.dialCode})`
              }
              value={
                allCountries.find(
                  (c: any) => `+${c.dialCode}` === formData.country_code,
                ) || null
              }
              onChange={(event, newValue: any) => {
                setFormData({
                  ...formData,
                  country_code: newValue ? `+${newValue.dialCode}` : "",
                })
              }}
              renderOption={(props, option: any) => (
                <Box
                  component="li"
                  {...props}
                  display="flex"
                  alignItems="center"
                  gap={1}
                >
                  <img
                    src={`https://flagcdn.com/w20/${option.iso2}.png`}
                    alt={option.name}
                    width="20"
                    height="14"
                  />
                  {option.name} (+{option.dialCode})
                </Box>
              )}
              renderInput={(params) => (
                <TextField {...params} label="Country Code" />
              )}
              sx={{ minWidth: 240 }}
            />

            <TextField
              fullWidth
              required
              margin="normal"
              label="Phone Number"
              value={formData.phone_number}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  phone_number: e.target.value,
                })
              }
              error={!!formErrors.phone_number}
              helperText={formErrors.phone_number}
            />

            <FormControl fullWidth required>
              <InputLabel id="calling-type-label">Type</InputLabel>

              <Select
                labelId="calling-type-label"
                value={formData.type || "outbound"}
                label="Type"
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as "inbound" | "outbound",
                  })
                }
              >
                <MenuItem value="inbound">Inbound</MenuItem>
                <MenuItem value="outbound">Outbound</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              margin="normal"
              label="Provider"
              value={formData.provider}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  provider: e.target.value,
                })
              }
            />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      is_active: e.target.checked,
                    })
                  }
                />
              }
              label="Active"
            />
          </DialogContent>

          <DialogActions>
            <Button
              onClick={() => setOpenDialog(false)}
            >
              Cancel
            </Button>

            <Button
              variant="contained"
              onClick={
                editingCallingNumber
                  ? handleUpdate
                  : handleCreate
              }
            >
              {editingCallingNumber
                ? "Update"
                : "Create"}
            </Button>
          </DialogActions>
        </Dialog>

        <ConfirmDialog
          open={Boolean(callingNumberToDelete)}
          title="Delete Calling Number?"
          description={
            callingNumberToDelete
              ? `This will permanently remove "${callingNumberToDelete.phone_number}". This action cannot be undone.`
              : undefined
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          confirmColor="error"
          loading={deleteSubmitting}
          onCancel={() => !deleteSubmitting && setCallingNumberToDelete(null)}
          onConfirm={handleConfirmDeleteCallingNumber}
        />
      </Box>
    </SuperAdminLayout>
  );
};

export default SuperAdminCallingNumberPage;
