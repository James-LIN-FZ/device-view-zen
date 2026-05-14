import { useEffect, useRef, useState } from "react";
import { Activity, Video, Settings2, Save, RotateCcw } from "lucide-react";
import type { Device } from "@/lib/devices";

const VIDEO_SOURCES = ["SDI-1", "SDI-2", "HDMI-1", "HDMI-2", "NDI", "USB"];
const VIDEO_CODECS = ["H.264 / AVC", "H.265 / HEVC", "AV1"];
const AUDIO_CODECS = ["AAC-LC 48kHz", "AAC-HE 48kHz", "Opus 48kHz", "MP3 44.1kHz"];
const RESOLUTIONS = ["3840 × 2160", "1920 × 1080", "1280 × 720", "854 × 480"];
const FRAMERATES = ["24 fps", "25 fps", "30 fps", "50 fps", "60 fps"];

export function EncodingPanel({ device }: { device: Device }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // editable form state, reset when device changes
  const [form, setForm] = useState(device.encoding);
  const [bitrateNum, setBitrateNum] = useState(() => parseInt(device.encoding.bitrate) || 8);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setForm(device.encoding);
    setBitrateNum(parseInt(device.encoding.bitrate) || 8);
    setDirty(false);
  }, [device.id]);

  const update = <K extends keyof typeof form>(k: K, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };

  // Faux live preview
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let frame = 0;
    const offline = device.status === "offline";

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
  }, [device.status, device.id]);

  const live = device.status === "streaming";

  return (
    <section className="panel flex flex-col h-full overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between bg-card/30">
        <div className="flex items-center gap-2">
          <Video className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-xs font-semibold tracking-wide uppercase">编码状态</h3>
          <span className="text-[11px] text-muted-foreground">· {device.name}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className={`status-dot inline-block h-1.5 w-1.5 rounded-full ${live ? "bg-destructive" : "bg-muted-foreground"}`} />
            <span className={live ? "text-destructive font-medium" : "text-muted-foreground"}>
              {live ? "LIVE" : device.status === "online" ? "STANDBY" : "OFFLINE"}
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
            <Row k="音频编码" v={form.audioCodec} />
            <Row k="分辨率" v={form.resolution} />
            <Row k="码率" v={`${bitrateNum} Mbps`} highlight />
            <Row k="帧率" v={form.framerate} highlight />
            <Row k="推流地址" v={form.streamUrl} mono />
          </dl>
        </div>

        {/* Edit Panel */}
        <div className="lg:col-span-2 min-h-0 overflow-y-auto rounded-sm border border-border bg-card/40 flex flex-col">
          <div className="px-2.5 py-1.5 border-b border-border flex items-center gap-1.5 bg-background/30">
            <Settings2 className="h-3 w-3 text-primary" />
            <span className="text-[11px] font-medium tracking-wide uppercase">参数修改</span>
            {dirty && <span className="ml-auto text-[10px] text-warning">未保存</span>}
          </div>
          <div className="p-2.5 space-y-2 text-[11px]">
            <Field label="视频源">
              <Select value={form.videoSource.split(" ")[0]} onChange={(v) => update("videoSource", v)} options={VIDEO_SOURCES} />
            </Field>
            <Field label="视频编码">
              <Select value={form.videoCodec} onChange={(v) => update("videoCodec", v)} options={VIDEO_CODECS} />
            </Field>
            <Field label="音频编码">
              <Select value={form.audioCodec} onChange={(v) => update("audioCodec", v)} options={AUDIO_CODECS} />
            </Field>
            <Field label="分辨率">
              <Select value={form.resolution} onChange={(v) => update("resolution", v)} options={RESOLUTIONS} />
            </Field>
            <Field label="帧率">
              <Select value={form.framerate} onChange={(v) => update("framerate", v)} options={FRAMERATES} />
            </Field>
            <Field label={`码率 ${bitrateNum} Mbps`}>
              <input
                type="range"
                min={1}
                max={50}
                value={bitrateNum}
                onChange={(e) => { setBitrateNum(+e.target.value); setDirty(true); }}
                className="w-full accent-[var(--color-primary)]"
                disabled={device.status === "offline"}
              />
              <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                <span>1</span><span>25</span><span>50</span>
              </div>
            </Field>
            <Field label="推流地址">
              <input
                type="text"
                value={form.streamUrl}
                onChange={(e) => update("streamUrl", e.target.value)}
                className="w-full bg-input border border-border rounded-sm px-2 py-1 font-mono text-[10px] focus:outline-none focus:border-primary"
              />
            </Field>
          </div>
          <div className="mt-auto p-2 border-t border-border flex gap-1.5 bg-background/30">
            <button
              onClick={() => { setForm(device.encoding); setBitrateNum(parseInt(device.encoding.bitrate) || 8); setDirty(false); }}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-sm border border-border bg-secondary/40 px-2 py-1.5 text-[11px] hover:border-primary/50 transition"
            >
              <RotateCcw className="h-3 w-3" /> 重置
            </button>
            <button
              onClick={() => setDirty(false)}
              disabled={!dirty}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-sm bg-primary text-primary-foreground px-2 py-1.5 text-[11px] font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Save className="h-3 w-3" /> 应用
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
