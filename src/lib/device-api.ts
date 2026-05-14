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
    name: device.name?.trim() || `设备 ${device.serialNo}`,
    serialNo: device.serialNo,
    online: device.online,
  }));
}