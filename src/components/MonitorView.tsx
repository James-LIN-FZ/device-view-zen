import { useEffect, useMemo, useRef, useState } from "react";
import { X, MonitorPlay, RefreshCw, Play } from "lucide-react";
import { Area, AreaChart, Customized, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchDeviceStatus, type BackendDevice, type BackendDeviceStatusData } from "@/lib/device-api";
import { subscribeDeviceWs } from "@/lib/device-ws";
import { cn } from "@/lib/utils";
import { AudioLoudnessMeter } from "@/components/AudioLoudnessMeter";


const SLOT_COUNT = 8;
const POINTS = 30;
const CHART_COLOR = "var(--color-primary)";
const GRID_COLOR = "rgba(120, 120, 140, 0.3)";

type Sample = { t: number; up: number; down: number };
type QualitySample = { t: number; rtt: number; loss: number };

function asNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function parseSpeedKbps(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const m = v.trim().match(/([\d.]+)\s*(b|kb|mb|gb)?ps/i);
  if (!m) return null;
  const num = Number(m[1]);
  if (!Number.isFinite(num)) return null;
  const unit = (m[2] || "kb").toLowerCase();
  if (unit === "b") return num / 1000;
  if (unit === "mb") return num * 1000;
  if (unit === "gb") return num * 1_000_000;
  return num;
}

function toKbps(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 0;
  if (v > 1_000_000) return v / 1000;
  return v;
}

function sumNetwork(payload: unknown): { up: number; down: number } {
  let list: unknown[] = [];
  if (Array.isArray(payload)) list = payload;
  else if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    const nested = obj.nics || obj.list || obj.data || obj.items;
    if (Array.isArray(nested)) list = nested;
    else list = Object.values(obj);
  }
  let up = 0;
  let down = 0;
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const stats = (row.statistics && typeof row.statistics === "object" ? row.statistics : row) as Record<string, unknown>;
    const upText = parseSpeedKbps(stats.sTxSpeed);
    const downText = parseSpeedKbps(stats.sRxSpeed);
    const upNum = ["iTxSpeed", "tx", "upload", "iUp", "iTx", "txKbps", "fTx", "send"].reduce<number>(
      (acc, k) => acc || asNum(stats[k]),
      0,
    );
    const downNum = ["iRxSpeed", "rx", "download", "iDown", "iRx", "rxKbps", "fRx", "recv"].reduce<number>(
      (acc, k) => acc || asNum(stats[k]),
      0,
    );
    up += upText ?? toKbps(upNum);
    down += downText ?? toKbps(downNum);
  }
  return { up, down };
}

function makeInitialSeries(): Sample[] {
  const now = Date.now();
  return Array.from({ length: POINTS }, (_, i) => ({ t: now - (POINTS - i) * 1000, up: 0, down: 0 }));
}

function makeInitialQuality(): QualitySample[] {
  const now = Date.now();
  return Array.from({ length: POINTS }, (_, i) => ({ t: now - (POINTS - i) * 1000, rtt: 0, loss: 0 }));
}

function isNoSignal(status: BackendDeviceStatusData | null | undefined): boolean {
  if (!status) return true;
  const codecRes = (status.sVideoCodec?.sResolution || "").trim().toLowerCase();
  const paramsRes = (status.sVideoParams?.sResolution || "").trim().toLowerCase();
  const resolutionText = `${codecRes} ${paramsRes}`;
  if (resolutionText.includes("nosignal") || resolutionText.includes("no signal")) {
    return true;
  }
  const width = status.sVideoCodec?.iWidth || status.sVideoParams?.iWidth || 0;
  const height = status.sVideoCodec?.iHeight || status.sVideoParams?.iHeight || 0;
  return width <= 0 || height <= 0;
}

function getPreviewBaseUrl(streamUrl: string): string | null {
  if (!streamUrl || streamUrl === "--") return null;
  try {
    const parsed = new URL(streamUrl);
    if (parsed.protocol.toLowerCase() !== "srt:") return null;
    const srtPort = Number(parsed.port);
    if (!Number.isFinite(srtPort) || srtPort < 15000 || srtPort > 15099) return null;
    const previewPort = 19000 + (srtPort - 15000);
    return `http://${parsed.hostname}:${previewPort}/api/frame.jpeg?src=main`;
  } catch {
    return null;
  }
}

