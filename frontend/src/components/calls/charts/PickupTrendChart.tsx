import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    ResponsiveContainer
} from "recharts";

const pickupData = [
    { day: "Mon", rate: 52 },
    { day: "Tue", rate: 55 },
    { day: "Wed", rate: 58 },
    { day: "Thu", rate: 61 },
    { day: "Fri", rate: 59 },
    { day: "Sat", rate: 64 },
    { day: "Sun", rate: 57 }
];

export default function PickupTrendChart() {
    return (
        <ResponsiveContainer width="100%" height={200}>
            <LineChart data={pickupData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis unit="%" />
                <Tooltip />
                <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="#2e7d32"
                    strokeWidth={3}
                />
            </LineChart>
        </ResponsiveContainer>
    );
}