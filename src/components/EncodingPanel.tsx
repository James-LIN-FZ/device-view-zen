import { useEffect, useRef, useState } from "react";
import { Activity, Video, Settings2, Save, Play, Square, RefreshCw } from "lucide-react";
import type { BackendDeviceStatusData } from "@/lib/device-api";

const ENCODE_TASKS = [
  "直播推流 - 主任务",
  "录制存档 - 本地",
  "低延迟回传",
  "多码率转码",
  "应急备播",
];

type EncodingForm = {
  videoSource: string;
  videoCodec: string;
  audioCodec: string;
  bitrate: string;
  framerate: string;
  resolution: string;
  streamUrl: string;
};

const EMPTY_FORM: EncodingForm = {
  videoSource: "--",
  videoCodec: "--",
  audioCodec: "--",
  bitrate: "--",
  framerate: "--",
  resolution: "--",
  streamUrl: "--",
};

function normalizeVideoSource(value?: string): string {
  if (!value) return "--";
  const upper = value.toUpperCase();
  if (upper.includes("HDMI")) return "HDMI-1";
  if (upper.includes("SDI")) return "SDI-1";
  if (upper.includes("USB")) return "USB";
  if (upper.includes("NDI")) return "NDI";
  return value;
}

function normalizeVideoCodec(value?: string): string {
  if (!value) return "--";
  const upper = value.toUpperCase();
  if (upper.includes("H264")) return "H.264 / AVC";
  if (upper.includes("H265")) return "H.265 / HEVC";
  if (upper.includes("AV1")) return "AV1";
  return value;
}

function normalizeAudioCodec(value?: string): string {
  if (!value) return "--";
  const upper = value.toUpperCase();
  if (upper.includes("AAC")) return "AAC-LC 48kHz";
  if (upper.includes("OPUS")) return "Opus 48kHz";
  if (upper.includes("MP3")) return "MP3 44.1kHz";
  return value;
}

function normalizeResolution(status: BackendDeviceStatusData | null | undefined): string {
  if (!status) return "--";
  const raw = status.sVideoCodec?.sResolution || status.sVideoParams?.sResolution || "--";
  const width = status.sVideoCodec?.iWidth || status.sVideoParams?.iWidth || 0;
  const height = status.sVideoCodec?.iHeight || status.sVideoParams?.iHeight || 0;
  if (width > 0 && height > 0) {
    return `${width} × ${height}`;
  }
  if (raw.toLowerCase() === "nosignal" || raw.toLowerCase() === "no signal") {
    return "—";
  }
  if (raw.includes("1080")) return "1920 × 1080";
  if (raw.includes("720")) return "1280 × 720";
  if (raw.includes("2160") || raw.includes("4k")) return "3840 × 2160";
  return raw || "--";
}

function normalizeFramerate(status: BackendDeviceStatusData | null | undefined): string {
  if (!status) return "--";
  const fps = status.sVideoCodec?.iFPS || status.sVideoParams?.iFPS || 0;
  if (fps > 0) return `${fps} fps`;
  const raw = status.sVideoCodec?.sResolution || status.sVideoParams?.sResolution || "";
  const match = raw.match(/(\d{2,3})p(\d{2})/i);
  if (match) return `${match[2]} fps`;
  return "--";
}

function parseVideoBitrate(status: BackendDeviceStatusData | null | undefined): number {
  if (!status) return 0;
  if ((status.sVideoCodec?.iBitrate || 0) > 0) {
    return Math.max(1, Math.round((status.sVideoCodec?.iBitrate || 0) / 1_000_000));
  }
  const raw = status.sVideoCodec?.sBitrate || status.sVideoCodec?.sActBitrate || "";
  const match = raw.match(/([\d.]+)\s*(k|m|g)?bps/i);
  if (!match) return 0;
  const value = Number(match[1]);
  const unit = (match[2] || "m").toLowerCase();
  if (Number.isNaN(value)) return 0;
  if (unit === "k") return Math.max(1, Math.round(value / 1000));
  if (unit === "g") return Math.max(1, Math.round(value * 1000));
  return Math.max(1, Math.round(value));
}

function buildForm(status: BackendDeviceStatusData | null | undefined): EncodingForm {
  if (!status) return EMPTY_FORM;
  return {
    videoSource: `${normalizeVideoSource(status.sVideoParams?.sDevice)}${status.sVideoParams?.sResolution ? ` (${status.sVideoParams.sResolution})` : ""}`,
    videoCodec: normalizeVideoCodec(status.sVideoCodec?.sCodec),
    audioCodec: normalizeAudioCodec(status.sAudioCodec?.sCodec),
    bitrate: status.sVideoCodec?.sBitrate || status.sVideoCodec?.sActBitrate || "--",
    framerate: normalizeFramerate(status),
    resolution: normalizeResolution(status),
    streamUrl: status.sMuxer?.sURL || "--",
  };
}

