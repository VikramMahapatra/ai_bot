import api from './api';
import { LoginRequest, LoginResponse } from '../types';

export const authService = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/api/admin/login', credentials);
    if (response.data.access_token) {
      localStorage.setItem('access_token', response.data.access_token);
    }
    return response.data;
  },

  async register(username: string, email: string, password: string, role: string = 'ADMIN') {
    const response = await api.post('/api/admin/register', {
      username,
      email,
      password,
      role,
    });
    return response.data;
  },

  logout() {
    localStorage.removeItem('access_token');
  },

  getToken(): string | null {
    return localStorage.getItem('access_token');
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  },
};
