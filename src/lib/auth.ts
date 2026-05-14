export interface AuthUser {
  id: number;
  username: string;
  role: string;
}

interface LoginResponse {
  token: string;
  user: AuthUser;
}

const TOKEN_KEY = "vtx-token";
const USER_KEY = "vtx-user";

function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return (configured?.trim() || "http://127.0.0.1:18081").replace(/\/$/, "");
}

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extra ?? {}),
  };
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const response = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    let message = "登录失败，请检查账号或密码";
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Keep fallback message for non-JSON responses.
    }
    throw new Error(message);
  }

  const payload = (await response.json()) as LoginResponse;
  persistAuth(payload.token, payload.user);
  return payload.user;
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${getApiBaseUrl()}/api/auth/logout`, {
      method: "POST",
      headers: authHeaders(),
    });
  } catch {
    // Ignore network errors during logout; local auth should still be cleared.
  } finally {
    clearAuth();
  }
}

export function persistAuth(token: string, user: AuthUser): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // Ignore storage failures and keep app behavior stable.
  }
}

export function clearAuth(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  } catch {
    // Ignore storage failures and keep app behavior stable.
  }
}

export function getAuthToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getAuthUser(): AuthUser | null {
  try {
    const value = sessionStorage.getItem(USER_KEY);
    if (!value) return null;
    return JSON.parse(value) as AuthUser;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return Boolean(getAuthToken());
}