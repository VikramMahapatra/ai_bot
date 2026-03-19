interface ChatResponse {
  response: string;
  session_id: string;
  sources?: Array<{
    id: number;
    name: string;
    type: string;
    url?: string;
  }>;
  ui_action?: string;
  handoff_chat_id?: string;
  handoff_status?: string;
}

interface HandoffSessionResponse {
  active: boolean;
  chat_id?: string | null;
  status?: string | null;
  wait_cycle?: number | null;
  waiting_expires_at?: string | null;
  waiting_timeout_notified?: boolean | null;
  wait_timeout_seconds?: number | null;
}

interface HandoffMessagesResponse {
  chat_id: string;
  status?: string | null;
  wait_cycle?: number | null;
  waiting_expires_at?: string | null;
  waiting_timeout_notified?: boolean | null;
  wait_timeout_seconds?: number | null;
  items: Array<{
    id: number;
    sender_type: string;
    message: string;
  }>;
}

interface SuggestedQuestionsResponse {
  questions: string[];
}

interface AppointmentBookingRequest {
  session_id: string;
  widget_id: string;
  appointment_at: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  timezone?: string;
}

interface AppointmentBookingResponse {
  id: number;
  session_id: string;
  widget_id: string;
  appointment_at: string;
  message: string;
}

export class ChatAPI {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  async sendMessage(
    message: string,
    sessionId: string,
    widgetId?: string,
    shopDomain?: string,
    customerId?: string
  ): Promise<ChatResponse> {
    const response = await fetch(`${this.baseURL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        session_id: sessionId,
        widget_id: widgetId,
        shop_domain: shopDomain,
        customer_id: customerId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to send message');
    }

    return response.json();
  }

  async sendMessageStream(
    message: string,
    sessionId: string,
    widgetId?: string,
    shopDomain?: string,
    customerId?: string,
    signal?: AbortSignal
  ): Promise<Response> {
    const response = await fetch(`${this.baseURL}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        session_id: sessionId,
        widget_id: widgetId,
        shop_domain: shopDomain,
        customer_id: customerId,
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error('Failed to stream chat response');
    }

    return response;
  }

  async shouldCaptureLead(sessionId: string, widgetId?: string): Promise<boolean> {
    const url = new URL(`${this.baseURL}/api/chat/should-capture-lead/${sessionId}`);
    if (widgetId) {
      url.searchParams.set('widget_id', widgetId);
    }

    const response = await fetch(url.toString(), {
      headers: {
        "ngrok-skip-browser-warning": "true"
      }
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.should_capture;
  }

  async submitLead(leadData: any): Promise<void> {
    const response = await fetch(`${this.baseURL}/api/admin/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(leadData),
    });

    if (!response.ok) {
      throw new Error('Failed to submit lead');
    }
  }

  async emailConversation(sessionId: string, email: string, widgetId?: string): Promise<void> {
    const response = await fetch(`${this.baseURL}/api/chat/email-conversation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
        email,
        widget_id: widgetId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to email conversation');
    }
  }

  async getSuggestedQuestions(widgetId?: string): Promise<string[]> {
    const url = new URL(`${this.baseURL}/api/chat/suggested-questions`);
    if (widgetId) {
      url.searchParams.set('widget_id', widgetId);
    }

    const response = await fetch(url.toString(), {
      headers: {
        "ngrok-skip-browser-warning": "true"
      }
    });

    if (!response.ok) {
      return [];
    }
    const data: SuggestedQuestionsResponse = await response.json();
    return Array.isArray(data.questions) ? data.questions : [];
  }

  async bookAppointment(payload: AppointmentBookingRequest): Promise<AppointmentBookingResponse> {
    const response = await fetch(`${this.baseURL}/api/chat/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Failed to book appointment');
    }

    return response.json();
  }

  async getHandoffSession(sessionId: string, widgetId: string, chatId?: string): Promise<HandoffSessionResponse | null> {
    const url = new URL(`${this.baseURL}/api/chat/handoff/session`);
    url.searchParams.set('session_id', sessionId);
    url.searchParams.set('widget_id', widgetId);
    if (chatId) {
      url.searchParams.set('chat_id', chatId);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      return null;
    }
    return response.json();
  }

  async getHandoffMessages(chatId: string, sessionId: string, widgetId: string, afterId = 0): Promise<HandoffMessagesResponse | null> {
    const url = new URL(`${this.baseURL}/api/chat/handoff/messages`);
    url.searchParams.set('chat_id', chatId);
    url.searchParams.set('session_id', sessionId);
    url.searchParams.set('widget_id', widgetId);
    url.searchParams.set('after_id', String(afterId));

    const response = await fetch(url.toString());
    if (!response.ok) {
      return null;
    }
    return response.json();
  }
}
