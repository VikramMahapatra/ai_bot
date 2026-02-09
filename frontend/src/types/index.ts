export interface User {
  username: string;
  email: string;
  role: 'ADMIN' | 'USER' | 'SUPERADMIN';
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
}

export interface WebCrawlResponse {
  source: KnowledgeSource;
  pages_crawled: number;
  pages_scanned: number;
  unchanged: boolean;
  message: string;
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
}

export interface TranslateResponse {
  translated_text: string;
}

export interface Lead {
  id: number;
  session_id: string;
  widget_id?: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  created_at: string;
}

export interface Organization {
  id: number;
  name: string;
  description?: string;
}

export interface LeadCreate {
  session_id: string;
  widget_id?: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
}

export interface WidgetConfig {
  id?: number;
  widget_id: string;
  name: string;
  welcome_message?: string;
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
  role: 'ADMIN' | 'USER' | 'SUPERADMIN';
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

export interface OrganizationLimits {
  id?: number;
  organization_id?: number;
  plan_id?: number;
  monthly_conversation_limit: number;
  monthly_crawl_pages_limit: number;
  max_crawl_depth: number;
  monthly_document_limit: number;
  max_document_size_mb: number;
  monthly_token_limit: number;
  max_query_words: number;
  lead_generation_enabled: boolean;
  voice_chat_enabled?: boolean;
  multilingual_text_enabled?: boolean;
}

export interface Plan {
  id: number;
  name: string;
  description?: string;
  price_inr: number;
  billing_cycle: 'monthly' | 'yearly';
  is_active: boolean;
  monthly_conversation_limit: number;
  monthly_crawl_pages_limit: number;
  max_crawl_depth: number;
  monthly_document_limit: number;
  max_document_size_mb: number;
  monthly_token_limit: number;
  max_query_words: number;
  lead_generation_enabled: boolean;
  voice_chat_enabled: boolean;
  multilingual_text_enabled: boolean;
}

export interface Subscription {
  id: number;
  organization_id: number;
  plan_id: number;
  status: string;
  billing_cycle: 'monthly' | 'yearly';
  start_date: string;
  end_date: string;
  trial_end?: string;
  is_active: boolean;
  days_left: number;
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

export interface SuperAdminOrganization {
  id: number;
  name: string;
  description?: string;
  admin_username?: string;
  admin_email?: string;
  limits?: OrganizationLimits;
  plan?: Plan;
  subscription?: Subscription;
}
