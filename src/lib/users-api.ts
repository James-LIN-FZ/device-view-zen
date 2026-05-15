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

// ====== 虚拟数据模式（演示用）======
// 后端联调完成后，将 USE_MOCK 设为 false 即可走真实接口。
const USE_MOCK = true;

let mockUsers: BackendUser[] = [
  { id: 1, username: "admin", role: "admin", createdAt: "2025-01-01 10:00" },
  { id: 2, username: "alice", role: "user", createdAt: "2025-02-12 09:23" },
  { id: 3, username: "bob", role: "user", createdAt: "2025-03-04 15:41" },
  { id: 4, username: "carol", role: "user", createdAt: "2025-04-18 11:07" },
  { id: 5, username: "david", role: "admin", createdAt: "2025-05-02 08:55" },
];

let mockBindings: DeviceBinding[] = [
  { id: 1, userId: 2, username: "alice", serialNo: "VTX-A1B2C3D4", deviceName: "前场摄像机-01" },
  { id: 2, userId: 2, username: "alice", serialNo: "VTX-E5F6G7H8", deviceName: "导播台-02" },
  { id: 3, userId: 3, username: "bob", serialNo: "VTX-I9J0K1L2", deviceName: "外景机-03" },
  { id: 4, userId: 4, username: "carol", serialNo: "VTX-M3N4O5P6", deviceName: "演播室-A" },
  { id: 5, userId: 3, username: "bob", serialNo: "VTX-Q7R8S9T0" },
];

let nextUserId = 100;
let nextBindingId = 100;

function delay<T>(value: T, ms = 200): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
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
  if (USE_MOCK) return delay([...mockUsers]);
  return request<BackendUser[]>("/api/users");
}

export function createUser(payload: {
  username: string;
  password: string;
  role: "admin" | "user";
}): Promise<BackendUser> {
  if (USE_MOCK) {
    if (mockUsers.some((u) => u.username === payload.username)) {
      return Promise.reject(new Error("用户名已存在"));
    }
    const u: BackendUser = {
      id: nextUserId++,
      username: payload.username,
      role: payload.role,
      createdAt: new Date().toISOString().slice(0, 16).replace("T", " "),
    };
    mockUsers = [...mockUsers, u];
    return delay(u);
  }
  return request<BackendUser>("/api/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteUser(id: number): Promise<void> {
  if (USE_MOCK) {
    mockUsers = mockUsers.filter((u) => u.id !== id);
    mockBindings = mockBindings.filter((b) => b.userId !== id);
    return delay(undefined);
  }
  return request<void>(`/api/users/${id}`, { method: "DELETE" });
}

export function updateUserPassword(id: number, password: string): Promise<void> {
  if (USE_MOCK) {
    void id;
    void password;
    return delay(undefined);
  }
  return request<void>(`/api/users/${id}/password`, {
    method: "PUT",
    body: JSON.stringify({ password }),
  });
}

export function updateOwnPassword(oldPassword: string, newPassword: string): Promise<void> {
  if (USE_MOCK) {
    void oldPassword;
    void newPassword;
    return delay(undefined);
  }
  return request<void>(`/api/auth/password`, {
    method: "PUT",
    body: JSON.stringify({ oldPassword, newPassword }),
  });
}

export function fetchBindings(): Promise<DeviceBinding[]> {
  if (USE_MOCK) return delay([...mockBindings]);
  return request<DeviceBinding[]>("/api/bindings");
}

export function createBinding(payload: {
  userId: number;
  serialNo: string;
}): Promise<DeviceBinding> {
  if (USE_MOCK) {
    const user = mockUsers.find((u) => u.id === payload.userId);
    if (!user) return Promise.reject(new Error("用户不存在"));
    const b: DeviceBinding = {
      id: nextBindingId++,
      userId: user.id,
      username: user.username,
      serialNo: payload.serialNo,
      deviceName: undefined,
      createdAt: new Date().toISOString().slice(0, 16).replace("T", " "),
    };
    mockBindings = [...mockBindings, b];
    return delay(b);
  }
  return request<DeviceBinding>("/api/bindings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteBinding(id: number): Promise<void> {
  if (USE_MOCK) {
    mockBindings = mockBindings.filter((b) => b.id !== id);
    return delay(undefined);
  }
  return request<void>(`/api/bindings/${id}`, { method: "DELETE" });
}
