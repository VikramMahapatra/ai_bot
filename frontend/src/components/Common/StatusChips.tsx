import { Chip } from "@mui/material";
import { FunnelCategory } from "../../types";
import { LEAD_SOURCE_FILTER_TINTS } from "../../constants/leadFilterChartColors";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import BlockIcon from "@mui/icons-material/Block";

export const titleCase = (value?: string | null): string => {
    if (!value) return "";

    return value
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
};

export const StatusChip = ({ value }: { value?: string | null }) => {
    if (!value || !value.trim()) {
        return (
            <Chip
                label="N/A"
                size="small"
                variant="outlined"
                sx={{
                    color: "#9e9e9e",
                    borderColor: "#e0e0e0",
                    backgroundColor: "#fafafa",
                }}
            />
        );
    }

    const normalized = value.toLowerCase().trim();

    type StatusType = "active" | "inactive";

    const isStatusType = (value: string): value is StatusType => {
        return value === "active" || value === "inactive";
    };

    const configMap: Record<
        StatusType,
        {
            label: string;
            color: "success" | "default";
            icon: React.ReactElement;
        }
    > = {
        active: {
            label: "Active",
            color: "success",
            icon: <CheckCircleIcon fontSize="small" />,
        },
        inactive: {
            label: "Inactive",
            color: "default",
            icon: <BlockIcon fontSize="small" />,
        },
    };

    const config = isStatusType(normalized)
        ? configMap[normalized] // ✅ now TS knows it's valid
        : {
            label: value,
            color: "default" as const,
            icon: undefined,
        };

    return (
        <Chip
            label={config.label}
            size="small"
            variant="outlined"
            color={config.color}
            icon={config.icon}
        />
    );
};

export const OutcomeChip = ({ value }: { value?: string | null }) => {
    if (!value || !value.trim()) return <Chip
        label="N/A"
        size="small"
        variant="outlined"
        sx={{
            color: "#9e9e9e",
            borderColor: "#e0e0e0",
            backgroundColor: "#fafafa",
        }}
    />;

    const normalized = value.toLowerCase().trim();

    const colorMap: Record<string, any> = {
        positive: "success",
        negative: "error",
        satisfactory: "info",
        neutral: "warning",
        unresolved: "default",
    };

    return (
        <Chip
            label={titleCase(value)}
            size="small"
            variant="outlined"
            color={colorMap[normalized] || "default"}
        />
    );
};
interface Props {
    value?: string | null;
    funnelCategories: FunnelCategory[];
    stageNameByKey: Map<string, string>;
    stageLabel: (key: string) => string;

    selected?: boolean;
    onClick?: () => void;
    height?: number;
    allTint?: string; // 👈 add this
}

export const StageChip = ({
    value,
    funnelCategories,
    stageNameByKey,
    stageLabel,
    selected = false,
    onClick,
    height,
    allTint = "#4f46e5", // default if not passed
}: Props) => {

    if (value === "all") {
        return (
            <Chip
                label="All"
                size="small"
                clickable={!!onClick}
                onClick={onClick}
                variant="outlined"
                sx={{
                    ...(height && { height }),

                    borderColor: allTint,
                    color: selected ? "#fff" : allTint,
                    backgroundColor: selected ? allTint : "transparent",

                    "&:hover": {
                        backgroundColor: selected ? allTint : `${allTint}20`,
                    },

                    "&.MuiChip-clickable:hover": {
                        backgroundColor: selected ? allTint : `${allTint}20`,
                    },

                    "&.MuiChip-outlined:hover": {
                        backgroundColor: selected ? allTint : `${allTint}20`,
                    },
                }}
            />
        );
    }

    if (!value || !value.trim()) {
        return <Chip label="Unassigned" size="small" variant="outlined" />;
    }

    const stage = funnelCategories.find((f) => f.key === value);
    const color = stage?.color || "#e0e0e0";

    return (
        <Chip
            label={
                stage?.name ||
                stageNameByKey.get(value) ||
                stageLabel(value)
            }
            size="small"
            variant="outlined"
            clickable={!!onClick}
            onClick={onClick}
            sx={{
                ...(height && { height }),

                borderColor: color,
                color: selected ? "#fff" : color,
                backgroundColor: selected ? color : "transparent",

                "&:hover": {
                    backgroundColor: selected ? color : `${color}20`,
                },

                "&.MuiChip-clickable:hover": {
                    backgroundColor: selected ? color : `${color}20`,
                },

                "&.MuiChip-outlined:hover": {
                    backgroundColor: selected ? color : `${color}20`,
                },
            }}
        />
    );
};

export const ConversionOutcomeChip = ({ value }: { value?: string | null }) => {
    if (!value || !value.trim()) return <Chip
        label="N/A"
        size="small"
        variant="outlined"
        sx={{
            color: "#9e9e9e",
            borderColor: "#e0e0e0",
            backgroundColor: "#fafafa",
        }}
    />;

    const normalized = value?.toLowerCase().trim();

    const colorMap: Record<string, any> = {
        positive: "success",
        negative: "error",
        satisfactory: "info",
        neutral: "warning",
        unresolved: "default",
        pending: "warning",
    };

    const label = normalized
        ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
        : "Pending";

    return (
        <Chip
            label={label}
            size="small"
            variant="outlined"
            color={colorMap[normalized || "pending"] || "default"}
        />
    );
};


interface SourceProps {
    value: string;
    selected?: boolean;
    onClick?: () => void;
    height?: number;
}

export const SourceChip = ({
    value,
    selected = false,
    onClick,
    height,
}: SourceProps) => {
    const tint = LEAD_SOURCE_FILTER_TINTS[value] || "#9e9e9e";

    return (
        <Chip
            label={value === "all" ? "All" : titleCase(value)}
            size="small"
            clickable={!!onClick}
            onClick={onClick}
            variant="outlined"
            sx={{
                ...(height && { height }),

                borderColor: tint,
                color: selected ? "#fff" : tint,
                backgroundColor: selected ? tint : "transparent",

                "&:hover": {
                    backgroundColor: selected ? tint : `${tint}20`,
                },

                "&.MuiChip-clickable:hover": {
                    backgroundColor: selected ? tint : `${tint}20`,
                },
            }}
        />
    );
};