import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Stack,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Alert,
  Chip,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  Tabs,
  Tab,
  Card,
  CardContent,
  Button,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import DeleteIcon from "@mui/icons-material/Delete";
import LanguageIcon from "@mui/icons-material/Language";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import DataObjectIcon from "@mui/icons-material/DataObject";
import StorageIcon from "@mui/icons-material/Storage";
import SourceIcon from "@mui/icons-material/Source";
import { knowledgeService } from "../../services/knowledgeService";
import { dashboardService } from "../../services/dashboardService";
import { KnowledgeSource } from "../../types";
import WebCrawler from "./WebCrawler";
import DocumentUpload from "./DocumentUpload";
import VectorizedDataViewer from "./VectorizedDataViewer";
import { analyticsService } from "../../services/analyticsService";
import { ConfirmDialog } from "../Common/ConfirmDialog";

interface KnowledgeGap {
  keyword: string;
  count: number;
  suggested_title: string;
  sample_questions: string[];
}

const KnowledgeManager: React.FC = () => {
  const theme = useTheme();
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [widgets, setWidgets] = useState<{ widget_id: string; name: string }[]>(
    [],
  );
  const [selectedWidgetId, setSelectedWidgetId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [error, setError] = useState("");
  const [vectorRefreshToken, setVectorRefreshToken] = useState<number>(0);
  const [vectorLoading, setVectorLoading] = useState<boolean>(false);
  const [lastTotalChunks, setLastTotalChunks] = useState<number>(0);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [pendingDeleteName, setPendingDeleteName] = useState("");
  const [pendingDeleteEmbeddings, setPendingDeleteEmbeddings] =
    useState<number>(0);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [gapSuggestions, setGapSuggestions] = useState<KnowledgeGap[]>([]);
  const [gapLoading, setGapLoading] = useState(false);
  const [gapError, setGapError] = useState("");
  const [ingestTab, setIngestTab] = useState(0);

  const sectionPanelSx = {
    borderRadius: "18px",
    border: `1px solid ${alpha(theme.palette.common.white, 0.62)}`,
    background: `linear-gradient(150deg, ${alpha(theme.palette.common.white, 0.7)} 0%, ${alpha(
      theme.palette.background.paper,
      0.82,
    )} 68%, ${alpha("#dce8f8", 0.78)} 100%)`,
    boxShadow: `0 14px 30px ${alpha(theme.palette.primary.dark, 0.14)}`,
    backdropFilter: "blur(10px)",
    position: "relative",
    overflow: "hidden",
    "&::before": {
      content: '""',
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      background:
        "linear-gradient(138deg, rgba(255,255,255,0.22) 8%, transparent 24%), linear-gradient(28deg, transparent 56%, rgba(78,137,213,0.14) 57%, transparent 80%)",
    },
    "& > *": {
      position: "relative",
      zIndex: 1,
    },
  } as const;

  const insetPanelSx = {
    borderRadius: "14px",
    border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
    background: `linear-gradient(138deg, ${alpha(theme.palette.common.white, 0.78)} 0%, ${alpha(
      "#e0ecfb",
      0.72,
    )} 100%)`,
    boxShadow: `0 10px 22px ${alpha(theme.palette.primary.dark, 0.1)}`,
    position: "relative",
    overflow: "hidden",
    "&::before": {
      content: '""',
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      background:
        "linear-gradient(145deg, rgba(255,255,255,0.2) 12%, transparent 40%)",
    },
    "& > *": {
      position: "relative",
      zIndex: 1,
    },
  } as const;

  const loadSources = async (widgetId?: string) => {
    try {
      setSourcesLoading(true);
      if (!widgetId) {
        setSources([]);
        return;
      }
      const data = await knowledgeService.listSources(widgetId);
      setSources(data);
    } catch (err) {
      setError("Failed to load knowledge sources");
    } finally {
      setSourcesLoading(false);
    }
  };

  const loadWidgets = async () => {
    try {
      setLoading(true);
      const data = await dashboardService.getWidgets();
      const widgetItems = data?.widgets || [];
      setWidgets(
        widgetItems.map((w: any) => ({ widget_id: w.widget_id, name: w.name })),
      );
      if (!selectedWidgetId && widgetItems.length > 0) {
        setSelectedWidgetId(widgetItems[0].widget_id);
      }
    } catch (err) {
      setError("Failed to load widgets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWidgets();
  }, []);

  useEffect(() => {
    if (!selectedWidgetId) return;
    loadSources(selectedWidgetId);
    const interval = setInterval(() => loadSources(selectedWidgetId), 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [selectedWidgetId]);

  useEffect(() => {
    const loadGaps = async () => {
      if (!selectedWidgetId) return;
      try {
        setGapLoading(true);
        setGapError("");
        const data = await analyticsService.getKnowledgeGaps(
          30,
          6,
          selectedWidgetId,
        );
        setGapSuggestions(data.gaps || []);
      } catch (err) {
        setGapError("Failed to load knowledge gaps");
      } finally {
        setGapLoading(false);
      }
    };

    loadGaps();
  }, [selectedWidgetId]);

  const handleDelete = async (id: number) => {
    if (!selectedWidgetId) return;

    try {
      const vectorData =
        await knowledgeService.getVectorizedData(selectedWidgetId);
      const embeddingsForSource = (vectorData?.documents || []).filter(
        (doc: any) => {
          if (doc?.source_id === null || typeof doc?.source_id === "undefined")
            return false;
          return String(doc.source_id) === String(id);
        },
      ).length;

      const sourceMeta = sources.find((s) => s.id === id);
      setPendingDeleteName(
        sourceMeta?.name?.trim() || "this knowledge source",
      );
      setPendingDeleteId(id);
      setPendingDeleteEmbeddings(embeddingsForSource);
    } catch (err) {
      setError("Failed to delete source");
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedWidgetId || pendingDeleteId === null) return;

    setDeleteSubmitting(true);
    try {
      setVectorLoading(true);
      await knowledgeService.deleteSource(pendingDeleteId);
      loadSources(selectedWidgetId);
      setVectorRefreshToken((t) => t + 1);
      setPendingDeleteId(null);
      setPendingDeleteName("");
      setPendingDeleteEmbeddings(0);
    } catch (err) {
      setError("Failed to delete source");
      setVectorLoading(false);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const closeDeleteDialog = () => {
    if (deleteSubmitting) return;
    setPendingDeleteId(null);
    setPendingDeleteName("");
    setPendingDeleteEmbeddings(0);
  };

  const buildGapTemplate = (title: string, questions: string[]) => {
    const lines = [
      `# ${title}`,
      "",
      "## Open Questions",
      ...questions.map((q) => `- ${q}`),
      "",
      "## Suggested Answers",
      ...questions.map((q) => `Q: ${q}\nA:`),
      "",
      "## Notes",
      "Add definitive answers and links. This document was auto-generated from unanswered chats.",
    ];
    return lines.join("\n");
  };

  const handleIngestGap = async (gap: any) => {
    if (!selectedWidgetId) return;
    try {
      setGapLoading(true);
      const content = buildGapTemplate(
        gap.suggested_title,
        gap.sample_questions || [],
      );
      await knowledgeService.ingestText(
        selectedWidgetId,
        gap.suggested_title,
        content,
      );
      await loadSources(selectedWidgetId);
      setVectorRefreshToken((t) => t + 1);
    } catch (err) {
      setGapError("Failed to ingest suggested gap");
    } finally {
      setGapLoading(false);
    }
  };

  const selectedWidget = widgets.find(
    (widget) => widget.widget_id === selectedWidgetId,
  );
  const sourceTypeCounts = sources.reduce(
    (acc, source) => {
      acc[source.source_type] = (acc[source.source_type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <Box>
      {loading && <LinearProgress sx={{ mb: 2, borderRadius: 1.2 }} />}

      {error && (
        <Alert
          severity="error"
          sx={{
            mb: 2,
            borderRadius: "14px",
            border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
            boxShadow: `0 10px 18px ${alpha(theme.palette.error.dark, 0.12)}`,
          }}
        >
          {error}
        </Alert>
      )}

      {widgets.length === 0 && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: "14px" }}>
          No agents found. Create an agent before adding knowledge sources.
        </Alert>
      )}

      <Paper sx={{ ...sectionPanelSx, p: 2.4, mb: 3 }}>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
          >
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                Knowledge Workspace
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Organize knowledge per agent, ingest data in one flow, and
                inspect vectorized chunks.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                icon={<DataObjectIcon />}
                label={`${widgets.length} agent${widgets.length === 1 ? "" : "s"}`}
                variant="outlined"
              />
              <Chip
                icon={<SourceIcon />}
                label={`${sources.length} source${sources.length === 1 ? "" : "s"}`}
                color="primary"
                variant="outlined"
              />
              <Chip
                icon={<AutoFixHighIcon />}
                label={`${gapSuggestions.length} gap suggestion${gapSuggestions.length === 1 ? "" : "s"}`}
                color="secondary"
                variant="outlined"
              />
              <Chip
                icon={<StorageIcon />}
                label={
                  vectorLoading
                    ? "Embedding sync in progress"
                    : "Embeddings idle"
                }
                color={vectorLoading ? "warning" : "success"}
                variant="outlined"
              />
            </Stack>
          </Stack>

          <FormControl
            fullWidth
            size="small"
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: "12px",
                backgroundColor: alpha(theme.palette.common.white, 0.72),
              },
            }}
          >
            <InputLabel id="knowledge-widget-select-label">
              Select Agent
            </InputLabel>
            <Select
              labelId="knowledge-widget-select-label"
              value={selectedWidgetId}
              label="Select Agent"
              onChange={(e) => setSelectedWidgetId(e.target.value)}
            >
              {widgets.map((widget) => (
                <MenuItem key={widget.widget_id} value={widget.widget_id}>
                  {widget.name} ({widget.widget_id})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {selectedWidget && (
            <Alert
              severity="info"
              sx={{
                borderRadius: 2.2,
                border: `1px solid ${alpha(theme.palette.info.main, 0.22)}`,
              }}
            >
              Active agent: <strong>{selectedWidget.name}</strong> (
              {selectedWidget.widget_id})
            </Alert>
          )}
        </Stack>
      </Paper>

      {selectedWidgetId ? (
        <Stack spacing={3}>
          <Card elevation={0} sx={{ ...sectionPanelSx }}>
            <CardContent>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Step 1: Ingest Knowledge
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Add web pages, documents, or one-click generated gap content
                    for this agent.
                  </Typography>
                </Box>

                <Tabs
                  value={ingestTab}
                  onChange={(_, value) => setIngestTab(value)}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{
                    borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
                  }}
                >
                  <Tab
                    icon={<LanguageIcon />}
                    iconPosition="start"
                    label="Web Crawl"
                  />
                  <Tab
                    icon={<UploadFileIcon />}
                    iconPosition="start"
                    label="Document Upload"
                  />
                  <Tab
                    icon={<AutoFixHighIcon />}
                    iconPosition="start"
                    label="Suggested Gaps"
                  />
                </Tabs>

                {ingestTab === 0 && (
                  <WebCrawler
                    widgetId={selectedWidgetId}
                    onStarted={() => setVectorLoading(true)}
                    onCompleted={() => {
                      setVectorLoading(true);
                      setVectorRefreshToken((t) => t + 1);
                    }}
                  />
                )}

                {ingestTab === 1 && (
                  <DocumentUpload
                    widgetId={selectedWidgetId}
                    onStarted={() => setVectorLoading(true)}
                    onCompleted={() => {
                      setVectorLoading(true);
                      setVectorRefreshToken((t) => t + 1);
                    }}
                  />
                )}

                {ingestTab === 2 && (
                  <Box>
                    {gapError && (
                      <Alert severity="error" sx={{ mb: 2 }}>
                        {gapError}
                      </Alert>
                    )}
                    {gapLoading && (
                      <Typography variant="body2">
                        Loading suggestions...
                      </Typography>
                    )}
                    {!gapLoading && gapSuggestions.length === 0 && (
                      <Typography variant="body2" color="text.secondary">
                        No gaps detected for this agent yet.
                      </Typography>
                    )}
                    <Grid container spacing={2} sx={{ mt: 0.5 }}>
                      {gapSuggestions.map((gap) => (
                        <Grid item xs={12} md={6} key={gap.keyword}>
                          <Paper sx={{ ...insetPanelSx, p: 2 }}>
                            <Typography
                              variant="subtitle1"
                              sx={{ fontWeight: 700 }}
                            >
                              {gap.suggested_title}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Mentions: {gap.count}
                            </Typography>
                            <Box
                              sx={{
                                mt: 1,
                                display: "flex",
                                flexDirection: "column",
                                gap: 0.5,
                              }}
                            >
                              {(gap.sample_questions || []).map(
                                (question, idx) => (
                                  <Typography
                                    key={`${gap.keyword}-${idx}`}
                                    variant="body2"
                                    color="text.secondary"
                                  >
                                    - {question}
                                  </Typography>
                                ),
                              )}
                            </Box>
                            <Box sx={{ mt: 1.5 }}>
                              <Button
                                variant="contained"
                                size="small"
                                onClick={() => handleIngestGap(gap)}
                                disabled={gapLoading}
                                sx={{
                                  borderRadius: "10px",
                                  boxShadow: `0 10px 20px ${alpha(theme.palette.primary.dark, 0.2)}`,
                                }}
                              >
                                One-click ingest
                              </Button>
                            </Box>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>

          <Card elevation={0} sx={{ ...sectionPanelSx }}>
            <CardContent>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Step 2: Manage Sources
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Review all uploaded and crawled sources for the selected
                    agent.
                  </Typography>
                </Box>

                {sourcesLoading && <LinearProgress sx={{ borderRadius: 1 }} />}

                {Object.keys(sourceTypeCounts).length > 0 && (
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {Object.entries(sourceTypeCounts).map(([type, count]) => (
                      <Chip
                        key={type}
                        size="small"
                        label={`${type}: ${count}`}
                        variant="outlined"
                      />
                    ))}
                  </Stack>
                )}

                <TableContainer
                  sx={{
                    borderRadius: "12px",
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                  }}
                >
                  <Table>
                    <TableHead>
                      <TableRow
                        sx={{
                          background: `linear-gradient(110deg, ${alpha("#e7f0ff", 0.8)} 0%, ${alpha("#d8e9ff", 0.68)} 100%)`,
                        }}
                      >
                        <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Source</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>
                          Created At
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sources.map((source) => (
                        <TableRow
                          key={source.id}
                          hover
                          sx={{
                            "&:hover": {
                              backgroundColor: alpha(
                                theme.palette.primary.main,
                                0.05,
                              ),
                            },
                          }}
                        >
                          <TableCell>{source.name}</TableCell>
                          <TableCell>
                            <Chip
                              label={source.source_type}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell
                            sx={{
                              maxWidth: 320,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {source.url || source.file_path || "-"}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={source.status}
                              size="small"
                              color={
                                source.status === "completed"
                                  ? "success"
                                  : source.status === "failed"
                                    ? "error"
                                    : "warning"
                              }
                            />
                          </TableCell>
                          <TableCell>
                            {new Date(source.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <IconButton
                              onClick={() => handleDelete(source.id)}
                              color="error"
                              size="small"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                      {sources.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} align="center">
                            <Typography color="text.secondary">
                              No knowledge sources found for this agent.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Stack>
            </CardContent>
          </Card>

          <Paper sx={{ ...sectionPanelSx, p: 2.3 }}>
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Step 3: Vector Index Explorer
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Inspect chunk volume and source coverage for fast retrieval
                diagnostics.
              </Typography>
            </Box>
            <VectorizedDataViewer
              widgetId={selectedWidgetId}
              refreshToken={vectorRefreshToken}
              externalLoading={vectorLoading}
              onLoaded={(data) => {
                if (data?.total_chunks && data.total_chunks > lastTotalChunks) {
                  setLastTotalChunks(data.total_chunks);
                  setVectorLoading(false);
                } else {
                  setTimeout(() => setVectorLoading(false), 5000);
                }
              }}
            />
          </Paper>
        </Stack>
      ) : (
        <Paper sx={{ ...sectionPanelSx, p: 3 }}>
          <Typography variant="body1" color="text.secondary">
            Select an agent to start ingesting and managing knowledge.
          </Typography>
        </Paper>
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete knowledge source?"
        description={
          pendingDeleteId !== null
            ? `This will remove "${pendingDeleteName}" and ${pendingDeleteEmbeddings} associated embedding(s). This action cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmColor="error"
        loading={deleteSubmitting}
        onCancel={closeDeleteDialog}
        onConfirm={handleConfirmDelete}
      />
    </Box>
  );
};

export default KnowledgeManager;
