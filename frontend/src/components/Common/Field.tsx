import { Box, Typography, Chip, Stack } from '@mui/material';

interface FieldProps {
    label: string;
    value?: string | number | null;
    badge?: boolean;   // for single badge (e.g., interest_stage)
    badges?: boolean;  // for comma-separated badges (e.g., tags)
}

const Field: React.FC<FieldProps> = ({ label, value, badge = false, badges = false }) => {
    if (!value) value = '';

    return (
        <Box sx={{ mb: 1 }}>
            {/* Label */}
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.25 }}>
                {label}
            </Typography>

            {/* Value */}
            {badge && value ? (
                <Chip label={value} color="info" size="small" sx={{ mt: 0.5 }} />
            ) : badges && value ? (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" mt={0.5}>
                    {String(value)
                        .split(',')
                        .map((v, idx) => (
                            <Chip key={idx} label={v.trim()} color="warning" size="small" />
                        ))}
                </Stack>
            ) : (
                <Typography
                    variant="body2"
                    sx={{
                        mt: 0.5,
                        fontWeight: 600,         // make text bold
                        color: 'primary.main',    // primary color highlight
                        backgroundColor: '#e7f0ff', // optional light highlight
                        px: 1,
                        py: 0.25,
                        borderRadius: 1,
                        display: 'inline-block'
                    }}
                >
                    {value || '-'}
                </Typography>
            )}
        </Box>
    );
};

export default Field;