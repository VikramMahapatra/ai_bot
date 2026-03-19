import { useEffect, useState } from "react";
import { alpha, useTheme } from '@mui/material/styles';
import {
    Box,
    Paper,
    Grid,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    TextField,
    Button,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    InputAdornment,
    MenuItem,
    TablePagination,
    Typography,
    Stack,
    Alert
} from "@mui/material";

import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import { callCampaignService, Contact, ContactList } from "../../services/callCampaignService";



const CampaignContacts = () => {
    const theme = useTheme();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [contactLists, setContactLists] = useState<ContactList[]>([]);
    const [campaignContactTotal, setCampaignContactTotal] = useState(0);
    const [campaignContactPage, setCampaignContactPage] = useState(0);
    const [campaignContactRowsPerPage, setCampaignContactRowsPerPage] = useState(10);

    const [search, setSearch] = useState("");

    const [openForm, setOpenForm] = useState(false);
    const [editContact, setEditContact] = useState<Contact | null>(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [errors, setErrors] = useState<any>({});
    const [form, setForm] = useState({
        name: "",
        email: "",
        phone: "",
        contact_list_id: ""
    });

    const showError = (message: string) => {
        setSuccess('');
        setError(message);
    };

    const showSuccess = (message: string) => {
        setError('');
        setSuccess(message);
    };


    /* ---------------------------
        Fetch Contacts
    ---------------------------- */

    const loadContacts = async () => {
        const data = await callCampaignService.allContacts({
            search: search || undefined,
            skip: campaignContactPage * campaignContactRowsPerPage,
            limit: campaignContactRowsPerPage,
        });
        console.log("contacts data", data)
        setContacts(data.items || []);
        setCampaignContactTotal(data.pagination?.total || 0);
    };

    const loadContactLists = async () => {
        const data = await callCampaignService.getContactLists();
        setContactLists(data || []);
    };

    useEffect(() => {
        loadContacts();
        loadContactLists();
    }, []);

    /* ---------------------------
    Search Filter
---------------------------- */

    useEffect(() => {
        const run = async () => {
            try {
                await loadContacts();
            } catch (err: any) {
                showError(err?.response?.data?.detail || 'Failed to load contact lists');
            }
        };
        run();
    }, [search, campaignContactPage, campaignContactRowsPerPage]);

    const validate = () => {

        const newErrors: any = {};

        if (!form.contact_list_id) {
            newErrors.contact_list_id = "List Name is required";
        }

        if (!form.name.trim()) {
            newErrors.name = "Name is required";
        }

        if (!form.phone.trim()) {
            newErrors.phone = "Phone is required";
        }

        if (!form.email.trim()) {
            newErrors.email = "Email is required";
        }

        if (form.email && !/\S+@\S+\.\S+/.test(form.email)) {
            newErrors.email = "Invalid email";
        }

        setErrors(newErrors);

        return Object.keys(newErrors).length === 0;
    };


    /* ---------------------------
        Open Add Form
    ---------------------------- */

    const handleAdd = () => {

        setEditContact(null);
        setForm({
            name: "",
            email: "",
            phone: "",
            contact_list_id: ""
        });
        setErrors({});
        setOpenForm(true);
    };

    /* ---------------------------
        Open Edit Form
    ---------------------------- */

    const handleEdit = (contact: Contact) => {

        setEditContact(contact);
        setErrors({});
        setForm({
            name: contact.name,
            email: contact.email,
            phone: contact.phone,
            contact_list_id: contact.contact_list_id.toString()
        });

        setOpenForm(true);
    };

    /* ---------------------------
        Save Contact
    ---------------------------- */

    const saveContact = async () => {
        if (!validate()) return;
        try {
            if (editContact) {
                await callCampaignService.updateContact(form, editContact.id);
            } else {
                console.log("calling api")
                await callCampaignService.createContact(form);
            }
            setOpenForm(false);
            loadContacts();
        } catch {
            console.log("Something went wrong!")
        }
    };

    return (

        <Box>
            {/* FILTERS */}

            <Grid container spacing={2} mb={2} alignItems="center">

                <Grid item xs={12} md={6}>
                    <TextField
                        fullWidth
                        size="small"
                        label="Search Contacts"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <SearchIcon />
                                </InputAdornment>
                            )
                        }}
                    />
                </Grid>

                <Grid item xs={12} md={6} textAlign="right">

                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleAdd}
                    >
                        Add Contact
                    </Button>

                </Grid>

            </Grid>

            <Stack
                mb={2}
            >
                {error && (
                    <Alert severity="error" sx={{ borderRadius: '14px', boxShadow: `0 10px 18px ${alpha(theme.palette.error.dark, 0.12)}` }}>
                        {error}
                    </Alert>
                )}
                {success && (
                    <Alert severity="success" sx={{ borderRadius: '14px', boxShadow: `0 10px 18px ${alpha(theme.palette.success.dark, 0.12)}` }}>
                        {success}
                    </Alert>
                )}
            </Stack>

            {/* CONTACT TABLE */}

            <Paper>
                <Table>

                    <TableHead>

                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Email</TableCell>
                            <TableCell>Phone</TableCell>
                            <TableCell width={120}>Actions</TableCell>
                        </TableRow>

                    </TableHead>

                    <TableBody>
                        {contacts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} sx={{ py: 8 }}>
                                    <Box
                                        display="flex"
                                        flexDirection="column"
                                        alignItems="center"
                                        justifyContent="center"
                                        textAlign="center"
                                        gap={1}
                                    >
                                        <SearchIcon sx={{ fontSize: 40, color: "text.secondary" }} />

                                        <Typography sx={{ color: "text.secondary", fontWeight: 500 }}>
                                            No contacts found
                                        </Typography>

                                        <Typography variant="body2" sx={{ color: "text.disabled" }}>
                                            Try adjusting your search or add a new contact
                                        </Typography>
                                    </Box>
                                </TableCell>
                            </TableRow>

                        ) : (
                            contacts.map((contact) => (

                                <TableRow key={contact.id} hover>

                                    <TableCell>{contact.name}</TableCell>
                                    <TableCell>{contact.email}</TableCell>
                                    <TableCell>{contact.phone}</TableCell>

                                    <TableCell>

                                        <IconButton
                                            size="small"
                                            onClick={() => handleEdit(contact)}
                                        >
                                            <EditIcon />
                                        </IconButton>

                                    </TableCell>

                                </TableRow>

                            )))}
                    </TableBody>
                </Table>
                <TablePagination
                    component="div"
                    count={campaignContactTotal}
                    page={campaignContactPage}
                    onPageChange={(_, value) => setCampaignContactPage(value)}
                    rowsPerPage={campaignContactRowsPerPage}
                    onRowsPerPageChange={(event) => {
                        setCampaignContactRowsPerPage(parseInt(event.target.value, 10));
                        setCampaignContactPage(0);
                    }}
                    rowsPerPageOptions={[10, 25, 50]}
                />
            </Paper>

            {/* ADD / EDIT FORM */}

            <Dialog
                open={openForm}
                onClose={() => setOpenForm(false)}
                maxWidth="sm"
                fullWidth
            >

                <DialogTitle>
                    {editContact ? "Edit Contact" : "Add Contact"}
                </DialogTitle>

                <DialogContent>

                    <Box
                        display="flex"
                        flexDirection="column"
                        gap={2}
                        mt={1}
                    >
                        <TextField
                            select
                            required
                            label="Contact List"
                            name="name"
                            value={form.contact_list_id}
                            onChange={(e) =>
                                setForm({ ...form, contact_list_id: e.target.value })
                            }
                            error={!!errors.contact_list_id}
                            helperText={errors.contact_list_id}
                        >
                            {contactLists.map((list) => (
                                <MenuItem key={list.id} value={list.id}>
                                    {list.list_name}
                                </MenuItem>
                            ))}
                        </TextField>

                        <TextField
                            required
                            label="Name"
                            value={form.name}
                            onChange={(e) =>
                                setForm({ ...form, name: e.target.value })
                            }
                            error={!!errors.name}
                            helperText={errors.name}
                        />

                        <TextField
                            required
                            label="Email"
                            value={form.email}
                            onChange={(e) =>
                                setForm({ ...form, email: e.target.value })
                            }
                            error={!!errors.email}
                            helperText={errors.email}
                        />

                        <TextField
                            label="Phone"
                            value={form.phone}
                            onChange={(e) =>
                                setForm({ ...form, phone: e.target.value })
                            }
                            error={!!errors.phone}
                            helperText={errors.phone}
                        />

                    </Box>

                </DialogContent>

                <DialogActions>

                    <Button onClick={() => setOpenForm(false)}>
                        Cancel
                    </Button>

                    <Button
                        variant="contained"
                        onClick={saveContact}
                    >
                        Save
                    </Button>

                </DialogActions>

            </Dialog>


        </Box>

    );
};

export default CampaignContacts;