import { Grid, TextField, Button, MenuItem } from "@mui/material";
import { useEffect, useState } from "react";
import { CallingAgentLookup, callingAgentService } from "../../services/callingAgentService";

interface CampaignInfoProps {
    form: any;
    setForm: any;
    nextStep: () => void;
}

const CampaignInfo = ({ form, setForm, nextStep }: CampaignInfoProps) => {
    const [errors, setErrors] = useState<any>({});
    const [agents, setAgents] = useState<CallingAgentLookup[]>([]);


    const loadAgentLookup = async () => {
        const data = await callingAgentService.agentLookup();
        setAgents(data || []);
    };

    useEffect(() => {
        loadAgentLookup();
    }, [form]);

    const validate = () => {

        let newErrors: any = {};

        if (!form.name.trim()) {
            newErrors.name = "Campaign name is required";
        }

        if (!form.description) {
            newErrors.description = "Description is required";
        }

        if (!form.agent_id) {
            newErrors.agent_id = "Agent is required";
        }

        setErrors(newErrors);

        if (Object.keys(newErrors).length === 0) {
            nextStep();
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setForm({ ...form, [name]: value });
    };

    return (
        <Grid container spacing={3}>

            <Grid item xs={12}>
                <TextField
                    required
                    label="Campaign Name"
                    fullWidth
                    name="name"
                    value={form.name}
                    onChange={handleInputChange}
                    error={!!errors.name}
                    helperText={errors.name}
                />
            </Grid>

            <Grid item xs={12}>
                <TextField
                    required
                    label="Description"
                    multiline
                    rows={4}
                    fullWidth
                    name="description"
                    value={form.description}
                    onChange={handleInputChange}
                    error={!!errors.description}
                    helperText={errors.description}
                />
            </Grid>
            <Grid item xs={6}>
                <TextField
                    required
                    label="Agent"
                    select
                    fullWidth
                    name="agent_id"
                    value={form.agent_id}
                    onChange={(e) =>
                        setForm({ ...form, agent_id: e.target.value })
                    }
                    error={!!errors.agent_id}
                    helperText={errors.agent_id}
                >
                    {
                        agents.map((agent) => (
                            <MenuItem value={agent.id}>{agent.name}</MenuItem>
                        ))
                    }
                </TextField>
            </Grid>

            <Grid item xs={6}>
                <TextField
                    label="Category"
                    select
                    fullWidth
                    name="category"
                    value={form.category}
                    onChange={(e) =>
                        setForm({ ...form, category: e.target.value })
                    }
                >
                    <MenuItem value="sales">Sales Outreach</MenuItem>
                    <MenuItem value="support">Support</MenuItem>
                </TextField>
            </Grid>

            {/* <Grid item xs={4}>
                <TextField
                    label="Priority"
                    select
                    fullWidth
                    name="priority"
                    value={form.priority}
                    onChange={(e) =>
                        setForm({ ...form, priority: e.target.value })
                    }
                >
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                </TextField>
            </Grid> */}

            <Grid item xs={12} textAlign="right">
                <Button
                    variant="contained"
                    onClick={validate}
                >
                    Continue
                </Button>
            </Grid>

        </Grid>
    );
};

export default CampaignInfo;