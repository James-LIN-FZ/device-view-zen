import { useEffect, useRef, useState } from "react";
import { Network, Settings } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getAuthToken } from "@/lib/auth";

const CHART_COLOR = "var(--color-primary)";
const GRID_COLOR = "var(--color-grid-line)";

const POINTS = 30;
const DISPLAY_NIC_COUNT = 8;

type Sample = { t: number; up: number; down: number };
type NicRealtime = { name: string; type: string; up: number; down: number };
type WsStatusMessage = {
  type?: string;
  payload?: unknown;
  online?: boolean;
};

function makeInitial(): Sample[] {
  const now = Date.now();
  return Array.from({ length: POINTS }, (_, i) => ({
    t: now - (POINTS - i) * 1000,
    up: 0,
    down: 0,
  }));
}

function getWsBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL as string | undefined;
  const httpBase = (configured?.trim() || "http://127.0.0.1:18081").replace(/\/$/, "");
  if (httpBase.startsWith("https://")) return `wss://${httpBase.slice(8)}`;
  if (httpBase.startsWith("http://")) return `ws://${httpBase.slice(7)}`;
  return httpBase;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function pickNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const maybe = asNumber(source[key]);
    if (maybe != null) return maybe;
  }
  return null;
}

function pickString(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function parseSpeedTextToKbps(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  const match = text.match(/([\d.]+)\s*(b|kb|mb|gb)?ps/i);
  if (!match) return null;
  const num = Number(match[1]);
  if (!Number.isFinite(num) || num <= 0) return 0;
  const unit = (match[2] || "kb").toLowerCase();
  if (unit === "b") return num / 1000;
  if (unit === "mb") return num * 1000;
  if (unit === "gb") return num * 1000 * 1000;
  return num;
}

function toKbps(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  // Guard: if upstream sends bps-like large values, normalize into kbps for chart display.
  if (value > 1_000_000) return value / 1_000;
  return value;
}

function parseNetworkPayload(payload: unknown): NicRealtime[] {
  let rawList: unknown[] = [];
  if (Array.isArray(payload)) {
    rawList = payload;
  } else if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    const nested = obj.nics || obj.list || obj.data || obj.items;
    if (Array.isArray(nested)) {
      rawList = nested;
    } else {
      // Support map-style payloads like {"eth0": {...}, "wlan0": {...}}.
      rawList = Object.entries(obj).map(([iface, value]) => {
        if (value && typeof value === "object") {
          return { sInterface: iface, ...(value as Record<string, unknown>) };
        }
        return { sInterface: iface, up: value, down: 0 };
      });
    }
  }

  return rawList
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const link = asRecord(row.link) || row;
      const stats = asRecord(row.statistics) || row;
      const name = pickString(link, ["sInterface", "interface", "ifName", "iface", "name", "nic", "sName", "sNic"]) || `网卡 ${index + 1}`;
      const type = pickString(link, ["sType", "type", "desc", "sDesc", "carrier", "operator"]) || "已连接";
      const upNum = pickNumber(stats, ["iTxSpeed", "tx", "upload", "iUp", "iTx", "txKbps", "txMbps", "fTx", "send", "out"]);
      const downNum = pickNumber(stats, ["iRxSpeed", "rx", "download", "iDown", "iRx", "rxKbps", "rxMbps", "fRx", "recv", "in"]);
      const upText = parseSpeedTextToKbps(stats.sTxSpeed);
      const downText = parseSpeedTextToKbps(stats.sRxSpeed);
      const up = upText ?? toKbps(upNum || 0);
      const down = downText ?? toKbps(downNum || 0);
      return { name, type, up, down };
    })
    .filter((item): item is NicRealtime => item !== null);
}

function makeDisplayNics(liveNics: NicRealtime[]): NicRealtime[] {
  return Array.from({ length: DISPLAY_NIC_COUNT }, (_, i) =>
    liveNics[i] ?? { name: "--", type: "--", up: 0, down: 0 },
  );
}

