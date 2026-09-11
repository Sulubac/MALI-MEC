import axios, { AxiosInstance, AxiosError } from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = Cookies.get('access_token') || localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as any;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = Cookies.get('refresh_token') || localStorage.getItem('refresh_token');
      if (refresh) {
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, { refresh_token: refresh });
          Cookies.set('access_token', data.access_token, { secure: true, sameSite: 'strict' });
          localStorage.setItem('access_token', data.access_token);
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return api(original);
        } catch {
          Cookies.remove('access_token');
          Cookies.remove('refresh_token');
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      } else {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// ---- Auth ----
export const authApi = {
  login: (username: string, password: string) => {
    const form = new FormData();
    form.append('username', username);
    form.append('password', password);
    return api.post('/auth/login', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  changePassword: (current: string, newPass: string) =>
    api.post('/auth/change-password', { current_password: current, new_password: newPass }),
  register: (data: any) => api.post('/auth/register', data),
};

// ---- Documents ----
export const documentsApi = {
  list: (params?: any) => api.get('/documents', { params }),
  get: (id: string) => api.get(`/documents/${id}`),
  create: (data: any) => api.post('/documents', data),
  update: (id: string, data: any) => api.patch(`/documents/${id}`, data),
  delete: (id: string) => api.delete(`/documents/${id}`),
  upload: (formData: FormData) => api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  }),
  download: (id: string) => api.get(`/documents/${id}/download`, { responseType: 'blob' }),
  processOCR: (id: string) => api.post(`/documents/${id}/process-ocr`),
  processOcr: (id: string) => api.post(`/documents/${id}/process-ocr`),
  validate: (id: string, decision: string, notes?: string) => {
    const form = new FormData();
    form.append('decision', decision);
    if (notes) form.append('notes', notes);
    return api.post(`/documents/${id}/validate`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  getStats: (institutionId?: string) => api.get('/documents/stats/summary', { params: { institution_id: institutionId } }),
};

// ---- Search ----
export const searchApi = {
  search: (params: any) => api.get('/search', { params }),
  naturalLanguage: (q: string) => api.get('/search/natural-language', { params: { q } }),
  aiAssistant: (question: string, contextIds?: string[]) =>
    api.post('/search/ai-assistant', { question, context_doc_ids: contextIds }),
  advanced: (params: any) => api.get('/search/advanced', { params }),
  suggest: (q: string) => api.get('/search/suggest', { params: { q } }),
};

// ---- Institutions ----
export const institutionsApi = {
  list: (params?: any) => api.get('/institutions', { params }),
  tree: () => api.get('/institutions/tree'),
  getTree: () => api.get('/institutions/tree'),
  get: (id: string) => api.get(`/institutions/${id}`),
  create: (data: any) => api.post('/institutions', data),
  update: (id: string, data: any) => api.patch(`/institutions/${id}`, data),
  getStats: (id: string) => api.get(`/institutions/${id}/stats`),
};

// ---- Dashboard ----
export const dashboardApi = {
  getKPIs: (params?: any) => api.get('/dashboard/kpis', { params }),
  getTopInstitutions: (metric?: string, limit?: number) =>
    api.get('/dashboard/top-institutions', { params: { metric, limit } }),
  getRecentActivity: (limit?: number) =>
    api.get('/dashboard/recent-activity', { params: { limit } }),
  getAlerts: () => api.get('/dashboard/alerts'),
  getGeographic: () => api.get('/dashboard/geographic'),
};

// ---- Workflows ----
export const workflowsApi = {
  listDefinitions: () => api.get('/workflows/definitions'),
  createDefinition: (data: any) => api.post('/workflows/definitions', data),
  listInstances: (params?: any) => api.get('/workflows/instances', { params }),
  createInstance: (definitionId: string, documentId: string) =>
    api.post('/workflows/instances', null, { params: { definition_id: definitionId, document_id: documentId } }),
  getInstance: (id: string) => api.get(`/workflows/instances/${id}`),
  completeStep: (stepId: string, decision: string, notes?: string) =>
    api.post(`/workflows/steps/${stepId}/complete`, { decision, notes }),
  getStats: () => api.get('/workflows/stats'),
};

// ---- Users ----
export const usersApi = {
  list: (params?: any) => api.get('/users', { params }),
  get: (id: string) => api.get(`/users/${id}`),
  create: (data: any) => api.post('/users', data),
  update: (id: string, data: any) => api.patch(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
  deactivate: (id: string) => api.delete(`/users/${id}`),
};

// ---- Physical Archives ----
export const physicalApi = {
  listLocations: (institutionId?: string) =>
    api.get('/physical/locations', { params: { institution_id: institutionId } }),
  createLocation: (data: any) => api.post('/physical/locations', data),
  listBoxes: (params?: any) => api.get('/physical/boxes', { params }),
  createBox: (data: any) => api.post('/physical/boxes', data),
  locateBox: (barcode: string) => api.get(`/physical/boxes/locate/${barcode}`),
  listBorrows: (params?: any) => api.get('/physical/borrows', { params }),
  createBorrow: (data: any) => api.post('/physical/borrows', data),
  returnBorrow: (borrowId: string) => api.post(`/physical/borrows/${borrowId}/return`),
  borrowBox: (data: any) => api.post('/physical/borrows', data),
  returnBox: (borrowId: string) => api.post(`/physical/borrows/${borrowId}/return`),
};

// ---- Classification ----
export const classificationApi = {
  listPlans: () => api.get('/classification/plans'),
  createPlan: (data: any) => api.post('/classification/plans', data),
  getPlanTree: (planId: string) => api.get(`/classification/plans/${planId}/tree`),
  createNode: (data: any) => api.post('/classification/nodes', data),
};
