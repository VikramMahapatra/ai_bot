import api from './api';
import {
  SuperAdminLoginRequest,
  SuperAdminLoginResponse,
  SuperAdminOrganization,
  OrganizationLimits,
  CallingNumber,
  OrganizationReport,
  OrganizationReportResponse,
  PriceMatrixItem,
  PriceMatrixItemPayload,
  PriceMatrixEstimateRequest,
  PriceMatrixEstimateResponse,
  CreditEstimatorShareCreateRequest,
  CreditEstimatorShareExtendRequest,
  CreditEstimatorShareResponse,
  CreditEstimatorSharePublicResponse,
  CreditEstimatorShareEmailRequest,
  CreditEstimatorResultListItem,
  CreditEstimatorShareUpdateRequest,
  OrganizationCreditAllocation,
  OrganizationCreditAllocationCreateRequest,
  OrganizationCreditAllocationSummary,
  OrganizationCreditAllocationUpdateRequest,
  OrganizationCreditProfile,
  OrganizationCreditProfileUpdateRequest,
  OrganizationCreditChangeLog,
  BillingInvoice,
  BillingInvoiceDetail,
  BillingInvoiceMarkPaidRequest,
  BillingInvoiceMarkPaidResponse,
  BillingPayment,
  BillingPaymentCreateRequest,
  BillingInvoiceBackfillResponse,
  BillingBill,
  Channel,
  OrganizationChannel
} from '../types';
import { OrgCreditAdminMonthSummary } from '../types/orgCreditBilling';

export interface CreditUsageFilters {
  organization_id?: number,
  billing_period?: string,
  search?: string;
  skip?: number;
  limit?: number;
}

export interface CrediUsageListResponse {
  items: OrgCreditAdminMonthSummary[];
  pagination: {
    total: number;
    skip: number;
    limit: number;
  };
}

