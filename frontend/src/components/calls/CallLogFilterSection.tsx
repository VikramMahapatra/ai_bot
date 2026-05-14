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
                <Grid item xs={12} sm={6} md={2}>
                    <TextField
                        size="small"
                        select
                        fullWidth
                        label="Sort By"
                        value={filters.sort_by}
                        onChange={(e) => onFilterChange({ sort_by: e.target.value as any })}
                    >
                        <MenuItem value="oldest">Oldest</MenuItem>
                        <MenuItem value="newest">Newest</MenuItem>
                    </TextField>
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
                        <Grid item xs={12} sm={6} md={4}>
                            <TextField
                                select
                                fullWidth
                                size="small"
                                label="Source"
                                value={filters.source}
                                onChange={(e) =>
                                    onFilterChange({
                                        source: e.target.value as CallLogFilterState["source"],
                                    })
                                }
                            >
                                <MenuItem value="All">All</MenuItem>
                                <MenuItem value="campaign_call">Campaign Call</MenuItem>
                                <MenuItem value="rescheduled_call">Rescheduled Call</MenuItem>
                            </TextField>
                        </Grid>
                        <Grid item xs={12} sm={6} md={4}>
                            <TextField
                                select
                                fullWidth
                                size="small"
                                label="Connection Status"
                                value={filters.is_connected}
                                onChange={(e) =>
                                    onFilterChange({
                                        is_connected: e.target.value as CallLogFilterState["is_connected"],
                                    })
                                }
                            >
                                <MenuItem value="All">All</MenuItem>
                                <MenuItem value="true">Connected</MenuItem>
                                <MenuItem value="false">Not Connected</MenuItem>
                            </TextField>
                        </Grid>
                        {/* Status */}
                        <Grid item xs={12} sm={6} md={4}>
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
                                <MenuItem value="ended">Ended</MenuItem>
                                <MenuItem value="queued">Queued</MenuItem>
                                <MenuItem value="calling fail">Failed</MenuItem>
                                <MenuItem value="scheduled">Scheduled</MenuItem>
                            </TextField>
                        </Grid>

                        {/* Call End Reason */}
                        <Grid item xs={12} sm={6} md={4}>
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
                                <MenuItem value="customer-busy">Customer Busy</MenuItem>
                                <MenuItem value="customer-did-not-answer">No Answer</MenuItem>
                                <MenuItem value="silence-timed-out">Silence Time Out</MenuItem>
                                <MenuItem value="exceeded-max-duration">Exceeded Max Duration</MenuItem>
                                <MenuItem value="customer-ended-call">Customer Ended</MenuItem>
                                <MenuItem value="assistant-ended-call">Assistant Ended</MenuItem>
                                <MenuItem value="failed-to-connect">Failed to Connect</MenuItem>
                                <MenuItem value="temporarily-unavailable">Temporarily Unavailable</MenuItem>
                            </TextField>
                        </Grid>

                        {/* Sentiment */}
                        <Grid item xs={12} sm={6} md={4}>
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
                                <MenuItem value="satisfactory">Satisfactory</MenuItem>
                                <MenuItem value="other">Other</MenuItem>
                            </TextField>
                        </Grid>

                        {/* Outcome */}

                        <Grid item xs={12} sm={6} md={4}>
                            <TextField
                                select
                                fullWidth
                                size="small"
                                label="Conversion Outcome"
                                value={filters.is_lead_qualified}
                                onChange={(e) =>
                                    onFilterChange({
                                        is_lead_qualified: e.target.value as CallLogFilterState["is_lead_qualified"]
                                    })
                                }
                            >
                                <MenuItem value="All">All</MenuItem>
                                <MenuItem value="true">Positive</MenuItem>
                                <MenuItem value="false">Negative</MenuItem>
                            </TextField>
                        </Grid>

                    </Grid>
                </Box>
            </Collapse>
        </Box>
    );
};

export default CallLogFilterSection;