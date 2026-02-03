import api from './api';
import { KnowledgeSource, WebCrawlRequest } from '../types';

export const knowledgeService = {
  async crawlWebsite(request: WebCrawlRequest): Promise<KnowledgeSource> {
    const response = await api.post<KnowledgeSource>('/api/admin/knowledge/crawl', request);
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

  async listSources(widgetId?: string): Promise<KnowledgeSource[]> {
    const response = await api.get<KnowledgeSource[]>('/api/admin/knowledge/sources', {
      params: widgetId ? { widget_id: widgetId } : undefined,
    });
    return response.data;
  },

  async deleteSource(sourceId: number): Promise<void> {
    await api.delete(`/api/admin/knowledge/sources/${sourceId}`);
  },

  async getVectorizedData(widgetId?: string): Promise<any> {
    const response = await api.get('/api/admin/knowledge/vectorized-data', {
      params: widgetId ? { widget_id: widgetId } : undefined,
    });
    return response.data;
  },
};
