import api from './api';
import { jsPDF } from 'jspdf';

export interface ReportSummary {
  total_conversations: number;
  total_messages: number;
  total_tokens: number;
  average_tokens_per_conversation: number;
  total_leads_captured: number;
  average_conversation_duration: number;
  average_satisfaction_rating: number | null;
}

export interface ConversationMetric {
  id: number;
  session_id: string;
  organization_id: number;
  widget_id: string | null;
  total_messages: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  average_response_time: number;
  conversation_duration: number;
  user_satisfaction: number | null;
  has_lead: number;
  lead_name: string | null;
  lead_email: string | null;
  conversation_start: string;
  conversation_end: string | null;
  created_at: string;
}

export interface DetailedReport {
  summary: ReportSummary;
  metrics: ConversationMetric[];
  pagination: {
    skip: number;
    limit: number;
    total: number;
  };
}

export interface TokenUsageReport {
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  average_tokens_per_conversation: number;
  conversations_count: number;
  cost_estimate: number | null;
}

export interface LeadReport {
  total_leads: number;
  leads_by_widget: Record<string, number>;
  leads_by_date: Record<string, number>;
  leads_with_email: number;
  conversion_rate: number;
}

export interface DailyStats {
  date: string;
  conversation_count: number;
  total_messages: number;
  total_tokens: number;
  leads_captured: number;
}

