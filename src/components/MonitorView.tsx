import { useEffect, useMemo, useRef, useState } from "react";
import { X, MonitorPlay } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchDeviceStatus, type BackendDevice, type BackendDeviceStatusData } from "@/lib/device-api";
import { getAuthToken } from "@/lib/auth";
import { cn } from "@/lib/utils";

const SLOT_COUNT = 8;
const POINTS = 30;
const CHART_COLOR = "var(--color-primary)";
const GRID_COLOR = "var(--color-grid-line)";

type Sample = { t: number; up: number; down: number };
type QualitySample = { t: number; rtt: number; loss: number };

function getWsBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL as string | undefined;
  const httpBase = (configured?.trim() || "http://127.0.0.1:18081").replace(/\/$/, "");
  if (httpBase.startsWith("https://")) return `wss://${httpBase.slice(8)}`;
  if (httpBase.startsWith("http://")) return `ws://${httpBase.slice(7)}`;
  return httpBase;
}

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

function MonitorTile({ device, onRemove }: { device: BackendDevice; onRemove: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<BackendDeviceStatusData | null>(null);
  const [onlineState, setOnlineState] = useState(device.online);
  const [series, setSeries] = useState<Sample[]>(() => makeInitialSeries());
  const [qualitySeries, setQualitySeries] = useState<QualitySample[]>(() => makeInitialQuality());
  const latestRef = useRef<{ up: number; down: number }>({ up: 0, down: 0 });
  const qualityRef = useRef<{ rtt: number; loss: number }>({ rtt: 0, loss: 0 });

  useEffect(() => {
    setOnlineState(device.online);
  }, [device.online]);

  // Poll status
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
    const id = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [device.serialNo]);

  // WS for network
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    const ws = new WebSocket(
      `${getWsBaseUrl()}/api/ws/devices/${encodeURIComponent(device.serialNo)}?token=${encodeURIComponent(token)}`,
    );
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as { type?: string; payload?: unknown; online?: boolean };
        if (typeof msg.online === "boolean") setOnlineState(msg.online);
        if (msg.type === "network") {
          latestRef.current = sumNetwork(msg.payload);
        }
      } catch {
        // ignore
      }
    };
    return () => ws.close();
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

  // Faux preview
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let frame = 0;
    const offline = !onlineState;
    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      if (offline) {
        ctx.fillStyle = "#0a0d12";
        ctx.fillRect(0, 0, w, h);
        const img = ctx.createImageData(w, h);
        for (let i = 0; i < img.data.length; i += 4) {
          const v = Math.random() * 60;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
          img.data[i + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#888";
        ctx.font = "600 14px ui-sans-serif, system-ui";
        ctx.textAlign = "center";
        ctx.fillText("NO SIGNAL", w / 2, h / 2);
      } else {
        const t = frame / 60;
        const grd = ctx.createLinearGradient(0, 0, w, h);
        grd.addColorStop(0, `hsl(${(t * 30) % 360}, 60%, 18%)`);
        grd.addColorStop(0.5, `hsl(${(t * 30 + 60) % 360}, 70%, 28%)`);
        grd.addColorStop(1, `hsl(${(t * 30 + 180) % 360}, 60%, 14%)`);
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
      }
      frame++;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [onlineState]);

  const last = series[series.length - 1] ?? { up: 0, down: 0 };

  const videoCodec = status?.sVideoCodec?.sCodec || "--";
  const audioCodec = status?.sAudioCodec?.sCodec || "--";
  const resolution =
    status?.sVideoCodec?.sResolution ||
    status?.sVideoParams?.sResolution ||
    (status?.sVideoCodec?.iWidth && status?.sVideoCodec?.iHeight
      ? `${status.sVideoCodec.iWidth}×${status.sVideoCodec.iHeight}`
      : "--");
  const fps = status?.sVideoCodec?.iFPS || status?.sVideoParams?.iFPS || 0;
  const actBitrate = status?.sVideoCodec?.sActBitrate || status?.sVideoCodec?.sBitrate || "--";
  const videoSource = status?.sVideoParams?.sDevice || "--";
  const audioSource = status?.sAudioParams?.sDevice || "--";
  const streamUrl = status?.sMuxer?.sURL || "--";

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
        <div className="relative bg-black border-r border-border min-h-0 overflow-hidden">
          <canvas ref={canvasRef} width={480} height={270} className="h-full w-full object-cover" />
          <div className="absolute top-1 left-1 rounded-sm bg-black/60 px-1 py-0.5 text-[9px] font-mono">
            {resolution} · {fps > 0 ? `${fps}fps` : "--"}
          </div>
          <div className="absolute bottom-1 right-1 rounded-sm bg-black/60 px-1 py-0.5 text-[9px] font-mono text-primary">
            {actBitrate}
          </div>
        </div>

        {/* Params */}
        <div className="overflow-y-auto border-r border-border text-[10px] divide-y divide-border min-h-0">
          <ParamRow k="视频源" v={videoSource} />
          <ParamRow k="视频编码" v={videoCodec} />
          <ParamRow k="分辨率" v={resolution} />
          <ParamRow k="帧率" v={fps > 0 ? `${fps} fps` : "--"} />
          <ParamRow k="码率" v={actBitrate} highlight />
          <ParamRow k="音频源" v={audioSource} />
          <ParamRow k="音频编码" v={audioCodec} />
          <ParamRow k="推流" v={streamUrl} mono />
        </div>

        {/* Network chart */}
        <div className="flex flex-col min-h-0">
          <div className="px-2 py-1 border-b border-border flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">网络</span>
            <span className="font-mono tabular-nums text-primary">
              ↑{last.up.toFixed(1)}
              <span className="text-muted-foreground">/</span>↓{last.down.toFixed(1)}
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
                <YAxis width={24} tick={{ fill: "var(--color-muted-foreground)", fontSize: 8 }} tickLine={false} axisLine={{ stroke: GRID_COLOR }} domain={[0, "auto"]} />
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
  );
}

function ParamRow({ k, v, mono, highlight }: { k: string; v: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-start gap-1.5 px-1.5 py-0.5">
      <span className="w-12 shrink-0 text-muted-foreground">{k}</span>
      <span className={cn("flex-1 break-all", mono && "font-mono text-[9px]", highlight && "text-primary font-medium")}>
        {v}
      </span>
    </div>
  );
}
