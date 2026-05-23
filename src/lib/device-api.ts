import { getAuthToken } from "@/lib/auth";
import { subscribeRPCReady } from "@/lib/rpc-events";

export interface BackendDevice {
  id: number;
  name: string;
  serialNo: string;
  online: boolean;
}

export interface BackendDeviceStatusData {
  sAudioCodec: {
    iBitrate: number;
    iChannels: number;
    iPoc: number;
    iSampleRate: number;
    iTc: number;
    sBitrate: string;
    sCodec: string;
    sFormat: string;
  };
  sAudioParams: {
    iChannels: number;
    iPoc: number;
    iSampleRate: number;
    iTc: number;
    iVolume: number;
    sDevice: string;
    sFormat: string;
  };
  sName: string;
  sVideoCodec: {
    iActBitrate: number;
    iActFPS: number;
    iBitrate: number;
    iFPS: number;
    iField: number;
    iHeight: number;
    iPoc: number;
    iTc: number;
    iWidth: number;
    sActBitrate: string;
    sBitrate: string;
    sCodec: string;
    sFormat: string;
    sResolution: string;
  };
  sVideoParams: {
    iFPS: number;
    iField: number;
    iHeight: number;
    iPoc: number;
    iTc: number;
    iWidth: number;
    sDevice: string;
    sFormat: string;
    sResolution: string;
  };
  sMuxer?: {
    iSendSize?: number;
    iStream?: number;
    sSrt?: {
      iMsRTT?: number;
      iPktDrop?: number;
      iPktLoss?: number;
      iPktRetrans?: number;
      iPktSent?: number;
    };
    sURL?: string;
  };
}

export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (configured !== undefined) return configured.trim().replace(/\/$/, "");
  return "http://127.0.0.1:18081";
}

export async function fetchMyDevices(): Promise<BackendDevice[]> {
  const token = getAuthToken();
  if (!token) {
    throw new Error("missing auth token");
  }

  const response = await fetch(`${getApiBaseUrl()}/api/devices`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    throw new Error("unauthorized");
  }

  if (!response.ok) {
    throw new Error("获取设备列表失败");
  }

  const payload = (await response.json()) as Array<{
    id: number;
    name?: string;
    serialNo: string;
    online: boolean;
  }>;

  return payload.map((device) => ({
    id: device.id,
    name: device.name?.trim() || "",
    serialNo: device.serialNo,
    online: device.online,
  }));
}

export async function updateDeviceName(serialNo: string, name: string): Promise<void> {
  const token = getAuthToken();
  if (!token) {
    throw new Error("missing auth token");
  }

  const response = await fetch(`${getApiBaseUrl()}/api/devices/${encodeURIComponent(serialNo)}/name`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  if (response.status === 401) {
    throw new Error("unauthorized");
  }

  if (!response.ok) {
    let message = "更新设备名称失败";
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Keep fallback message.
    }
    throw new Error(message);
  }
}

export async function fetchDeviceStatus(serialNo: string): Promise<BackendDeviceStatusData | null> {
  const token = getAuthToken();
  if (!token) {
    throw new Error("missing auth token");
  }

  const response = await fetch(`${getApiBaseUrl()}/api/devices/${encodeURIComponent(serialNo)}/status`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    throw new Error("unauthorized");
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("获取设备状态失败");
  }

  return (await response.json()) as BackendDeviceStatusData;
}

export interface DeviceRPCSyncRequest {
  method?: string;
  path: string;
  body?: unknown;
}

export interface DeviceRPCAck {
  requestId: string;
  status: string;
  timeoutSeconds: number;
}

export interface DeviceRPCReply {
  requestId: string;
  status: string;
  method: string;
  path: string;
  data?: unknown;
  error?: string;
  timestamp: string;
}

export async function fetchDeviceNetwork(serialNo: string): Promise<unknown | null> {
  const token = getAuthToken();
  if (!token) {
    throw new Error("missing auth token");
  }

  const response = await fetch(`${getApiBaseUrl()}/api/devices/${encodeURIComponent(serialNo)}/network`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    throw new Error("unauthorized");
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("获取网络状态失败");
  }

  return (await response.json()) as unknown;
}

export async function requestDeviceRPC(serialNo: string, request: DeviceRPCSyncRequest): Promise<DeviceRPCAck> {
  const token = getAuthToken();
  if (!token) {
    throw new Error("missing auth token");
  }

  const response = await fetch(`${getApiBaseUrl()}/api/devices/${encodeURIComponent(serialNo)}/rpc`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (response.status === 401) {
    throw new Error("unauthorized");
  }

  if (!response.ok) {
    let message = "发起设备RPC请求失败";
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Keep fallback message.
    }
    throw new Error(message);
  }

  return (await response.json()) as DeviceRPCAck;
}

export async function fetchDeviceRPCReply(serialNo: string, requestId: string): Promise<DeviceRPCReply | null> {
  const token = getAuthToken();
  if (!token) {
    throw new Error("missing auth token");
  }

  const response = await fetch(
    `${getApiBaseUrl()}/api/devices/${encodeURIComponent(serialNo)}/rpc/${encodeURIComponent(requestId)}/reply`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (response.status === 401) {
    throw new Error("unauthorized");
  }

  if (response.status === 404 || response.status === 202) {
    return null;
  }

  if (!response.ok) {
    let message = "获取RPC返回值失败";
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Keep fallback message.
    }
    throw new Error(message);
  }

  return (await response.json()) as DeviceRPCReply;
}

/**
 * Initiate a device RPC call and wait for the reply.
 *
 * Flow:
 *  1. POST HTTP to start the RPC → receive an ack with requestId.
 *  2. Subscribe to the WS notification for that requestId (fired by
 *     `notifyRPCReady` in the WebSocket handler when `rpc.reply` arrives).
 *  3. When the WS fires, immediately fetch the reply via HTTP.
 *  4. If no WS notification arrives within 5 s, fall back and try HTTP anyway.
 *  5. Repeat until the total 15 s deadline is exceeded, then return null.
 */
export async function rpcCall(
  serialNo: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<DeviceRPCReply | null> {
  try {
    const ack = await requestDeviceRPC(serialNo, { method, path, body });
    if (!ack?.requestId) return null;

    const TIMEOUT_MS = 15_000;
    const FALLBACK_POLL_MS = 5_000;
    const deadline = Date.now() + TIMEOUT_MS;

    let unsubscribe = (): void => {};
    const wsNotify = new Promise<void>((resolve) => {
      unsubscribe = subscribeRPCReady(ack.requestId, resolve);
    });

    try {
      while (Date.now() < deadline) {
        const remaining = deadline - Date.now();
        await Promise.race([
          wsNotify,
          new Promise<void>((r) => setTimeout(r, Math.min(FALLBACK_POLL_MS, remaining))),
        ]);
        const reply = await fetchDeviceRPCReply(serialNo, ack.requestId);
        if (reply !== null) return reply;
      }
    } finally {
      unsubscribe();
    }

    return null;
  } catch {
    return null;
  }
}