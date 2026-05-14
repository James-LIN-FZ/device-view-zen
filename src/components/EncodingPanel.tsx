import { useEffect, useRef } from "react";
import { Activity, Video } from "lucide-react";
import type { Device } from "@/lib/devices";

export function EncodingPanel({ device }: { device: Device }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Faux live preview: animated gradient + scanlines + timecode
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
        // noise
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

        // moving bars
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = `rgba(255,255,255,${0.04 + (i % 2) * 0.03})`;
          const x = ((t * 40 + i * 90) % (w + 120)) - 60;
          ctx.fillRect(x, 0, 30, h);
        }

        // scanlines
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);

        // center crosshair
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
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold tracking-wide">编码状态 · {device.name}</h3>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5">
            <span
              className={`status-dot inline-block h-2 w-2 rounded-full ${live ? "bg-destructive" : "bg-muted-foreground"}`}
            />
            <span className={live ? "text-destructive font-medium" : "text-muted-foreground"}>
              {live ? "LIVE" : device.status === "online" ? "STANDBY" : "OFFLINE"}
            </span>
          </span>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-3 p-3 min-h-0">
        {/* Preview */}
        <div className="lg:col-span-3 flex flex-col min-h-0">
          <div className="relative flex-1 min-h-0 rounded-md overflow-hidden border border-border bg-black">
            <canvas
              ref={canvasRef}
              width={960}
              height={540}
              className="h-full w-full object-cover"
            />
            <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-sm bg-black/55 px-2 py-1 text-[10px] font-mono">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${live ? "bg-destructive" : "bg-muted-foreground"}`}
              />
              {live ? "REC" : "IDLE"} · {device.encoding.resolution} · {device.encoding.framerate}
            </div>
            <div className="absolute bottom-2 right-2 rounded-sm bg-black/55 px-2 py-1 text-[10px] font-mono text-primary">
              {device.encoding.videoCodec}
            </div>
          </div>
        </div>

        {/* Params */}
        <div className="lg:col-span-2 min-h-0 overflow-y-auto rounded-md border border-border bg-card/40">
          <div className="px-3 py-2 border-b border-border flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium tracking-wide">参数详情</span>
          </div>
          <dl className="divide-y divide-border text-xs">
            <Row k="视频源" v={device.encoding.videoSource} />
            <Row k="视频编码" v={device.encoding.videoCodec} />
            <Row k="音频编码" v={device.encoding.audioCodec} />
            <Row k="分辨率" v={device.encoding.resolution} />
            <Row k="码率" v={device.encoding.bitrate} highlight />
            <Row k="帧率" v={device.encoding.framerate} highlight />
            <Row k="推流地址" v={device.encoding.streamUrl} mono />
          </dl>
        </div>
      </div>
    </section>
  );
}

function Row({ k, v, mono, highlight }: { k: string; v: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5">
      <dt className="w-20 shrink-0 text-muted-foreground">{k}</dt>
      <dd
        className={`flex-1 break-all ${mono ? "font-mono text-[11px]" : ""} ${highlight ? "text-primary font-medium" : ""}`}
      >
        {v}
      </dd>
    </div>
  );
}
