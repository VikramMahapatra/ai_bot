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
    Alert,
    TableContainer,
    Chip
} from "@mui/material";

import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import { callCampaignService, Contact } from "../../services/callCampaignService";
import { campaignService, ContactItem, ContactListItem } from "../../services/campaignService";
import { formatDate } from "../../utils/dateUtils";
import ListAltIcon from '@mui/icons-material/ListAlt';
import DeleteIcon from '@mui/icons-material/Delete';

type ContactForm = Omit<ContactItem, 'id' | 'created_at'>;

const CampaignContacts = () => {
    const theme = useTheme();
    const [contacts, setContacts] = useState<ContactItem[]>([]);
    const [campaignContactTotal, setCampaignContactTotal] = useState(0);
    const [campaignContactPage, setCampaignContactPage] = useState(0);
    const [campaignContactRowsPerPage, setCampaignContactRowsPerPage] = useState(10);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [selectedListId, setSelectedListId] = useState<number | ''>('');
    const [createContactListId, setCreateContactListId] = useState<number | ''>('');

    const [contactLists, setContactLists] = useState<ContactListItem[]>([]);
    const [contactListSearch, setContactListSearch] = useState('');
    const [contactListPage, setContactListPage] = useState(0);
    const [contactListRowsPerPage, setContactListRowsPerPage] = useState(10);
    const [contactListTotal, setContactListTotal] = useState(0);

    const [newListName, setNewListName] = useState('');
    const [newListDescription, setNewListDescription] = useState('');

    const [uploadListId, setUploadListId] = useState<number | ''>('');

    const [openForm, setOpenForm] = useState(false);
    const [editContact, setEditContact] = useState<ContactItem | null>(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [errors, setErrors] = useState<any>({});
    const [form, setForm] = useState<ContactForm>({
        name: "",
        email: "",
        phone: "",
        company: "",
        contact_list_id: null
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

    const loadContactLists = async () => {
        const data = await campaignService.listContactLists({
            search: contactListSearch || undefined,
            skip: contactListPage * contactListRowsPerPage,
            limit: contactListRowsPerPage,
        });
        setContactLists(data.items || []);
        setContactListTotal(data.pagination?.total || 0);
    };

    useEffect(() => {
        loadContactLists();
    }, []);

    /* ---------------------------
    Search Filter
---------------------------- */

    useEffect(() => {
        const run = async () => {
            try {
                await loadContacts(selectedListId as number);
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
            company: "",
            contact_list_id: selectedListId as number || null
        });
        setErrors({});
        setOpenForm(true);
    };

    /* ---------------------------
        Open Edit Form
    ---------------------------- */

    const handleEdit = (contact: ContactItem) => {

        setEditContact(contact);
        setErrors({});
        setForm({
            name: contact.name,
            email: contact.email,
            phone: contact.phone,
            company: contact.company || "",
            contact_list_id: contact.contact_list_id
        });

        setOpenForm(true);
    };

    const handleDeleteContact = async (id: number) => {
        if (!selectedListId) return;
        setLoading(true);
        try {
            await campaignService.deleteContact(id);
            showSuccess('Contact deleted');
            await loadContacts(Number(selectedListId));
            await loadContactLists();
        } catch (err: any) {
            showError(err?.response?.data?.detail || 'Failed to delete contact');
        } finally {
            setLoading(false);
        }
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
            loadContacts(selectedListId as number);
        } catch {
            console.log("Something went wrong!")
        }
    };

    const loadContacts = async (contactListId: number) => {
        if (!contactListId) return;
        const data = await campaignService.listContacts(contactListId, {
            search: search || undefined,
            skip: campaignContactPage * campaignContactRowsPerPage,
            limit: campaignContactRowsPerPage,
        });
        setContacts(data.items || []);
        setCampaignContactTotal(data.pagination?.total || 0);
    };

    const sectionPanelSx = {
        borderRadius: '18px',
        border: `1px solid ${alpha(theme.palette.common.white, 0.62)}`,
        background: `linear-gradient(150deg, ${alpha(theme.palette.common.white, 0.7)} 0%, ${alpha(
            theme.palette.background.paper,
            0.82
        )} 68%, ${alpha('#dce8f8', 0.78)} 100%)`,
        boxShadow: `0 14px 30px ${alpha(theme.palette.primary.dark, 0.14)}`,
        backdropFilter: 'blur(10px)',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
                'linear-gradient(138deg, rgba(255,255,255,0.22) 8%, transparent 24%), linear-gradient(28deg, transparent 56%, rgba(78,137,213,0.14) 57%, transparent 80%)',
        },
        '& > *': {
            position: 'relative',
            zIndex: 1,
        },
    } as const;

    const compactInputSx = {
        '& .MuiInputBase-root': {
            minHeight: 40,
        },
    } as const;

    const compactButtonSx = {
        '& .MuiButton-root': {
            minHeight: 40,
        },
    } as const;

    const handleCreateList = async () => {
        if (!newListName.trim()) {
            showError('Contact list name is required');
            return;
        }

        setLoading(true);
        try {
            await campaignService.createContactList({
                list_name: newListName,
                description: newListDescription || undefined,
            });
            setNewListName('');
            setNewListDescription('');
            showSuccess('Contact list created successfully');
            await loadContactLists();
        } catch (err: any) {
            showError(err?.response?.data?.detail || 'Failed to create contact list');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteList = async (id: number) => {
        if (!window.confirm('Delete this contact list?')) return;

        setLoading(true);
        try {
            await campaignService.deleteContactList(id);
            if (selectedListId === id) {
                setSelectedListId('');
                setContacts([]);
            }
            if (uploadListId === id) {
                setUploadListId('');
            }
            if (createContactListId === id) {
                setCreateContactListId('');
            }
            showSuccess('Contact list deleted');
            await loadContactLists();
        } catch (err: any) {
            showError(err?.response?.data?.detail || 'Failed to delete contact list');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectListForContacts = async (id: number) => {
        setSelectedListId(id);
        setCampaignContactPage(0);
        setSearch('');
        setLoading(true);
        try {
            await loadContacts(id);
        } catch (err: any) {
            showError(err?.response?.data?.detail || 'Failed to load contacts');
        } finally {
            setLoading(false);
        }
    };

    const getContactListLabel = (list: ContactListItem) => {
        const autoTag = list.is_agent_auto_list ? ' • Auto' : '';
        return `${list.list_name}${autoTag} (${list.contact_count})`;
    };

    const getContactListDescription = (list: ContactListItem) => {
        if (list.description) return list.description;
        if (list.is_agent_auto_list) {
            const widgetSuffix = list.agent_widget_id ? ` for agent ${list.agent_widget_id}` : '';
            return `Auto-created from appointment bookings${widgetSuffix}`;
        }
        return '-';
    };

    return (
        <>
            <Stack spacing={2.5}>
                {(success || error) && (
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
                )}

                <Paper sx={{ ...sectionPanelSx, p: 2.5 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Create Contact List</Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                            <TextField
                                size="small"
                                sx={compactInputSx}
                                fullWidth
                                label="List Name"
                                value={newListName}
                                onChange={(e) => setNewListName(e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                size="small"
                                sx={compactInputSx}
                                fullWidth
                                label="Description"
                                value={newListDescription}
                                onChange={(e) => setNewListDescription(e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12} md={2}>
                            <Button size="small" sx={compactButtonSx} fullWidth variant="contained" onClick={handleCreateList}>Create</Button>
                        </Grid>
                    </Grid>
                </Paper>

                <Paper sx={{ ...sectionPanelSx, p: 2.5 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Contact Lists</Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
                        <TextField
                            size="small"
                            sx={compactInputSx}
                            label="Filter Lists"
                            value={contactListSearch}
                            onChange={(e) => setContactListSearch(e.target.value)}
                        />
                        <Button size="small" sx={compactButtonSx} variant="outlined" onClick={() => { setContactListPage(0); loadContactLists(); }}>
                            Apply
                        </Button>
                    </Stack>

                    <TableContainer sx={{ borderRadius: '12px', border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}` }}>
                        <Table>
                            <TableHead>
                                <TableRow sx={{ background: `linear-gradient(110deg, ${alpha('#e7f0ff', 0.8)} 0%, ${alpha('#d8e9ff', 0.68)} 100%)` }}>
                                    <TableCell>List Name</TableCell>
                                    <TableCell>Description</TableCell>
                                    <TableCell>Contacts</TableCell>
                                    <TableCell>Created</TableCell>
                                    <TableCell>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {contactLists.length ? (
                                    contactLists.map((list) => (
                                        <TableRow key={list.id} hover sx={{ '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.05) } }}>
                                            <TableCell>
                                                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                                    <Typography>{list.list_name}</Typography>
                                                    {list.is_agent_auto_list && (
                                                        <Chip size="small" color="info" variant="outlined" label="Auto-created" />
                                                    )}
                                                </Stack>
                                            </TableCell>
                                            <TableCell>{getContactListDescription(list)}</TableCell>
                                            <TableCell>{list.contact_count}</TableCell>
                                            <TableCell>{formatDate(list.created_at)}</TableCell>
                                            <TableCell>
                                                <Stack direction="row" spacing={1}>
                                                    <Button size="small" startIcon={<ListAltIcon />} onClick={() => handleSelectListForContacts(list.id)}>
                                                        View Contacts
                                                    </Button>
                                                    <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => handleDeleteList(list.id)}>
                                                        Delete
                                                    </Button>
                                                </Stack>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} align="center">No contact lists found.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <TablePagination
                        component="div"
                        count={contactListTotal}
                        page={contactListPage}
                        onPageChange={(_, value) => setContactListPage(value)}
                        rowsPerPage={contactListRowsPerPage}
                        onRowsPerPageChange={(event) => {
                            setContactListRowsPerPage(parseInt(event.target.value, 10));
                            setContactListPage(0);
                        }}
                        rowsPerPageOptions={[10, 25, 50]}
                    />
                </Paper>

                {selectedListId && (
                    <Paper sx={{ ...sectionPanelSx, p: 2.5 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                            Contacts (List #{selectedListId})
                        </Typography>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
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
                        </Stack>
                        <TableContainer sx={{ borderRadius: '12px', border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}` }}>
                            <Table>
                                <TableHead>
                                    <TableRow sx={{ background: `linear-gradient(110deg, ${alpha('#e7f0ff', 0.8)} 0%, ${alpha('#d8e9ff', 0.68)} 100%)` }}>
                                        <TableCell>Name</TableCell>
                                        <TableCell>Email</TableCell>
                                        <TableCell>Phone</TableCell>
                                        <TableCell>Company</TableCell>
                                        <TableCell>Created</TableCell>
                                        <TableCell>Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {contacts.length ? (
                                        contacts.map((contact) => (
                                            <TableRow key={contact.id} hover sx={{ '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.05) } }}>
                                                <TableCell>{contact.name || '-'}</TableCell>
                                                <TableCell>{contact.email || '-'}</TableCell>
                                                <TableCell>{contact.phone || '-'}</TableCell>
                                                <TableCell>{contact.company || '-'}</TableCell>
                                                <TableCell>{formatDate(contact.created_at)}</TableCell>
                                                <TableCell>
                                                    <Button size="small" color="primary" startIcon={<EditIcon />} onClick={() => handleEdit(contact)}>
                                                        Edit
                                                    </Button>
                                                    <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => handleDeleteContact(contact.id)}>
                                                        Delete
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={6} align="center">No contacts found.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
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
                )}
            </Stack>
            <Box>
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
                                    setForm({ ...form, contact_list_id: Number(e.target.value) || null })
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
                                required
                                label="Phone"
                                value={form.phone}
                                onChange={(e) =>
                                    setForm({ ...form, phone: e.target.value })
                                }
                                error={!!errors.phone}
                                helperText={errors.phone}
                            />

                            <TextField
                                label="Company"
                                value={form.company}
                                onChange={(e) =>
                                    setForm({ ...form, company: e.target.value })
                                }
                                error={!!errors.company}
                                helperText={errors.company}
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
        </>

    );
};

export default CampaignContacts;