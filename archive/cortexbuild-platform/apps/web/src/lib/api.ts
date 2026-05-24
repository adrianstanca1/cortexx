import axios, { AxiosInstance, AxiosError } from 'axios';

const api: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('cortexbuild_token') : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('cortexbuild_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

export interface Paginated<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export async function getList<T>(path: string, params?: Record<string, unknown>): Promise<Paginated<T>> {
  const { data } = await api.get(path, { params });
  return data;
}

export async function getOne<T>(path: string): Promise<T> {
  const { data } = await api.get(path);
  return data.data;
}

export async function createOne<T>(path: string, body: unknown): Promise<T> {
  const { data } = await api.post(path, body);
  return data.data;
}

export async function updateOne<T>(path: string, body: unknown): Promise<T> {
  const { data } = await api.put(path, body);
  return data.data;
}

export async function removeOne(path: string): Promise<void> {
  await api.delete(path);
}

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const url = (process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3006/api') + path;
  const token = typeof window !== 'undefined' ? localStorage.getItem('cortexbuild_token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers as Record<string, string> || {}),
  };
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('cortexbuild_token');
    window.location.href = '/login';
  }
  return res;
}
