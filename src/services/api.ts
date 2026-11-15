
const API_BASE_URL = `${import.meta.env.VITE_API_URL}/api`;

export interface ApiResponse<T> {
  status: string;
  data?: T;
  message?: string;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message || `API error: ${response.status}`
    );
  }

  return result as T;
}

export const api = {
  get: <T>(endpoint: string) =>
    request<T>(endpoint),

  post: <T>(endpoint: string, data: unknown) =>
    request<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  put: <T>(endpoint: string, data: unknown) =>
    request<T>(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

    patch: <T>(endpoint: string, data: unknown) =>
  request<T>(endpoint, {
    method: "PATCH",
    body: JSON.stringify(data),
  }),

  delete: <T>(endpoint: string) =>
    request<T>(endpoint, {
      method: "DELETE",
    }),
};
