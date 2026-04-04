import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    ResponsiveContainer,
    Cell
} from "recharts";
import { IntentDistribution } from "../../../services/callService";

// const intentData = [
//     { intent: "Interested", value: 620 },
//     { intent: "Not Interested", value: 430 },
//     { intent: "Call Back Later", value: 300 },
//     { intent: "Wrong Number", value: 90 }
// ];

interface Props {
    data: IntentDistribution[];
}

export default function IntentChart({ data }: Props) {

    const LEAD_OUTCOME_COLORS: Record<string, string> = {
        negative: "#E53935",      // Red
        neutral: "#FFB300",       // Amber
        positive: "#43A047",      // Green
        satisfactory: "#1E88E5",  // Blue
        unresolved: "#8E24AA",    // Purple
        pending: "#757575"        // Gray
    };

    return (
        <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="intent" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value">
                    {data.map((entry, index) => (
                        <Cell
                            key={`cell-${index}`}
                            fill={LEAD_OUTCOME_COLORS[entry.intent.toLowerCase()] || "#CCCCCC"}
                        />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}