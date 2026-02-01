export interface User {
  username: string;
  email: string;
  role: 'ADMIN' | 'USER';
  organization_id?: number;
  user_id?: number;
}

export interface KnowledgeSource {
  id: number;
  source_type: 'WEB' | 'PDF' | 'DOCX' | 'XLSX';
  name: string;
  url?: string;
  file_path?: string;
  status: string;
  created_at: string;
}

export interface WebCrawlRequest {
  url: string;
  max_pages: number;
  max_depth: number;
}

export interface ChatMessage {
  message: string;
  session_id: string;
  widget_id?: string;
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
  role: 'ADMIN' | 'USER';
  organization_name: string;
}
