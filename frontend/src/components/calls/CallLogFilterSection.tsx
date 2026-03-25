import {
    Box,
    Grid,
    TextField,
    InputAdornment,
    IconButton,
    MenuItem,
    Button,
    Collapse,
    Typography
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import { useState } from "react";
import { CallLogFilterState } from "../../services/callLogService";

interface Props {
    filters: CallLogFilterState;
    onFilterChange: (filters: Partial<CallLogFilterState>) => void;
}

const CallLogFilterSection = ({ filters, onFilterChange }: Props) => {
    const [showFilters, setShowFilters] = useState(false);

    return (
        <Box mb={3}>
            {/* Top Row */}
            <Grid container spacing={2} alignItems="center">

                {/* Search */}
                <Grid item xs={12} md={6}>
                    <TextField
                        fullWidth
                        value={filters.search}
                        onChange={(e) =>
                            onFilterChange({ search: e.target.value })
                        }
                        size="small"
                        placeholder="Search by contact name, phone, status..."
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" />
                                </InputAdornment>
                            )
                        }}
                    />
                </Grid>

                {/* Filter Button */}
                <Grid item xs={12} md="auto">
                    <Button
                        variant="outlined"
                        startIcon={<FilterListIcon />}
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        Filters
                    </Button>
                </Grid>
            </Grid>

            {/* Expandable Filters */}
            <Collapse in={showFilters}>
                <Box mt={3} pt={2} borderTop="1px solid #e0e0e0">

                    {/* Date Filter */}
                    <Typography variant="subtitle2" mb={2}>
                        Filter by Call Started Date:
                    </Typography>

                    <Grid container spacing={2} mb={2}>
                        <Grid item xs={12} md={5}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Start Date"
                                type="date"
                                value={filters.fromDate}
                                onChange={(e) =>
                                    onFilterChange({ fromDate: e.target.value })
                                }
                                InputLabelProps={{ shrink: true }}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <CalendarTodayIcon fontSize="small" />
                                        </InputAdornment>
                                    )
                                }}
                            />
                        </Grid>

                        <Grid item xs={12} md={2} textAlign="center">
                            <Box mt={1}>To</Box>
                        </Grid>

                        <Grid item xs={12} md={5}>
                            <TextField
                                fullWidth
                                size="small"
                                label="End Date"
                                type="date"
                                value={filters.endDate}
                                onChange={(e) =>
                                    onFilterChange({ endDate: e.target.value })
                                }
                                InputLabelProps={{ shrink: true }}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <CalendarTodayIcon fontSize="small" />
                                        </InputAdornment>
                                    )
                                }}
                            />
                        </Grid>
                    </Grid>

                    {/* Other Filters */}
                    <Grid container spacing={2}>

                        {/* Status */}
                        <Grid item xs={12} sm={6} md={3}>
                            <TextField
                                select
                                fullWidth
                                size="small"
                                label="Status"
                                value={filters.status}
                                onChange={(e) =>
                                    onFilterChange({
                                        status: e.target.value as CallLogFilterState["status"],
                                    })
                                }
                            >
                                <MenuItem value="All">All</MenuItem>
                                <MenuItem value="completed">Completed</MenuItem>
                                <MenuItem value="ended">Ended</MenuItem>
                                <MenuItem value="in_progress">In Progress</MenuItem>
                                <MenuItem value="failed">Call Failed</MenuItem>
                                <MenuItem value="scheduled">Scheduled</MenuItem>
                            </TextField>
                        </Grid>

                        {/* Call End Reason */}
                        <Grid item xs={12} sm={6} md={3}>
                            <TextField
                                select
                                fullWidth
                                size="small"
                                label="Call End Reason"
                                value={filters.call_end_reason}
                                onChange={(e) =>
                                    onFilterChange({
                                        call_end_reason: e.target.value,
                                    })
                                }
                            >
                                <MenuItem value="All">All</MenuItem>
                                <MenuItem value="busy">Customer Busy</MenuItem>
                                <MenuItem value="no_answer">No Answer</MenuItem>
                                <MenuItem value="voicemail">Voicemail</MenuItem>
                                <MenuItem value="customer_end">Customer Ended</MenuItem>
                                <MenuItem value="assistant_end">Assistant Ended</MenuItem>
                            </TextField>
                        </Grid>

                        {/* Sentiment */}
                        <Grid item xs={12} sm={6} md={3}>
                            <TextField
                                select
                                fullWidth
                                size="small"
                                label="Sentiment"
                                value={filters.sentiment}
                                onChange={(e) =>
                                    onFilterChange({
                                        sentiment: e.target.value as CallLogFilterState["sentiment"],
                                    })
                                }>
                                <MenuItem value="All">All</MenuItem>
                                <MenuItem value="positive">Positive</MenuItem>
                                <MenuItem value="negative">Negative</MenuItem>
                                <MenuItem value="neutral">Neutral</MenuItem>
                            </TextField>
                        </Grid>

                        {/* Evaluation */}
                        <Grid item xs={12} sm={6} md={3}>
                            <TextField
                                select
                                fullWidth
                                size="small"
                                label="Evaluation"
                                onChange={(e) =>
                                    onFilterChange({
                                        evaluation:
                                            e.target.value === "All"
                                                ? undefined
                                                : e.target.value === "true",
                                    })
                                }
                            >
                                <MenuItem value="All">All</MenuItem>
                                <MenuItem value="true">True</MenuItem>
                                <MenuItem value="false">False</MenuItem>
                            </TextField>
                        </Grid>

                    </Grid>
                </Box>
            </Collapse>
        </Box>
    );
};

export default CallLogFilterSection;