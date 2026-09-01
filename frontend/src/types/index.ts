export interface User {
  username: string;
  email: string;
  role: 'ADMIN' | 'USER' | 'USER_HANDOFF' | 'SUPERADMIN';
  organization_id?: number;
  user_id?: number;
}

export interface KnowledgeSource {
  id: number;
  widget_id?: string;
  source_type: 'WEB' | 'PDF' | 'DOCX' | 'XLSX';
  name: string;
  url?: string;
  file_path?: string;
  status: string;
  created_at: string;
}

export interface WebCrawlRequest {
  widget_id: string;
  url: string;
  max_pages: number;
  max_depth: number;
  selected_urls?: string[];
}

export interface WebCrawlPreviewRequest {
  url: string;
  max_pages: number;
  max_depth: number;
}

export interface CrawlDiscoveredUrl {
  url: string;
  depth: number;
}

export interface WebCrawlPreviewResponse {
  discovered_urls: CrawlDiscoveredUrl[];
  pages_scanned: number;
  message: string;
}

export interface WebCrawlResponse {
  source: KnowledgeSource;
  pages_crawled: number;
  pages_scanned: number;
  unchanged: boolean;
  message: string;
}

export interface CrawlJobStatus {
  job_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  stage?: string | null;
  progress: number;
  message?: string | null;
  error?: string | null;
  url?: string | null;
  widget_id?: string | null;
  pages_total: number;
  pages_completed: number;
  pages_crawled: number;
  pages_scanned: number;
  chunks_embedded: number;
  unchanged: boolean;
  source?: {
    id: number;
    name: string;
    source_type: string;
    status: string;
    widget_id: string;
  } | null;
  created_at?: string | null;
  started_at?: string | null;
  updated_at?: string | null;
  finished_at?: string | null;
}

export interface ChatMessage {
  message: string;
  session_id: string;
  widget_id: string;
  language_code?: string;
  language_label?: string;
  retrieval_message?: string;
}

export interface SourceInfo {
  id: number;
  name: string;
  type: string;
  url?: string;
}

export interface ChatResponse {
  response: string;
  session_id: string;
  sources?: SourceInfo[];
  ui_action?: string;
  handoff_chat_id?: string;
  handoff_status?: string;
}

export interface ConversationHistoryItem {
  role: string;
  message: string;
  response: string;
  created_at: string;
}

export interface TranslateRequest {
  text: string;
  target_language_code?: string;
  target_language_label?: string;
  widget_id?: string;
}

export interface TranslateResponse {
  translated_text: string;
}

export interface AppointmentBookingRequest {
  session_id: string;
  widget_id: string;
  appointment_at: string;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
  timezone?: string;
}

export interface AppointmentBookingResponse {
  id: number;
  session_id: string;
  widget_id: string;
  appointment_at: string;
  message: string;
}

export interface Lead {
  id: number;
  session_id: string;
  widget_id?: string;
  product_id?: string;
  product_name?: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  lead_outcome?: string;
  source: 'chat' | 'voice' | 'email' | 'sms' | 'whatsapp';
  funnel_stage?: string;
  custom_fields?: string;
  organization_id?: number;
  user_id?: number;
  created_at: string;
  close_date: string;
}

export interface Organization {
  id: number;
  name: string;
  description?: string;
  joining_date?: string | null;
  effective_joining_date?: string | null;
}

export interface LeadCreate {
  session_id: string;
  widget_id?: string;
  product_id?: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  lead_outcome?: string;
  source?: 'chat' | 'voice' | 'email' | 'sms' | 'whatsapp';
  funnel_stage?: string;
}

export interface FunnelCategory {
  id: number;
  organization_id: number;
  name: string;
  key: string;
  color: string;
  position: number;
  is_active: boolean;
  created_at: string;
}

export interface FunnelCategoryPayload {
  name: string;
  key: string;
  color: string;
  position: number;
  is_active: boolean;
}

export interface WidgetConfig {
  id?: number;
  widget_id: string;
  name: string;
  welcome_message?: string;
  system_prompt?: string;
  logo_url?: string;
  primary_color: string;
  secondary_color: string;
  position: string;
  lead_capture_enabled: boolean;
  lead_fields?: string;
  created_at?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
  organization_id: number;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  organization_id: number;
  role: 'ADMIN' | 'USER' | 'USER_HANDOFF' | 'SUPERADMIN';
  organization_name: string;
}

export interface SuperAdminLoginRequest {
  username: string;
  password: string;
}

export interface SuperAdminLoginResponse {
  access_token: string;
  token_type: string;
  role: 'SUPERADMIN';
  superadmin_id: number;
}

