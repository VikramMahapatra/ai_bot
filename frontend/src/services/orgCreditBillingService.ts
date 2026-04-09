import api from './api';
import {
  OrgCredit,
  OrgCreditAutomationRunResponse,
  OrgCreditBalance,
  OrgCreditCreateRequest,
  OrgCreditCreateResponse,
  OrgCreditInvoice,
  OrgCreditInvoiceGenerateRequest,
  OrgCreditInvoicePaymentStatusRequest,
  OrgCreditPayment,
  OrgCreditPaymentCreateRequest,
  OrgCreditPaymentCreateResponse,
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
};