export function EncodingPanel({
  deviceName,
  online,
  status,
}: {
  deviceName: string;
  online: boolean;
  status: BackendDeviceStatusData | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [form, setForm] = useState<EncodingForm>(() => buildForm(status));
  const [bitrateNum, setBitrateNum] = useState(() => parseVideoBitrate(status) || 8);
  const [latency, setLatency] = useState(500);
  const [task, setTask] = useState(ENCODE_TASKS[0]);
  const [running, setRunning] = useState(false);
  const [localRecordingEnabled, setLocalRecordingEnabled] = useState(false);
  const [dirty, setDirty] = useState(false);

  const resetEditPanel = () => {
    setLatency(500);
    setBitrateNum(parseVideoBitrate(status) || 8);
    setTask(ENCODE_TASKS[0]);
    setRunning(false);
    setLocalRecordingEnabled(false);
    setDirty(false);
  };

  useEffect(() => {
    setForm(buildForm(status));
    setBitrateNum(parseVideoBitrate(status) || 8);
    setDirty(false);
  }, [status]);

  // Faux live preview
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let frame = 0;
    const offline = !online;

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
        ctx.font = "600 18px ui-sans-serif, system-ui";
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
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = `rgba(255,255,255,${0.04 + (i % 2) * 0.03})`;
          const x = ((t * 40 + i * 90) % (w + 120)) - 60;
          ctx.fillRect(x, 0, 30, h);
        }
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(w / 2, h / 2 - 14);
        ctx.lineTo(w / 2, h / 2 + 14);
        ctx.moveTo(w / 2 - 14, h / 2);
        ctx.lineTo(w / 2 + 14, h / 2);
        ctx.stroke();
      }
      frame++;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [online, deviceName]);

  const live = online;
  const realtimeBitrate = status?.sVideoCodec?.sActBitrate || "--";
  const realtimeFramerate = status?.sVideoCodec?.iActBitrate != null
    ? String(status.sVideoCodec.iActBitrate)
    : "--";
  const audioSource = status?.sAudioParams?.sDevice || "--";
  const localRecording = "--";

  return (
    <section className="panel flex flex-col h-full overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between bg-card/30">
        <div className="flex items-center gap-2">
          <Video className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-xs font-semibold tracking-wide uppercase">编码状态</h3>
          <span className="text-[11px] text-muted-foreground">· {deviceName}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className={`status-dot inline-block h-1.5 w-1.5 rounded-full ${live ? "bg-destructive" : "bg-muted-foreground"}`} />
            <span className={live ? "text-destructive font-medium" : "text-muted-foreground"}>
              {live ? "LIVE" : "OFFLINE"}
            </span>
          </span>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-7 gap-2 p-2 min-h-0">
        {/* Preview */}
        <div className="lg:col-span-3 flex flex-col min-h-0">
          <div className="relative flex-1 min-h-0 rounded-sm overflow-hidden border border-border bg-black">
            <canvas ref={canvasRef} width={960} height={540} className="h-full w-full object-cover" />
            <div className="absolute top-1.5 left-1.5 flex items-center gap-1.5 rounded-sm bg-black/60 px-1.5 py-0.5 text-[10px] font-mono">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${live ? "bg-destructive" : "bg-muted-foreground"}`} />
              {live ? "REC" : "IDLE"} · {form.resolution} · {form.framerate}
            </div>
            <div className="absolute bottom-1.5 right-1.5 rounded-sm bg-black/60 px-1.5 py-0.5 text-[10px] font-mono text-primary">
              {form.videoCodec}
            </div>
          </div>
        </div>

        {/* Params (read-only display) */}
        <div className="lg:col-span-2 min-h-0 overflow-y-auto rounded-sm border border-border bg-card/40">
          <div className="px-2.5 py-1.5 border-b border-border flex items-center gap-1.5 bg-background/30">
            <Activity className="h-3 w-3 text-primary" />
            <span className="text-[11px] font-medium tracking-wide uppercase">参数详情</span>
          </div>
          <dl className="divide-y divide-border text-[11px]">
            <Row k="视频源" v={form.videoSource} />
            <Row k="视频编码" v={form.videoCodec} />
            <Row k="音频源" v={audioSource} />
            <Row k="音频编码" v={form.audioCodec} />
            <Row k="编码分辨率" v={form.resolution} />
            <Row k="实时码率" v={realtimeBitrate} highlight />
            <Row k="实时帧率" v={realtimeFramerate} highlight />
            <Row k="本地录制" v={localRecording} />
            <Row k="推流地址" v={form.streamUrl} mono />
          </dl>
        </div>

        {/* Edit Panel */}
        <div className="lg:col-span-2 min-h-0 overflow-y-auto rounded-sm border border-border bg-card/40 flex flex-col">
          <div className="px-2.5 py-1.5 border-b border-border flex items-center gap-1.5 bg-background/30">
            <Settings2 className="h-3 w-3 text-primary" />
            <span className="text-[11px] font-medium tracking-wide uppercase">参数修改</span>
            <div className="ml-auto flex items-center gap-1.5">
              {dirty && <span className="text-[10px] text-warning">未保存</span>}
              <button
                type="button"
                onClick={resetEditPanel}
                className="inline-flex items-center justify-center rounded-sm border border-border bg-secondary/30 p-1 text-muted-foreground hover:border-primary/50 hover:text-primary transition"
                title="刷新"
                aria-label="刷新"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            </div>
          </div>
          <div className="p-2.5 space-y-3 text-[11px]">
            <Field label="延迟设置 (ms)">
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={100}
                  max={5000}
                  step={50}
                  value={latency}
                  onChange={(e) => { setLatency(+e.target.value); setDirty(true); }}
                  className="flex-1 accent-[var(--color-primary)]"
                  disabled={!online}
                />
                <input
                  type="number"
                  min={100}
                  max={5000}
                  step={50}
                  value={latency}
                  onChange={(e) => { setLatency(+e.target.value); setDirty(true); }}
                  className="w-16 bg-input border border-border rounded-sm px-1.5 py-0.5 text-[11px] text-right focus:outline-none focus:border-primary"
                  disabled={!online}
                />
              </div>
            </Field>
            <Field label="码率 (Mbps)">
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={1}
                  max={50}
                  value={bitrateNum}
                  onChange={(e) => { setBitrateNum(+e.target.value); setDirty(true); }}
                  className="flex-1 accent-[var(--color-primary)]"
                  disabled={!online}
                />
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={bitrateNum}
                  onChange={(e) => { setBitrateNum(+e.target.value); setDirty(true); }}
                  className="w-16 bg-input border border-border rounded-sm px-1.5 py-0.5 text-[11px] text-right focus:outline-none focus:border-primary"
                  disabled={!online}
                />
              </div>
            </Field>
            <Field label="本地录制开关">
              <button
                type="button"
                onClick={() => { setLocalRecordingEnabled((v) => !v); setDirty(true); }}
                className={`w-full inline-flex items-center justify-between rounded-sm border px-2 py-1.5 text-[11px] transition ${
                  localRecordingEnabled
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-secondary/30 text-muted-foreground"
                }`}
                disabled={!online}
              >
                <span>本地录制</span>
                <span className="font-medium">{localRecordingEnabled ? "开启" : "关闭"}</span>
              </button>
            </Field>
            <button
              onClick={() => setDirty(false)}
              disabled={!dirty}
              className="w-full inline-flex items-center justify-center gap-1 rounded-sm bg-primary text-primary-foreground px-2 py-1.5 text-[11px] font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Save className="h-3 w-3" /> 应用
            </button>
            <Field label="编码任务">
              <Select value={task} onChange={(v) => { setTask(v); setDirty(true); }} options={ENCODE_TASKS} />
            </Field>
            <button
              onClick={() => setRunning((r) => !r)}
              disabled={!online}
              className={`w-full inline-flex items-center justify-center gap-1.5 rounded-sm px-2 py-2 text-[11px] font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${
                running
                  ? "bg-destructive/15 text-destructive border border-destructive/40 hover:bg-destructive/25"
                  : "bg-primary/15 text-primary border border-primary/40 hover:bg-primary/25"
              }`}
            >
              {running ? <><Square className="h-3 w-3" /> 停止任务</> : <><Play className="h-3 w-3" /> 开始任务</>}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({ k, v, mono, highlight }: { k: string; v: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-start gap-2 px-2.5 py-1.5">
      <dt className="w-16 shrink-0 text-muted-foreground">{k}</dt>
      <dd className={`flex-1 break-all ${mono ? "font-mono text-[10px]" : ""} ${highlight ? "text-primary font-medium" : ""}`}>
        {v}
      </dd>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  const has = options.includes(value);
  return (
    <select
      value={has ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-input border border-border rounded-sm px-2 py-1 text-[11px] focus:outline-none focus:border-primary"
    >
      {!has && <option value="" disabled>{value || "—"}</option>}
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
