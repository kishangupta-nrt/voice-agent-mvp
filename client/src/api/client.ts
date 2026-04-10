import { API_URL } from '../config/api';

export interface ApiError {
  error: string;
}

export const apiClient = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<any> => {
  const token = localStorage.getItem('token');

  if (!token && endpoint !== '/auth/login' && endpoint !== '/auth/register') {
    throw new Error('User not authenticated');
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
};

export const chatApi = {
  sendMessage: (message: string, conversationId?: string) =>
    apiClient('/chat', {
      method: 'POST',
      body: JSON.stringify({ message, conversationId }),
    }),

  getConversations: (limit = 10) =>
    apiClient(`/chat?limit=${limit}`, {
      method: 'GET',
    }),
};

export const authApi = {
  login: (email: string, password: string) =>
    apiClient('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string) =>
    apiClient('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
};