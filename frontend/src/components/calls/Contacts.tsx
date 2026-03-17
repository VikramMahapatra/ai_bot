import { useEffect, useState } from "react";
import { alpha, useTheme } from '@mui/material/styles';
import {
    Grid,
    Button,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Typography,
    Box,
    TextField,
    Autocomplete,
    MenuItem,
    Alert,
    Stack,
    FormControl,
    InputLabel,
    Select
} from "@mui/material";
import { callCampaignService, Contact, ContactList } from "../../services/callCampaignService";
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { campaignService } from "../../services/campaignService";
interface ContactsProps {
    form: any;
    setForm: any;
    campaignContacts: Contact[];
    setCampaignContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
    nextStep: () => void;
    prevStep: () => void;
}


const Contacts = ({ form, setForm, campaignContacts, setCampaignContacts, nextStep, prevStep }: ContactsProps) => {

    const [openAdd, setOpenAdd] = useState(false);
    const [mode, setMode] = useState<"crm" | "csv" | null>(null);
    const [contactLists, setContactLists] = useState<ContactList[]>([]);
    const [crmContacts, setCrmContacts] = useState<Contact[]>([]);
    const [openNewContact, setOpenNewContact] = useState(false);
    const [contactForm, setContactForm] = useState({
        name: "",
        email: "",
        phone: "",
        contact_list_id: ""
    });
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [uploadListId, setUploadListId] = useState<number | ''>('');

    const [errors, setErrors] = useState<any>({});
    const [contactError, setContactError] = useState("");
    const [success, setSuccess] = useState('');
    const [mapContactError, setMapContactError] = useState("");
    const [loading, setLoading] = useState(false);
    const theme = useTheme();
    const [dialogContacts, setDialogContacts] = useState<Contact[]>([]);

    const handleAddContacts = () => {
        const existingIds = campaignContacts.map(c => c.id);

        const newContacts = dialogContacts.filter(
            c => !existingIds.includes(c.id)
        );

        setCampaignContacts(prev => [...prev, ...newContacts]);

        setForm((prev: any) => ({
            ...prev,
            contacts: [...prev.contacts, ...newContacts.map(c => c.id)]
        }));
        setOpenAdd(false);
    };


    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;

        setContactForm(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const loadContactLists = async () => {
        const data = await callCampaignService.getContactLists();
        setContactLists(data || []);
    };

    const loadExistingContacts = async () => {
        const data = await callCampaignService.getContactLookup();
        setCrmContacts(data || []);
    };


    useEffect(() => {
        loadContactLists();
        loadExistingContacts();
    }, [form]);


    const validate = () => {

        const newErrors: any = {};

        if (!contactForm.contact_list_id) {
            newErrors.contact_list_id = "List Name is required";
        }

        if (!contactForm.name.trim()) {
            newErrors.name = "Name is required";
        }

        if (!contactForm.phone.trim()) {
            newErrors.phone = "Phone is required";
        }

        if (!contactForm.email.trim()) {
            newErrors.email = "Email is required";
        }

        if (contactForm.email && !/\S+@\S+\.\S+/.test(contactForm.email)) {
            newErrors.email = "Invalid email";
        }

        setErrors(newErrors);

        return Object.keys(newErrors).length === 0;
    };

    const handleSaveContact = async () => {
        if (!validate()) return;

        try {
            const newContact = await callCampaignService.createContact(contactForm);

            // Add the new contact to selected campaignContacts
            setCampaignContacts(prev => [...prev, newContact]);

            // Update form.contacts with the new contact's id
            setForm((prev: any) => ({
                ...prev,
                contacts: [...prev.contacts, newContact.id]
            }));

            loadExistingContacts();
            resetForm();
        } catch (err: any) {
            console.log(err?.response?.data?.detail || 'Something went wrong');
        }
    };

    const handleCloseDialog = () => {
        setOpenAdd(false);
        setMode(null)
    };

    const handleContinue = () => {
        if (form.contacts.length === 0) {
            setContactError("Please add at least one contact");
            return;
        }

        setContactError("");
        nextStep();
    };

    const resetForm = () => {
        setContactForm({
            name: "",
            email: "",
            phone: "",
            contact_list_id: ""
        });

        setErrors({});
        setOpenNewContact(false);
    };

    const showMapContactError = (message: string) => {
        setMapContactError(message);
    };


    const showSuccess = (message: string) => {
        setMapContactError('');
        setSuccess(message);
    };


    const handleOpenAddContacts = () => {
        setDialogContacts(campaignContacts); // preload selected contacts
        setOpenAdd(true);
        setMode(null);
        setCsvFile(null);
        setUploadListId('');
    };

    const handleCsvUpload = async () => {
        if (!uploadListId) {
            showMapContactError('Select a contact list before CSV upload');
            return;
        }
        if (!csvFile) {
            showMapContactError('Choose a CSV file first');
            return;
        }

        setLoading(true);
        try {
            const result = await campaignService.uploadContactsCsv(Number(uploadListId), csvFile);
            setCsvFile(null);
            showSuccess(`CSV upload complete: ${result.created} created, ${result.failed} failed`);
            await loadContactLists();
        } catch (err: any) {
            showMapContactError(err?.response?.data?.detail || 'Failed to upload CSV contacts');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Grid container spacing={2}>

            {/* BUTTONS */}

            <Grid item xs={12} textAlign="right">

                <Button
                    variant="outlined"
                    sx={{ mr: 2 }}
                    onClick={() => {
                        setOpenNewContact(true)
                    }}
                >
                    New Contact
                </Button>

                <Button
                    variant="contained"
                    onClick={handleOpenAddContacts}
                >
                    Add Contacts
                </Button>

            </Grid>

            {/* CONTACT TABLE */}

            <Grid item xs={12}>
                <Stack
                    mb={2}
                >
                    {contactError && (
                        <Alert severity="error" sx={{ borderRadius: '14px', boxShadow: `0 10px 18px ${alpha(theme.palette.error.dark, 0.12)}` }}>
                            {contactError}
                        </Alert>
                    )}
                </Stack>
                <Table>

                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Phone</TableCell>
                            <TableCell>Email</TableCell>
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {campaignContacts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} align="center">
                                    No contacts added
                                </TableCell>
                            </TableRow>
                        ) : (
                            campaignContacts.map((contact: any, index: number) => (
                                <TableRow key={index}>
                                    <TableCell>{contact.name}</TableCell>
                                    <TableCell>{contact.phone}</TableCell>
                                    <TableCell>{contact.email}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>

                </Table>
            </Grid>

            {/* STEPPER */}

            <Grid item xs={6}>
                <Button onClick={prevStep}>Back</Button>
            </Grid>

            <Grid item xs={6} textAlign="right">
                <Button variant="contained"
                    onClick={handleContinue}
                >
                    Continue
                </Button>
            </Grid>

            {/* ADD CONTACTS POPUP */}

            <Dialog open={openAdd} onClose={() => setOpenAdd(false)} maxWidth="sm" fullWidth>

                <DialogTitle>Add Contacts</DialogTitle>

                <DialogContent>

                    {!mode && (
                        <>
                            <Typography mb={2}>
                                Choose how you'd like to add contacts to your database
                            </Typography>

                            <Box display="flex" gap={2}>

                                <Button
                                    variant="outlined"
                                    fullWidth
                                    onClick={() => setMode("crm")}
                                >
                                    Select CRM Contacts
                                </Button>

                                <Button
                                    variant="outlined"
                                    fullWidth
                                    onClick={() => setMode("csv")}
                                >
                                    Upload CSV File
                                </Button>

                            </Box>
                        </>
                    )}

                    {mode === "crm" && (
                        <Box mt={2}>

                            <Autocomplete
                                multiple
                                options={crmContacts}
                                getOptionLabel={(option: Contact) => option.label ?? ""}
                                isOptionEqualToValue={(option, value) => option.id === value.id}
                                value={dialogContacts}
                                onChange={(event, newValue) => setDialogContacts(newValue)}
                                renderInput={(params) => (
                                    <TextField {...params} label="Select Contacts" />
                                )}
                            />

                        </Box>
                    )}

                    {mode === "csv" && (
                        <>
                            <Box mt={2}>
                                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Upload Contacts</Typography>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} md={6}>
                                        <FormControl fullWidth>
                                            <InputLabel>Target Contact List</InputLabel>
                                            <Select
                                                value={uploadListId}
                                                label="Target Contact List"
                                                onChange={(e) => setUploadListId(Number(e.target.value))}
                                            >
                                                {contactLists.map((list) => (
                                                    <MenuItem key={list.id} value={list.id}>{list.list_name}</MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <Alert severity="info">CSV format: name,email,phone</Alert>
                                    </Grid>
                                </Grid>
                            </Box>
                            <Box mt={2}>

                                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>CSV Upload</Typography>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                    <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}>
                                        Choose CSV
                                        <input
                                            hidden
                                            type="file"
                                            accept=".csv"
                                            onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                                        />
                                    </Button>
                                    <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
                                        {csvFile ? csvFile.name : 'No file selected'}
                                    </Typography>
                                    <Button variant="contained" onClick={handleCsvUpload}>Upload CSV</Button>
                                </Stack>

                            </Box>
                        </>

                    )}

                </DialogContent>

                <DialogActions>
                    <Button variant="outlined" onClick={handleCloseDialog} color="error">Cancel</Button>
                    <Button variant="contained" onClick={handleAddContacts}>
                        Done
                    </Button>
                </DialogActions>

            </Dialog>

            {/* NEW CONTACT FORM */}

            <Dialog
                open={openNewContact}
                onClose={() => setOpenNewContact(false)}
                maxWidth="sm"
                fullWidth
            >

                <DialogTitle>Add New Contact</DialogTitle>

                <DialogContent>

                    <Grid container spacing={2} mt={1}>
                        <Grid item xs={12}>
                            <TextField
                                required
                                select
                                fullWidth
                                label="Contact List"
                                name="contact_list_id"
                                value={contactForm.contact_list_id}
                                onChange={(e) =>
                                    setContactForm({ ...contactForm, contact_list_id: e.target.value })
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
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                required
                                fullWidth
                                label="Name"
                                name="name"
                                value={contactForm.name}
                                onChange={handleInputChange}
                                error={!!errors.name}
                                helperText={errors.name}
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                required
                                fullWidth
                                label="Email"
                                name="email"
                                value={contactForm.email}
                                onChange={handleInputChange}
                                error={!!errors.email}
                                helperText={errors.email}
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Phone"
                                name="phone"
                                value={contactForm.phone}
                                onChange={handleInputChange}
                                error={!!errors.phone}
                                helperText={errors.phone}
                            />
                        </Grid>



                    </Grid>

                </DialogContent>

                <DialogActions>

                    <Button onClick={() => {
                        setOpenNewContact(false);
                        resetForm();
                    }}>
                        Cancel
                    </Button>

                    <Button variant="contained" onClick={handleSaveContact}>
                        Save Contact
                    </Button>

                </DialogActions>

            </Dialog>

        </Grid>
    );
};

export default Contacts;