export const superadminService = {
  async login(credentials: SuperAdminLoginRequest): Promise<SuperAdminLoginResponse> {
    const response = await api.post<SuperAdminLoginResponse>('/api/superadmin/login', credentials);
    return response.data;
  },

  async bootstrap(username: string, password: string, email?: string) {
    const response = await api.post('/api/superadmin/bootstrap', { username, password, email });
    return response.data;
  },

  async listOrganizations(): Promise<SuperAdminOrganization[]> {
    const response = await api.get<SuperAdminOrganization[]>('/api/superadmin/organizations');
    return response.data;
  },

  async listCreditUsage(params?: CreditUsageFilters): Promise<CrediUsageListResponse> {
    const response = await api.get<CrediUsageListResponse>(`/api/superadmin/org-credit-usage`, { params });
    return response.data;
  },

  async createOrganization(payload: {
    organization_name: string;
    description?: string;
    joining_date?: string;
    effective_joining_date?: string;
    admin_username: string;
    admin_email: string;
    admin_password: string;
    limits?: Partial<OrganizationLimits>;
    echoleads_api_key?: string;
    status?: string;
    trial_end_date?: string;
    industry?: string;
    commercial_notes?: string;
  }) {
    const response = await api.post<SuperAdminOrganization>('/api/superadmin/organizations', payload);
    return response.data;
  },

  async updateOrganization(
    orgId: number,
    payload: {
      organization_name?: string;
      description?: string;
      joining_date?: string;
      effective_joining_date?: string;
      admin_username?: string;
      admin_email?: string;
      admin_password?: string;
      echoleads_api_key?: string;
      status?: string;
      trial_end_date?: string;
      industry?: string;
      commercial_notes?: string;
      timezone?: string;
    }
  ) {
    const response = await api.put<SuperAdminOrganization>(`/api/superadmin/organizations/${orgId}`, payload);
    return response.data;
  },

  async updateOrganizationStatus(orgId: number, isActive: boolean) {
    const response = await api.patch<SuperAdminOrganization>(`/api/superadmin/organizations/${orgId}/status`, { is_active: isActive });
    return response.data;
  },

  async deleteOrganization(orgId: number) {
    const response = await api.delete<{ success: boolean; deleted_organization_id: number }>(`/api/superadmin/organizations/${orgId}`);
    return response.data;
  },

  async updateLimits(orgId: number, limits: Partial<OrganizationLimits>) {
    const response = await api.put<OrganizationLimits>(`/api/superadmin/organizations/${orgId}/limits`, limits);
    return response.data;
  },

  async getAnalyticsOverview() {
    const response = await api.get('/api/superadmin/analytics/overview');
    return response.data;
  },

  async getAnalyticsByOrg() {
    const response = await api.get('/api/superadmin/analytics/by-org');
    return response.data;
  },

  async getOrgAnalytics(orgId: number) {
    const response = await api.get(`/api/superadmin/analytics/org/${orgId}`);
    return response.data;
  },

  // Calling No
  async getCallingNumbers(orgId: number): Promise<CallingNumber[]> {
    const response = await api.get<CallingNumber[]>(`/api/superadmin/org/${orgId}/calling-numbers`);
    return response.data;
  },

  async createCallingNumber(orgId: number, payload: Omit<CallingNumber, 'id'>) {
    const response = await api.post<CallingNumber>(`/api/superadmin/org/${orgId}/calling-number`, payload);
    return response.data;
  },

  async updateCallingNumber(callingNoId: number, payload: Omit<CallingNumber, 'id'>) {
    const response = await api.put<CallingNumber>(`/api/superadmin/org/calling-number/${callingNoId}`, payload);
    return response.data;
  },

  async setDefaultCallingNumber(callingNoId: number) {
    const response = await api.patch<CallingNumber>(`/api/superadmin/org/calling-number/${callingNoId}/default`);
    return response.data;
  },

  async toggleActiveCallingNumber(callingNoId: number) {
    const response = await api.patch<CallingNumber>(`/api/superadmin/org/calling-number/${callingNoId}/active`);
    return response.data;
  },

  async deleteCallingNumber(callingNoId: number) {
    const response = await api.delete<CallingNumber>(`/api/superadmin/org/calling-number/${callingNoId}`);
    return response.data;
  },

  // Channel
  async getMasterChanels(): Promise<Channel[]> {
    const response = await api.get<Channel[]>(`/api/superadmin/master/channels`);
    return response.data;
  },

  async getOrganizationChanels(orgId: number): Promise<OrganizationChannel[]> {
    const response = await api.get<OrganizationChannel[]>(`/api/superadmin/org/${orgId}/channels`);
    return response.data;
  },

  async createOrgChannel(orgId: number, channel_id: number) {
    const response = await api.post<OrganizationChannel>(`/api/superadmin/org/${orgId}/channel`, { "channel_id": channel_id });
    return response.data;
  },

  async updateOrgChannel(orgChannelId: number, channel_id: number) {
    const response = await api.put<OrganizationChannel>(`/api/superadmin/org/channel/${orgChannelId}`, { "channel_id": channel_id });
    return response.data;
  },

  async deleteOrgChannel(orgChannelId: number) {
    const response = await api.delete<OrganizationChannel>(`/api/superadmin/org/channel/${orgChannelId}`);
    return response.data;
  },
  /////

  async getOrganizationReport(params: { search?: string; skip?: number; limit?: number } = {}): Promise<OrganizationReportResponse> {
    const response = await api.get<OrganizationReportResponse>(`/api/superadmin/org/organization-calling-report`, { params });
    return response.data;
  },

  async listPriceMatrix(activeOnly = false): Promise<PriceMatrixItem[]> {
    const response = await api.get<PriceMatrixItem[]>('/api/superadmin/price-matrix', {
      params: { active_only: activeOnly },
    });
    return response.data;
  },

  async createPriceMatrixItem(payload: PriceMatrixItemPayload): Promise<PriceMatrixItem> {
    const response = await api.post<PriceMatrixItem>('/api/superadmin/price-matrix', payload);
    return response.data;
  },

  async updatePriceMatrixItem(itemId: number, payload: Partial<PriceMatrixItemPayload>): Promise<PriceMatrixItem> {
    const response = await api.put<PriceMatrixItem>(`/api/superadmin/price-matrix/item/${itemId}`, payload);
    return response.data;
  },

  async deletePriceMatrixItem(itemId: number) {
    const response = await api.delete<{ success: boolean; deleted_item_id: number }>(`/api/superadmin/price-matrix/item/${itemId}`);
    return response.data;
  },

  async estimatePriceMatrix(payload: PriceMatrixEstimateRequest): Promise<PriceMatrixEstimateResponse> {
    const response = await api.post<PriceMatrixEstimateResponse>('/api/superadmin/price-matrix/estimate', payload);
    return response.data;
  },

  async createCreditEstimatorShare(payload: CreditEstimatorShareCreateRequest): Promise<CreditEstimatorShareResponse> {
    const response = await api.post<CreditEstimatorShareResponse>('/api/superadmin/credit-estimator/share', payload);
    return response.data;
  },

  async listCreditEstimatorResults(params?: { company_name?: string; status_filter?: 'all' | 'active' | 'expired' }): Promise<CreditEstimatorResultListItem[]> {
    const response = await api.get<CreditEstimatorResultListItem[]>('/api/superadmin/credit-estimator/results', {
      params,
    });
    return response.data;
  },

  async getCreditEstimatorResult(resultId: number): Promise<CreditEstimatorResultListItem> {
    const response = await api.get<CreditEstimatorResultListItem>(`/api/superadmin/credit-estimator/results/${resultId}`);
    return response.data;
  },

  async updateCreditEstimatorResult(resultId: number, payload: CreditEstimatorShareUpdateRequest): Promise<CreditEstimatorShareResponse> {
    const response = await api.put<CreditEstimatorShareResponse>(`/api/superadmin/credit-estimator/results/${resultId}`, payload);
    return response.data;
  },

  async extendCreditEstimatorShare(token: string, payload: CreditEstimatorShareExtendRequest): Promise<CreditEstimatorShareResponse> {
    const response = await api.post<CreditEstimatorShareResponse>(`/api/superadmin/credit-estimator/share/${encodeURIComponent(token)}/extend`, payload);
    return response.data;
  },

  async extendCreditEstimatorResult(resultId: number, payload: CreditEstimatorShareExtendRequest): Promise<CreditEstimatorShareResponse> {
    const response = await api.post<CreditEstimatorShareResponse>(`/api/superadmin/credit-estimator/results/${resultId}/extend`, payload);
    return response.data;
  },

  async getCreditEstimatorSharePublic(token: string): Promise<CreditEstimatorSharePublicResponse> {
    const response = await api.get<CreditEstimatorSharePublicResponse>(`/api/superadmin/credit-estimator/share/${encodeURIComponent(token)}`);
    return response.data;
  },

  async sendCreditEstimatorShareEmail(token: string, payload: CreditEstimatorShareEmailRequest) {
    const response = await api.post<{ message: string }>(`/api/superadmin/credit-estimator/share/${encodeURIComponent(token)}/email`, payload);
    return response.data;
  },

  async sendCreditEstimatorResultEmail(resultId: number, payload: CreditEstimatorShareEmailRequest) {
    const response = await api.post<{ message: string }>(`/api/superadmin/credit-estimator/results/${resultId}/email`, payload);
    return response.data;
  },

  async deleteCreditEstimatorResult(resultId: number) {
    const response = await api.delete<{ success: boolean; deleted_result_id: number }>(`/api/superadmin/credit-estimator/results/${resultId}`);
    return response.data;
  },

  async listOrganizationCreditAllocations(params?: { organization_id?: number; search?: string; active_only?: boolean }): Promise<OrganizationCreditAllocation[]> {
    const response = await api.get<OrganizationCreditAllocation[]>('/api/superadmin/organization-credit-allocations', { params });
    return response.data;
  },

  async summarizeOrganizationCreditAllocations(): Promise<OrganizationCreditAllocationSummary[]> {
    const response = await api.get<OrganizationCreditAllocationSummary[]>('/api/superadmin/organization-credit-allocations/summary');
    return response.data;
  },

  async getOrganizationCreditProfile(organizationId: number): Promise<OrganizationCreditProfile> {
    const response = await api.get<OrganizationCreditProfile>(`/api/superadmin/organization-credit-allocations/profile/${organizationId}`);
    return response.data;
  },

  async updateOrganizationCreditProfile(organizationId: number, payload: OrganizationCreditProfileUpdateRequest): Promise<OrganizationCreditProfile> {
    const response = await api.put<OrganizationCreditProfile>(`/api/superadmin/organization-credit-allocations/profile/${organizationId}`, payload);
    return response.data;
  },

  async createOrganizationCreditAllocations(payload: OrganizationCreditAllocationCreateRequest): Promise<OrganizationCreditAllocation[]> {
    const response = await api.post<OrganizationCreditAllocation[]>('/api/superadmin/organization-credit-allocations', payload);
    return response.data;
  },

  async updateOrganizationCreditAllocation(allocationId: number, payload: OrganizationCreditAllocationUpdateRequest): Promise<OrganizationCreditAllocation> {
    const response = await api.put<OrganizationCreditAllocation>(`/api/superadmin/organization-credit-allocations/${allocationId}`, payload);
    return response.data;
  },

  async deleteOrganizationCreditAllocation(allocationId: number) {
    const response = await api.delete<{ success: boolean; deleted_allocation_id: number }>(`/api/superadmin/organization-credit-allocations/${allocationId}`);
    return response.data;
  },

  async listOrganizationCreditChanges(params?: { organization_id?: number; change_type?: string; limit?: number }): Promise<OrganizationCreditChangeLog[]> {
    const response = await api.get<OrganizationCreditChangeLog[]>('/api/superadmin/organization-credit-allocations/changes', { params });
    return response.data;
  },

  async listBillingInvoices(params?: { organization_id?: number; status_filter?: string }): Promise<BillingInvoice[]> {
    const response = await api.get<BillingInvoice[]>('/api/superadmin/billing/invoices', { params });
    return response.data;
  },

  async getBillingInvoiceDetail(invoiceId: number): Promise<BillingInvoiceDetail> {
    const response = await api.get<BillingInvoiceDetail>(`/api/superadmin/billing/invoices/${invoiceId}`);
    return response.data;
  },

  async markBillingInvoicePaid(invoiceId: number, payload: BillingInvoiceMarkPaidRequest): Promise<BillingInvoiceMarkPaidResponse> {
    const response = await api.post<BillingInvoiceMarkPaidResponse>(`/api/superadmin/billing/invoices/${invoiceId}/mark-paid`, payload);
    return response.data;
  },

  async exportBillingInvoice(invoiceId: number) {
    const response = await api.get(`/api/superadmin/billing/invoices/${invoiceId}/export`);
    return response.data;
  },

  async listBillingPayments(params?: { organization_id?: number; invoice_id?: number; status_filter?: string }): Promise<BillingPayment[]> {
    const response = await api.get<BillingPayment[]>('/api/superadmin/billing/payments', { params });
    return response.data;
  },

  async createBillingPayment(payload: BillingPaymentCreateRequest): Promise<BillingPayment> {
    const response = await api.post<BillingPayment>('/api/superadmin/billing/payments', payload);
    return response.data;
  },

  async backfillBillingInvoices(force = false): Promise<BillingInvoiceBackfillResponse> {
    const response = await api.post<BillingInvoiceBackfillResponse>('/api/superadmin/billing/invoices/backfill-existing', null, {
      params: { force },
    });
    return response.data;
  },

  async listBillingBills(params?: { organization_id?: number; invoice_id?: number }): Promise<BillingBill[]> {
    const response = await api.get<BillingBill[]>('/api/superadmin/billing/bills', { params });
    return response.data;
  },

  async getBillingBill(billId: number): Promise<BillingBill> {
    const response = await api.get<BillingBill>(`/api/superadmin/billing/bills/${billId}`);
    return response.data;
  },

  async exportBillingBill(billId: number) {
    const response = await api.get(`/api/superadmin/billing/bills/${billId}/export`);
    return response.data;
  },
};