function getWebrtcBaseUrl(streamUrl: string): string | null {
  if (!streamUrl || streamUrl === "--") return null;
  try {
    const parsed = new URL(streamUrl);
    if (parsed.protocol.toLowerCase() !== "srt:") return null;
    const srtPort = Number(parsed.port);
    if (!Number.isFinite(srtPort) || srtPort < 15000 || srtPort > 15099) return null;
    const webrtcPort = 19000 + (srtPort - 15000);
    return `http://${parsed.hostname}:${webrtcPort}/stream.html?src=240p`;
  } catch {
    return null;
  }
}

export function MonitorView({ devices }: { devices: BackendDevice[] }) {
  const [slots, setSlots] = useState<(string | null)[]>(() => Array(SLOT_COUNT).fill(null));
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);

  const deviceMap = useMemo(() => {
    const map = new Map<string, BackendDevice>();
    devices.forEach((d) => map.set(d.serialNo, d));
    return map;
  }, [devices]);

  const handleDrop = (index: number, e: React.DragEvent) => {
    e.preventDefault();
    const sn = e.dataTransfer.getData("application/x-device-sn") || e.dataTransfer.getData("text/plain");
    if (!sn) return;
    setSlots((prev) => {
      const next = [...prev];
      // If already placed elsewhere, remove from old slot
      const oldIdx = next.indexOf(sn);
      if (oldIdx >= 0) next[oldIdx] = null;
      next[index] = sn;
      return next;
    });
    setHoverSlot(null);
  };

  return (
    <section className="panel flex flex-col h-full overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MonitorPlay className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-wide">监看面板</h2>
        </div>
        <span className="text-[11px] text-muted-foreground">
          从左侧设备列表拖拽设备到监看位 · {slots.filter(Boolean).length} / {SLOT_COUNT}
        </span>
      </div>
      <div className="flex-1 grid grid-cols-2 grid-rows-4 gap-2 p-2 min-h-0">
        {slots.map((sn, i) => {
          const device = sn ? deviceMap.get(sn) ?? null : null;
          return (
            <div
              key={i}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                if (hoverSlot !== i) setHoverSlot(i);
              }}
              onDragLeave={() => setHoverSlot((s) => (s === i ? null : s))}
              onDrop={(e) => handleDrop(i, e)}
              className={cn(
                "rounded-md border bg-card/40 min-h-0 overflow-hidden flex flex-col transition-colors",
                hoverSlot === i
                  ? "border-primary bg-primary/10"
                  : device
                  ? "border-border"
                  : "border-dashed border-border/70",
              )}
            >
              {device ? (
                <MonitorTile
                  device={device}
                  onRemove={() =>
                    setSlots((prev) => {
                      const next = [...prev];
                      next[i] = null;
                      return next;
                    })
                  }
                />
              ) : sn ? (
                <EmptyTile label={`未知设备 ${sn}`} />
              ) : (
                <EmptyTile label={`监看位 ${i + 1}`} hint="拖拽设备到此处" />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EmptyTile({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-1 text-muted-foreground">
      <MonitorPlay className="h-5 w-5 opacity-50" />
      <div className="text-xs">{label}</div>
      {hint ? <div className="text-[10px] opacity-70">{hint}</div> : null}
    </div>
  );
}

function GridLines(props: Record<string, unknown>) {
  const offset = props.offset as { top: number; left: number; width: number; height: number } | undefined;
  if (!offset || offset.width <= 0 || offset.height <= 0) return null;
  const { top, left, width, height } = offset;
  return (
    <g stroke={GRID_COLOR} strokeWidth={0.6}>
      <line x1={left} x2={left + width} y1={top + height / 3} y2={top + height / 3} />
      <line x1={left} x2={left + width} y1={top + (height * 2) / 3} y2={top + (height * 2) / 3} />
      {[1, 2, 3, 4].map((i) => (
        <line key={i} x1={left + (width * i) / 5} x2={left + (width * i) / 5} y1={top} y2={top + height} />
      ))}
    </g>
  );
}

function MonitorTile({ device, onRemove }: { device: BackendDevice; onRemove: () => void }) {
  const fallbackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<BackendDeviceStatusData | null>(null);
  const [onlineState, setOnlineState] = useState(device.online);
  const [webrtcOpen, setWebrtcOpen] = useState(false);
  const [previewNonce, setPreviewNonce] = useState(0);
  const [previewLoadFailed, setPreviewLoadFailed] = useState(false);
  const [webrtcNonce, setWebrtcNonce] = useState(0);
  const [series, setSeries] = useState<Sample[]>(() => makeInitialSeries());
  const [qualitySeries, setQualitySeries] = useState<QualitySample[]>(() => makeInitialQuality());
  const latestRef = useRef<{ up: number; down: number }>({ up: 0, down: 0 });
  const qualityRef = useRef<{ rtt: number; loss: number }>({ rtt: 0, loss: 0 });

  useEffect(() => {
    setOnlineState(device.online);
  }, [device.online]);

  // Status fetch + WS (codec/presence events trigger immediate re-fetch; 5s poll as fallback)
  useEffect(() => {
    let active = true;
    const load = () => {
      fetchDeviceStatus(device.serialNo)
        .then((s) => {
          if (active) {
            setStatus(s);
            const srt = s?.sMuxer?.sSrt;
            qualityRef.current = {
              rtt: Number(srt?.iMsRTT) || 0,
              loss: Number(srt?.iPktLoss) || 0,
            };
          }
        })
        .catch(() => {});
    };
    load();
    const pollId = setInterval(load, 5000);
    const unsubscribe = subscribeDeviceWs(device.serialNo, (msg) => {
      if (typeof msg.online === "boolean") setOnlineState(msg.online);
      if (msg.type === "network") latestRef.current = sumNetwork(msg.payload);
      if (msg.type === "codec" || msg.type === "presence") load();
    });
    return () => {
      active = false;
      clearInterval(pollId);
      unsubscribe();
    };
  }, [device.serialNo]);

  // Sampler
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setSeries((prev) => {
        const next = prev.slice(1);
        const { up, down } = onlineState ? latestRef.current : { up: 0, down: 0 };
        next.push({ t: now, up: +up.toFixed(2), down: +down.toFixed(2) });
        return next;
      });
      setQualitySeries((prev) => {
        const next = prev.slice(1);
        const { rtt, loss } = onlineState ? qualityRef.current : { rtt: 0, loss: 0 };
        next.push({ t: now, rtt: +rtt.toFixed(1), loss: +loss.toFixed(2) });
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [onlineState]);

  const streamUrl = status?.sMuxer?.sURL || "--";
  const noSignal = onlineState ? isNoSignal(status) : true;
  const previewBaseUrl = useMemo(() => getPreviewBaseUrl(streamUrl), [streamUrl]);
  const webrtcBaseUrl = useMemo(() => getWebrtcBaseUrl(streamUrl), [streamUrl]);
  const canShowPreview = onlineState && !noSignal && !!previewBaseUrl;
  const canPlayWebrtc = canShowPreview && !previewLoadFailed && !!webrtcBaseUrl;
  const previewSrc = useMemo(() => {
    if (!canShowPreview || !previewBaseUrl) return "";
    return `${previewBaseUrl}&_r=${previewNonce}`;
  }, [canShowPreview, previewBaseUrl, previewNonce]);
  const webrtcSrc = useMemo(() => {
    if (!canPlayWebrtc || !webrtcBaseUrl) return "";
    const sep = webrtcBaseUrl.includes("?") ? "&" : "?";
    return `${webrtcBaseUrl}${sep}_r=${webrtcNonce}`;
  }, [canPlayWebrtc, webrtcBaseUrl, webrtcNonce]);

  useEffect(() => {
    setPreviewLoadFailed(false);
    setPreviewNonce((v) => v + 1);
    setWebrtcOpen(false);
    setWebrtcNonce(0);
  }, [previewBaseUrl, onlineState, noSignal]);

  // Draw a 360p RGB fallback frame for offline / no-signal states.
  useEffect(() => {
    if (canShowPreview && !previewLoadFailed) return;
    const canvas = fallbackCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = 640;
    const h = 360;
    canvas.width = w;
    canvas.height = h;

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#330000");
    grad.addColorStop(0.33, "#003300");
    grad.addColorStop(0.66, "#001033");
    grad.addColorStop(1, "#220022");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    for (let x = 0; x < w; x += 24) {
      const r = (x / w) * 255;
      const g = ((w - x) / w) * 255;
      const b = ((x % 120) / 120) * 255;
      ctx.fillStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, 0.18)`;
      ctx.fillRect(x, 0, 12, h);
    }

    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    for (let y = 0; y < h; y += 3) {
      ctx.fillRect(0, y, w, 1);
    }

    const label = onlineState ? "No Signal" : "Device Offline";
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#f3f6ff";
    ctx.font = "600 30px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, w / 2, h / 2);
  }, [canShowPreview, previewLoadFailed, onlineState]);

  const last = series[series.length - 1] ?? { up: 0, down: 0 };
  const lastQ = qualitySeries[qualitySeries.length - 1] ?? { rtt: 0, loss: 0 };

  const videoCodec = status?.sVideoCodec?.sCodec || "--";
  const audioCodec = status?.sAudioCodec?.sCodec || "--";
  const resolution =
    status?.sVideoCodec?.sResolution ||
    status?.sVideoParams?.sResolution ||
    (status?.sVideoCodec?.iWidth && status?.sVideoCodec?.iHeight
      ? `${status.sVideoCodec.iWidth}×${status.sVideoCodec.iHeight}`
      : "--");
  const fps = status?.sVideoCodec?.iActFPS || status?.sVideoCodec?.iFPS || status?.sVideoParams?.iFPS || 0;
  const actBitrate = status?.sVideoCodec?.sActBitrate || status?.sVideoCodec?.sBitrate || "--";
  const videoSource = status?.sVideoParams?.sDevice || "--";
  

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-border bg-card/30">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full shrink-0",
              onlineState ? "bg-[var(--color-success)]" : "bg-muted-foreground",
            )}
          />
          <span className="text-[11px] font-medium truncate">{device.name?.trim() || "未命名设备"}</span>
          <span className="text-[10px] text-muted-foreground truncate">· {device.serialNo}</span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive p-0.5"
          title="移除"
          aria-label="移除"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Body: preview left, params + chart right */}
      <div className="flex-1 grid grid-cols-[40%_30%_30%] min-h-0">
        {/* Preview */}
        <div className="group relative bg-black border-r border-border min-h-0 overflow-hidden">
          {webrtcOpen ? (
            <>
              <iframe
                src={webrtcSrc}
                className="absolute inset-0 h-full w-full border-0"
                allow="autoplay; camera; microphone"
                title="WebRTC 监看"
                scrolling="no"
              />
              <div className="absolute top-1.5 right-1.5 z-20 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => setWebrtcNonce((v) => v + 1)}
                  className="inline-flex items-center justify-center rounded-sm border border-border/60 bg-black/70 p-1 text-muted-foreground hover:text-foreground transition"
                  title="刷新播放"
                  aria-label="刷新播放"
                >
                  <RefreshCw className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setWebrtcOpen(false)}
                  className="inline-flex items-center justify-center rounded-sm border border-border/60 bg-black/70 p-1 text-muted-foreground hover:text-foreground transition"
                  title="关闭预览"
                  aria-label="关闭预览"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </>
          ) : (
            <>
              {canShowPreview && !previewLoadFailed ? (
                <img
                  src={previewSrc}
                  alt="设备预览图"
                  className="h-full w-full object-cover"
                  onError={() => setPreviewLoadFailed(true)}
                />
              ) : (
                <canvas ref={fallbackCanvasRef} width={640} height={360} className="h-full w-full object-cover" />
              )}
              {canPlayWebrtc ? (
                <button
                  type="button"
                  onClick={() => setWebrtcOpen(true)}
                  className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:pointer-events-auto group-hover:bg-black/20 group-hover:opacity-100"
                  title={`播放 WebRTC：${webrtcBaseUrl}`}
                >
                  <span className="inline-flex items-center justify-center rounded-full border border-primary/70 bg-black/65 p-2 text-primary shadow-sm">
                    <Play className="h-4 w-4" />
                  </span>
                </button>
              ) : null}
              {canShowPreview ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewLoadFailed(false);
                    setPreviewNonce((v) => v + 1);
                  }}
                  className="absolute top-1.5 right-1.5 z-20 inline-flex items-center justify-center rounded-sm border border-border/60 bg-black/70 p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-foreground"
                  title="刷新预览图"
                  aria-label="刷新预览图"
                >
                  <RefreshCw className="h-3 w-3" />
                </button>
              ) : null}
            </>
          )}
          {/* OBS-style audio loudness meter overlay */}
          <div className="pointer-events-none absolute inset-y-0 right-0 z-30">
            <AudioLoudnessMeter active={canShowPreview} />
          </div>
        </div>


        {/* Params */}
        <div className="overflow-y-auto border-r border-border text-[10px] divide-y divide-border min-h-0">
          <ParamRow k="视频源" v={videoSource} />
          <ParamRow k="视频编码" v={videoCodec} />
          <ParamRow k="音频编码" v={audioCodec} />
          <ParamRow k="编码分辨率" v={resolution} />
          <ParamRow k="实时码率" v={actBitrate} highlight />
          <ParamRow k="实时帧率" v={fps > 0 ? `${fps} fps` : "--"} highlight />
        </div>

        {/* Charts: quality (top) + network (bottom) */}
        <div className="flex flex-col min-h-0">
          {/* Quality chart */}
          <div className="flex flex-col min-h-0 flex-1 border-b border-border">
            <div className="px-2 py-1 border-b border-border flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">传输质量</span>
              <span className="font-mono tabular-nums text-primary">
                RTT {lastQ.rtt.toFixed(0)}ms
                <span className="text-muted-foreground"> · </span>
                丢包 {lastQ.loss.toFixed(0)}
              </span>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={qualitySeries} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`m-q-${device.serialNo}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-warning, #f59e0b)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--color-warning, #f59e0b)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" hide />
                  <YAxis width={0} tick={false} tickLine={false} axisLine={false} domain={[0, "auto"]} />
                  <Customized component={GridLines} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 6,
                      fontSize: 10,
                    }}
                    labelFormatter={(v) => new Date(v as number).toLocaleTimeString()}
                    formatter={(v: number, name) => [name === "rtt" ? `${v} ms` : `${v}`, name === "rtt" ? "RTT" : "丢包"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="loss"
                    stroke="var(--color-destructive)"
                    strokeDasharray="3 3"
                    strokeOpacity={0.6}
                    strokeWidth={1.2}
                    fill={`url(#m-q-${device.serialNo})`}
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="rtt"
                    stroke="var(--color-warning, #f59e0b)"
                    strokeWidth={1}
                    fill={`url(#m-q-${device.serialNo})`}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Network chart */}
          <div className="flex flex-col min-h-0 flex-1">
            <div className="px-2 py-1 border-b border-border flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">网络</span>
              <span className="font-mono tabular-nums text-primary">
                ↑  {last.up.toFixed(1) } kbps
                <span className="text-muted-foreground">/</span>↓  {last.down.toFixed(1)} kbps
              </span>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`m-g-${device.serialNo}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLOR} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={CHART_COLOR} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" hide />
                  <YAxis width={0} tick={false} tickLine={false} axisLine={false} domain={[0, "auto"]} />
                  <Customized component={GridLines} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 6,
                      fontSize: 10,
                    }}
                    labelFormatter={(v) => new Date(v as number).toLocaleTimeString()}
                    formatter={(v: number, name) => [`${v} kbps`, name === "up" ? "上行" : "下行"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="down"
                    stroke={CHART_COLOR}
                    strokeDasharray="3 3"
                    strokeOpacity={0.6}
                    strokeWidth={1.2}
                    fill={`url(#m-g-${device.serialNo})`}
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="up"
                    stroke={CHART_COLOR}
                    strokeWidth={1}
                    fill={`url(#m-g-${device.serialNo})`}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ParamRow({ k, v, mono, highlight }: { k: string; v: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-start gap-1.5 px-1.5 py-0.5">
      <span className="w-14 shrink-0 text-muted-foreground">{k}</span>
      <span className={cn("flex-1 break-all", mono && "font-mono text-[9px]", highlight && "text-primary font-medium")}>
        {v}
      </span>
    </div>
  );
}
