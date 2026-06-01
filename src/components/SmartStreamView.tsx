import { useEffect, useMemo, useRef, useState } from "react";
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
  Sparkles,
  Wand2,
  Cloud,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { rpcCall, getApiBaseUrl, type BackendDevice } from "@/lib/device-api";
import { getAuthToken } from "@/lib/auth";
import { PanelStatusView, type PanelLoadStatus } from "@/components/PanelStatus";
import { subscribeDeviceWs } from "@/lib/device-ws";

export type PushType = "srt" | "rtsp" | "rtmp";
export type AiTaskType = "ai_enhance" | "smart_hd" | "cloud_record";
export type TaskType = PushType | AiTaskType;

const PUSH_TYPES: PushType[] = ["srt", "rtsp", "rtmp"];
const AI_TYPES: AiTaskType[] = ["ai_enhance", "smart_hd", "cloud_record"];
const isPushType = (t: TaskType): t is PushType => (PUSH_TYPES as string[]).includes(t);

interface PushSlot {
  type: TaskType;
  url: string;
  latencyMs?: number;
}

/** Raw slot record returned by /api/ubserv_streams */
interface ServerStream {
  id: number;       // 1-based slot index
  type: string;     // e.g. "RTSP_PUSH", "SRT_PUSH", "RTMP_PUSH"
  push_url: string;
  magic: string;
}

/** Task real-time progress pushed via server_pub MQTT topic and exposed by HTTP. */
interface TaskProgressData {
  frame: number;
  fps: number;
  dropFrames: number;
  outTime: string;
  progress: string;
}

/** Device info returned by the ubverity activation server (offline fallback). */
interface UbverityDeviceInfo {
  sId?: string;
  sDeviceName?: string;
  sModel?: string;
  iGD116?: number;
  iPreview?: number;
  sFrpServer?: string;
  iFrpClientId?: number;
  sGTHost?: string;
  sGTPeer?: string;
  sGTPort?: string;
}

const SERVER_TYPE_MAP: Partial<Record<string, TaskType>> = {
  SRT_PUSH: "srt",
  RTSP_PUSH: "rtsp",
  RTMP_PUSH: "rtmp",
};

const PUSH_TYPE_TO_SERVER: Record<PushType, string> = {
  srt: "SRT_PUSH",
  rtsp: "RTSP_PUSH",
  rtmp: "RTMP_PUSH",
};

