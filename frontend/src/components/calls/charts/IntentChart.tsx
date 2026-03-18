import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    ResponsiveContainer
} from "recharts";

const intentData = [
    { intent: "Interested", value: 620 },
    { intent: "Not Interested", value: 430 },
    { intent: "Call Back Later", value: 300 },
    { intent: "Wrong Number", value: 90 }
];

export default function IntentChart() {
    return (
        <ResponsiveContainer width="100%" height={200}>
            <BarChart data={intentData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="intent" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#1976d2" />
            </BarChart>
        </ResponsiveContainer>
    );
}