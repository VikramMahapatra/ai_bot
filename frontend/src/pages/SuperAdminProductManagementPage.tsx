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
import { Product, productService } from "../services/productService";
import {
  SuperAdminProduct,
  SuperAdminProductFormData,
  SuperAdminProductFormErrors,
} from "../types/superAdminProduct";

const SuperAdminProductManagementPage: React.FC = () => {
  const theme = useTheme();

  const [products, setProducts] = useState<SuperAdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openDialog, setOpenDialog] = useState(false);
  const [editingProduct, setEditingProduct] =
    useState<SuperAdminProduct | null>(null);

  const [search, setSearch] = useState("");
  const [productTotal, setProductTotal] = useState(0);
  const [productPage, setProductPage] = useState(0);
  const [productRowsPerPage, setProductRowsPerPage] = useState(10);

  const [formData, setFormData] = useState<SuperAdminProductFormData>({
    name: "",
    code: "",
    isActive: true,
  });

  const [formErrors, setFormErrors] = useState<SuperAdminProductFormErrors>({
    name: "",
    code: "",
  });

  const [productError, setProductError] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, [search, productPage, productRowsPerPage]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      setLoading(true);

      // Mock data for demonstration
      const mockProducts: Product[] = [
        {
          id: 1,
          name: "WhatsApp Business",
          code: "WHATSAPP",
          isActive: true,
          organisation: "Acme Corporation",
          created_at: "2024-01-15T10:30:00Z",
        },
        {
          id: 2,
          name: "Email Service",
          code: "EMAIL",
          isActive: true,
          organisation: "Tech Solutions Inc",
          created_at: "2024-01-20T14:15:00Z",
        },
        {
          id: 3,
          name: "SMS Gateway",
          code: "SMS",
          isActive: false,
          organisation: "Global Marketing Ltd",

          created_at: "2024-02-01T09:00:00Z",
        },
        {
          id: 4,
          name: "Voice Call",
          code: "VOICE",
          isActive: true,
          organisation: "Customer Support Co",
          created_at: "2024-02-10T16:45:00Z",
        },
        {
          id: 5,
          name: "Chat Widget",
          code: "CHAT",
          isActive: false,
          organisation: "Digital Agency Pro",

          created_at: "2024-02-15T11:20:00Z",
        },
      ];

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Filter mock data based on search
      let filteredProducts = mockProducts;
      if (search) {
        filteredProducts = mockProducts.filter(
          (product) =>
            product.name.toLowerCase().includes(search.toLowerCase()) ||
            product.code.toLowerCase().includes(search.toLowerCase()),
        );
      }

      // Apply pagination
      const startIndex = productPage * productRowsPerPage;
      const endIndex = startIndex + productRowsPerPage;
      const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

      setProducts(paginatedProducts);
      setProductTotal(filteredProducts.length);

      // Uncomment below to use real API instead of mock data
      /*
      const data = await productService.listProducts({
        search: search || undefined,
        skip: productPage * productRowsPerPage,
        limit: productRowsPerPage,
      });
      setProducts(data.items || []);
      setProductTotal(data.pagination?.total || 0);
      */
    } catch (err) {
      setError("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (product?: SuperAdminProduct) => {
    setProductError("");
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        code: product.code,
        isActive: product.isActive,
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: "",
        code: "",
        isActive: true,
      });
    }

    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingProduct(null);
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    try {
      const response = await productService.createProduct({
        ...formData,
        description: "",
      });
      if (response.success) {
        fetchProducts();
        handleCloseDialog();
      } else {
        setProductError(response.message);
      }
    } catch {
      setProductError("Failed to create channel");
    }
  };

  const handleUpdate = async () => {
    if (!editingProduct) return;

    if (!validateForm()) return;

    try {
      const response = await productService.updateUser(editingProduct.id, {
        ...formData,
        description: "",
      });
      if (response.success) {
        fetchProducts();
        handleCloseDialog();
      } else {
        setProductError(response.message);
      }
    } catch {
      setProductError("Failed to update channel");
    }
  };

  const handleConfirmDeleteProduct = async () => {
    if (!productToDelete?.id) return;

    setDeleteSubmitting(true);
    setError(null);
    await productService.deleteUser(productToDelete.id);
    setProductToDelete(null);
    await fetchProducts();
    setDeleteSubmitting(false);
  };

  const validateForm = () => {
    const errors: SuperAdminProductFormErrors = {
      name: "",
      code: "",
    };

    if (!formData.name?.trim()) {
      errors.name = "Channel name is required";
    }

    if (!formData.code?.trim()) {
      errors.code = "Channel code is required";
    }

    setFormErrors(errors);

    return !errors.name && !errors.code;
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
                      <TableCell>Organisation</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {products.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          sx={{ py: 8, textAlign: "center" }}
                        >
                          <SearchIcon
                            sx={{ fontSize: 40, color: "text.secondary" }}
                          />
                          <Typography>No products found</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      products.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell>{product.name}</TableCell>

                          <TableCell>
                            <Switch
                              checked={product.isActive}
                              onChange={() => {
                                // Toggle the active status
                                const updatedProducts = products.map((p) =>
                                  p.id === product.id
                                    ? { ...p, isActive: !p.isActive }
                                    : p,
                                );
                                setProducts(updatedProducts);
                              }}
                              color="primary"
                              size="small"
                            />
                          </TableCell>

                          <TableCell>{product.organisation}</TableCell>

                          <TableCell align="right">
                            <Tooltip title="Edit">
                              <IconButton
                                onClick={() => handleOpenDialog(product)}
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton
                                color="error"
                                onClick={() => setProductToDelete(product)}
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
                  count={productTotal}
                  page={productPage}
                  onPageChange={(_, value) => setProductPage(value)}
                  rowsPerPage={productRowsPerPage}
                  onRowsPerPageChange={(event) => {
                    setProductRowsPerPage(parseInt(event.target.value, 10));
                    setProductPage(0);
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
            {editingProduct ? "Edit Product" : "Create Product"}
          </DialogTitle>

          <DialogContent>
            {productError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {productError}
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

            <TextField
              required
              fullWidth
              label="Code"
              margin="normal"
              value={formData.code}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  code: e.target.value.toUpperCase(),
                })
              }
              error={!!formErrors.code}
              helperText={formErrors.code}
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
              onClick={editingProduct ? handleUpdate : handleCreate}
            >
              {editingProduct ? "Update" : "Create"}
            </Button>
          </DialogActions>
        </Dialog>

        <ConfirmDialog
          open={Boolean(productToDelete)}
          title="Delete product?"
          description={
            productToDelete
              ? `This will permanently remove "${productToDelete.name}" (${productToDelete.code}). This action cannot be undone.`
              : undefined
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          confirmColor="error"
          loading={deleteSubmitting}
          onCancel={() => !deleteSubmitting && setProductToDelete(null)}
          onConfirm={handleConfirmDeleteProduct}
        />
      </Box>
    </SuperAdminLayout>
  );
};

export default SuperAdminProductManagementPage;
