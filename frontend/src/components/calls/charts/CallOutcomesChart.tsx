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

const COLORS = ["#2e7d32", "#ed6c02", "#0288d1", "#9c27b0"];

interface Props {
    data: CallOutcome[];
}

export default function CallOutcomesChart({ data }: Props) {
    return (
        <ResponsiveContainer width="100%" height={200}>
            <PieChart>
                <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="55%"          // 👈 move chart slightly down
                    outerRadius={70}  // 👈 reduce size
                    label
                >
                    {data.map((entry, index) => (
                        <Cell key={index} fill={COLORS[index]} />
                    ))}
                </Pie>

                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
            </PieChart>
        </ResponsiveContainer>
    );
}