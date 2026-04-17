import api from './api';
import {
  KnowledgeSource,
  WebCrawlRequest,
  WebCrawlResponse,
  WebCrawlPreviewRequest,
  WebCrawlPreviewResponse,
  CrawlJobStatus,
} from '../types';

export interface SourceListResponse {
  items: KnowledgeSource[];
  pagination: {
    total: number;
    skip: number;
    limit: number;
  };
}

export interface KnowledgeSourceFilters {
  widgetId: string,
   // pagination
  search?: string;
  skip?: number;
  limit?: number;
}

export const knowledgeService = {
  async previewWebsiteLinks(request: WebCrawlPreviewRequest): Promise<WebCrawlPreviewResponse> {
    const response = await api.post<WebCrawlPreviewResponse>('/api/admin/knowledge/crawl/preview', request);
    return response.data;
  },

  async crawlWebsite(request: WebCrawlRequest): Promise<WebCrawlResponse> {
    const response = await api.post<WebCrawlResponse>('/api/admin/knowledge/crawl', request);
    return response.data;
  },

  async startCrawlWebsiteJob(request: WebCrawlRequest): Promise<CrawlJobStatus> {
    const response = await api.post<CrawlJobStatus>('/api/admin/knowledge/crawl/async', request);
    return response.data;
  },

  async getCrawlWebsiteJobStatus(jobId: string): Promise<CrawlJobStatus> {
    const response = await api.get<CrawlJobStatus>(`/api/admin/knowledge/crawl/async/${encodeURIComponent(jobId)}`);
    return response.data;
  },

  async getLatestActiveCrawlWebsiteJob(widgetId: string): Promise<CrawlJobStatus> {
    const response = await api.get<CrawlJobStatus>('/api/admin/knowledge/crawl/async/latest', {
      params: { widget_id: widgetId },
    });
    return response.data;
  },

  async uploadDocument(file: File, widgetId: string): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('widget_id', widgetId);

    const response = await api.post('/api/admin/knowledge/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async listSources(filters?: KnowledgeSourceFilters): Promise<SourceListResponse> {
    const params = filters
      ? {
          widget_id: filters.widgetId,
          search: filters.search,
          skip: filters.skip,
          limit: filters.limit,
        }
      : undefined;

    const response = await api.get('/api/admin/knowledge/sources', {
      params,
    });
    return response.data;
  },

  async deleteSource(sourceId: number): Promise<void> {
    await api.delete(`/api/admin/knowledge/sources/${sourceId}`);
  },

  async getVectorizedData(widgetId: string, options?: { includeDocuments?: boolean; limit?: number }): Promise<any> {
    const response = await api.get('/api/admin/knowledge/vectorized-data', {
      params: {
        widget_id: widgetId,
        include_documents: options?.includeDocuments ?? false,
        limit: options?.limit ?? 200,
      },
    });
    return response.data;
  },

  async ingestText(widgetId: string, title: string, content: string): Promise<any> {
    const response = await api.post('/api/admin/knowledge/ingest-text', {
      widget_id: widgetId,
      title,
      content,
    });
    return response.data;
  },
};
