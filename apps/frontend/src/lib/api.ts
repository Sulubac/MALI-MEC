import axios, { AxiosInstance, AxiosError } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Request interceptor - attach token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor - handle auth errors
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');
        
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        localStorage.setItem('accessToken', data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        if (typeof window !== 'undefined') window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then(r => r.data),
  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }).then(r => r.data),
  getProfile: () =>
    api.get('/auth/profile').then(r => r.data),
};

// Clients
export const clientsApi = {
  getAll: (params?: any) => api.get('/clients', { params }).then(r => r.data),
  getOne: (id: string) => api.get(`/clients/${id}`).then(r => r.data),
  create: (data: any) => api.post('/clients', data).then(r => r.data),
  update: (id: string, data: any) => api.patch(`/clients/${id}`, data).then(r => r.data),
  getStats: () => api.get('/clients/stats').then(r => r.data),
  getDossiers: (id: string) => api.get(`/clients/${id}/dossiers`).then(r => r.data),
};

// Dossiers
export const dossiersApi = {
  getAll: (params?: any) => api.get('/dossiers', { params }).then(r => r.data),
  getOne: (id: string) => api.get(`/dossiers/${id}`).then(r => r.data),
  create: (data: any) => api.post('/dossiers', data).then(r => r.data),
  update: (id: string, data: any) => api.patch(`/dossiers/${id}`, data).then(r => r.data),
  getStats: () => api.get('/dossiers/stats').then(r => r.data),
  getTimeline: (id: string) => api.get(`/dossiers/${id}/timeline`).then(r => r.data),
  addClient: (id: string, data: any) => api.post(`/dossiers/${id}/clients`, data).then(r => r.data),
  addComment: (id: string, data: any) => api.post(`/dossiers/${id}/comments`, data).then(r => r.data),
};

// Documents
export const documentsApi = {
  getAll: (params?: any) => api.get('/documents', { params }).then(r => r.data),
  getOne: (id: string) => api.get(`/documents/${id}`).then(r => r.data),
  create: (data: any) => api.post('/documents', data).then(r => r.data),
  update: (id: string, data: any) => api.patch(`/documents/${id}`, data).then(r => r.data),
  getTemplates: (type?: string) => api.get('/documents/templates', { params: { type } }).then(r => r.data),
  sign: (id: string, data: any) => api.post(`/documents/${id}/sign`, data).then(r => r.data),
  generateFromTemplate: (data: any) => api.post('/documents/generate-from-template', data).then(r => r.data),
};

// Appointments
export const appointmentsApi = {
  getAll: (params?: any) => api.get('/appointments', { params }).then(r => r.data),
  getOne: (id: string) => api.get(`/appointments/${id}`).then(r => r.data),
  create: (data: any) => api.post('/appointments', data).then(r => r.data),
  update: (id: string, data: any) => api.patch(`/appointments/${id}`, data).then(r => r.data),
  cancel: (id: string) => api.patch(`/appointments/${id}/cancel`).then(r => r.data),
  getUpcoming: (limit?: number) => api.get('/appointments/upcoming', { params: { limit } }).then(r => r.data),
  getCalendar: (notaryId: string, year: number, month: number) =>
    api.get('/appointments/calendar', { params: { notaryId, year, month } }).then(r => r.data),
};

// Tasks
export const tasksApi = {
  getAll: (params?: any) => api.get('/tasks', { params }).then(r => r.data),
  getOne: (id: string) => api.get(`/tasks/${id}`).then(r => r.data),
  create: (data: any) => api.post('/tasks', data).then(r => r.data),
  update: (id: string, data: any) => api.patch(`/tasks/${id}`, data).then(r => r.data),
  getMyTasks: () => api.get('/tasks/my').then(r => r.data),
};

// Invoices
export const invoicesApi = {
  getAll: (params?: any) => api.get('/invoices', { params }).then(r => r.data),
  getOne: (id: string) => api.get(`/invoices/${id}`).then(r => r.data),
  create: (data: any) => api.post('/invoices', data).then(r => r.data),
  recordPayment: (id: string, data: any) => api.post(`/invoices/${id}/payment`, data).then(r => r.data),
  getRevenue: (year?: number) => api.get('/invoices/revenue', { params: { year } }).then(r => r.data),
};

// AI
export const aiApi = {
  chat: (data: any) => api.post('/ai/chat', data).then(r => r.data),
  reviewDocument: (id: string) => api.post(`/ai/documents/${id}/review`).then(r => r.data),
  assessRisk: (id: string) => api.post(`/ai/dossiers/${id}/risk-assessment`).then(r => r.data),
  summarize: (id: string) => api.post(`/ai/dossiers/${id}/summarize`).then(r => r.data),
  searchLegal: (params: any) => api.get('/ai/legal/search', { params }).then(r => r.data),
};

// Reports
export const reportsApi = {
  getDashboard: () => api.get('/reports/dashboard').then(r => r.data),
  getMonthly: (year?: number, month?: number) =>
    api.get('/reports/monthly', { params: { year, month } }).then(r => r.data),
  getActivity: (limit?: number) => api.get('/reports/activity', { params: { limit } }).then(r => r.data),
};

// Notifications
export const notificationsApi = {
  getAll: (unreadOnly = false) => api.get('/notifications', { params: { unreadOnly } }).then(r => r.data),
  getUnreadCount: () => api.get('/notifications/unread-count').then(r => r.data),
  markAsRead: (id: string) => api.patch(`/notifications/${id}/read`).then(r => r.data),
  markAllAsRead: () => api.patch('/notifications/read-all').then(r => r.data),
};

// Search
export const searchApi = {
  global: (q: string) => api.get('/search', { params: { q } }).then(r => r.data),
};

export default api;
