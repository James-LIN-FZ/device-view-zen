import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { DeviceList } from "@/components/DeviceList";
import { ViewSwitcher, type ViewKey } from "@/components/ViewSwitcher";
import { EncodingPanel } from "@/components/EncodingPanel";
import { NetworkPanel } from "@/components/NetworkPanel";
import { isAuthenticated } from "@/lib/auth";
import { fetchDeviceStatus, fetchMyDevices, updateDeviceName, type BackendDevice, type BackendDeviceStatusData } from "@/lib/device-api";
import { devices as demoDevices } from "@/lib/devices";

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
  const [selectedDemoIndex, setSelectedDemoIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deviceStatus, setDeviceStatus] = useState<BackendDeviceStatusData | null>(null);
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
        setSelectedDemoIndex(0);
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
    if (!selectedId) {
      setDeviceStatus(null);
      return;
    }

    let active = true;
    fetchDeviceStatus(selectedId)
      .then((status) => {
        if (!active) return;
        setDeviceStatus(status);
      })
      .catch((err) => {
        if (!active) return;
        const message = err instanceof Error ? err.message : "获取设备状态失败";
        if (message === "unauthorized") {
          navigate({ to: "/login" });
          return;
        }
        setDeviceStatus(null);
      });

    return () => {
      active = false;
    };
  }, [navigate, selectedId]);

  const selected = useMemo(
    () => demoDevices[selectedDemoIndex] ?? demoDevices[0],
    [selectedDemoIndex],
  );

  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <div className="flex-1 min-h-0 grid gap-2 p-2" style={{ gridTemplateColumns: "auto 1fr 3fr" }}>
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
              onSelect={(device, index) => {
                setSelectedId(device.serialNo);
                setSelectedDemoIndex(index % demoDevices.length);
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
          <EncodingPanel
            deviceName={selectedDevice?.name?.trim() || "未命名设备"}
            online={selectedDevice?.online ?? false}
            status={deviceStatus}
          />
          <NetworkPanel device={selected} />
        </div>
        <ViewSwitcher active={activeView} onChange={setActiveView} />
      </div>
    </div>
  );
}
