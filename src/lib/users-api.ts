import { getAuthToken } from "@/lib/auth";

export interface BackendUser {
  id: number;
  username: string;
  role: "admin" | "user";
  createdAt?: string;
}

export interface DeviceBinding {
  id: number;
  userId: number;
  username: string;
  serialNo: string;
  deviceName?: string;
  createdAt?: string;
}

function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return (configured?.trim() || "http://127.0.0.1:18081").replace(/\/$/, "");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  if (!token) throw new Error("missing auth token");

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (response.status === 401) throw new Error("unauthorized");

  if (!response.ok) {
    let message = "请求失败";
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function fetchUsers(): Promise<BackendUser[]> {
  return request<BackendUser[]>("/api/users");
}

export function createUser(payload: {
  username: string;
  password: string;
  role: "admin" | "user";
}): Promise<BackendUser> {
  return request<BackendUser>("/api/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteUser(id: number): Promise<void> {
  return request<void>(`/api/users/${id}`, { method: "DELETE" });
}

export function updateUserPassword(id: number, password: string): Promise<void> {
  return request<void>(`/api/users/${id}/password`, {
    method: "PUT",
    body: JSON.stringify({ password }),
  });
}

export function updateOwnPassword(oldPassword: string, newPassword: string): Promise<void> {
  return request<void>(`/api/auth/password`, {
    method: "PUT",
    body: JSON.stringify({ oldPassword, newPassword }),
  });
}

export function fetchBindings(): Promise<DeviceBinding[]> {
  return request<DeviceBinding[]>("/api/bindings");
}

export function createBinding(payload: {
  userId: number;
  serialNo: string;
}): Promise<DeviceBinding> {
  return request<DeviceBinding>("/api/bindings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteBinding(id: number): Promise<void> {
  return request<void>(`/api/bindings/${id}`, { method: "DELETE" });
}
