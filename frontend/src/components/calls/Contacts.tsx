import { useState } from "react";
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
    Autocomplete
} from "@mui/material";

interface ContactsProps {
    nextStep: () => void;
    prevStep: () => void;
}

const crmContacts = [
    { label: "Rohit Patil - +919989821211" },
    { label: "Amit Sharma - +919812345678" }
];

const Contacts = ({ nextStep, prevStep }: ContactsProps) => {

    const [openAdd, setOpenAdd] = useState(false);
    const [mode, setMode] = useState<"crm" | "csv" | null>(null);

    const [openNewContact, setOpenNewContact] = useState(false);

    return (
        <Grid container spacing={2}>

            {/* BUTTONS */}

            <Grid item xs={12} textAlign="right">

                <Button
                    variant="outlined"
                    sx={{ mr: 2 }}
                    onClick={() => setOpenNewContact(true)}
                >
                    New Contact
                </Button>

                <Button
                    variant="contained"
                    onClick={() => {
                        setOpenAdd(true);
                        setMode(null);
                    }}
                >
                    Add Contacts
                </Button>

            </Grid>

            {/* CONTACT TABLE */}

            <Grid item xs={12}>
                <Table>

                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Phone</TableCell>
                            <TableCell>City</TableCell>
                            <TableCell>Status</TableCell>
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        <TableRow>
                            <TableCell>Roh Patil</TableCell>
                            <TableCell>+919989821211</TableCell>
                            <TableCell>Mumbai</TableCell>
                            <TableCell>Draft</TableCell>
                        </TableRow>
                    </TableBody>

                </Table>
            </Grid>

            {/* STEPPER */}

            <Grid item xs={6}>
                <Button onClick={prevStep}>Back</Button>
            </Grid>

            <Grid item xs={6} textAlign="right">
                <Button variant="contained" onClick={nextStep}>
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
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Select Contacts"
                                    />
                                )}
                            />

                        </Box>
                    )}

                    {mode === "csv" && (
                        <Box mt={2}>

                            <Button variant="outlined" component="label">
                                Upload CSV
                                <input hidden type="file" accept=".csv" />
                            </Button>

                        </Box>
                    )}

                </DialogContent>

                <DialogActions>
                    <Button onClick={() => setMode(null)}>Back</Button>
                    <Button variant="contained" onClick={() => setOpenAdd(false)}>
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
                                fullWidth
                                label="Name"
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Email"
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Phone"
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Company"
                            />
                        </Grid>

                    </Grid>

                </DialogContent>

                <DialogActions>

                    <Button onClick={() => setOpenNewContact(false)}>
                        Cancel
                    </Button>

                    <Button variant="contained">
                        Save Contact
                    </Button>

                </DialogActions>

            </Dialog>

        </Grid>
    );
};

export default Contacts;