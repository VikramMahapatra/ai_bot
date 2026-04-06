import api from './api';

export interface AppointmentItem {
  id: number;
  session_id: string;
  widget_id: string;
  widget_name: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  timezone?: string;
  appointment_at: string;
  status: 'booked' | 'completed' | 'cancelled' | 'no_show';
  created_at?: string;
}

export interface AppointmentFilters {
  widget_id?: string;
  status?: string;
  upcoming_only?: boolean;
  start_date?: string;
  end_date?: string;
   // pagination
  search?: String;
  skip?: number;
  limit?: number;
}

export interface AppointmentReschedulePayload {
  appointment_at: string;
  timezone?: string;
  notes?: string;
  meeting_link?: string;
}

export interface AppointmentRescheduleResponse {
  id: number;
  appointment_at: string;
  timezone?: string;
  status: AppointmentItem['status'];
  meeting_link?: string;
  notification?: {
    sent: boolean;
    recipient_count: number;
    errors: string[];
  };
  message?: string;
}

export interface AppointmentListResponse {
  appointments: AppointmentItem[];
  pagination: {
    total: number;
    skip: number;
    limit: number;
  };
}

export const appointmentService = {
  async list(filters?: AppointmentFilters): Promise<AppointmentListResponse> {
    const response = await api.get('/api/admin/appointments', { params: filters });
    return response.data;
  },

  async updateStatus(appointmentId: number, status: AppointmentItem['status']): Promise<void> {
    await api.put(`/api/admin/appointments/${appointmentId}/status`, { status });
  },

  async reschedule(
    appointmentId: number,
    payload: AppointmentReschedulePayload
  ): Promise<AppointmentRescheduleResponse> {
    const response = await api.put(`/api/admin/appointments/${appointmentId}/reschedule`, payload);
    return response.data;
  },

  async syncFromCalls(): Promise<void> {
    await api.post('/api/calls/sync-bookings');
  }
};
