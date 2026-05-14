import { useEffect, useRef, useState } from "react";
import { Network } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Device } from "@/lib/devices";

const CHART_COLOR = "var(--color-primary)";
const GRID_COLOR = "var(--color-grid-line)";

const POINTS = 30;

type Sample = { t: number; up: number; down: number };

function makeInitial(): Sample[] {
  const now = Date.now();
  return Array.from({ length: POINTS }, (_, i) => ({
    t: now - (POINTS - i) * 1000,
    up: 0,
    down: 0,
  }));
}

export function NetworkPanel({ device }: { device: Device }) {
  const offline = device.status === "offline";
  const [series, setSeries] = useState<Sample[][]>(() =>
    device.nics.map(() => makeInitial()),
  );
  const baseRef = useRef<number[]>([]);

  // reset when device changes
  useEffect(() => {
    baseRef.current = device.nics.map(() => 2 + Math.random() * 8);
    setSeries(device.nics.map(() => makeInitial()));
  }, [device.id, device.nics.length]);

  useEffect(() => {
    const id = setInterval(() => {
      setSeries((prev) =>
        prev.map((arr, i) => {
          const base = baseRef.current[i] ?? 5;
          const drift = Math.sin(Date.now() / (4000 + i * 700)) * base * 0.4;
          const up = offline
            ? 0
            : Math.max(0, base + drift + (Math.random() - 0.5) * base * 0.6);
          const down = offline
            ? 0
            : Math.max(0, base * 1.6 + drift * 1.2 + (Math.random() - 0.5) * base);
          const next = arr.slice(1);
          next.push({ t: Date.now(), up: +up.toFixed(2), down: +down.toFixed(2) });
          return next;
        }),
      );
    }, 1000);
    return () => clearInterval(id);
  }, [offline]);

  return (
    <section className="panel flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold tracking-wide">网络状态 · 网卡实时流量</h3>
        </div>
        <span className="text-[11px] text-muted-foreground">采样 1s · 单位 Mbps</span>
      </div>

      <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 gap-3 p-3 min-h-0">
        {device.nics.map((nic, i) => {
          const data = series[i] ?? [];
          const last = data[data.length - 1] ?? { up: 0, down: 0 };
          const color = CHART_COLOR;
          return (
            <div
              key={nic.name}
              className="rounded-md border border-border bg-card/40 p-3 flex flex-col min-h-0"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="min-w-0">
                  <div className="text-xs font-semibold tracking-wide truncate">
                    {nic.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">{nic.type}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground">↑ / ↓ Mbps</div>
                  <div className="font-mono text-xs tabular-nums" style={{ color }}>
                    {last.up.toFixed(1)}
                    <span className="text-muted-foreground"> / </span>
                    {last.down.toFixed(1)}
                  </div>
                </div>
              </div>
              <div className="flex-1 min-h-0 -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`g-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.45} />
                        <stop offset="100%" stopColor={color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={GRID_COLOR} strokeDasharray="0" vertical={true} horizontal={true} />
                    <XAxis
                      dataKey="t"
                      tick={{ fill: "var(--color-muted-foreground)", fontSize: 9 }}
                      tickLine={false}
                      axisLine={{ stroke: GRID_COLOR }}
                      tickFormatter={(v) => {
                        const d = new Date(v as number);
                        return `${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
                      }}
                      minTickGap={30}
                    />
                    <YAxis
                      width={28}
                      tick={{ fill: "var(--color-muted-foreground)", fontSize: 9 }}
                      tickLine={false}
                      axisLine={{ stroke: GRID_COLOR }}
                      domain={[0, "auto"]}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 6,
                        fontSize: 11,
                      }}
                      labelFormatter={(v) => new Date(v as number).toLocaleTimeString()}
                      formatter={(v: number, name) => [`${v} Mbps`, name === "up" ? "上行" : "下行"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="down"
                      stroke={color}
                      strokeWidth={1.5}
                      fill={`url(#g-${i})`}
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="up"
                      stroke={color}
                      strokeOpacity={0.6}
                      strokeDasharray="3 3"
                      strokeWidth={1}
                      fill="transparent"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
