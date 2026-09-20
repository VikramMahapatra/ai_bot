import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import RuleIcon from "@mui/icons-material/Rule";
import SearchIcon from "@mui/icons-material/Search";
import AdminLayout from "../components/Layout/AdminLayout";
import {
  QualificationStatus,
  QualificationTemplateSummary,
  qualificationTemplateService,
} from "../services/qualificationTemplateService";

const getErrorMessage = (error: any) =>
  error?.response?.data?.detail || "Something went wrong. Please try again.";

export default function QualificationTemplatesPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<QualificationTemplateSummary[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"All" | QualificationStatus>("All");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [selected, setSelected] = useState<QualificationTemplateSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QualificationTemplateSummary | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const result = await qualificationTemplateService.list({
          search: search.trim() || undefined,
          status: status === "All" ? undefined : status,
          skip: page * rowsPerPage,
          limit: rowsPerPage,
        });
        setTemplates(result.items);
        setTotal(result.total);
      } catch (requestError) {
        setError(getErrorMessage(requestError));
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [page, rowsPerPage, search, status]);

  const closeMenu = () => {
    setMenuAnchor(null);
    setSelected(null);
  };

  const refresh = async () => {
    const result = await qualificationTemplateService.list({
      search: search.trim() || undefined,
      status: status === "All" ? undefined : status,
      skip: page * rowsPerPage,
      limit: rowsPerPage,
    });
    setTemplates(result.items);
    setTotal(result.total);
  };

  const toggleStatus = async () => {
    if (!selected) return;
    const nextStatus: QualificationStatus = selected.status === "Active" ? "Inactive" : "Active";
    try {
      await qualificationTemplateService.updateStatus(selected.id, nextStatus);
      setSuccess(`Template ${nextStatus === "Active" ? "activated" : "deactivated"}.`);
      closeMenu();
      await refresh();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  const removeTemplate = async () => {
    if (!deleteTarget) return;
    try {
      await qualificationTemplateService.remove(deleteTarget.id);
      setDeleteTarget(null);
      setSuccess("Qualification template deleted.");
      await refresh();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  return (
    <AdminLayout>
      <Box sx={{ width: "100%", maxWidth: 1500, mx: "auto", p: { xs: 2, md: 3.5 } }}>
        <Box
          sx={{
            display: "flex",
            alignItems: { xs: "flex-start", md: "center" },
            justifyContent: "space-between",
            flexDirection: { xs: "column", md: "row" },
            gap: 2,
            mb: 3,
          }}
        >
          <Stack direction="row" spacing={1.75} alignItems="center">
            <Box
              sx={{
                width: 48,
                height: 48,
                display: "grid",
                placeItems: "center",
                borderRadius: 2,
                color: "#fff",
                bgcolor: "#157f78",
                boxShadow: "0 10px 24px rgba(21,127,120,.25)",
              }}
            >
              <RuleIcon />
            </Box>
            <Box>
              <Typography variant="h4" fontWeight={800}>Qualification Templates</Typography>
              <Typography color="text.secondary">Design reusable rules for consistent lead qualification.</Typography>
            </Box>
          </Stack>
          <Button
            variant="contained"
            size="large"
            startIcon={<AddIcon />}
            onClick={() => navigate("/qualification-templates/new")}
            sx={{ bgcolor: "#157f78", "&:hover": { bgcolor: "#106c66" } }}
          >
            Add qualification template
          </Button>
        </Box>

        <Paper
          elevation={0}
          sx={{
            overflow: "hidden",
            border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
            boxShadow: `0 18px 50px ${alpha(theme.palette.common.black, 0.08)}`,
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}
          >
            <TextField
              fullWidth
              size="small"
              value={search}
              placeholder="Search by template name, objective, or description"
              onChange={(event) => { setSearch(event.target.value); setPage(0); }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
              }}
            />
            <TextField
              select
              size="small"
              value={status}
              onChange={(event) => { setStatus(event.target.value as any); setPage(0); }}
              InputProps={{ startAdornment: <InputAdornment position="start"><FilterAltOutlinedIcon fontSize="small" /></InputAdornment> }}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="All">All statuses</MenuItem>
              <MenuItem value="Active">Active</MenuItem>
              <MenuItem value="Inactive">Inactive</MenuItem>
            </TextField>
          </Stack>

          <TableContainer sx={{ minHeight: 340 }}>
            {loading && <Box sx={{ height: 3 }}><CircularProgress size={22} sx={{ position: "absolute", mt: 2, left: "50%" }} /></Box>}
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.045) }}>
                  <TableCell sx={{ fontWeight: 800 }}>Template</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Campaign / agent objective</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Updated</TableCell>
                  <TableCell align="right" sx={{ width: 72 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {!loading && templates.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ py: 10, textAlign: "center" }}>
                      <RuleIcon sx={{ fontSize: 42, color: "text.disabled", mb: 1 }} />
                      <Typography fontWeight={800}>No qualification templates found</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {search ? "Try a different search." : "Create the first reusable qualification framework."}
                      </Typography>
                      {!search && <Button startIcon={<AddIcon />} onClick={() => navigate("/qualification-templates/new")}>Create template</Button>}
                    </TableCell>
                  </TableRow>
                )}
                {templates.map((template) => (
                  <TableRow key={template.id} hover>
                    <TableCell>
                      <Typography fontWeight={800}>{template.name}</Typography>
                      <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 320 }}>
                        {template.description || "No description"}
                      </Typography>
                    </TableCell>
                    <TableCell><Typography variant="body2" sx={{ maxWidth: 470 }}>{template.objective}</Typography></TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={template.status}
                        sx={{
                          fontWeight: 800,
                          color: template.status === "Active" ? "#08695b" : "text.secondary",
                          bgcolor: template.status === "Active" ? "#dff5ee" : alpha(theme.palette.text.secondary, 0.1),
                        }}
                      />
                    </TableCell>
                    <TableCell>{new Date(template.updated_at || template.created_at).toLocaleDateString()}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        aria-label={`Actions for ${template.name}`}
                        onClick={(event) => { setMenuAnchor(event.currentTarget); setSelected(template); }}
                      ><MoreHorizIcon /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={total}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={(_, nextPage) => setPage(nextPage)}
            onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0); }}
          />
        </Paper>
      </Box>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem onClick={() => { if (selected) navigate(`/qualification-templates/${selected.id}/edit`); closeMenu(); }}>
          <EditOutlinedIcon fontSize="small" sx={{ mr: 1.2 }} /> Edit template
        </MenuItem>
        <MenuItem onClick={toggleStatus}>{selected?.status === "Active" ? "Deactivate" : "Activate"}</MenuItem>
        <MenuItem onClick={() => { setDeleteTarget(selected); closeMenu(); }} sx={{ color: "error.main" }}>
          <DeleteOutlineIcon fontSize="small" sx={{ mr: 1.2 }} /> Delete
        </MenuItem>
      </Menu>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete qualification template?</DialogTitle>
        <DialogContent>This permanently deletes <strong>{deleteTarget?.name}</strong> and all of its qualification rules.</DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={removeTemplate}>Delete</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(error || success)} autoHideDuration={4500} onClose={() => { setError(""); setSuccess(""); }}>
        <Alert severity={error ? "error" : "success"} variant="filled">{error || success}</Alert>
      </Snackbar>
    </AdminLayout>
  );
}