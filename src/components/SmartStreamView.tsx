import { useEffect, useMemo, useState } from "react";
import {
  Workflow,
  Server,
  HardDrive,
  Video,
  Upload,
  X,
  RotateCcw,
  Check,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BackendDevice } from "@/lib/device-api";

export type PushType = "srt" | "rtsp" | "rtmp";

interface PushSlot {
  type: PushType;
  url: string;
  latencyMs?: number;
}

const SMUX_SERVER = { host: "smux.local", port: 8080 };
const SRT_PULL = `srt://${SMUX_SERVER.host}:9000?streamid=pull`;
const RTSP_PULL = `rtsp://${SMUX_SERVER.host}:8554/live`;
const SLOT_COUNT = 4;

const PUSH_META: Record<PushType, { label: string; Icon: typeof Upload; placeholder: string }> = {
  srt: { label: "SRT Push", Icon: Upload, placeholder: "srt://host:port?streamid=xxx" },
  rtsp: { label: "RTSP Push", Icon: Upload, placeholder: "rtsp://host:port/path" },
  rtmp: { label: "RTMP Push", Icon: Upload, placeholder: "rtmp://host/app/stream" },
};

type Pipeline = {
  slots: (PushSlot | null)[];
};

const emptyPipeline = (): Pipeline => ({ slots: Array(SLOT_COUNT).fill(null) });

