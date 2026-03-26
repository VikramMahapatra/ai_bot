import { Tooltip, Typography } from "@mui/material";

interface EllipsisCellProps {
    value?: string | null;
    width?: number;
}

const EllipsisCell = ({ value, width = 140 }: EllipsisCellProps) => (
    <Tooltip title={value || "-"}>
        <Typography
            variant="body2"
            noWrap
            sx={{
                maxWidth: width,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
            }}
        >
            {value || "-"}
        </Typography>
    </Tooltip>
);

export default EllipsisCell;