export const reportService = {
  async getReportSummary(params: {
    start_date?: string;
    end_date?: string;
    widget_id?: string;
  }): Promise<ReportSummary> {
    const response = await api.get('/api/reports/summary', { params });
    return response.data;
  },

  async getConversationsReport(params: {
    skip?: number;
    limit?: number;
    start_date?: string;
    end_date?: string;
    widget_id?: string;
    min_tokens?: number;
    max_tokens?: number;
    has_lead?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }): Promise<DetailedReport> {
    const response = await api.get('/api/reports/conversations', { params });
    return response.data;
  },

  async getTokenUsageReport(params: {
    start_date?: string;
    end_date?: string;
  }): Promise<TokenUsageReport> {
    const response = await api.get('/api/reports/tokens', { params });
    return response.data;
  },

  async getLeadsReport(params: {
    start_date?: string;
    end_date?: string;
  }): Promise<LeadReport> {
    const response = await api.get('/api/reports/leads', { params });
    return response.data;
  },

  async getDailyStats(params: { days?: number }): Promise<{ daily_stats: DailyStats[] }> {
    const response = await api.get('/api/reports/daily-stats', { params });
    return response.data;
  },

  async exportToCSV(params: {
    start_date?: string;
    end_date?: string;
    widget_id?: string;
  }): Promise<void> {
    const response = await api.get('/api/reports/export/csv', {
      params,
      responseType: 'blob',
    });

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'conversation_report.csv');
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
  },

  async exportToPDF(
    summary: ReportSummary,
    metrics: ConversationMetric[],
    title: string = 'Conversation Report'
  ): Promise<void> {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPosition = 20;

    // Header
    doc.setFontSize(20);
    doc.setTextColor(0, 51, 102);
    doc.text(title, margin, yPosition);
    yPosition += 15;

    // Summary Section
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'bold');
    doc.text('Summary', margin, yPosition);
    yPosition += 10;

    // Summary data as simple text
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    const summaryLines = [
      `Total Conversations: ${summary.total_conversations}`,
      `Total Messages: ${summary.total_messages}`,
      `Total Tokens: ${summary.total_tokens}`,
      `Avg Tokens/Conversation: ${summary.average_tokens_per_conversation.toFixed(2)}`,
      `Total Leads: ${summary.total_leads_captured}`,
      `Avg Duration: ${summary.average_conversation_duration.toFixed(2)}s`,
      `Avg Satisfaction: ${summary.average_satisfaction_rating?.toFixed(2) || 'N/A'}/5`,
    ];

    summaryLines.forEach(line => {
      if (yPosition > pageHeight - 30) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(line, margin, yPosition);
      yPosition += 7;
    });

    yPosition += 5;

    // Conversation Details Section
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.text('Conversation Details', margin, yPosition);
    yPosition += 10;

    // Column headers
    doc.setFont(undefined, 'bold');
    doc.setFontSize(9);
    doc.setFillColor(220, 220, 220);
    const colWidths = [18, 12, 12, 15, 12, 10, 20];
    const headers = ['Session', 'Msgs', 'Tokens', 'Resp (s)', 'Rating', 'Lead', 'Date'];
    let xPos = margin;
    headers.forEach((header, i) => {
      doc.rect(xPos, yPosition - 5, colWidths[i], 7, 'F');
      doc.text(header, xPos + 1, yPosition);
      xPos += colWidths[i];
    });
    yPosition += 10;

    // Data rows
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    metrics.slice(0, 100).forEach(m => {
      if (yPosition > pageHeight - 20) {
        doc.addPage();
        yPosition = 20;
      }

      xPos = margin;
      const row = [
        m.session_id.substring(0, 12),
        m.total_messages.toString(),
        m.total_tokens.toString(),
        m.average_response_time.toFixed(2),
        m.user_satisfaction ? m.user_satisfaction.toFixed(1) : 'N/A',
        m.has_lead ? 'Yes' : 'No',
        new Date(m.conversation_start).toLocaleDateString(),
      ];

      row.forEach((cell, i) => {
        doc.text(cell, xPos + 1, yPosition);
        xPos += colWidths[i];
      });
      yPosition += 7;
    });

    // Footer with page numbers
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    // Save PDF
    doc.save('conversation_report.pdf');
  },

  async exportSummaryToPDF(summary: ReportSummary, title: string = 'Summary Report'): Promise<void> {
    const doc = new jsPDF();
    const margin = 15;
    let yPosition = 20;

    // Header
    doc.setFontSize(20);
    doc.setTextColor(0, 51, 102);
    doc.text(title, margin, yPosition);
    yPosition += 15;

    // Summary metrics
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text('Key Metrics', margin, yPosition);
    yPosition += 10;

    doc.setFont(undefined, 'normal');
    doc.setFontSize(11);
    const metrics = [
      { label: 'Total Conversations', value: summary.total_conversations },
      { label: 'Total Messages', value: summary.total_messages },
      { label: 'Total Tokens Used', value: summary.total_tokens.toLocaleString() },
      { label: 'Average Tokens per Conversation', value: summary.average_tokens_per_conversation.toFixed(2) },
      { label: 'Total Leads Captured', value: summary.total_leads_captured },
      { label: 'Average Conversation Duration', value: `${summary.average_conversation_duration.toFixed(2)}s` },
      { label: 'Average Satisfaction Rating', value: `${summary.average_satisfaction_rating?.toFixed(2) || 'N/A'}/5` },
    ];

    metrics.forEach(metric => {
      doc.setFont(undefined, 'bold');
      doc.text(metric.label, margin, yPosition);
      doc.setFont(undefined, 'normal');
      doc.text(metric.value.toString(), margin + 100, yPosition);
      yPosition += 10;
    });

    doc.save('summary_report.pdf');
  },

  async exportConversationsToPDF(metrics: ConversationMetric[], title: string = 'Conversations Report'): Promise<void> {
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPosition = 20;

    // Header
    doc.setFontSize(20);
    doc.setTextColor(0, 51, 102);
    doc.text(title, margin, yPosition);
    yPosition += 15;

    // Table headers
    doc.setFont(undefined, 'bold');
    doc.setFontSize(9);
    doc.setFillColor(220, 220, 220);
    doc.setTextColor(0, 0, 0);
    const colWidths = [18, 12, 12, 15, 12, 10, 20];
    const headers = ['Session', 'Msgs', 'Tokens', 'Resp (s)', 'Rating', 'Lead', 'Date'];
    let xPos = margin;
    headers.forEach((header, i) => {
      doc.rect(xPos, yPosition - 5, colWidths[i], 7, 'F');
      doc.text(header, xPos + 1, yPosition);
      xPos += colWidths[i];
    });
    yPosition += 10;

    // Data rows
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    metrics.forEach(m => {
      if (yPosition > pageHeight - 20) {
        doc.addPage();
        yPosition = 20;
      }

      xPos = margin;
      const row = [
        m.session_id.substring(0, 12),
        m.total_messages.toString(),
        m.total_tokens.toString(),
        m.average_response_time.toFixed(2),
        m.user_satisfaction ? m.user_satisfaction.toFixed(1) : 'N/A',
        m.has_lead ? 'Yes' : 'No',
        new Date(m.conversation_start).toLocaleDateString(),
      ];
      row.forEach((cell, i) => {
        doc.text(cell, xPos + 1, yPosition);
        xPos += colWidths[i];
      });
      yPosition += 7;
    });

    doc.save('conversations_report.pdf');
  },

  async exportTokensToPDF(tokenReport: TokenUsageReport, title: string = 'Token Usage Report'): Promise<void> {
    const doc = new jsPDF();
    const margin = 15;
    let yPosition = 20;

    // Header
    doc.setFontSize(20);
    doc.setTextColor(0, 51, 102);
    doc.text(title, margin, yPosition);
    yPosition += 15;

    // Metrics
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text('Token Usage Summary', margin, yPosition);
    yPosition += 10;

    doc.setFont(undefined, 'normal');
    doc.setFontSize(11);
    const metrics = [
      { label: 'Total Tokens Used', value: tokenReport.total_tokens.toLocaleString() },
      { label: 'Prompt Tokens', value: tokenReport.prompt_tokens.toLocaleString() },
      { label: 'Completion Tokens', value: tokenReport.completion_tokens.toLocaleString() },
      { label: 'Average Tokens per Conversation', value: tokenReport.average_tokens_per_conversation.toFixed(2) },
      { label: 'Total Conversations', value: tokenReport.conversations_count },
      { label: 'Estimated Cost', value: tokenReport.cost_estimate ? `$${tokenReport.cost_estimate.toFixed(2)}` : 'N/A' },
    ];

    metrics.forEach(metric => {
      doc.setFont(undefined, 'bold');
      doc.text(metric.label, margin, yPosition);
      doc.setFont(undefined, 'normal');
      doc.text(metric.value.toString(), margin + 100, yPosition);
      yPosition += 10;
    });

    doc.save('token_usage_report.pdf');
  },

  async exportLeadsToPDF(leadReport: LeadReport, title: string = 'Leads Analytics Report'): Promise<void> {
    const doc = new jsPDF();
    const margin = 15;
    let yPosition = 20;

    // Header
    doc.setFontSize(20);
    doc.setTextColor(0, 51, 102);
    doc.text(title, margin, yPosition);
    yPosition += 15;

    // Summary metrics
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text('Lead Summary', margin, yPosition);
    yPosition += 10;

    doc.setFont(undefined, 'normal');
    doc.setFontSize(11);
    const metrics = [
      { label: 'Total Leads', value: leadReport.total_leads },
      { label: 'Leads with Email', value: leadReport.leads_with_email },
      { label: 'Conversion Rate', value: `${(leadReport.conversion_rate * 100).toFixed(2)}%` },
    ];

    metrics.forEach(metric => {
      doc.setFont(undefined, 'bold');
      doc.text(metric.label, margin, yPosition);
      doc.setFont(undefined, 'normal');
      doc.text(metric.value.toString(), margin + 100, yPosition);
      yPosition += 10;
    });

    // Leads by widget
    if (Object.keys(leadReport.leads_by_widget).length > 0) {
      yPosition += 5;
      doc.setFont(undefined, 'bold');
      doc.setFontSize(12);
      doc.text('Leads by Widget', margin, yPosition);
      yPosition += 10;

      doc.setFont(undefined, 'normal');
      doc.setFontSize(10);
      Object.entries(leadReport.leads_by_widget).forEach(([widget, count]) => {
        doc.text(`${widget}: ${count}`, margin + 5, yPosition);
        yPosition += 7;
      });
    }

    doc.save('leads_analytics_report.pdf');
  },

  async exportDailyStatsToPDF(dailyStats: DailyStats[], title: string = 'Daily Statistics Report'): Promise<void> {
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPosition = 20;

    // Header
    doc.setFontSize(20);
    doc.setTextColor(0, 51, 102);
    doc.text(title, margin, yPosition);
    yPosition += 15;

    // Table headers
    doc.setFont(undefined, 'bold');
    doc.setFontSize(9);
    doc.setFillColor(220, 220, 220);
    doc.setTextColor(0, 0, 0);
    const colWidths = [30, 25, 25, 25, 25];
    const headers = ['Date', 'Conversations', 'Messages', 'Tokens', 'Leads'];
    let xPos = margin;
    headers.forEach((header, i) => {
      doc.rect(xPos, yPosition - 5, colWidths[i], 7, 'F');
      doc.text(header, xPos + 1, yPosition);
      xPos += colWidths[i];
    });
    yPosition += 10;

    // Data rows
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    dailyStats.forEach(stat => {
      if (yPosition > pageHeight - 20) {
        doc.addPage();
        yPosition = 20;
      }

      xPos = margin;
      const row = [
        stat.date,
        stat.conversation_count.toString(),
        stat.total_messages.toString(),
        stat.total_tokens.toString(),
        stat.leads_captured.toString(),
      ];
      row.forEach((cell, i) => {
        doc.text(cell, xPos + 1, yPosition);
        xPos += colWidths[i];
      });
      yPosition += 7;
    });

    doc.save('daily_stats_report.pdf');
  },

  async exportToPDF(
    summary: ReportSummary,
    metrics: ConversationMetric[],
    title: string = 'Conversation Report'
  ): Promise<void> {
    return this.exportConversationsToPDF(metrics, title);
  },
};
