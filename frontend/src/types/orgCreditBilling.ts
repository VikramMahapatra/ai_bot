export type OrgCreditPaymentStatus = "paid" | "unpaid";
export type OrgCreditBillingCycle = "monthly";
export type PartialPaymentStrategy =
  | "keep_open"
  | "create_invoice"
  | "full_payment";

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
  full_partial: "full" | "partial" | string;
  invoice_amount: number;
  actual_payment: number;
  actual_credit: number;
  payment_date: string;
  payment_details?: string | null;
  payment_mode?: string | null;
  payment_reference?: string | null;
  payment_other_details?: string | null;
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
  estimator_id?: number | null;
  total_credits?: number | null;
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
  payment_date?: string;
  payment_mode?: string;
  payment_reference?: string;
  payment_other_details?: string;
}

export interface OrgCreditPaymentCreateRequest {
  invoice_id: number;
  actual_payment: number;
  actual_credit?: number;
  payment_date?: string;
  payment_details?: string;
  payment_mode?: string;
  payment_reference?: string;
  payment_other_details?: string;
  partial_strategy?: PartialPaymentStrategy;
}

export interface OrgCreditPaymentCreateResponse {
  payment: OrgCreditPayment;
  invoice: OrgCreditInvoice;
  generated_invoice?: OrgCreditInvoice | null;
}

export interface OrgCreditDeleteResponse {
  success: boolean;
  deleted_org_credit_id: number;
}

export interface OrgCreditInvoiceDeleteResponse {
  success: boolean;
  deleted_invoice_id: number;
}

export interface OrgCreditPaymentDeleteResponse {
  success: boolean;
  deleted_payment_id: number;
}

export interface OrgCreditInvoiceDocument {
  invoice: OrgCreditInvoice;
  organization_name: string;
  organization_admin_email?: string | null;
  estimator_name?: string | null;
  billing_start_date: string;
  billing_end_date: string;
  billing_cycle: string;
  payment_status: string;
  outstanding_amount: number;
  payments: OrgCreditPayment[];
  generated_at: string;
}

export interface OrgCreditPaymentReceipt {
  payment: OrgCreditPayment;
  invoice: OrgCreditInvoice;
  organization_name: string;
  organization_admin_email?: string | null;
  estimator_name?: string | null;
  billing_start_date: string;
  billing_end_date: string;
  generated_at: string;
}

export interface OrgCreditDocumentEmailRequest {
  to_email: string;
  subject?: string;
  body?: string;
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

export interface OrgCreditAdminMonthSummary {
  organization_id: number;
  organization_name: string;
  billing_period: string;
  total_credit: number;
  used_credit: number;
  remaining_credit: number;
  lapsed_previous_month: number;
  invoices_count: number;
  paid_invoices_count: number;
  open_invoices_count: number;
  payments_collected: number;
  no_rollover_policy: boolean;
  generated_at: string;
}

export interface OrgCreditLapseRow {
  organization_id: number;
  organization_name: string;
  billing_period: string;
  total_credit: number;
  used_credit: number;
  remaining_credit: number;
  lapsed_credit: number;
}

export interface OrgCreditLapseReport {
  rows: OrgCreditLapseRow[];
  total_lapsed_credit: number;
  months: number;
  end_period: string;
  generated_at: string;
}