/** Deterministic 6-char hex magic derived from the push URL (djb2 variant). */
function urlToMagic(url: string): string {
  let h = 5381;
  for (let i = 0; i < url.length; i++) {
    h = (((h << 5) + h) ^ url.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, "0").slice(0, 6);
}

const SLOT_COUNT = 4;

const PUSH_META: Record<TaskType, { label: string; Icon: typeof Upload; placeholder: string }> = {
  srt: { label: "SRT Push", Icon: Upload, placeholder: "srt://host:port?streamid=xxx" },
  rtsp: { label: "RTSP Push", Icon: Upload, placeholder: "rtsp://host:port/path" },
  rtmp: { label: "RTMP Push", Icon: Upload, placeholder: "rtmp://host/app/stream" },
  ai_enhance: { label: "AI画质增强", Icon: Sparkles, placeholder: "" },
  smart_hd: { label: "智感高清", Icon: Wand2, placeholder: "" },
  cloud_record: { label: "云收录", Icon: Cloud, placeholder: "" },
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
  const mountedRef = useRef(true);
  const [pipelines, setPipelines] = useState<Record<string, Pipeline>>({});
  const [draft, setDraft] = useState<Pipeline>(emptyPipeline());
  const [dragType, setDragType] = useState<TaskType | null>(null);
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [editingUrl, setEditingUrl] = useState("");
  const [editingLatency, setEditingLatency] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [status, setStatus] = useState<PanelLoadStatus>("loading");
  const [saving, setSaving] = useState(false);
  const [smuxHost, setSmuxHost] = useState("");
  const [smuxPort, setSmuxPort] = useState(0);
  const [serverSlots, setServerSlots] = useState<ServerStream[]>([]);
  const [taskProgresses, setTaskProgresses] = useState<Record<string, TaskProgressData>>({});

  const device = useMemo(
    () => devices.find((d) => d.serialNo === selectedSn) ?? null,
    [devices, selectedSn],
  );

  // sGTPeer port is the SRT port; RTSP port = srtPort + 2000
  const srtPull = smuxHost && smuxPort ? `srt://${smuxHost}:${smuxPort}` : "—";
  const rtspPull = smuxHost && smuxPort ? `rtsp://${smuxHost}:${smuxPort + 2000}/main` : "—";

  const copyToClipboard = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1200);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Load draft and device info when device changes
  useEffect(() => {
    setDraft(pipelines[selectedSn] ?? emptyPipeline());
    setSelectedNode(null);
    setEditingSlot(null);
    setTaskProgresses({});
    if (!selectedSn) return;
    void loadDeviceInfo();
    void loadTaskProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSn, device?.online]);

  // Subscribe to WebSocket for real-time task progress updates
  useEffect(() => {
    if (!selectedSn) return;
    return subscribeDeviceWs(selectedSn, (msg) => {
      if (typeof msg.type === "string" && msg.type.startsWith("task_progress:")) {
        const key = msg.type.slice("task_progress:".length);
        if (msg.payload && typeof msg.payload === "object") {
          setTaskProgresses((prev) => ({ ...prev, [key]: msg.payload as TaskProgressData }));
        }
      }
    });
  }, [selectedSn]);

  async function loadTaskProgress() {
    if (!selectedSn) return;
    const token = getAuthToken();
    try {
      const resp = await fetch(
        `${getApiBaseUrl()}/api/devices/${encodeURIComponent(selectedSn)}/task-progress`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (resp.ok && mountedRef.current) {
        const data = (await resp.json()) as Record<string, TaskProgressData>;
        setTaskProgresses(data);
      }
    } catch {
      // ignore — status will be populated via WebSocket
    }
  }

  async function loadDeviceInfo() {
    if (!device) return;
    if (!device.online) {
      // Device is offline — try to get static config from ubverity activation server
      setStatus("loading");
      try {
        const token = getAuthToken();
        const resp = await fetch(
          `${getApiBaseUrl()}/api/devices/${encodeURIComponent(selectedSn)}/ubverity-info`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} },
        );
        if (!mountedRef.current) return;
        if (resp.ok) {
          const data = (await resp.json()) as UbverityDeviceInfo;
          const sGTHost = (data.sGTHost ?? "").trim();
          const parsedPort = parseInt(data.sGTPeer ?? "", 10);
          const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 0;
          setSmuxHost(sGTHost);
          setSmuxPort(port);
          setServerSlots([]);
          setPipelines((prev) => ({ ...prev, [selectedSn]: emptyPipeline() }));
          setDraft(emptyPipeline());
          setStatus("ready");
          return;
        }
      } catch {
        // fall through to error
      }
      if (!mountedRef.current) return;
      setStatus("error");
      return;
    }
    setStatus("loading");
    const reply = await rpcCall(selectedSn, "GET", "/system/deviceinfo");
    if (!mountedRef.current) return;
    if (reply?.status !== "ok" || !Array.isArray(reply.data)) {
      setStatus("error");
      return;
    }
    const items = reply.data as { name: string; value: unknown }[];
    const get = (n: string) => (items.find((i) => i.name === n)?.value as string) ?? "";
    const sGTHost = get("sGTHost").trim();
    const sGTPeer = get("sGTPeer").trim();
    // sGTPeer is a plain port number (e.g. 15001)
    const parsedPort = parseInt(sGTPeer, 10);
    const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 0;
    setSmuxHost(sGTHost);
    setSmuxPort(port);

    // Fetch slot configuration via backend proxy (avoids CORS)
    let streams: ServerStream[] = [];
    if (sGTHost && port > 0) {
      try {
        const token = getAuthToken();
        const proxyUrl = `${getApiBaseUrl()}/api/devices/${encodeURIComponent(selectedSn)}/ubserv-streams?host=${encodeURIComponent(sGTHost)}&port=${port + 4000}`;
        const resp = await fetch(proxyUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (resp.ok) {
          const data: unknown = await resp.json();
          if (Array.isArray(data)) streams = data as ServerStream[];
        }
      } catch {
        // network unreachable — leave slots empty
      }
    }
    if (!mountedRef.current) return;

    setServerSlots(streams);

    // Map server streams → pipeline slots
    const serverPipeline = emptyPipeline();
    for (const s of streams) {
      const idx = s.id - 1; // server id is 1-based
      if (idx < 0 || idx >= SLOT_COUNT) continue;
      const taskType = SERVER_TYPE_MAP[s.type];
      if (!taskType) continue;
      serverPipeline.slots[idx] = {
        type: taskType,
        url: s.push_url,
        ...(taskType === "srt" ? { latencyMs: 120 } : {}),
      };
    }
    // Treat server state as the saved baseline so dirty-check works correctly
    setPipelines((prev) => ({ ...prev, [selectedSn]: serverPipeline }));
    setDraft(serverPipeline);
    setStatus("ready");
  }

  const dirty = useMemo(() => {
    const saved = pipelines[selectedSn] ?? emptyPipeline();
    return JSON.stringify(saved.slots) !== JSON.stringify(draft.slots);
  }, [pipelines, selectedSn, draft]);

  const handleDrop = (idx: number) => {
    if (!dragType) return;
    const type = dragType;
    setHoverSlot(null);
    setDragType(null);
    if (isPushType(type)) {
      setEditingSlot(idx);
      setEditingUrl("");
      setEditingLatency(type === "srt" ? "120" : "");
      setDraft((prev) => {
        const next = { slots: [...prev.slots] };
        next.slots[idx] = { type, url: "", ...(type === "srt" ? { latencyMs: 120 } : {}) };
        return next;
      });
    } else {
      // AI task — no URL editing needed
      setDraft((prev) => {
        const next = { slots: [...prev.slots] };
        next.slots[idx] = { type, url: "" };
        return next;
      });
    }
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

  const handleApply = async () => {
    if (!selectedSn || !smuxHost || smuxPort <= 0) return;

    // Convert draft slots back to server format
    const body: ServerStream[] = [];
    for (let i = 0; i < draft.slots.length; i++) {
      const slot = draft.slots[i];
      if (!slot || !isPushType(slot.type)) continue;
      body.push({
        id: i + 1,
        type: PUSH_TYPE_TO_SERVER[slot.type],
        push_url: slot.url,
        magic: urlToMagic(slot.url),
      });
    }

    setSaving(true);
    try {
      const token = getAuthToken();
      const proxyUrl = `${getApiBaseUrl()}/api/devices/${encodeURIComponent(selectedSn)}/ubserv-streams?host=${encodeURIComponent(smuxHost)}&port=${smuxPort + 4000}`;
      const resp = await fetch(proxyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (resp.ok) {
        setPipelines((prev) => ({ ...prev, [selectedSn]: { slots: [...draft.slots] } }));
      }
    } catch {
      // network error — stay dirty so user can retry
    } finally {
      setSaving(false);
    }
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
            disabled={!dirty || saving}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            恢复
          </button>
          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-1 rounded-md border border-primary/60 bg-primary/15 px-2.5 py-1 text-[11px] text-primary hover:bg-primary/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Check className="h-3 w-3" />
            {saving ? "应用中…" : "应用"}
          </button>
        </div>
      </div>

      {/* Pipeline area */}
      <div className="relative flex-1 min-h-0 overflow-auto p-4 flex items-center justify-center">
        {/* Draggable task palette pinned to top-left — two columns */}
        {device && status === "ready" && <div className="absolute top-3 left-3 z-10 flex gap-3">
          {[
            { title: "推流任务", types: PUSH_TYPES as TaskType[] },
            { title: "AI 任务", types: AI_TYPES as TaskType[] },
          ].map((col) => (
            <div key={col.title} className="flex flex-col gap-1.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {col.title}
              </span>
              {col.types.map((t) => {
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
          ))}
        </div>}

        {!device ? (
          <div className="text-xs text-muted-foreground">
            请从左侧选择一个设备查看智流 pipeline
          </div>
        ) : (
          <PanelStatusView
            status={status}
            onRetry={() => void loadDeviceInfo()}
          >
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
              subtitle={smuxHost ? `${smuxHost}:${smuxPort}` : "—"}
              tone="server"
              active={selectedNode === "smux"}
              onClick={() => setSelectedNode("smux")}
            />

            {/* Branch connector + outputs */}
            <BranchConnector count={2 + SLOT_COUNT} />

            <div className="flex flex-col gap-2">
              {/* Fixed: SRT Server */}
              <div className="flex items-center gap-2">
                <FixedNode
                  icon={<Video className="h-4 w-4" />}
                  title="SRT Server"
                  detail={srtPull}
                  copied={copiedKey === "srt-server"}
                  onClick={() => {
                    setSelectedNode("srt-server");
                    copyToClipboard("srt-server", srtPull);
                  }}
                />
                <TaskStatusTag
                  prog={taskProgresses["loopback"]}
                  running={taskProgresses["loopback"]?.progress === "continue"}
                />
              </div>
              {/* Fixed: RTSP Server */}
              <div className="flex items-center gap-2">
                <FixedNode
                  icon={<Video className="h-4 w-4" />}
                  title="RTSP Server"
                  detail={rtspPull}
                  copied={copiedKey === "rtsp-server"}
                  onClick={() => {
                    setSelectedNode("rtsp-server");
                    copyToClipboard("rtsp-server", rtspPull);
                  }}
                />
                <TaskStatusTag
                  prog={taskProgresses["loopback"]}
                  running={taskProgresses["loopback"]?.progress === "continue"}
                />
              </div>


              {/* Editable slots */}
              {draft.slots.map((slot, i) => {
                const isHover = hoverSlot === i;
                const isEditing = editingSlot === i;
                if (slot) {
                  const { Icon, label } = PUSH_META[slot.type];
                  const slotKey = String(i + 1);
                  const prog = taskProgresses[slotKey];
                  const running = !!prog && prog.progress === "continue";
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <div
                        className={cn(
                          "group flex items-center justify-between gap-2 rounded-md border-2 bg-card/60 px-3 py-2 min-w-[260px] transition-colors flex-1",
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
                            {!isPushType(slot.type) ? (
                              <div className="text-[11px] text-muted-foreground italic">已启用</div>
                            ) : isEditing ? (
                              <div className="mt-1 space-y-1" onClick={(e) => e.stopPropagation()}>
                                <input
                                  autoFocus
                                  value={editingUrl}
                                  placeholder={PUSH_META[slot.type].placeholder}
                                  onChange={(e) => setEditingUrl(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && slot.type !== "srt") {
                                      e.preventDefault();
                                      commitEdit();
                                    }
                                    if (e.key === "Escape") {
                                      e.preventDefault();
                                      cancelEdit();
                                    }
                                  }}
                                  onBlur={slot.type === "srt" ? undefined : commitEdit}
                                  className="w-full rounded-sm border border-primary/50 bg-background px-1.5 py-0.5 text-[11px] outline-none"
                                />
                                {slot.type === "srt" && (
                                  <div className="flex items-center gap-1.5">
                                    <label className="text-[10px] text-muted-foreground shrink-0">延迟</label>
                                    <input
                                      type="number"
                                      min={0}
                                      value={editingLatency}
                                      placeholder="120"
                                      onChange={(e) => setEditingLatency(e.target.value)}
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
                                      onBlur={commitEdit}
                                      className="w-20 rounded-sm border border-primary/50 bg-background px-1.5 py-0.5 text-[11px] outline-none"
                                    />
                                    <span className="text-[10px] text-muted-foreground">ms</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="text-[11px] text-muted-foreground truncate text-left w-full hover:text-primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingSlot(i);
                                  setEditingUrl(slot.url);
                                  setEditingLatency(slot.latencyMs?.toString() ?? "120");
                                  setSelectedNode(`slot-${i}`);
                                }}
                                title="点击编辑推流地址"
                              >
                                {slot.url ? (
                                  <span className="font-mono">
                                    {slot.url}
                                    {slot.type === "srt" && slot.latencyMs != null && (
                                      <span className="ml-1 text-primary/80">· {slot.latencyMs}ms</span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="italic">未设置 · 点击编辑</span>
                                )}
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
                      <TaskStatusTag prog={prog} running={running} />
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
                    <span className="opacity-70">空槽 {i + 1} · 拖入任务</span>
                  </div>
                );
              })}
            </div>
          </div>
          </PanelStatusView>
        )}
      </div>
    </section>
  );
}

function TaskStatusTag({
  prog,
  running,
}: {
  prog?: TaskProgressData;
  running: boolean;
}) {
  if (!prog || !running) return null;

  return (
    <div
      className="shrink-0 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-mono text-emerald-400 min-w-[120px]"
      title="实时状态"
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-sans">运行中</span>
      </div>
      <div className="leading-tight">{prog.outTime.slice(0, 8)}</div>
      <div className="leading-tight">{prog.fps.toFixed(1)}fps · {prog.frame}帧</div>
      <div className="leading-tight">丢帧:{prog.dropFrames}</div>
    </div>
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
  copied,
  taskStatus,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  copied?: boolean;
  taskStatus?: TaskProgressData;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="点击复制拉流地址"
      className={cn(
        "flex items-center gap-2 rounded-md border-2 bg-card/60 px-3 py-2 min-w-[260px] text-left transition-colors",
        copied
          ? "border-primary bg-primary/15"
          : "border-primary/50 hover:border-primary",
      )}
    >
      <div className="text-primary shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-medium leading-tight">{title}</div>
        <div className="text-[11px] text-muted-foreground truncate font-mono">{detail}</div>
        {taskStatus && taskStatus.progress === "continue" && (
          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-emerald-400/90 font-mono">
            <span>{taskStatus.outTime.slice(0, 8)}</span>
            <span>{taskStatus.fps.toFixed(1)}fps</span>
            <span>{taskStatus.frame}帧</span>
            <span>丢帧:{taskStatus.dropFrames}</span>
          </div>
        )}
      </div>
      {copied ? (
        <Check className="h-3.5 w-3.5 text-primary shrink-0" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      )}
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
