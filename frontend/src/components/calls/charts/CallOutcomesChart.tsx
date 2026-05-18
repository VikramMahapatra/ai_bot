import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
    Legend
} from "recharts";
import { CallOutcome } from "../../../services/callService";

// const outcomes = [
//     { name: "Answered", value: 1870 },
//     { name: "No Answer", value: 890 },
//     { name: "Busy", value: 310 },
//     { name: "Voicemail", value: 140 }
// ];

export const REASON_COLOR_MAP: Record<string, string> = {
    "Customer Busy": "#2e7d32",
    "No Answer": "#ed6c02",
    "Silence Time Out": "#0288d1",
    "Exceeded Max Duration": "#9c27b0",
    "Customer Ended": "#4caf50",
    "Assistant Ended": "#f44336",
    "Failed to Connect": "#ff9800",
    "Temporarily Unavailable": "#607d8b",
};

const getColor = (name: string) =>
    REASON_COLOR_MAP[name] || "#9e9e9e";

interface Props {
    data: CallOutcome[];
}

export default function CallOutcomesChart({ data }: Props) {
    return (
        <ResponsiveContainer width="100%" height={250}>
            <PieChart>
                <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="55%"
                    outerRadius={85}
                    minAngle={8}
                    labelLine={false}               // Draw line from pie to label
                    label={({ name }) => name}
                >
                    {data.map((entry, index) => (
                        <Cell key={index} fill={getColor(entry.name)} />
                    ))}
                </Pie>

                <Tooltip />
                {/* <Legend verticalAlign="bottom" height={36} wrapperStyle={{ marginTop: 30 }} /> */}
            </PieChart>
        </ResponsiveContainer>
    );
}