import api from './api';
import {
  OrgCredit,
  OrgCreditAutomationRunResponse,
  OrgCreditBalance,
  OrgCreditCreateRequest,
  OrgCreditCreateResponse,
  OrgCreditDeleteResponse,
  OrgCreditDocumentEmailRequest,
  OrgCreditInvoice,
  OrgCreditInvoiceDeleteResponse,
  OrgCreditInvoiceDocument,
  OrgCreditInvoiceGenerateRequest,
  OrgCreditInvoicePaymentStatusRequest,
  OrgCreditLapseReport,
  OrgCreditPayment,
  OrgCreditPaymentDeleteResponse,
  OrgCreditPaymentCreateRequest,
  OrgCreditPaymentCreateResponse,
  OrgCreditPaymentReceipt,
  OrgCreditTopupRequest,
  OrgCreditUsageTrackRequest,
} from '../types/orgCreditBilling';

const basePath = '/api/superadmin/org-credit';

export const orgCreditBillingService = {
  async createOrgCredit(payload: OrgCreditCreateRequest): Promise<OrgCreditCreateResponse> {
    const response = await api.post<OrgCreditCreateResponse>(`${basePath}/org-credits`, payload);
    return response.data;
  },

  async listOrgCredits(params?: { organization_id?: number }): Promise<OrgCredit[]> {
    const response = await api.get<OrgCredit[]>(`${basePath}/org-credits`, { params });
    return response.data;
  },

  async deleteOrgCredit(orgCreditId: number): Promise<OrgCreditDeleteResponse> {
    const response = await api.delete<OrgCreditDeleteResponse>(`${basePath}/org-credits/${orgCreditId}`);
    return response.data;
  },

  async addTopup(orgCreditId: number, payload: OrgCreditTopupRequest): Promise<OrgCreditCreateResponse> {
    const response = await api.post<OrgCreditCreateResponse>(`${basePath}/org-credits/${orgCreditId}/topups`, payload);
    return response.data;
  },

  async generateInvoice(payload: OrgCreditInvoiceGenerateRequest): Promise<OrgCreditInvoice> {
    const response = await api.post<OrgCreditInvoice>(`${basePath}/invoices/generate`, payload);
    return response.data;
  },

  async listInvoices(params?: { organization_id?: number; org_credit_id?: number }): Promise<OrgCreditInvoice[]> {
    const response = await api.get<OrgCreditInvoice[]>(`${basePath}/invoices`, { params });
    return response.data;
  },

  async deleteInvoice(invoiceId: number): Promise<OrgCreditInvoiceDeleteResponse> {
    const response = await api.delete<OrgCreditInvoiceDeleteResponse>(`${basePath}/invoices/${invoiceId}`);
    return response.data;
  },

  async getInvoiceDocument(invoiceId: number): Promise<OrgCreditInvoiceDocument> {
    const response = await api.get<OrgCreditInvoiceDocument>(`${basePath}/invoices/${invoiceId}/document`);
    return response.data;
  },

  async sendInvoiceEmail(invoiceId: number, payload: OrgCreditDocumentEmailRequest): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>(`${basePath}/invoices/${invoiceId}/email`, payload);
    return response.data;
  },

  async markInvoicePaymentStatus(invoiceId: number, payload: OrgCreditInvoicePaymentStatusRequest): Promise<OrgCreditInvoice> {
    const response = await api.put<OrgCreditInvoice>(`${basePath}/invoices/${invoiceId}/payment-status`, payload);
    return response.data;
  },

  async addPayment(payload: OrgCreditPaymentCreateRequest): Promise<OrgCreditPaymentCreateResponse> {
    const response = await api.post<OrgCreditPaymentCreateResponse>(`${basePath}/payments`, payload);
    return response.data;
  },

  async listPayments(params?: { organization_id?: number; invoice_id?: number }): Promise<OrgCreditPayment[]> {
    const response = await api.get<OrgCreditPayment[]>(`${basePath}/payments`, { params });
    return response.data;
  },

  async deletePayment(paymentId: number): Promise<OrgCreditPaymentDeleteResponse> {
    const response = await api.delete<OrgCreditPaymentDeleteResponse>(`${basePath}/payments/${paymentId}`);
    return response.data;
  },

  async getPaymentReceipt(paymentId: number): Promise<OrgCreditPaymentReceipt> {
    const response = await api.get<OrgCreditPaymentReceipt>(`${basePath}/payments/${paymentId}/receipt`);
    return response.data;
  },

  async sendPaymentReceiptEmail(paymentId: number, payload: OrgCreditDocumentEmailRequest): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>(`${basePath}/payments/${paymentId}/email`, payload);
    return response.data;
  },

  async getCreditAvailability(params: { organization_id: number; billing_period?: string }): Promise<OrgCreditBalance> {
    const response = await api.get<OrgCreditBalance>(`${basePath}/credits/availability`, { params });
    return response.data;
  },

  async trackUsage(payload: OrgCreditUsageTrackRequest): Promise<OrgCreditBalance> {
    const response = await api.post<OrgCreditBalance>(`${basePath}/credits/usage`, payload);
    return response.data;
  },

  async runAutomation(): Promise<OrgCreditAutomationRunResponse> {
    const response = await api.post<OrgCreditAutomationRunResponse>(`${basePath}/automation/run`);
    return response.data;
  },

  async getLapseReport(params?: { billing_period?: string; months?: number; organization_id?: number }): Promise<OrgCreditLapseReport> {
    const response = await api.get<OrgCreditLapseReport>(`${basePath}/reports/lapse`, { params });
    return response.data;
  },
};
