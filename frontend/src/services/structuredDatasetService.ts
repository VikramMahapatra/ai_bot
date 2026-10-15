import api from './api';

// Decimal and monetary values must remain strings throughout the UI.
export type DatasetScalar = string | number | boolean | null;
export type DatasetRow = Record<string, DatasetScalar>;
export interface DatasetColumn {
  key: string;
  label: string;
  data_type: 'text' | 'integer' | 'decimal' | 'boolean' | 'date';
  aliases: string[];
  unit?: string | null;
  currency?: string | null;
  public: boolean;
  queryable: boolean;
}
export interface DatasetCapabilities {
  enabled: boolean;
  chat_enabled: boolean;
  supported_formats: ('xlsx' | 'csv')[];
  max_rows: number;
  max_columns: number;
}
export interface DatasetValidation { valid: boolean; errors: string[]; warnings: string[] }
export interface DatasetVersionInput {
  sheet_name: string;
  columns: DatasetColumn[];
  rows: DatasetRow[];
  required_filters: string[];
}
export interface DatasetVersion extends DatasetVersionInput {
  id: number;
  version_number: number;
  status: 'draft' | 'published';
  validation: DatasetValidation;
  row_count: number;
}
export interface StructuredDataset {
  id: number;
  widget_id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'inactive';
  active_version_id: number | null;
  versions?: DatasetVersion[];
  draft_version?: DatasetVersion;
}
export interface DatasetCreateInput extends DatasetVersionInput {
  widget_id: string;
  name: string;
  description: string;
}
export interface DatasetInspection {
  sheet_names: string[];
  tables: { sheet_name: string; columns: DatasetColumn[]; rows: DatasetRow[]; row_count: number }[];
  warnings: string[];
}
export interface DatasetQueryPlan {
  dataset_id: number;
  version_id?: number;
  operation: 'lookup' | 'count' | 'sum' | 'min' | 'max';
  filters: { column: string; operator: 'eq' | 'lt' | 'lte' | 'gt' | 'gte'; value: DatasetScalar }[];
  select: string[];
  aggregate_column?: string;
  limit: number;
}
export interface DatasetQueryResult {
  status: 'matched' | 'no_match' | 'clarify';
  response: string;
  citations: Record<string, unknown>[];
  rows: DatasetRow[];
  total_matches: number;
}

const base = '/api/admin/knowledge/datasets';
// Optional metadata cleared in the editor must not become an invalid currency ''.
const normalizeVersionInput = <T extends DatasetVersionInput>(body: T): T => ({
  ...body,
  columns: body.columns.map(column => ({
    ...column,
    aliases: column.aliases.map(alias => alias.trim()).filter(Boolean),
    unit: column.unit?.trim() || null,
    currency: column.currency?.trim().toUpperCase() || null,
  })),
});
export const structuredDatasetService = {
  async capabilities(widgetId: string, signal?: AbortSignal): Promise<DatasetCapabilities> {
    return (await api.get<DatasetCapabilities>(`${base}/capabilities`, { params: { widget_id: widgetId }, signal })).data;
  },
  async list(widgetId: string, signal?: AbortSignal): Promise<StructuredDataset[]> {
    return (await api.get<{ items: StructuredDataset[] }>(`${base}/`, { params: { widget_id: widgetId }, signal })).data.items;
  },
  async inspect(file: File, widgetId: string, headerRow = 1, signal?: AbortSignal, sheetName?: string, discoveryOnly = false): Promise<DatasetInspection> {
    const body = new FormData();
    body.append('file', file);
    body.append('widget_id', widgetId);
    body.append('header_row', String(headerRow));
    if (sheetName !== undefined) body.append('sheet_name', sheetName);
    if (discoveryOnly) body.append('discovery_only', 'true');
    return (await api.post<DatasetInspection>(`${base}/inspect`, body, { signal })).data;
  },
  async create(body: DatasetCreateInput, signal?: AbortSignal): Promise<StructuredDataset> {
    return (await api.post<StructuredDataset>(`${base}/`, normalizeVersionInput(body), { signal })).data;
  },
  async detail(id: number, signal?: AbortSignal): Promise<StructuredDataset> {
    return (await api.get<StructuredDataset>(`${base}/${id}`, { signal })).data;
  },
  async replace(id: number, body: DatasetVersionInput, signal?: AbortSignal): Promise<StructuredDataset> {
    return (await api.post<StructuredDataset>(`${base}/${id}/versions`, normalizeVersionInput(body), { signal })).data;
  },
  async validate(id: number, versionId: number, signal?: AbortSignal): Promise<DatasetValidation> {
    return (await api.post<DatasetValidation>(`${base}/${id}/versions/${versionId}/validate`, undefined, { signal })).data;
  },
  async publish(id: number, versionId: number, signal?: AbortSignal): Promise<StructuredDataset> {
    return (await api.post<StructuredDataset>(`${base}/${id}/versions/${versionId}/publish`, undefined, { signal })).data;
  },
  async setStatus(id: number, status: 'active' | 'inactive', signal?: AbortSignal): Promise<StructuredDataset> {
    return (await api.patch<StructuredDataset>(`${base}/${id}`, { status }, { signal })).data;
  },
  async remove(id: number, signal?: AbortSignal): Promise<void> {
    await api.delete(`${base}/${id}`, { signal });
  },
  async rows(id: number, skip = 0, limit = 50, signal?: AbortSignal): Promise<{ items: { row_number: number; values: DatasetRow }[]; total: number }> {
    return (await api.get(`${base}/${id}/rows`, { params: { skip, limit: Math.min(2000, limit) }, signal })).data;
  },
  async testQuery(id: number, body: DatasetQueryPlan, signal?: AbortSignal): Promise<DatasetQueryResult> {
    return (await api.post<DatasetQueryResult>(`${base}/${id}/test-query`, { ...body, limit: Math.min(20, Math.max(1, body.limit)) }, { signal })).data;
  },
};