export type OrganizationLimitKey = Exclude<
  keyof OrganizationLimits,
  "id" | "organization_id"
>;

export interface LimitToggleField {
  key: OrganizationLimitKey;
  label: string;
  visible: boolean;
  category: LimitCategory;
}

export type LimitCategory =
  | "Communication Channels"
  | "AI & Automation"
  | "Campaigns"
  | "Voice Calling"
  | "Core Modules"
  | "Analytics";


export interface OrganizationLimits {
  id?: number;
  organization_id?: number;
  lead_generation_enabled: boolean;
  voice_chat_enabled?: boolean;
  multilingual_text_enabled?: boolean;
  whatsapp_enabled?: boolean;
  instagram_chat_enabled?: boolean;
  facebook_messenger_enabled?: boolean;
  human_handoff_enabled?: boolean;
  email_campaign_enabled?: boolean;
  sms_campaign_enabled?: boolean;
  whatsapp_campaign_enabled?: boolean;
  ai_assistant_campaign_enabled?: boolean;
  inbound_voice_enabled?: boolean;
  outbound_voice_enabled?: boolean;
  call_forwarding_enabled?: boolean;
  module_chat_agents_enabled?: boolean;
  module_followup_workflow_enabled?: boolean;
  module_knowledge_enabled?: boolean;
  module_leads_enabled?: boolean;
  module_analytics_enabled?: boolean;
  module_advanced_analytics_enabled?: boolean;
  module_reports_enabled?: boolean;
  module_campaigns_enabled?: boolean;
  module_appointments_enabled?: boolean;
  module_products_enabled?: boolean;
  module_users_enabled?: boolean;

  outbound_call_billing_model?: "per_attempt" | "per_minute";
  max_outbound_voice_agents?: number;
  max_inbound_voice_agents?: number;
  max_outbound_calls?: number;
}

export interface OrganizationUsage {
  organization_id: number;
  year: number;
  month: number;
  conversations_count: number;
  messages_count: number;
  crawl_pages_count: number;
  documents_count: number;
  tokens_used: number;
  leads_count: number;
}

export type OrganizationStatus =
  | "active"
  | "inactive"
  | "trial";

export interface SuperAdminOrganization {
  id: number;
  name: string;
  organization_name: string;
  description?: string;
  joining_date?: string | null;
  effective_joining_date?: string | null;
  admin_username?: string;
  admin_email?: string;
  limits?: OrganizationLimits;
  echoleads_api_key?: string;
  status: OrganizationStatus;
  trial_end_date?: string | null;
  industry?: string | null;
  commercial_notes?: string | null;
  timezone?: string | null;
}


export interface OrganizationCallingNumber {
  id: number;
  calling_number: string;
  calling_number_id: number | "";
  type: 'inbound' | 'outbound';
  is_default?: boolean;
  is_active?: boolean;
}

export interface Channel {
  id: number;
  name: string;
  channel_type: string;
  is_active?: boolean;
}

export interface OrganizationChannel {
  id: number;
  channel_id: number;
  name: string;
  channel_type: string;
}

export interface PriceMatrixItem {
  id: number;
  category: string;
  module: string;
  sub_module?: string | null;
  billing_unit?: string | null;
  credits_per_unit?: number | null;
  credit_formula?: string | null;
  definition?: string | null;
  overage_handling?: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
}

