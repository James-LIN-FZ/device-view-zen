import { getAuthToken } from "@/lib/auth";

export interface BackendDevice {
  id: number;
  name: string;
  serialNo: string;
  online: boolean;
}

function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return (configured?.trim() || "http://127.0.0.1:18081").replace(/\/$/, "");
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