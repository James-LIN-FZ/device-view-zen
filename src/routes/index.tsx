import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { DeviceList } from "@/components/DeviceList";
import { EncodingPanel } from "@/components/EncodingPanel";
import { NetworkPanel } from "@/components/NetworkPanel";
import { devices } from "@/lib/devices";
import { isAuthenticated } from "@/lib/auth";

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
  const [selectedId, setSelectedId] = useState(devices[0].id);

  useEffect(() => {
    try {
      if (!isAuthenticated()) {
        navigate({ to: "/login" });
      }
    } catch {}
  }, [navigate]);

  const selected = useMemo(
    () => devices.find((d) => d.id === selectedId) ?? devices[0],
    [selectedId],
  );

  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <div className="flex-1 min-h-0 grid gap-2 p-2" style={{ gridTemplateColumns: "1fr 3fr" }}>
        <DeviceList devices={devices} selectedId={selectedId} onSelect={setSelectedId} />
        <div className="grid grid-rows-2 gap-2 min-h-0">
          <EncodingPanel device={selected} />
          <NetworkPanel device={selected} />
        </div>
      </div>
    </div>
  );
}
