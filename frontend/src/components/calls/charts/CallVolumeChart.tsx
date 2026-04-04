import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    ResponsiveContainer
} from "recharts";
import { CallVolumeEntry } from "../../../services/callService";

// const data = [
//     { hour: "09:00", calls: 120 },
//     { hour: "10:00", calls: 210 },
//     { hour: "11:00", calls: 320 },
//     { hour: "12:00", calls: 280 },
//     { hour: "13:00", calls: 260 },
//     { hour: "14:00", calls: 310 },
//     { hour: "15:00", calls: 340 },
//     { hour: "16:00", calls: 290 },
//     { hour: "17:00", calls: 230 }
// ];

interface Props {
    data: CallVolumeEntry[];
}

export default function CallVolumeChart({ data }: Props) {

    const formatHour = (hour: number) => {
        const period = hour >= 12 ? "PM" : "AM";
        const formatted = hour % 12 || 12;
        return `${formatted} ${period}`;
    };

    return (
        <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" tickFormatter={formatHour} />
                <YAxis />
                <Tooltip />
                <Line
                    type="monotone"
                    dataKey="calls"
                    stroke="#1976d2"
                    strokeWidth={3}
                />
            </LineChart>
        </ResponsiveContainer>
    );
}