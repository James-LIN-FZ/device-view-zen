import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Video, Settings2, Save, Play, Square, RefreshCw, X } from "lucide-react";
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
    return `http://${parsed.hostname}:${webrtcPort}/stream.html?src=540p`;
  } catch {
    return null;
  }
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
  const fallbackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [form, setForm] = useState<EncodingForm>(() => buildForm(status));
  const [bitrateNum, setBitrateNum] = useState(() => parseVideoBitrate(status) || 8);
  const [latency, setLatency] = useState(500);
  const [task, setTask] = useState(ENCODE_TASKS[0]);
  const [running, setRunning] = useState(false);
  const [localRecordingEnabled, setLocalRecordingEnabled] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [webrtcOpen, setWebrtcOpen] = useState(false);
  const [previewNonce, setPreviewNonce] = useState(0);
  const [previewLoadFailed, setPreviewLoadFailed] = useState(false);
  const [webrtcNonce, setWebrtcNonce] = useState(0);

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

  const noSignal = online ? isNoSignal(status) : true;
  const previewBaseUrl = useMemo(() => getPreviewBaseUrl(form.streamUrl), [form.streamUrl]);
  const webrtcBaseUrl = useMemo(() => getWebrtcBaseUrl(form.streamUrl), [form.streamUrl]);
  const canShowPreview = online && !noSignal && !!previewBaseUrl;
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
  }, [previewBaseUrl, online, noSignal]);

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

    const label = online ? "No Signal" : "Device Offline";
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#f3f6ff";
    ctx.font = "600 30px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, w / 2, h / 2);
  }, [canShowPreview, previewLoadFailed, online, deviceName]);

  const live = online;
  const realtimeBitrate = status?.sVideoCodec?.sActBitrate || "--";
  const realtimeFramerate = status?.sVideoCodec?.iActFPS != null
    ? `${status.sVideoCodec.iActFPS} fps`
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
          <div className="group relative flex-1 min-h-0 rounded-sm overflow-hidden border border-border bg-black">
            {webrtcOpen ? (
              <>
                <iframe
                  src={webrtcSrc}
                  className="absolute inset-0 h-full w-full border-0"
                  allow="autoplay; camera; microphone"
                  title="WebRTC 预览"
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
                    
                  >
                    <span className="inline-flex items-center justify-center rounded-full border border-primary/70 bg-black/65 p-2.5 text-primary shadow-sm">
                      <Play className="h-5 w-5" />
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
