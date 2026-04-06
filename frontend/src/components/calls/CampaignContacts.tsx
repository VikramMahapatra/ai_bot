import { useEffect, useState } from "react";
import { alpha, useTheme } from '@mui/material/styles';
import { ButtonGroup, IconButton, Menu } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
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
import { campaignService } from "../../services/campaignService";
import React from "react";
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import GroupIcon from '@mui/icons-material/Group';
import ListAltIcon from '@mui/icons-material/ListAlt';
import UploadFileIcon from '@mui/icons-material/UploadFile';

interface CampaignContactsProps {
    form: any;
    setForm: any;
    campaignContacts: Contact[];
    setCampaignContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
    nextStep: () => void;
    prevStep: () => void;
}


const CampaignContacts = ({ form, setForm, campaignContacts, setCampaignContacts, nextStep, prevStep }: CampaignContactsProps) => {

    const [openAdd, setOpenAdd] = useState(false);
    const [mode, setMode] = useState<"crm" | "csv" | null>(null);
    const [contactLists, setContactLists] = useState<ContactList[]>([]);
    const [crmContacts, setCrmContacts] = useState<Contact[]>([]);
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [uploadListId, setUploadListId] = useState<number | ''>('');
    const [errors, setErrors] = useState<any>({});
    const [contactError, setContactError] = useState("");
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const theme = useTheme();
    const [dialogContacts, setDialogContacts] = useState<Contact[]>([]);
    const [uploadResult, setUploadResult] = React.useState<any>(null);
    const [anchorEl, setAnchorEl] = useState(null)
    const [openContactList, setOpenContactList] = useState(false)
    const [selectedContactLists, setSelectedContactLists] = useState<number[]>([])

    const handleMenuOpen = (event: any) => {
        setAnchorEl(event.currentTarget)
    }

    const handleMenuClose = () => {
        setAnchorEl(null)
    }

    const handleAddContacts = () => {
        const existingIds = new Set(campaignContacts.map(c => c.id));

        const combined = [
            ...dialogContacts,
            ...(uploadResult?.contacts || [])
        ];

        const uniqueNew: Contact[] = [];
        const seen = new Set();

        for (const c of combined) {
            if (!c?.id) continue;

            // skip if already in campaign OR already added in this batch
            if (existingIds.has(c.id) || seen.has(c.id)) continue;

            seen.add(c.id);
            uniqueNew.push(c);
        }

        if (uniqueNew.length === 0) {
            setOpenAdd(false);
            return;
        }

        setCampaignContacts(prev => [...prev, ...uniqueNew]);

        setForm((prev: any) => ({
            ...prev,
            contacts: [...prev.contacts, ...uniqueNew.map(c => c.id)]
        }));

        setOpenAdd(false);
    };

    const handleAddContactLists = () => {

        const selectedSet = new Set(selectedContactLists)

        // Get contacts belonging to selected lists
        const listContacts = crmContacts.filter(contact =>
            selectedSet.has(contact.contact_list_id)
        )

        // Keep manually added contacts (optional but recommended)
        const manualContacts = campaignContacts.filter(
            c => !c.contact_list_id
        )

        // Merge list contacts + manual contacts
        const mergedContacts = [
            ...manualContacts,
            ...listContacts
        ]

        // Remove duplicates
        const uniqueMap = new Map()

        mergedContacts.forEach(c => {
            if (c?.id) uniqueMap.set(c.id, c)
        })

        const finalContacts = Array.from(uniqueMap.values())

        // Update campaign contacts
        setCampaignContacts(finalContacts)

        // Update form
        setForm((prev: any) => ({
            ...prev,
            contacts: finalContacts.map(c => c.id)
        }))

        setOpenContactList(false)
    }

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
        setUploadResult(null)
    }, []);


    useEffect(() => {
        const selectedContactListIds = [
            ...new Set(dialogContacts.map(c => c.contact_list_id))
        ];
        setSelectedContactLists(selectedContactListIds);
    }, [dialogContacts]);


    const handleCloseDialog = () => {
        setOpenAdd(false);
        setMode(null)
    };

    const handleCloseContactListDialog = () => {
        setOpenContactList(false);
    };

    const handleContinue = () => {
        if (form.contacts.length === 0) {
            setContactError("Please add at least one contact");
            return;
        }

        setContactError("");
        nextStep();
    };


    const handleOpenExistingContacts = () => {
        setDialogContacts(campaignContacts); // preload selected contacts
        setOpenAdd(true);
        setMode("crm")
        setCsvFile(null);
        setUploadListId('');
    }


    const handleRemove = (contactId: number) => {
        // Remove from UI list
        setCampaignContacts((prev: any[]) =>
            prev.filter((c) => c.id !== contactId)
        );

        // Remove from form.contacts
        setForm((prev: any) => ({
            ...prev,
            contacts: prev.contacts.filter((id: number) => id !== contactId)
        }));
    };

    const handleMenuAction = (action: () => void) => {
        handleMenuClose()
        action()
    }

    return (
        <Grid container spacing={2}>

            {/* BUTTONS */}
            <Grid item xs={12} textAlign="right">

                <Button
                    variant="contained"
                    endIcon={<ArrowDropDownIcon />}
                    onClick={handleMenuOpen}
                >
                    Add Contacts
                </Button>

                <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleMenuClose}
                >

                    <MenuItem onClick={() => handleMenuAction(handleOpenExistingContacts)}>
                        <GroupIcon sx={{ mr: 1 }} />
                        Select Existing Contacts
                    </MenuItem>

                    <MenuItem onClick={() => handleMenuAction(() => setOpenContactList(true))}>
                        <ListAltIcon sx={{ mr: 1 }} />
                        Select Contact List
                    </MenuItem>
                </Menu>

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
                            <TableCell>Company</TableCell>
                            <TableCell align="center">Action</TableCell>
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {campaignContacts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} align="center">
                                    No contacts added
                                </TableCell>
                            </TableRow>
                        ) : (
                            campaignContacts.map((contact: any, index: number) => (
                                <TableRow key={index}>
                                    <TableCell>{contact.name}</TableCell>
                                    <TableCell>{contact.phone}</TableCell>
                                    <TableCell>{contact.email}</TableCell>
                                    <TableCell>{contact.company}</TableCell>
                                    <TableCell align="center">
                                        <IconButton
                                            color="error"
                                            onClick={() => handleRemove(contact.id)}
                                        >
                                            <DeleteIcon />
                                        </IconButton>
                                    </TableCell>
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
                </DialogContent>

                <DialogActions>
                    <Button variant="outlined" onClick={handleCloseDialog} color="error">Cancel</Button>
                    <Button variant="contained" onClick={handleAddContacts}>
                        Done
                    </Button>
                </DialogActions>

            </Dialog>

            {/* CONTACT LIST SELECTION */}

            <Dialog open={openContactList} onClose={() => setOpenContactList(false)} maxWidth="sm" fullWidth>

                <DialogTitle>Add Contact Lists</DialogTitle>
                <DialogContent>
                    <Box mt={2}>

                        <Autocomplete
                            multiple
                            options={contactLists}
                            getOptionLabel={(option: ContactList) => option.list_name ?? ""}
                            isOptionEqualToValue={(option, value) => option.id === value.id}

                            value={contactLists.filter(list =>
                                selectedContactLists.includes(list.id)
                            )}

                            onChange={(event, newValue) =>
                                setSelectedContactLists(newValue.map(item => item.id))
                            }

                            renderInput={(params) => (
                                <TextField {...params} label="Select Contact Lists" />
                            )}
                        />
                    </Box>
                </DialogContent>

                <DialogActions>
                    <Button variant="outlined" onClick={handleCloseContactListDialog} color="error">Cancel</Button>
                    <Button variant="contained" onClick={handleAddContactLists}>
                        Done
                    </Button>
                </DialogActions>

            </Dialog>

        </Grid>
    );
};

export default CampaignContacts;