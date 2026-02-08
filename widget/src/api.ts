interface ChatResponse {
  response: string;
  session_id: string;
}

export class ChatAPI {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  async sendMessage(
    message: string,
    sessionId: string,
    widgetId?: string
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
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to send message');
    }

    return response.json();
  }

  async shouldCaptureLead(sessionId: string, widgetId?: string): Promise<boolean> {
    const url = new URL(`${this.baseURL}/api/chat/should-capture-lead/${sessionId}`);
    if (widgetId) {
      url.searchParams.set('widget_id', widgetId);
    }

    const response = await fetch(url.toString());

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
}
