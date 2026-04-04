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
    Chip,
    CircularProgress,
    Alert,
    IconButton,
    Tooltip,
    Typography,
    TablePagination,
    LinearProgress,
    InputAdornment,
    Grid,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import AdminLayout from "../components/Layout/AdminLayout";
import { ConfirmDialog } from "../components/Common/ConfirmDialog";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import { Product, productService } from "../services/productService";



const ProductManagementPage: React.FC = () => {
    const theme = useTheme();

    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [openDialog, setOpenDialog] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    const [search, setSearch] = useState("");
    const [productTotal, setProductTotal] = useState(0);
    const [productPage, setProductPage] = useState(0);
    const [productRowsPerPage, setProductRowsPerPage] = useState(10);

    const [formData, setFormData] = useState({
        name: "",
        code: "",
        description: "",
    });

    const [formErrors, setFormErrors] = useState({
        name: "",
        code: ""
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
            const data = await productService.listProducts({
                search: search || undefined,
                skip: productPage * productRowsPerPage,
                limit: productRowsPerPage,
            });
            setProducts(data.items || []);
            setProductTotal(data.pagination?.total || 0);
        } catch (err) {
            setError("Failed to load products");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDialog = (product?: Product) => {
        setProductError('');
        if (product) {
            setEditingProduct(product);
            setFormData({
                name: product.name,
                code: product.code,
                description: product.description || "",
            });
        } else {
            setEditingProduct(null);
            setFormData({
                name: "",
                code: "",
                description: "",
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
            const response = await productService.createProduct(formData);
            if (response.success) {
                fetchProducts();
                handleCloseDialog();
            }
            else {
                setProductError(response.message);
            }

        } catch {
            setProductError("Failed to create product");
        }
    };

    const handleUpdate = async () => {
        if (!editingProduct) return;

        if (!validateForm()) return;

        try {
            const response = await productService.updateUser(editingProduct.id, formData);
            if (response.success) {
                fetchProducts();
                handleCloseDialog();
            }
            else {
                setProductError(response.message);
            }
        } catch {
            setProductError("Failed to update product");
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
        const errors = {
            name: "",
            code: ""
        };

        if (!formData.name?.trim()) {
            errors.name = "Product name is required";
        }

        if (!formData.code?.trim()) {
            errors.code = "Product code is required";
        }

        setFormErrors(errors);

        return !errors.name && !errors.code;
    };


    return (
        <AdminLayout>
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
                            0.92
                        )} 0%, ${alpha(
                            theme.palette.background.paper,
                            0.84
                        )} 72%, ${alpha("#a9bfdc", 0.98)} 100%)`,
                        boxShadow: `0 18px 36px ${alpha(
                            theme.palette.primary.dark,
                            0.24
                        )}`,
                    }}
                >
                    <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                    >
                        <Box>
                            <Typography variant="h4" fontWeight={800}>
                                Product Management
                            </Typography>

                            <Typography variant="body2" color="text.secondary">
                                Manage organization products
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
                                    background:
                                        "linear-gradient(135deg,#2f6bff 0%,#2d8ef0 100%)",
                                    textTransform: "none",
                                    fontWeight: 700,
                                }}
                            >
                                Create Product
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
                                                bgcolor: alpha(
                                                    theme.palette.primary.main,
                                                    0.08
                                                ),
                                            }}
                                        >
                                            <TableCell>Name</TableCell>
                                            <TableCell>Code</TableCell>
                                            <TableCell>Description</TableCell>
                                            <TableCell align="right">
                                                Actions
                                            </TableCell>
                                        </TableRow>
                                    </TableHead>

                                    <TableBody>
                                        {products.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} sx={{ py: 8, textAlign: "center" }}>
                                                    <SearchIcon sx={{ fontSize: 40, color: "text.secondary" }} />
                                                    <Typography>No products found</Typography>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            products.map((product) => (
                                                <TableRow key={product.id}>
                                                    <TableCell>
                                                        {product.name}
                                                    </TableCell>

                                                    <TableCell>
                                                        {product.code}
                                                    </TableCell>

                                                    <TableCell>
                                                        {product.description || "-"}
                                                    </TableCell>


                                                    <TableCell align="right">
                                                        <Tooltip title="Edit">
                                                            <IconButton
                                                                onClick={() =>
                                                                    handleOpenDialog(product)
                                                                }
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
                        {editingProduct
                            ? "Edit Product"
                            : "Create Product"}
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

                        <TextField
                            fullWidth
                            label="Description"
                            multiline
                            rows={3}
                            margin="normal"
                            value={formData.description}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    description: e.target.value,
                                })
                            }
                        />
                    </DialogContent>

                    <DialogActions>
                        <Button onClick={handleCloseDialog}>
                            Cancel
                        </Button>

                        <Button
                            variant="contained"
                            onClick={
                                editingProduct
                                    ? handleUpdate
                                    : handleCreate
                            }
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
        </AdminLayout>
    );
};

export default ProductManagementPage;