export function SmartStreamView({
  devices,
  selectedSn,
}: {
  devices: BackendDevice[];
  selectedSn: string;
}) {
  const [pipelines, setPipelines] = useState<Record<string, Pipeline>>({});
  const [draft, setDraft] = useState<Pipeline>(emptyPipeline());
  const [dragType, setDragType] = useState<PushType | null>(null);
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [editingUrl, setEditingUrl] = useState("");
  const [editingLatency, setEditingLatency] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1200);
    } catch {
      // ignore
    }
  };

  // Load draft when device changes
  useEffect(() => {
    setDraft(pipelines[selectedSn] ?? emptyPipeline());
    setSelectedNode(null);
    setEditingSlot(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSn]);

  const device = useMemo(
    () => devices.find((d) => d.serialNo === selectedSn) ?? null,
    [devices, selectedSn],
  );

  const dirty = useMemo(() => {
    const saved = pipelines[selectedSn] ?? emptyPipeline();
    return JSON.stringify(saved.slots) !== JSON.stringify(draft.slots);
  }, [pipelines, selectedSn, draft]);

  const handleDrop = (idx: number) => {
    if (!dragType) return;
    const type = dragType;
    setHoverSlot(null);
    setDragType(null);
    setEditingSlot(idx);
    setEditingUrl("");
    setEditingLatency(type === "srt" ? "120" : "");
    setDraft((prev) => {
      const next = { slots: [...prev.slots] };
      next.slots[idx] = { type, url: "", ...(type === "srt" ? { latencyMs: 120 } : {}) };
      return next;
    });
  };

  const commitEdit = () => {
    if (editingSlot === null) return;
    setDraft((prev) => {
      const next = { slots: [...prev.slots] };
      const cur = next.slots[editingSlot];
      if (cur) {
        const updated: PushSlot = { ...cur, url: editingUrl.trim() };
        if (cur.type === "srt") {
          const n = parseInt(editingLatency, 10);
          updated.latencyMs = Number.isFinite(n) && n >= 0 ? n : 120;
        }
        next.slots[editingSlot] = updated;
      }
      return next;
    });
    setEditingSlot(null);
    setEditingUrl("");
    setEditingLatency("");
  };

  const cancelEdit = () => {
    if (editingSlot !== null) {
      const cur = draft.slots[editingSlot];
      if (cur && !cur.url) {
        // remove empty slot if cancelled before first save
        setDraft((prev) => {
          const next = { slots: [...prev.slots] };
          next.slots[editingSlot] = null;
          return next;
        });
      }
    }
    setEditingSlot(null);
    setEditingUrl("");
    setEditingLatency("");
  };

  const removeSlot = (idx: number) => {
    setDraft((prev) => {
      const next = { slots: [...prev.slots] };
      next.slots[idx] = null;
      return next;
    });
    if (selectedNode === `slot-${idx}`) setSelectedNode(null);
  };

  const handleReset = () => {
    setDraft(pipelines[selectedSn] ?? emptyPipeline());
    setEditingSlot(null);
    setSelectedNode(null);
  };

  const handleApply = () => {
    if (!selectedSn) return;
    setPipelines((prev) => ({ ...prev, [selectedSn]: { slots: [...draft.slots] } }));
  };

  return (
    <section className="panel flex flex-col h-full overflow-hidden">
      {/* Header with title + actions */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Workflow className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-wide">智流管理</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={!dirty}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            恢复
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!dirty}
            className="inline-flex items-center gap-1 rounded-md border border-primary/60 bg-primary/15 px-2.5 py-1 text-[11px] text-primary hover:bg-primary/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Check className="h-3 w-3" />
            应用
          </button>
        </div>
      </div>

      {/* Pipeline area */}
      <div className="relative flex-1 min-h-0 overflow-auto p-4 flex items-center justify-center">
        {/* Draggable push palette pinned to top-left */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">拖拽推流</span>
          {(Object.keys(PUSH_META) as PushType[]).map((t) => {
            const { label, Icon } = PUSH_META[t];
            return (
              <div
                key={t}
                draggable
                onDragStart={(e) => {
                  setDragType(t);
                  e.dataTransfer.effectAllowed = "copy";
                  e.dataTransfer.setData("text/plain", t);
                }}
                onDragEnd={() => {
                  setDragType(null);
                  setHoverSlot(null);
                }}
                className="flex items-center gap-1.5 rounded-md border border-border bg-card/80 backdrop-blur px-2 py-1 text-[11px] cursor-grab active:cursor-grabbing hover:border-primary/60 hover:bg-primary/10 transition-colors"
                title={`拖拽 ${label} 到空槽`}
              >
                <Icon className="h-3.5 w-3.5 text-primary" />
                <span>{label}</span>
              </div>
            );
          })}
        </div>


        {!device ? (
          <div className="text-xs text-muted-foreground">
            请从左侧选择一个设备查看智流 pipeline
          </div>
        ) : (
          <div className="flex items-center gap-3 min-w-max mx-auto">
            {/* Device node */}
            <PipelineNode
              icon={<HardDrive className="h-5 w-5" />}
              title={device.name?.trim() || "未命名设备"}
              subtitle={device.serialNo}
              tone={device.online ? "device" : "offline"}
              active={selectedNode === "device"}
              onClick={() => setSelectedNode("device")}
            />
            <Connector />

            {/* S-Mux Server node */}
            <PipelineNode
              icon={<Server className="h-5 w-5" />}
              title="S-Mux 服务器"
              subtitle={`${SMUX_SERVER.host}:${SMUX_SERVER.port}`}
              tone="server"
              active={selectedNode === "smux"}
              onClick={() => setSelectedNode("smux")}
            />

            {/* Branch connector + outputs */}
            <BranchConnector count={2 + SLOT_COUNT} />

            <div className="flex flex-col gap-2">
              {/* Fixed: SRT Server */}
              <FixedNode
                icon={<Video className="h-4 w-4" />}
                title="SRT Server"
                detail={SRT_PULL}
                copied={copiedKey === "srt-server"}
                onClick={() => {
                  setSelectedNode("srt-server");
                  copyToClipboard("srt-server", SRT_PULL);
                }}
              />
              {/* Fixed: RTSP Server */}
              <FixedNode
                icon={<Video className="h-4 w-4" />}
                title="RTSP Server"
                detail={RTSP_PULL}
                copied={copiedKey === "rtsp-server"}
                onClick={() => {
                  setSelectedNode("rtsp-server");
                  copyToClipboard("rtsp-server", RTSP_PULL);
                }}
              />

              {/* Editable slots */}
              {draft.slots.map((slot, i) => {
                const isHover = hoverSlot === i;
                const isEditing = editingSlot === i;
                if (slot) {
                  const { Icon, label } = PUSH_META[slot.type];
                  return (
                    <div
                      key={i}
                      className={cn(
                        "group flex items-center justify-between gap-2 rounded-md border-2 bg-card/60 px-3 py-2 min-w-[260px] transition-colors",
                        selectedNode === `slot-${i}`
                          ? "border-primary bg-primary/10"
                          : "border-primary/50 hover:border-primary",
                      )}
                      onClick={() => !isEditing && setSelectedNode(`slot-${i}`)}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Icon className="h-4 w-4 text-primary shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] font-medium leading-tight">{label}</div>
                          {isEditing ? (
                            <input
                              autoFocus
                              value={editingUrl}
                              placeholder={PUSH_META[slot.type].placeholder}
                              onChange={(e) => setEditingUrl(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              onBlur={commitEdit}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  commitEdit();
                                }
                                if (e.key === "Escape") {
                                  e.preventDefault();
                                  cancelEdit();
                                }
                              }}
                              className="mt-1 w-full rounded-sm border border-primary/50 bg-background px-1.5 py-0.5 text-[11px] outline-none"
                            />
                          ) : (
                            <button
                              type="button"
                              className="text-[11px] text-muted-foreground truncate text-left w-full hover:text-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingSlot(i);
                                setEditingUrl(slot.url);
                                setSelectedNode(`slot-${i}`);
                              }}
                              title="点击编辑推流地址"
                            >
                              {slot.url || <span className="italic">未设置 · 点击编辑</span>}
                            </button>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSlot(i);
                        }}
                        className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition"
                        title="删除"
                        aria-label="删除推流"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                }
                return (
                  <div
                    key={i}
                    onDragOver={(e) => {
                      if (!dragType) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "copy";
                      if (hoverSlot !== i) setHoverSlot(i);
                    }}
                    onDragLeave={() => setHoverSlot((s) => (s === i ? null : s))}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDrop(i);
                    }}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-md border-2 border-dashed px-3 py-2 min-w-[260px] text-[11px] transition-colors",
                      isHover
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-primary/40 text-muted-foreground hover:border-primary/70",
                    )}
                  >
                    <span className="opacity-70">空槽 {i + 1} · 拖入推流</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function PipelineNode({
  icon,
  title,
  subtitle,
  tone,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tone: "device" | "server" | "offline";
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-md border-2 bg-card/60 px-4 py-3 min-w-[160px] transition-colors cursor-pointer",
        active
          ? "border-primary bg-primary/10 shadow-[0_0_0_1px_var(--color-primary)]"
          : "border-primary/50 hover:border-primary",
      )}
    >
      <div
        className={cn(
          "h-10 w-10 rounded-full flex items-center justify-center border-2",
          tone === "offline"
            ? "border-border bg-muted/30 text-muted-foreground"
            : "border-primary bg-primary text-primary-foreground",
        )}
      >
        {icon}
      </div>
      <div className="text-[12px] font-medium leading-tight">{title}</div>
      <div className="text-[10px] text-muted-foreground">{subtitle}</div>
    </button>
  );
}

function FixedNode({
  icon,
  title,
  detail,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-md border-2 bg-card/60 px-3 py-2 min-w-[260px] text-left transition-colors",
        active
          ? "border-primary bg-primary/10"
          : "border-primary/50 hover:border-primary",
      )}
    >
      <div className="text-primary shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-medium leading-tight">{title}</div>
        <div className="text-[11px] text-muted-foreground truncate">{detail}</div>
      </div>
      <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition", active && "rotate-90 text-primary")} />
    </button>
  );
}

function Connector() {
  return (
    <div className="flex items-center" aria-hidden>
      <svg width="36" height="12" className="overflow-visible">
        <line
          x1="0"
          y1="6"
          x2="36"
          y2="6"
          stroke="var(--color-primary)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function BranchConnector({ count }: { count: number }) {
  const rowH = 44;
  const height = count * rowH;
  const mid = height / 2;
  return (
    <div className="flex items-center" aria-hidden>
      <svg width="40" height={height} className="overflow-visible">
        <line x1="0" y1={mid} x2="20" y2={mid} stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" />
        <line
          x1="20"
          y1={rowH / 2}
          x2="20"
          y2={height - rowH / 2}
          stroke="var(--color-primary)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {Array.from({ length: count }).map((_, i) => (
          <line
            key={i}
            x1="20"
            y1={rowH / 2 + i * rowH}
            x2="40"
            y2={rowH / 2 + i * rowH}
            stroke="var(--color-primary)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        ))}
        <circle cx="20" cy={mid} r="3" fill="var(--color-primary)" />
      </svg>
    </div>
  );
}
