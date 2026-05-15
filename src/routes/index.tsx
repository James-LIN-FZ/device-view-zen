import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { DeviceList } from "@/components/DeviceList";
import { ViewSwitcher, type ViewKey } from "@/components/ViewSwitcher";
import { EncodingPanel } from "@/components/EncodingPanel";
import { NetworkPanel } from "@/components/NetworkPanel";
import { UserManagementView } from "@/components/UserManagementView";
import { MonitorView } from "@/components/MonitorView";
import { getAuthToken, isAuthenticated } from "@/lib/auth";
import { fetchMyDevices, updateDeviceName, type BackendDevice, type BackendDeviceStatusData } from "@/lib/device-api";

type DeviceWsMessage = {
  type?: string;
  payload?: unknown;
  online?: boolean;
};

function getWsBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL as string | undefined;
  const httpBase = (configured?.trim() || "http://127.0.0.1:18081").replace(/\/$/, "");
  if (httpBase.startsWith("https://")) return `wss://${httpBase.slice(8)}`;
  if (httpBase.startsWith("http://")) return `ws://${httpBase.slice(7)}`;
  return httpBase;
}

function toStatusPayload(value: unknown): BackendDeviceStatusData | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as BackendDeviceStatusData;
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "控制台 — 视频传输设备管理平台" },
      { name: "description", content: "实时查看视频传输设备的编码状态与网络流量" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<BackendDevice[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deviceStatus, setDeviceStatus] = useState<BackendDeviceStatusData | null>(null);
  const [deviceOnline, setDeviceOnline] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<ViewKey>("control");

  const selectedDevice = useMemo(
    () => devices.find((device) => device.serialNo === selectedId) ?? null,
    [devices, selectedId],
  );

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate({ to: "/login" });
      return;
    }

    let active = true;
    setLoading(true);
    setError("");

    fetchMyDevices()
      .then((items) => {
        if (!active) return;
        setDevices(items);
        setSelectedId((current) => current || items[0]?.serialNo || "");
      })
      .catch((err) => {
        if (!active) return;
        const message = err instanceof Error ? err.message : "获取设备列表失败";
        if (message === "unauthorized") {
          navigate({ to: "/login" });
          return;
        }
        setError(message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (!isAuthenticated()) {
      return;
    }

    let disposed = false;

    const refreshDevices = async () => {
      try {
        const items = await fetchMyDevices();
        if (disposed) return;

        setDevices((current) =>
          items.map((item) => {
            const existing = current.find((x) => x.serialNo === item.serialNo);
            // Keep local name during optimistic rename flow until backend list catches up.
            if (existing && existing.name && !item.name) {
              return { ...item, name: existing.name };
            }
            return item;
          }),
        );

        setSelectedId((current) => {
          if (current && items.some((item) => item.serialNo === current)) return current;
          return items[0]?.serialNo || "";
        });
      } catch (err) {
        if (disposed) return;
        const message = err instanceof Error ? err.message : "获取设备列表失败";
        if (message === "unauthorized") {
          navigate({ to: "/login" });
        }
      }
    };

    const timer = setInterval(() => {
      void refreshDevices();
    }, 10000);

    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [navigate]);

  useEffect(() => {
    setDeviceOnline(selectedDevice?.online ?? false);
  }, [selectedDevice?.online, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setDeviceStatus(null);
      setDeviceOnline(false);
      return;
    }

    setDeviceStatus(null);

    const token = getAuthToken();
    if (!token) {
      navigate({ to: "/login" });
      return;
    }

    const ws = new WebSocket(
      `${getWsBaseUrl()}/api/ws/devices/${encodeURIComponent(selectedId)}?token=${encodeURIComponent(token)}`,
    );

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as DeviceWsMessage;
        if (typeof msg.online === "boolean") {
          setDeviceOnline(msg.online);
          setDevices((current) =>
            current.map((item) =>
              item.serialNo === selectedId ? { ...item, online: msg.online as boolean } : item,
            ),
          );
        }

        if (msg.type !== "codec") return;
        const nextStatus = toStatusPayload(msg.payload);
        if (!nextStatus) return;
        setDeviceStatus(nextStatus);
      } catch {
        // Ignore malformed messages and keep current UI state.
      }
    };

    ws.onerror = () => {
      setError((prev) => prev || "设备状态实时连接失败");
    };

    return () => {
      ws.close();
    };
  }, [navigate, selectedId]);

  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <div className="flex-1 min-h-0 grid gap-2 p-2" style={{ gridTemplateColumns: "auto 0.67fr 3fr" }}>
        <ViewSwitcher active={activeView} onChange={setActiveView} />
        {activeView === "users" ? (
          <div className="col-span-2 min-h-0">
            <UserManagementView onUnauthorized={() => navigate({ to: "/login" })} />
          </div>
        ) : (
          <>
            <div className="flex flex-col min-h-0 gap-2">
              {error ? (
                <div className="panel border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              ) : null}
              <div className="flex-1 min-h-0">
                <DeviceList
                  devices={devices}
                  selectedId={selectedId}
                  onSelect={(device) => {
                    setSelectedId(device.serialNo);
                  }}
                  onRename={async (device, nextName) => {
                    try {
                      await updateDeviceName(device.serialNo, nextName);
                      setDevices((current) =>
                        current.map((item) =>
                          item.serialNo === device.serialNo ? { ...item, name: nextName } : item,
                        ),
                      );
                    } catch (err) {
                      const message = err instanceof Error ? err.message : "更新设备名称失败";
                      if (message === "unauthorized") {
                        navigate({ to: "/login" });
                        return;
                      }
                      setError(message);
                      throw err;
                    }
                  }}
                />
              </div>
              {loading ? <div className="text-xs text-muted-foreground px-2">加载设备中...</div> : null}
            </div>
            <div className="grid grid-rows-2 gap-2 min-h-0">
              {activeView === "control" ? (
                <>
                  <EncodingPanel
                    deviceName={selectedDevice?.name?.trim() || "未命名设备"}
                    online={deviceOnline}
                    status={deviceStatus}
                  />
                  <NetworkPanel
                    serialNo={selectedId}
                    online={deviceOnline}
                  />
                </>
              ) : (
                <div className="row-span-2 min-h-0">
                  <MonitorView devices={devices} />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
