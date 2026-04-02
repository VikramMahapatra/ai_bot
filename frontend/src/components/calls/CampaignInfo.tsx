import { Grid, TextField, Button, MenuItem } from "@mui/material";
import { useEffect, useState } from "react";
import { CallingAgentLookup, callingAgentService } from "../../services/callingAgentService";
import { Product, productService } from "../../services/productService";
import { CallingNumberType, callService } from "../../services/callService";
import { CallingNumber } from "../../types";

interface CampaignInfoProps {
    form: any;
    setForm: any;
    nextStep: () => void;
}

const CampaignInfo = ({ form, setForm, nextStep }: CampaignInfoProps) => {
    const [errors, setErrors] = useState<any>({});
    const [agents, setAgents] = useState<CallingAgentLookup[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [callingNumbers, setCallingNumbers] = useState<CallingNumber[]>([])


    const loadAgentLookup = async () => {
        const data = await callingAgentService.agentLookup();
        setAgents(data || []);
    };

    const loadProductLookup = async () => {
        const data = await productService.productLookup();
        setProducts(data || []);
    };

    const loadCallingNoLookup = async () => {
        const data = await callService.getCallingNumbers(CallingNumberType.OUTBOUND);
        setCallingNumbers(data || []);
    };


    useEffect(() => {
        loadAgentLookup();
        loadProductLookup();
        loadCallingNoLookup();
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

        if (!form.calling_no) {
            newErrors.calling_no = "From number is required";
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
            <Grid item xs={12} sm={6}>
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
                            <MenuItem key={agent.id} value={agent.id}>{agent.name}</MenuItem>
                        ))
                    }
                </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
                <TextField
                    required
                    label="From Number"
                    select
                    fullWidth
                    name="product_id"
                    value={form.calling_no}
                    onChange={(e) =>
                        setForm({ ...form, calling_no: e.target.value })
                    }
                    error={!!errors.calling_no}
                    helperText={errors.calling_no}
                >
                    {
                        callingNumbers.map((p) => (
                            <MenuItem key={p.id} value={p.calling_number}>{p.calling_number}</MenuItem>
                        ))
                    }
                </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
                <TextField
                    label="Product"
                    select
                    fullWidth
                    name="product_id"
                    value={form.product_id}
                    onChange={(e) =>
                        setForm({ ...form, product_id: e.target.value })
                    }
                >
                    {
                        products.map((p) => (
                            <MenuItem key={p.id} value={p.id}>{p.label}</MenuItem>
                        ))
                    }
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

            <Grid item xs={12} sm={6}>
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