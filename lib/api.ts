import { API_URL } from '@/constants/config';

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

const request = async <T>(path: string, method: Method = 'GET', body?: unknown, token?: string) => {
  const url = `${API_URL}${path}`;
  // Lightweight client-side logging to verify requests fire
  console.log(`[api] ${method} ${url}`, body ? { body } : {});

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    console.warn('[api] error', method, url, error);
    throw new Error(error.message ?? 'Request failed');
  }
  return res.json() as Promise<T>;
};

export const api = {
  get: <T>(path: string, token?: string) => request<T>(path, 'GET', undefined, token),
  post: <T>(path: string, body: unknown, token?: string) => request<T>(path, 'POST', body, token),
  patch: <T>(path: string, body: unknown, token?: string) =>
    request<T>(path, 'PATCH', body, token),
  put: <T>(path: string, body: unknown, token?: string) => request<T>(path, 'PUT', body, token),
  delete: <T>(path: string, token?: string) => request<T>(path, 'DELETE', undefined, token),
  upload: async <T>(path: string, formData: FormData, token?: string): Promise<T> => {
    const url = `${API_URL}${path}`;
    console.log(`[api] POST ${url} (file upload)`);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      console.warn('[api] error', 'POST', url, error);
      throw new Error(error.message ?? 'Upload failed');
    }
    return res.json() as Promise<T>;
  },
};

