import axios from 'axios';
import type {
  EmailListResponse,
  EmailStats,
  Sender,
  ScheduleResponse,
} from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      const publicAuthPage = window.location.pathname === '/login' ||
        window.location.pathname === '/auth/callback';
      if (!publicAuthPage) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  me: () => api.get('/auth/me').then((r) => r.data.user),
  logout: () => api.post('/auth/logout'),
  googleLoginUrl: () => `${BASE_URL}/auth/google`,
};

export const emailsApi = {
  getScheduled: (page = 1, limit = 20) =>
    api
      .get<EmailListResponse>('/emails/scheduled', { params: { page, limit } })
      .then((r) => r.data),

  getSent: (page = 1, limit = 20) =>
    api
      .get<EmailListResponse>('/emails/sent', { params: { page, limit } })
      .then((r) => r.data),

  search: (q: string, status?: string, page = 1, limit = 20) =>
    api
      .get('/emails/search', { params: { q, status, page, limit } })
      .then((r) => ({
        // search returns { emails, pagination } — normalise to { jobs, pagination }
        jobs: r.data.emails ?? [],
        pagination: r.data.pagination,
      })),

  getStats: () => api.get<EmailStats>('/emails/stats').then((r) => r.data),

  schedule: (formData: FormData) =>
    api
      .post<ScheduleResponse>('/emails/schedule', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data),

  cancel: (id: string) =>
    api.delete(`/emails/${id}`).then((r) => r.data),

  getSenders: () =>
    api.get<{ senders: Sender[] }>('/emails/senders').then((r) => r.data.senders),

  createEtherealSender: (name?: string) =>
    api
      .post('/emails/senders/ethereal', { name })
      .then((r) => r.data),
};

export const slackApi = {
  getConnectUrl: () =>
    api.get<{ url: string }>('/slack/connect').then((r) => r.data.url),
  disconnect: () => api.post('/slack/disconnect').then((r) => r.data),
  status: () =>
    api
      .get<{ connected: boolean; teamId: string }>('/slack/status')
      .then((r) => r.data),
};

export default api;
