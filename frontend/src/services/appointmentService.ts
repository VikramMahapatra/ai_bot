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
}

export const appointmentService = {
  async list(filters?: AppointmentFilters): Promise<AppointmentItem[]> {
    const response = await api.get('/api/admin/appointments', { params: filters });
    return Array.isArray(response.data?.appointments) ? response.data.appointments : [];
  },

  async updateStatus(appointmentId: number, status: AppointmentItem['status']): Promise<void> {
    await api.put(`/api/admin/appointments/${appointmentId}/status`, { status });
  },
};
