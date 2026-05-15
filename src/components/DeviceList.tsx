import { useEffect, useRef, useState } from "react";
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
  onRename,
}: {
  devices: DeviceSummary[];
  selectedId: string;
  onSelect: (device: DeviceSummary, index: number) => void;
  onRename: (device: DeviceSummary, nextName: string) => Promise<void>;
}) {
  const onlineCount = devices.filter((d) => d.online).length;
  const [editingSerial, setEditingSerial] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [savingSerial, setSavingSerial] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editingSerial) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editingSerial]);

  useEffect(() => {
    if (editingSerial && !devices.some((device) => device.serialNo === editingSerial)) {
      setEditingSerial(null);
      setDraftName("");
      setSavingSerial(null);
    }
  }, [devices, editingSerial]);

  const displayName = (name: string) => name.trim() || "未命名设备";

  const beginEdit = (device: DeviceSummary) => {
    if (savingSerial === device.serialNo) return;
    setEditingSerial(device.serialNo);
    setDraftName(device.name);
  };

  const cancelEdit = () => {
    setEditingSerial(null);
    setDraftName("");
  };

  const commitEdit = async (device: DeviceSummary) => {
    if (savingSerial === device.serialNo) return;

    const nextName = draftName.trim();
    if (nextName === device.name.trim()) {
      cancelEdit();
      return;
    }

    setSavingSerial(device.serialNo);
    try {
      await onRename(device, nextName);
      cancelEdit();
    } finally {
      setSavingSerial(null);
    }
  };

  return (
    <aside className="panel flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide">我的设备</h2>
          <span className="text-xs text-muted-foreground">
            <span className="text-primary font-medium">{onlineCount}</span> / {devices.length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {devices.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">暂无设备</div>
        ) : null}

        {devices.map((d, index) => {
          const s = statusMap[d.online ? "online" : "offline"];
          const active = d.serialNo === selectedId;
          const Icon = d.online ? Wifi : WifiOff;
          const isEditing = editingSerial === d.serialNo;
          const isSaving = savingSerial === d.serialNo;

          return (
            <div
              key={d.id}
              role="button"
              tabIndex={0}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", d.serialNo);
                e.dataTransfer.setData("application/x-device-sn", d.serialNo);
                e.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => onSelect(d, index)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(d, index);
                }
              }}
              className={cn(
                "w-full text-left rounded-md border px-3 py-2.5 transition flex items-center gap-3 cursor-pointer",
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
                  {isEditing ? (
                    <input
                      ref={inputRef}
                      value={draftName}
                      disabled={isSaving}
                      onChange={(event) => setDraftName(event.target.value)}
                      onBlur={() => {
                        void commitEdit(d);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void commitEdit(d);
                        }
                        if (event.key === "Escape") {
                          event.preventDefault();
                          cancelEdit();
                        }
                      }}
                      onClick={(event) => event.stopPropagation()}
                      className="w-full rounded-sm border border-primary/50 bg-background px-2 py-1 text-sm outline-none"
                      placeholder="未命名设备"
                    />
                  ) : (
                    <span
                      className="truncate text-sm font-medium"
                      title="双击修改设备名称"
                      onDoubleClick={(event) => {
                        event.stopPropagation();
                        beginEdit(d);
                      }}
                    >
                      {displayName(d.name)}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">序列号 {d.serialNo}</div>
              </div>
              <div className={cn("flex items-center gap-1.5 text-[11px]", s.cls)}>
                <span className={cn("status-dot inline-block h-1.5 w-1.5 rounded-full", s.dot)} />
                <span>{isSaving ? "保存中" : s.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