export function NetworkPanel({ serialNo, online }: { serialNo: string; online: boolean }) {
  const [onlineState, setOnlineState] = useState(online);
  const [liveNics, setLiveNics] = useState<NicRealtime[]>([]);
  const displayNics = makeDisplayNics(liveNics);
  const [series, setSeries] = useState<Sample[][]>(() =>
    Array.from({ length: DISPLAY_NIC_COUNT }, () => makeInitial()),
  );
  const latestRef = useRef<NicRealtime[]>(displayNics);

  useEffect(() => {
    setOnlineState(online);
  }, [online]);

  // reset when selected serial changes
  useEffect(() => {
    setLiveNics([]);
    setSeries(Array.from({ length: DISPLAY_NIC_COUNT }, () => makeInitial()));
  }, [serialNo]);

  useEffect(() => {
    latestRef.current = displayNics;
  }, [displayNics]);

  useEffect(() => {
    if (!serialNo) return;
    const token = getAuthToken();
    if (!token) return;

    const ws = new WebSocket(`${getWsBaseUrl()}/api/ws/devices/${encodeURIComponent(serialNo)}?token=${encodeURIComponent(token)}`);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as WsStatusMessage;
        if (typeof msg.online === "boolean") {
          setOnlineState(msg.online);
        }
        if (msg.type !== "network") return;
        const parsed = parseNetworkPayload(msg.payload);
        setLiveNics(parsed);
      } catch {
        // Ignore malformed messages to keep the panel stable.
      }
    };

    return () => {
      ws.close();
    };
  }, [serialNo]);

  useEffect(() => {
    const id = setInterval(() => {
      setSeries((prev) =>
        prev.map((arr, i) => {
          const nic = latestRef.current[i];
          const up = onlineState ? Math.max(0, nic?.up || 0) : 0;
          const down = onlineState ? Math.max(0, nic?.down || 0) : 0;
          const next = arr.slice(1);
          next.push({ t: Date.now(), up: +up.toFixed(2), down: +down.toFixed(2) });
          return next;
        }),
      );
    }, 1000);
    return () => clearInterval(id);
  }, [onlineState]);

  return (
    <section className="panel flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold tracking-wide">网络状态 · 网卡实时流量</h3>
        </div>
        <span className="text-[11px] text-muted-foreground">采样 1s · 单位 kbps</span>
      </div>

      <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-3 p-3 min-h-0">
        {displayNics.map((nic, i) => {
          const data = series[i] ?? [];
          const last = data[data.length - 1] ?? { up: 0, down: 0 };
          const color = CHART_COLOR;
          const isEmpty = nic.name === "--";
          return (
            <div
              key={`${nic.name}-${i}`}
              className="rounded-md border border-border bg-card/40 p-3 flex flex-col min-h-0"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="min-w-0">
                  <div className={`text-xs font-semibold tracking-wide truncate ${isEmpty ? "text-muted-foreground" : ""}`}>
                    {nic.name}
                  </div>
                  <div className={`text-[10px] truncate ${isEmpty ? "text-muted-foreground" : "text-muted-foreground"}`}>{nic.type}</div>
                </div>
                <div className="text-right">
                  <div className="flex justify-end mb-0.5">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-sm border border-border p-0.5 text-muted-foreground hover:border-primary/50 hover:text-primary transition"
                      aria-label="网卡设置"
                      title="网卡设置"
                    >
                      <Settings className="h-3 w-3" />
                    </button>
                  </div>
                  <div className={`font-mono text-xs tabular-nums ${isEmpty ? "text-muted-foreground" : ""}`} style={isEmpty ? undefined : { color }}>
                    {isEmpty ? "--" : `↑${last.up.toFixed(1)}`}
                    <span className="text-muted-foreground">/</span>
                    {isEmpty ? "--" : `↓${last.down.toFixed(1)} Kbps`}
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
                      formatter={(v: number, name) => [`${v} kbps`, name === "up" ? "上行" : "下行"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="down"
                      stroke={color}
                      strokeDasharray="3 3"
                      strokeOpacity={0.6}
                      strokeWidth={1.5}
                      fill={`url(#g-${i})`}
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="up"
                      stroke={color}
                      strokeWidth={1}
                      fill={`url(#g-${i})`}
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