export interface PriceMatrixItemPayload {
  category: string;
  module: string;
  sub_module?: string | null;
  billing_unit?: string | null;
  credits_per_unit?: number | null;
  credit_formula?: string | null;
  definition?: string | null;
  overage_handling?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface PriceMatrixEstimateLineInput {
  price_matrix_item_id: number;
  quantity: number;
}

export interface PriceMatrixEstimateRequest {
  lines: PriceMatrixEstimateLineInput[];
  buffer_percent?: number;
  discount_percent?: number;
}

export interface PriceMatrixEstimateBreakdownLine {
  price_matrix_item_id: number;
  category: string;
  module: string;
  sub_module?: string | null;
  billing_unit?: string | null;
  credits_per_unit: number;
  quantity: number;
  estimated_credits: number;
}

export interface PriceMatrixEstimateResponse {
  subtotal_credits: number;
  buffer_percent: number;
  buffer_credits: number;
  discount_percent: number;
  discount_credits: number;
  final_recommended_credits: number;
  final_recommended_credits_ceiling: number;
  recommended_credits: number;
  recommended_credits_ceiling: number;
  breakdown: PriceMatrixEstimateBreakdownLine[];
}

export interface CreditEstimatorShareCreateRequest extends PriceMatrixEstimateRequest {
  company_name: string;
  valid_for_hours?: number;
}

export interface CreditEstimatorShareExtendRequest {
  extra_hours: number;
}

export interface CreditEstimatorShareResponse {
  id: number;
  company_name: string;
  token: string;
  share_path: string;
  expires_at: string;
  expires_in_hours: number;
  estimate: PriceMatrixEstimateResponse;
}

export interface CreditEstimatorSharePublicResponse {
  id: number;
  company_name: string;
  token: string;
  estimate: PriceMatrixEstimateResponse;
  created_at: string;
  expires_at: string;
}

export interface CreditEstimatorShareEmailRequest {
  to_email: string;
  subject: string;
  body: string;
}

export interface CreditEstimatorResultListItem extends CreditEstimatorSharePublicResponse {
  share_path: string;
  is_active: boolean;
  is_expired: boolean;
  estimator_input: PriceMatrixEstimateRequest;
}

export interface CreditEstimatorShareUpdateRequest {
  company_name?: string;
  lines?: PriceMatrixEstimateLineInput[];
  buffer_percent?: number;
  discount_percent?: number;
  valid_for_hours?: number;
}

export interface OrganizationCreditAllocationLineInput {
  price_matrix_item_id: number;
  quantity?: number;
  credits_per_unit?: number;
  allocated_credits?: number;
}

export interface OrganizationCreditProfileInput {
  total_price?: number;
  buffer_percent?: number;
  discount_percent?: number;
  payment_status?: string;
  start_date?: string | null;
  end_date?: string | null;
  expiry_days?: number | null;
  notes?: string | null;
}

export interface OrganizationCreditAllocationCreateRequest {
  organization_id: number;
  profile?: OrganizationCreditProfileInput;
  lines: OrganizationCreditAllocationLineInput[];
}

export interface OrganizationCreditAllocationUpdateRequest {
  quantity?: number;
  credits_per_unit?: number;
  allocated_credits?: number;
  is_active?: boolean;
}

export interface OrganizationCreditAllocation {
  id: number;
  organization_id: number;
  organization_name: string;
  price_matrix_item_id: number;
  category: string;
  module: string;
  sub_module?: string | null;
  billing_unit?: string | null;
  quantity?: number | null;
  credits_per_unit?: number | null;
  allocated_credits: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
}

export interface OrganizationCreditProfile {
  organization_id: number;
  organization_name: string;
  total_price: number;
  buffer_percent: number;
  discount_percent: number;
  payment_status: string;
  start_date?: string | null;
  end_date?: string | null;
  expiry_days?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface OrganizationCreditProfileUpdateRequest {
  total_price?: number;
  buffer_percent?: number;
  discount_percent?: number;
  payment_status?: string;
  start_date?: string | null;
  end_date?: string | null;
  expiry_days?: number | null;
  notes?: string | null;
}

export interface OrganizationCreditAllocationSummary {
  organization_id: number;
  organization_name: string;
  total_allocated_credits: number;
  total_price: number;
  buffer_percent: number;
  discount_percent: number;
  payment_status: string;
  start_date?: string | null;
  end_date?: string | null;
  expiry_days?: number | null;
  notes?: string | null;
  row_count: number;
}

export interface OrganizationCreditChangeLog {
  id: number;
  organization_id: number;
  price_matrix_item_id?: number | null;
  change_type: string;
  previous_json?: string | null;
  new_json?: string | null;
  description?: string | null;
  created_at: string;
}

export interface BillingInvoice {
  id: number;
  organization_id: number;
  organization_name: string;
  invoice_number: string;
  issue_date: string;
  due_date?: string | null;
  billing_start_date?: string | null;
  billing_end_date?: string | null;
  amount: number;
  paid_amount: number;
  status: string;
  notes?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface BillingInvoiceItem {
  id: number;
  invoice_id: number;
  organization_id: number;
  price_matrix_item_id?: number | null;
  category: string;
  module: string;
  sub_module?: string | null;
  billing_unit?: string | null;
  quantity?: number | null;
  credits_per_unit?: number | null;
  allocated_credits: number;
  created_at: string;
}

export interface BillingPayment {
  id: number;
  organization_id: number;
  organization_name: string;
  invoice_id?: number | null;
  invoice_number?: string | null;
  amount: number;
  payment_date: string;
  method: string;
  reference?: string | null;
  status: string;
  notes?: string | null;
  created_at: string;
}

export interface BillingBill {
  id: number;
  organization_id: number;
  organization_name: string;
  invoice_id: number;
  invoice_number: string;
  payment_id?: number | null;
  bill_number: string;
  issued_date: string;
  amount: number;
  payment_method?: string | null;
  payment_reference?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface BillingInvoiceDetail extends BillingInvoice {
  items: BillingInvoiceItem[];
  bills: BillingBill[];
}

export interface BillingInvoiceMarkPaidRequest {
  payment_date?: string | null;
  method?: string;
  reference?: string | null;
  notes?: string | null;
  amount_paid?: number | null;
}

export interface BillingInvoiceMarkPaidResponse {
  invoice: BillingInvoice;
  payment: BillingPayment;
  bill: BillingBill;
  partial_invoice?: BillingInvoice | null;
  credit_note?: number | null;
  credit_applied?: number | null;
}

export interface BillingPaymentCreateRequest {
  organization_id: number;
  invoice_id?: number | null;
  amount: number;
  payment_date?: string | null;
  method?: string;
  reference?: string | null;
  status?: string;
  notes?: string | null;
}

export interface BillingInvoiceBackfillResponse {
  success: boolean;
  force: boolean;
  total_organizations_checked: number;
  invoices_created_count: number;
  invoices_created_for_org_ids: number[];
  skipped_count: number;
  skipped_org_ids: number[];
  skipped_due_to_existing_invoice_org_ids: number[];
}

export interface OrganizationCreditAllocationLineInput {
  price_matrix_item_id: number;
  quantity?: number;
  credits_per_unit?: number;
  allocated_credits?: number;
}

export interface OrganizationCreditProfileInput {
  total_price?: number;
  buffer_percent?: number;
  discount_percent?: number;
  payment_status?: string;
  start_date?: string | null;
  end_date?: string | null;
  expiry_days?: number | null;
  notes?: string | null;
}

export interface OrganizationCreditAllocationCreateRequest {
  organization_id: number;
  profile?: OrganizationCreditProfileInput;
  lines: OrganizationCreditAllocationLineInput[];
}

export interface OrganizationCreditAllocationUpdateRequest {
  quantity?: number;
  credits_per_unit?: number;
  allocated_credits?: number;
  is_active?: boolean;
}

export interface OrganizationCreditAllocation {
  id: number;
  organization_id: number;
  organization_name: string;
  price_matrix_item_id: number;
  category: string;
  module: string;
  sub_module?: string | null;
  billing_unit?: string | null;
  quantity?: number | null;
  credits_per_unit?: number | null;
  allocated_credits: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
}

export interface OrganizationCreditProfile {
  organization_id: number;
  organization_name: string;
  total_price: number;
  buffer_percent: number;
  discount_percent: number;
  payment_status: string;
  start_date?: string | null;
  end_date?: string | null;
  expiry_days?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface OrganizationCreditProfileUpdateRequest {
  total_price?: number;
  buffer_percent?: number;
  discount_percent?: number;
  payment_status?: string;
  start_date?: string | null;
  end_date?: string | null;
  expiry_days?: number | null;
  notes?: string | null;
}

export interface OrganizationCreditAllocationSummary {
  organization_id: number;
  organization_name: string;
  total_allocated_credits: number;
  total_price: number;
  buffer_percent: number;
  discount_percent: number;
  payment_status: string;
  start_date?: string | null;
  end_date?: string | null;
  expiry_days?: number | null;
  notes?: string | null;
  row_count: number;
}

export interface OrganizationCreditChangeLog {
  id: number;
  organization_id: number;
  price_matrix_item_id?: number | null;
  change_type: string;
  previous_json?: string | null;
  new_json?: string | null;
  description?: string | null;
  created_at: string;
}

export interface BillingInvoice {
  id: number;
  organization_id: number;
  organization_name: string;
  invoice_number: string;
  issue_date: string;
  due_date?: string | null;
  billing_start_date?: string | null;
  billing_end_date?: string | null;
  amount: number;
  paid_amount: number;
  status: string;
  notes?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface BillingInvoiceItem {
  id: number;
  invoice_id: number;
  organization_id: number;
  price_matrix_item_id?: number | null;
  category: string;
  module: string;
  sub_module?: string | null;
  billing_unit?: string | null;
  quantity?: number | null;
  credits_per_unit?: number | null;
  allocated_credits: number;
  created_at: string;
}

export interface BillingPayment {
  id: number;
  organization_id: number;
  organization_name: string;
  invoice_id?: number | null;
  invoice_number?: string | null;
  amount: number;
  payment_date: string;
  method: string;
  reference?: string | null;
  status: string;
  notes?: string | null;
  created_at: string;
}

export interface BillingBill {
  id: number;
  organization_id: number;
  organization_name: string;
  invoice_id: number;
  invoice_number: string;
  payment_id?: number | null;
  bill_number: string;
  issued_date: string;
  amount: number;
  payment_method?: string | null;
  payment_reference?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface BillingInvoiceDetail extends BillingInvoice {
  items: BillingInvoiceItem[];
  bills: BillingBill[];
}

export interface BillingInvoiceMarkPaidRequest {
  payment_date?: string | null;
  method?: string;
  reference?: string | null;
  notes?: string | null;
  amount_paid?: number | null;
}

export interface BillingInvoiceMarkPaidResponse {
  invoice: BillingInvoice;
  payment: BillingPayment;
  bill: BillingBill;
  partial_invoice?: BillingInvoice | null;
  credit_note?: number | null;
  credit_applied?: number | null;
}

export interface BillingPaymentCreateRequest {
  organization_id: number;
  invoice_id?: number | null;
  amount: number;
  payment_date?: string | null;
  method?: string;
  reference?: string | null;
  status?: string;
  notes?: string | null;
}

export interface BillingInvoiceBackfillResponse {
  success: boolean;
  force: boolean;
  total_organizations_checked: number;
  invoices_created_count: number;
  invoices_created_for_org_ids: number[];
  skipped_count: number;
  skipped_org_ids: number[];
  skipped_due_to_existing_invoice_org_ids: number[];
}

export interface PriceMatrixItem {
  id: number;
  category: string;
  module: string;
  sub_module?: string | null;
  billing_unit?: string | null;
  credits_per_unit?: number | null;
  credit_formula?: string | null;
  definition?: string | null;
  overage_handling?: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
}

export interface PriceMatrixItemPayload {
  category: string;
  module: string;
  sub_module?: string | null;
  billing_unit?: string | null;
  credits_per_unit?: number | null;
  credit_formula?: string | null;
  definition?: string | null;
  overage_handling?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface PriceMatrixEstimateLineInput {
  price_matrix_item_id: number;
  quantity: number;
}

export interface PriceMatrixEstimateRequest {
  lines: PriceMatrixEstimateLineInput[];
  buffer_percent?: number;
  discount_percent?: number;
}

export interface PriceMatrixEstimateBreakdownLine {
  price_matrix_item_id: number;
  category: string;
  module: string;
  sub_module?: string | null;
  billing_unit?: string | null;
  credits_per_unit: number;
  quantity: number;
  estimated_credits: number;
}

export interface PriceMatrixEstimateResponse {
  subtotal_credits: number;
  buffer_percent: number;
  buffer_credits: number;
  discount_percent: number;
  discount_credits: number;
  final_recommended_credits: number;
  final_recommended_credits_ceiling: number;
  recommended_credits: number;
  recommended_credits_ceiling: number;
  breakdown: PriceMatrixEstimateBreakdownLine[];
}

export interface CreditEstimatorShareCreateRequest extends PriceMatrixEstimateRequest {
  company_name: string;
  valid_for_hours?: number;
}

export interface CreditEstimatorShareExtendRequest {
  extra_hours: number;
}

export interface CreditEstimatorShareResponse {
  id: number;
  company_name: string;
  token: string;
  share_path: string;
  expires_at: string;
  expires_in_hours: number;
  estimate: PriceMatrixEstimateResponse;
}

export interface CreditEstimatorSharePublicResponse {
  id: number;
  company_name: string;
  token: string;
  estimate: PriceMatrixEstimateResponse;
  created_at: string;
  expires_at: string;
}

export interface CreditEstimatorShareEmailRequest {
  to_email: string;
  subject: string;
  body: string;
}

export interface CreditEstimatorResultListItem extends CreditEstimatorSharePublicResponse {
  share_path: string;
  is_active: boolean;
  is_expired: boolean;
  estimator_input: PriceMatrixEstimateRequest;
}

export interface CreditEstimatorShareUpdateRequest {
  company_name?: string;
  lines?: PriceMatrixEstimateLineInput[];
  buffer_percent?: number;
  discount_percent?: number;
  valid_for_hours?: number;
}


export interface AgentReport {
  name: string;
  external_agent_name?: string | null;
  external_agent_id?: string | null;
}


export interface CampaignReport {
  name: string;
  external_campaign_name?: string | null;
  external_campaign_id?: number | null;
}

export interface OrganizationReportResponse {
  items: OrganizationReport[];
  total: number;
}


export interface OrganizationReport {
  organization_id: number;
  organization_name: string;

  agents_created: number;

  campaign_created: number;

  calls_done: number;

  agents: AgentReport[];
  campaigns: CampaignReport[];
}
