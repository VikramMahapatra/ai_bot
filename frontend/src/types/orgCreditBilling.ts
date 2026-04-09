export type OrgCreditPaymentStatus = 'paid' | 'unpaid';
export type OrgCreditBillingCycle = 'monthly';
export type PartialPaymentStrategy = 'keep_open' | 'create_invoice';

export interface OrgCredit {
  id: number;
  organization_id: number;
  estimator_id: number;
  parent_org_credit_id?: number | null;
  total_credit: number;
  billing_cycle: string;
  payment_status: string;
  billing_start_date: string;
  billing_end_date: string;
  billing_month: string;
  is_topup: boolean;
  topup_credit?: number | null;
  is_auto_generated: boolean;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface OrgCreditInvoice {
  id: number;
  organization_id: number;
  org_credit_id: number;
  reference_invoice_id?: number | null;
  total_credit: number;
  invoice_amount: number;
  paid_amount: number;
  billing_month: string;
  invoice_date: string;
  payment_done_flag: boolean;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface OrgCreditPayment {
  id: number;
  organization_id: number;
  invoice_id: number;
  full_partial: 'full' | 'partial' | string;
  invoice_amount: number;
  actual_payment: number;
  actual_credit: number;
  payment_date: string;
  payment_details?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface OrgCreditBalance {
  id?: number | null;
  organization_id: number;
  billing_period: string;
  total_credit: number;
  used_credit: number;
  remaining_credit: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface OrgCreditCreateRequest {
  organization_id: number;
  estimator_id: number;
  billing_cycle?: OrgCreditBillingCycle;
  payment_status?: OrgCreditPaymentStatus;
  billing_start_date?: string;
  notes?: string;
}

export interface OrgCreditTopupRequest {
  topup_credit: number;
  payment_status?: OrgCreditPaymentStatus;
  notes?: string;
}

export interface OrgCreditCreateResponse {
  org_credit: OrgCredit;
  invoice: OrgCreditInvoice;
}

export interface OrgCreditInvoiceGenerateRequest {
  org_credit_id: number;
  invoice_date?: string;
  notes?: string;
}

export interface OrgCreditInvoicePaymentStatusRequest {
  payment_done_flag: boolean;
}

export interface OrgCreditPaymentCreateRequest {
  invoice_id: number;
  actual_payment: number;
  actual_credit?: number;
  payment_date?: string;
  payment_details?: string;
  partial_strategy?: PartialPaymentStrategy;
}

export interface OrgCreditPaymentCreateResponse {
  payment: OrgCreditPayment;
  invoice: OrgCreditInvoice;
  generated_invoice?: OrgCreditInvoice | null;
}

export interface OrgCreditUsageTrackRequest {
  organization_id: number;
  used_credit: number;
  billing_period?: string;
}

export interface OrgCreditAutomationRunResponse {
  evaluated_entries: number;
  generated_entries: number;
  generated_invoices: number;
}
