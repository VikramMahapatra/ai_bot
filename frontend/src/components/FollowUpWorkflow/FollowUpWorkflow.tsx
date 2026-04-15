import React, { useState } from "react";
import {
    Box,
    Grid,
    Card,
    CardContent,
    CardHeader,
    Typography,
    Button,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    IconButton,
    Chip,
    Divider,
} from "@mui/material";

import {
    Add,
    Delete,
    ArrowBack,
    AccessTime,
} from "@mui/icons-material";

const modes = ["call", "email", "sms", "whatsapp"];

interface FollowUpWorkflowProps {
    onBack: () => void;
}

export default function FollowUpWorkflow({ onBack }: FollowUpWorkflowProps) {
    const [source, setSource] = useState("campaign");
    const [contactSource, setContactSource] = useState("contact_list");
    const [campaignSource, setCampaignSource] = useState("");
    const [campaign, setCampaign] = useState("");
    const [contactList, setContactList] = useState("");
    const [leadOutcome, setLeadOutcome] = useState("");

    const [sequences, setSequences] = useState([
        {
            id: 1,
            delayValue: 1,
            delayUnit: "hours",
            mode: "call",
        },
    ]);

    const addSequence = () => {
        setSequences([
            ...sequences,
            {
                id: Date.now(),
                delayValue: 1,
                delayUnit: "hours",
                mode: "call",
            },
        ]);
    };

    const removeSequence = (id: number) => {
        setSequences(sequences.filter((s) => s.id !== id));
    };

    const updateSequence = (id: number, key: string, value: any) => {
        setSequences(
            sequences.map((s) =>
                s.id === id ? { ...s, [key]: value } : s
            )
        );
    };

    return (
        <Box>
            {/* Header */}
            <Box display="flex" alignItems="center" gap={1} mb={2}>
                <IconButton onClick={onBack}>
                    <ArrowBack />
                </IconButton>

                <Typography variant="h5" fontWeight={600}>
                    Create Follow-up Workflow
                </Typography>
            </Box>

            <Card sx={{ mb: 3 }}>
                <CardHeader title="Workflow Settings" />

                <CardContent>
                    <Grid container spacing={2}>

                        {/* Row 1 */}
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Workflow Name"
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth>
                                <InputLabel>Select Contacts From</InputLabel>

                                <Select
                                    label="Select Contacts From"
                                    value={contactSource}
                                    onChange={(e) =>
                                        setContactSource(e.target.value)
                                    }
                                >
                                    <MenuItem value="contact_list">
                                        Contact List
                                    </MenuItem>

                                    <MenuItem value="campaign">
                                        Campaign
                                    </MenuItem>
                                </Select>

                            </FormControl>
                        </Grid>

                        {/* Row 2 - Contact List */}
                        {contactSource === "contact_list" && (
                            <>
                                <Grid item xs={12} md={6}>
                                    <FormControl fullWidth>
                                        <InputLabel>Contact List</InputLabel>

                                        <Select
                                            label="Contact List"
                                            value={contactList}
                                            onChange={(e) =>
                                                setContactList(e.target.value)
                                            }
                                        >
                                            <MenuItem value="1">
                                                Contact List 1
                                            </MenuItem>

                                            <MenuItem value="2">
                                                Contact List 2
                                            </MenuItem>
                                        </Select>

                                    </FormControl>
                                </Grid>

                                <Grid item xs={12} md={6}>
                                    <FormControl fullWidth>
                                        <InputLabel>Lead Outcome</InputLabel>

                                        <Select
                                            label="Lead Outcome"
                                            value={leadOutcome}
                                            onChange={(e) =>
                                                setLeadOutcome(e.target.value)
                                            }
                                        >
                                            <MenuItem value="interested">
                                                Interested
                                            </MenuItem>

                                            <MenuItem value="callback">
                                                Callback
                                            </MenuItem>

                                            <MenuItem value="not_answered">
                                                Not Answered
                                            </MenuItem>

                                        </Select>
                                    </FormControl>
                                </Grid>
                            </>
                        )}

                        {/* Row 2 - Campaign */}
                        {contactSource === "campaign" && (
                            <>
                                <Grid item xs={12} md={4}>
                                    <FormControl fullWidth>
                                        <InputLabel>
                                            Campaign Source
                                        </InputLabel>

                                        <Select
                                            label="Campaign Source"
                                            value={campaignSource}
                                            onChange={(e) =>
                                                setCampaignSource(
                                                    e.target.value
                                                )
                                            }
                                        >
                                            <MenuItem value="call">
                                                Call
                                            </MenuItem>

                                            <MenuItem value="email">
                                                Email
                                            </MenuItem>

                                            <MenuItem value="sms">
                                                SMS
                                            </MenuItem>

                                            <MenuItem value="whatsapp">
                                                WhatsApp
                                            </MenuItem>
                                        </Select>

                                    </FormControl>
                                </Grid>

                                <Grid item xs={12} md={4}>
                                    <FormControl fullWidth>
                                        <InputLabel>Campaign</InputLabel>

                                        <Select
                                            label="Campaign"
                                            value={campaign}
                                            onChange={(e) =>
                                                setCampaign(
                                                    e.target.value
                                                )
                                            }
                                        >
                                            <MenuItem value="1">
                                                Campaign 1
                                            </MenuItem>

                                            <MenuItem value="2">
                                                Campaign 2
                                            </MenuItem>
                                        </Select>

                                    </FormControl>
                                </Grid>

                                <Grid item xs={12} md={4}>
                                    <FormControl fullWidth>
                                        <InputLabel>
                                            Lead Outcome
                                        </InputLabel>

                                        <Select
                                            label="Lead Outcome"
                                            value={leadOutcome}
                                            onChange={(e) =>
                                                setLeadOutcome(
                                                    e.target.value
                                                )
                                            }
                                        >
                                            <MenuItem value="interested">
                                                Interested
                                            </MenuItem>

                                            <MenuItem value="callback">
                                                Callback
                                            </MenuItem>

                                            <MenuItem value="not_answered">
                                                Not Answered
                                            </MenuItem>

                                        </Select>
                                    </FormControl>
                                </Grid>
                            </>
                        )}

                    </Grid>
                </CardContent>
            </Card>
            {/* Followup Sequences */}
            {
                sequences.map((seq, index) => (
                    <Card key={seq.id} sx={{ mb: 2 }}>
                        <CardHeader
                            title={`Follow-up #${index + 1}`}
                            action={
                                <IconButton
                                    onClick={() =>
                                        removeSequence(seq.id)
                                    }
                                >
                                    <Delete />
                                </IconButton>
                            }
                        />

                        <CardContent>
                            <Grid container spacing={2}>
                                {/* Schedule */}
                                <Grid item xs={12} md={3}>
                                    <TextField
                                        type="number"
                                        label="Delay"
                                        fullWidth
                                        value={seq.delayValue}
                                        onChange={(e) =>
                                            updateSequence(
                                                seq.id,
                                                "delayValue",
                                                e.target.value
                                            )
                                        }
                                    />
                                </Grid>

                                <Grid item xs={12} md={3}>
                                    <FormControl fullWidth>
                                        <InputLabel>Unit</InputLabel>
                                        <Select
                                            value={seq.delayUnit}
                                            label="Unit"
                                            onChange={(e) =>
                                                updateSequence(
                                                    seq.id,
                                                    "delayUnit",
                                                    e.target.value
                                                )
                                            }
                                        >
                                            <MenuItem value="minutes">
                                                Minutes
                                            </MenuItem>
                                            <MenuItem value="hours">
                                                Hours
                                            </MenuItem>
                                            <MenuItem value="days">
                                                Days
                                            </MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>

                                <Grid item xs={12} md={3}>
                                    <FormControl fullWidth>
                                        <InputLabel>Mode</InputLabel>
                                        <Select
                                            value={seq.mode}
                                            label="Mode"
                                            onChange={(e) =>
                                                updateSequence(
                                                    seq.id,
                                                    "mode",
                                                    e.target.value
                                                )
                                            }
                                        >
                                            <MenuItem value="call">
                                                Call
                                            </MenuItem>
                                            <MenuItem value="email">
                                                Email
                                            </MenuItem>
                                            <MenuItem value="sms">
                                                SMS
                                            </MenuItem>
                                            <MenuItem value="whatsapp">
                                                WhatsApp
                                            </MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>

                                {/* CALL */}
                                {seq.mode === "call" && (
                                    <>
                                        <Grid item xs={12} md={3}>
                                            <FormControl fullWidth>
                                                <InputLabel>
                                                    Agent
                                                </InputLabel>
                                                <Select label="Agent">
                                                    <MenuItem value={1}>
                                                        Sales Agent
                                                    </MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Grid>

                                        {source === "contact_list" && (
                                            <Grid item xs={12}>
                                                <TextField
                                                    fullWidth
                                                    multiline
                                                    rows={3}
                                                    label="Agent Prompt"
                                                />
                                            </Grid>
                                        )}
                                    </>
                                )}

                                {/* EMAIL */}
                                {seq.mode === "email" && (
                                    <>
                                        <Grid item xs={12} md={6}>
                                            <TextField
                                                fullWidth
                                                label="Subject"
                                            />
                                        </Grid>

                                        <Grid item xs={12}>
                                            <TextField
                                                fullWidth
                                                multiline
                                                rows={4}
                                                label="Email Template"
                                            />
                                        </Grid>
                                    </>
                                )}

                                {/* SMS / WHATSAPP */}
                                {(seq.mode === "sms" ||
                                    seq.mode === "whatsapp") && (
                                        <Grid item xs={12}>
                                            <TextField
                                                fullWidth
                                                multiline
                                                rows={3}
                                                label="Template"
                                            />
                                        </Grid>
                                    )}
                            </Grid>
                        </CardContent>
                    </Card>
                ))
            }

            <Button
                variant="outlined"
                startIcon={<Add />}
                onClick={addSequence}
            >
                Add Follow-up
            </Button>
        </Box >
    );
}
