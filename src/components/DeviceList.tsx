import { Server, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DeviceSummary {
  id: number;
  name: string;
  serialNo: string;
  online: boolean;
}

const statusMap: Record<"online" | "offline", { label: string; cls: string; dot: string }> = {
  online: { label: "在线", cls: "text-success", dot: "bg-[var(--color-success)]" },
  offline: { label: "离线", cls: "text-muted-foreground", dot: "bg-muted-foreground" },
};

export function DeviceList({
  devices,
  selectedId,
  onSelect,
}: {
  devices: DeviceSummary[];
  selectedId: string;
  onSelect: (device: DeviceSummary, index: number) => void;
}) {
  const onlineCount = devices.filter((d) => d.online).length;

  return (
    <aside className="panel flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide">我的设备</h2>
          <span className="text-xs text-muted-foreground">
            <span className="text-primary font-medium">{onlineCount}</span> / {devices.length}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">点击选择设备查看详情</p>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {devices.map((d, index) => {
          const s = statusMap[d.online ? "online" : "offline"];
          const active = d.serialNo === selectedId;
          const Icon = d.online ? Wifi : WifiOff;
          return (
            <button
              key={d.id}
              onClick={() => onSelect(d, index)}
              className={cn(
                "w-full text-left rounded-md border px-3 py-2.5 transition flex items-center gap-3",
                active
                  ? "border-primary/70 bg-primary/10 shadow-[0_0_0_1px_var(--color-primary)]"
                  : "border-border bg-card/40 hover:border-primary/40 hover:bg-card",
              )}
            >
              <div
                className={cn(
                  "h-9 w-9 shrink-0 rounded-md border flex items-center justify-center",
                  active ? "border-primary/60 bg-primary/10" : "border-border bg-background/40",
                )}
              >
                <Server className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{d.name}</span>
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {d.serialNo} · 1800x
                </div>
              </div>
              <div className={cn("flex items-center gap-1.5 text-[11px]", s.cls)}>
                <span className={cn("status-dot inline-block h-1.5 w-1.5 rounded-full", s.dot)} />
                <Icon className="h-3 w-3" />
                <span>{s.label}</span>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
