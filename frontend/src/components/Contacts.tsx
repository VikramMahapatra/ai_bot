import { useEffect, useState } from "react";
import { alpha, useTheme } from '@mui/material/styles';
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/material.css";
import { allCountries } from "country-telephone-data";
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
    Chip,
    Tabs,
    Tab,
    FormControl,
    InputLabel,
    Select,
    Autocomplete
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import { callCampaignService, Contact } from "../services/callCampaignService";
import { campaignService, ContactItem, ContactListItem } from "../services/campaignService";
import { formatDate } from "../utils/dateUtils";
import ListAltIcon from '@mui/icons-material/ListAlt';
import DeleteIcon from '@mui/icons-material/Delete';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import ContactsIcon from "@mui/icons-material/Contacts";
import PhoneIcon from "@mui/icons-material/Phone";
import EmailIcon from "@mui/icons-material/Email";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import InfoIcon from "@mui/icons-material/Info";
import ErrorIcon from "@mui/icons-material/Error";

type ContactForm = Omit<ContactItem, 'id' | 'created_at'>;

interface ContactsProps {
    tab: number;
    setTab: (value: number) => void;
}

const Contacts = ({ tab, setTab }: ContactsProps) => {
    const theme = useTheme();
    const [contacts, setContacts] = useState<ContactItem[]>([]);
    const [contactTotal, setContactTotal] = useState(0);
    const [contactPage, setContactPage] = useState(0);
    const [contactRowsPerPage, setContactRowsPerPage] = useState(10);
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
    const [manualName, setManualName] = useState('');
    const [manualEmail, setManualEmail] = useState('');
    const [manualPhone, setManualPhone] = useState('');
    const [manualCompany, setManualCompany] = useState('');
    const [manualContacts, setManualContacts] = useState<Array<{ name?: string; email?: string; phone?: string; company?: string }>>([]);
    const [csvFile, setCsvFile] = useState<File | null>(null);

    const [allContacts, setAllContacts] = useState<ContactItem[]>([]);
    const [contactListLookupItems, setContactListsLookupItems] = useState<ContactListItem[]>([]);
    const [allContactTotal, setAllContactTotal] = useState(0);
    const [allContactPage, setAllContactPage] = useState(0);
    const [allContactRowsPerPage, setAllContactRowsPerPage] = useState(10);
    const [allContactSearch, setAllContactSearch] = useState("");
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
    const [uploadCountryCode, setUploadCountryCode] = useState("IN");
    const [uploadResult, setUploadResult] = useState<any>(null);

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
        loadAllContacts();
        loadContactListLookup();
        setUploadResult(null);
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
    }, [search, contactPage, contactRowsPerPage]);

    const validate = () => {

        const newErrors: any = {};

        if (!form.contact_list_id) {
            newErrors.contact_list_id = "List Name is required";
        }

        if (!form.name.trim()) {
            newErrors.name = "Name is required";
        }

        if (!form.phone?.trim() && !form.email?.trim()) {
            newErrors.phone = "Phone or Email is required";
            newErrors.email = "Phone or Email is required";
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
            await loadAllContacts();
        } catch (err: any) {
            showError(err?.response?.data?.detail || 'Failed to delete contact');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteContactFromAllContacts = async (id: number) => {
        setLoading(true);
        try {
            await campaignService.deleteContact(id);
            showSuccess('Contact deleted');
            await loadAllContacts();
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
        setLoading(true);
        try {
            if (editContact) {
                await callCampaignService.updateContact(form, editContact.id);
            } else {
                console.log("calling api")
                await callCampaignService.createContact(form);
            }
            setOpenForm(false);

            if (tab === 0) {
                loadContacts(selectedListId as number);
            }
            loadAllContacts();
        } catch (err: any) {
            showError(err?.response?.data?.detail || err?.detail || "Failed to save the data");
        } finally {
            setLoading(false);
        }
    };

    const handleAddManualContact = () => {
        if (!manualEmail.trim() && !manualPhone.trim()) {
            showError('Manual entry requires email or phone');
            return;
        }

        setManualContacts((prev) => [
            ...prev,
            {
                name: manualName.trim() || undefined,
                email: manualEmail.trim() || undefined,
                phone: manualPhone.trim() || undefined,
                company: manualCompany.trim() || undefined,
            },
        ]);
        setManualName('');
        setManualEmail('');
        setManualPhone('');
        setManualCompany('');
        setError('');
    };

    const loadContacts = async (contactListId: number) => {
        if (!contactListId) return;
        const data = await campaignService.listContacts(contactListId, {
            search: search || undefined,
            skip: contactPage * contactRowsPerPage,
            limit: contactRowsPerPage,
        });
        setContacts(data.items || []);
        setContactTotal(data.pagination?.total || 0);
    };


    const loadAllContacts = async () => {
        const data = await callCampaignService.allContacts({
            search: allContactSearch || undefined,
            skip: allContactPage * allContactRowsPerPage,
            limit: allContactRowsPerPage,
        });
        console.log("contacts data", data)
        setAllContacts(data.items || []);
        setAllContactTotal(data.pagination?.total || 0);
    };

    const loadContactListLookup = async () => {
        const data = await callCampaignService.getContactLists();
        setContactListsLookupItems(data || []);
    };

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
        setContactPage(0);
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

    const handleManualUpload = async () => {
        if (!uploadListId) {
            showError('Select a contact list before manual upload');
            return;
        }
        if (!manualContacts.length) {
            showError('Add at least one contact for manual upload');
            return;
        }

        setLoading(true);
        try {
            const result = await campaignService.uploadContactsManual(Number(uploadListId), { contacts: manualContacts });
            setManualContacts([]);
            showSuccess(`Manual upload complete: ${result.created} created, ${result.failed} failed`);
            await loadContactLists();
            if (selectedListId === uploadListId) {
                await loadContacts(Number(uploadListId));
            }
        } catch (err: any) {
            showError(err?.response?.data?.detail || 'Failed to upload manual contacts');
        } finally {
            setLoading(false);
        }
    };

    const handleCsvUpload = async () => {
        if (!uploadListId) {
            showError('Select a contact list before CSV upload');
            return;
        }
        if (!csvFile) {
            showError('Choose a CSV file first');
            return;
        }
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append("file", csvFile);
            formData.append("country_code", uploadCountryCode);
            const result = await campaignService.uploadContactsCsv(Number(uploadListId), formData);
            setCsvFile(null);
            setUploadResult(result);
            await loadContactLists();
            await loadAllContacts();
            if (selectedListId === uploadListId) {
                await loadContacts(Number(uploadListId));
            }
        } catch (err: any) {
            showError(err?.response?.data?.detail || 'Failed to upload CSV contacts');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadCsvTemplate = () => {
        const template = 'name,email,phone,company\nJohn Doe,john@example.com,+15551234567,Acme Corp\n';
        const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'contacts_template.csv';
        anchor.click();
        URL.revokeObjectURL(url);
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

    const getFlag = (iso2: string) =>
        iso2
            .toUpperCase()
            .replace(/./g, char =>
                String.fromCodePoint(127397 + char.charCodeAt(0))
            );

    return (
        <>
            {(success || error) && (
                <Stack
                    mb={2}
                >
                    {error && (
                        <Alert severity="error"
                            sx={{ borderRadius: '14px', boxShadow: `0 10px 18px ${alpha(theme.palette.error.dark, 0.12)}` }}
                            action={
                                <IconButton
                                    aria-label="close"
                                    color="inherit"
                                    size="small"
                                    onClick={() => setError("")} // clears the error
                                >
                                    <CloseIcon fontSize="inherit" />
                                </IconButton>
                            }
                        >
                            {error}
                        </Alert>
                    )}
                    {success && (
                        <Alert severity="success"
                            sx={{ borderRadius: '14px', boxShadow: `0 10px 18px ${alpha(theme.palette.success.dark, 0.12)}` }}
                            action={
                                <IconButton
                                    aria-label="close"
                                    color="inherit"
                                    size="small"
                                    onClick={() => setSuccess("")} // clears the success message
                                >
                                    <CloseIcon fontSize="inherit" />
                                </IconButton>
                            }
                        >
                            {success}
                        </Alert>
                    )}
                </Stack>
            )}
            <Paper sx={{ ...sectionPanelSx, borderRadius: '16px' }}>
                <Tabs
                    value={tab}
                    onChange={(_, value) => setTab(value)}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{ borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.16)}` }}
                >
                    <Tab label="Contact Lists" icon={<ListAltIcon />} iconPosition="start" />
                    <Tab label="Upload Contacts" icon={<UploadFileIcon />} iconPosition="start" />
                    <Tab label="Contacts" icon={<ContactsIcon />} iconPosition="start" />
                </Tabs>
            </Paper>
            {tab === 0 && (
                <Stack spacing={2.5}>


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
                                count={contactTotal}
                                page={contactPage}
                                onPageChange={(_, value) => setContactPage(value)}
                                rowsPerPage={contactRowsPerPage}
                                onRowsPerPageChange={(event) => {
                                    setContactRowsPerPage(parseInt(event.target.value, 10));
                                    setContactPage(0);
                                }}
                                rowsPerPageOptions={[10, 25, 50]}
                            />
                        </Paper>
                    )}
                </Stack>
            )}
            {tab === 1 && (
                <Stack spacing={2.5}>
                    <Paper sx={{ ...sectionPanelSx, p: 2.5 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Upload Contacts</Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                                <FormControl fullWidth size="small" sx={compactInputSx}>
                                    <InputLabel>Target Contact List</InputLabel>
                                    <Select
                                        value={uploadListId}
                                        label="Target Contact List"
                                        onChange={(e) => setUploadListId(Number(e.target.value))}
                                    >
                                        {contactLists.map((list) => (
                                            <MenuItem key={list.id} value={list.id}>{getContactListLabel(list)}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                {!uploadListId && (
                                    <Alert severity="warning" sx={{ py: 0.5 }}>
                                        Please select a contact list before uploading contacts
                                    </Alert>
                                )}
                            </Grid>
                        </Grid>
                    </Paper>

                    <Paper sx={{ ...sectionPanelSx, p: 2.5 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Manual Entry (Optional)</Typography>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} flexWrap="wrap" useFlexGap>
                            <TextField
                                size="small"
                                sx={{ ...compactInputSx, minWidth: 160, flex: '1 1 180px' }}
                                label="Name"
                                value={manualName}
                                onChange={(e) => setManualName(e.target.value)}
                            />
                            <TextField
                                size="small"
                                sx={{ ...compactInputSx, minWidth: 200, flex: '1 1 220px' }}
                                label="Email"
                                value={manualEmail}
                                onChange={(e) => setManualEmail(e.target.value)}
                            />
                            <Box
                                sx={{
                                    ...compactInputSx,
                                    minWidth: 170,
                                    flex: '1 1 200px'
                                }}
                            >
                                <PhoneInput
                                    country={"in"}
                                    value={manualPhone}
                                    onChange={(phone) => setManualPhone(`+${phone}`)}
                                    inputStyle={{
                                        width: "100%",
                                        height: "40px",
                                        fontSize: "14px"
                                    }}
                                    containerStyle={{
                                        width: "100%"
                                    }}
                                />
                            </Box>
                            <TextField
                                size="small"
                                sx={{ ...compactInputSx, minWidth: 170, flex: '1 1 200px' }}
                                label="Company"
                                value={manualCompany}
                                onChange={(e) => setManualCompany(e.target.value)}
                            />
                            <Button size="small" sx={{ ...compactButtonSx, minWidth: 90 }} variant="outlined" onClick={handleAddManualContact}>
                                Add
                            </Button>
                            <Button size="small" sx={{ ...compactButtonSx, minWidth: 95 }} variant="contained" onClick={handleManualUpload}>
                                Upload
                            </Button>
                        </Stack>

                        {manualContacts.length > 0 && (
                            <TableContainer sx={{ mt: 2 }}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Name</TableCell>
                                            <TableCell>Email</TableCell>
                                            <TableCell>Phone</TableCell>
                                            <TableCell>Company</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {manualContacts.map((item, idx) => (
                                            <TableRow key={`${item.email}-${item.phone}-${idx}`}>
                                                <TableCell>{item.name || '-'}</TableCell>
                                                <TableCell>{item.email || '-'}</TableCell>
                                                <TableCell>{item.phone || '-'}</TableCell>
                                                <TableCell>{item.company || '-'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </Paper>

                    <Paper sx={{ ...sectionPanelSx, p: 2.5 }}>
                        <Box
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                            mb={2}
                        >
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                File Upload
                            </Typography>

                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={<FileDownloadIcon />}
                                onClick={handleDownloadCsvTemplate}
                            >
                                Download CSV Template
                            </Button>
                        </Box>
                        <Alert
                            severity="info"
                            sx={{
                                mb: 2,
                                py: 0.5,
                                alignItems: "flex-start"
                            }}
                        >
                            <Box>
                                <Typography variant="body2" fontWeight={600}>
                                    Excel/CSV Format
                                </Typography>
                                <Typography variant="body2">
                                    • name, email, phone, company
                                </Typography>
                                <Typography variant="body2">
                                    • Enter phone <strong>without country code</strong>.
                                </Typography>
                                <Typography variant="body2">
                                    • Selected country code will be added automatically
                                </Typography>
                            </Box>
                        </Alert>
                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1}
                            alignItems="center"
                            flexWrap="wrap"
                            useFlexGap
                        >
                            <Autocomplete
                                size="small"
                                options={allCountries}
                                autoHighlight
                                getOptionLabel={(option: any) =>
                                    `${option.name} (+${option.dialCode})`
                                }
                                value={
                                    allCountries.find(
                                        (c: any) => c.iso2.toUpperCase() === uploadCountryCode
                                    ) || null
                                }
                                onChange={(event, newValue: any) => {
                                    setUploadCountryCode(newValue?.iso2?.toUpperCase() || "");
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
                                    <TextField
                                        {...params}
                                        label="Country Code"
                                    />
                                )}
                                sx={{ minWidth: 240 }}
                            />
                            <Button sx={compactButtonSx} component="label" variant="outlined" startIcon={<UploadFileIcon />}>
                                Choose CSV/Excel
                                <input
                                    hidden
                                    type="file"
                                    accept=".csv,.xlsx,.xls"
                                    onChange={(e) => {
                                        setCsvFile(e.target.files?.[0] || null);
                                        setUploadResult(null)
                                        e.target.value = "";
                                    }}
                                />
                            </Button>
                            <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
                                {csvFile ? csvFile.name : 'No file selected'}
                            </Typography>
                            <Button
                                sx={compactButtonSx}
                                variant="contained"
                                onClick={handleCsvUpload}
                                disabled={!uploadCountryCode || !csvFile || !uploadListId || loading}
                            >
                                Upload File
                            </Button>
                        </Stack>
                        {uploadResult && (() => {
                            const isSuccess = uploadResult.failed === 0;
                            const isFailed = uploadResult.created === 0 && uploadResult.updated === 0;

                            let title = "File Upload Successful";
                            let bgColor = "#ecfdf5";
                            let borderColor = "#bbf7d0";
                            let textColor = "#065f46";
                            let subTextColor = "#047857";
                            let Icon = CheckCircleIcon;

                            if (!isSuccess && !isFailed) {
                                title = "File Upload Partially Completed";
                                bgColor = "#fffbeb";
                                borderColor = "#fde68a";
                                textColor = "#92400e";
                                subTextColor = "#b45309";
                                Icon = InfoIcon;
                            }

                            if (isFailed) {
                                title = "File Upload Failed";
                                bgColor = "#fef2f2";
                                borderColor = "#fecaca";
                                textColor = "#991b1b";
                                subTextColor = "#b91c1c";
                                Icon = ErrorIcon;
                            }

                            return (
                                <Box
                                    mt={2}
                                    sx={{
                                        p: 2,
                                        borderRadius: 2,
                                        bgcolor: bgColor,
                                        border: `1px solid ${borderColor}`,
                                        display: "flex",
                                        alignItems: "flex-start",
                                        gap: 1.5
                                    }}
                                >
                                    <Icon
                                        sx={{
                                            color: textColor,
                                            fontSize: 22,
                                            mt: "2px"
                                        }}
                                    />

                                    <Box>
                                        <Typography
                                            variant="subtitle2"
                                            sx={{
                                                fontWeight: 600,
                                                color: textColor,
                                                mb: 0.5
                                            }}
                                        >
                                            {title}
                                        </Typography>

                                        <Typography
                                            variant="body2"
                                            sx={{ color: subTextColor }}
                                        >
                                            {uploadResult.created} contacts added,{" "}
                                            {uploadResult.updated} updated,{" "}
                                            {uploadResult.failed} failed.
                                        </Typography>
                                    </Box>
                                </Box>
                            );
                        })()}
                    </Paper>
                </Stack>
            )}
            {tab === 2 && (
                <Box>
                    {/* FILTERS */}

                    <Grid container spacing={2} mb={2} alignItems="center">

                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Search Contacts"
                                value={search}
                                onChange={(e) => setAllContactSearch(e.target.value)}
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

                    {/* CONTACT TABLE */}

                    <Paper>
                        <Table>

                            <TableHead>

                                <TableRow>
                                    <TableCell>Contact List</TableCell>
                                    <TableCell>Name</TableCell>
                                    <TableCell>Company</TableCell>
                                    <TableCell width={120}>Actions</TableCell>
                                </TableRow>

                            </TableHead>

                            <TableBody>
                                {allContacts.length === 0 ? (
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
                                    allContacts.map((contact) => (

                                        <TableRow key={contact.id} hover>
                                            {/* Contact List */}
                                            <TableCell>{contact.contact_list_name}</TableCell>

                                            {/* Name + Phone + Email */}
                                            <TableCell>
                                                <Typography fontWeight={600}>{contact.name}</Typography>
                                                <Box display="flex" alignItems="center" gap={1}>
                                                    <PhoneIcon fontSize="small" color="action" />
                                                    <Typography variant="body2" color="text.secondary">
                                                        {contact.phone || "N/A"}
                                                    </Typography>
                                                </Box>
                                                <Box display="flex" alignItems="center" gap={1}>
                                                    <EmailIcon fontSize="small" color="action" />
                                                    <Typography variant="body2" color="text.secondary">
                                                        {contact.email || "N/A"}
                                                    </Typography>
                                                </Box>
                                            </TableCell>

                                            {/* Company */}
                                            <TableCell>{contact.company || "N/A"}</TableCell>

                                            {/* Actions */}
                                            <TableCell>
                                                <Box display="flex" gap={1}>
                                                    <Button
                                                        size="small"
                                                        color="primary"
                                                        startIcon={<EditIcon />}
                                                        onClick={() => handleEdit(contact)}
                                                    >
                                                        Edit
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        color="error"
                                                        startIcon={<DeleteIcon />}
                                                        onClick={() => handleDeleteContactFromAllContacts(contact.id)}
                                                    >
                                                        Delete
                                                    </Button>
                                                </Box>
                                            </TableCell>
                                        </TableRow>

                                    )))}
                            </TableBody>
                        </Table>
                        <TablePagination
                            component="div"
                            count={allContactTotal}
                            page={allContactPage}
                            onPageChange={(_, value) => setAllContactPage(value)}
                            rowsPerPage={allContactRowsPerPage}
                            onRowsPerPageChange={(event) => {
                                setAllContactRowsPerPage(parseInt(event.target.value, 10));
                                setAllContactPage(0);
                            }}
                            rowsPerPageOptions={[10, 25, 50]}
                        />
                    </Paper >

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
                                        setForm({ ...form, contact_list_id: Number(e.target.value) })
                                    }
                                    error={!!errors.contact_list_id}
                                    helperText={errors.contact_list_id}
                                >
                                    {contactListLookupItems.map((list) => (
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

                    </Dialog >


                </Box >
            )}
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
                                label="Email"
                                value={form.email}
                                onChange={(e) =>
                                    setForm({ ...form, email: e.target.value })
                                }
                                error={!!errors.email}
                                helperText={errors.email}
                            />

                            <Box>
                                <PhoneInput
                                    country={"in"}
                                    value={form.phone}
                                    onChange={(phone) =>
                                        setForm({
                                            ...form,
                                            phone: `+${phone}`
                                        })
                                    }
                                    inputStyle={{
                                        width: "100%",
                                        height: "56px",
                                    }}
                                    containerStyle={{
                                        width: "100%",
                                    }}
                                />

                                {errors.phone && (
                                    <Typography
                                        variant="caption"
                                        color="error"
                                        sx={{ ml: 1 }}
                                    >
                                        {errors.phone}
                                    </Typography>
                                )}
                            </Box>

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

export default Contacts;