import { useEffect, useRef, useState } from "react";
import { Network, Signal, Wifi } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const CHART_COLOR = "var(--color-primary)";
const GRID_COLOR = "var(--color-grid-line)";
const DATA_STALE_MS = 3000;

const POINTS = 30;
const DISPLAY_NIC_COUNT = 8;

type Sample = { t: number; up: number; down: number };
type NicRealtime = {
  name: string;
  type: string;
  up: number;
  down: number;
  isWireless: boolean;
  isWifi: boolean;
  signal: string;
  isp: string;
  netMode: string; // "5G" | "4G" | "Wi-Fi" | ""
};

function makeInitial(): Sample[] {
  const now = Date.now();
  return Array.from({ length: POINTS }, (_, i) => ({
    t: now - (POINTS - i) * 1000,
    up: 0,
    down: 0,
  }));
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
      const type = pickString(link, ["sType", "type", "desc", "sDesc", "carrier", "operator"]);
      const upNum = pickNumber(stats, ["iTxSpeed", "tx", "upload", "iUp", "iTx", "txKbps", "txMbps", "fTx", "send", "out"]);
      const downNum = pickNumber(stats, ["iRxSpeed", "rx", "download", "iDown", "iRx", "rxKbps", "rxMbps", "fRx", "recv", "in"]);
      const upText = parseSpeedTextToKbps(stats.sTxSpeed);
      const downText = parseSpeedTextToKbps(stats.sRxSpeed);
      const up = upText ?? toKbps(upNum || 0);
      const down = downText ?? toKbps(downNum || 0);

      const linkType = pickString(link, ["sType", "type"]).toLowerCase();
      const isWifi = /^wlan/i.test(name) || linkType === "wifi" || linkType === "wlan";
      const isEth = linkType === "ethernet" || /^eth/i.test(name);
      const isWireless = !isEth;

      const modem = asRecord(row.modem) || {};
      const signal = pickString(modem, ["sSignal", "signal", "rssi"]);
      const isp = pickString(modem, ["sISP", "isp", "operator", "carrier"]);
      const modeRaw = pickString(modem, ["sMode", "mode", "netMode", "rat"]).toUpperCase();

      let netMode = "";
      if (isWifi) {
        netMode = "Wi-Fi";
      } else if (isWireless) {
        if (/NR/.test(modeRaw)) netMode = /LTE/.test(modeRaw) ? "5G/4G" : "5G";
        else if (/LTE|4G/.test(modeRaw)) netMode = "4G";
        else if (/3G|WCDMA|HSPA/.test(modeRaw)) netMode = "3G";
        else if (modeRaw) netMode = modeRaw;
      }

      return { name, type, up, down, isWireless, isWifi, signal, isp, netMode };
    })
    .filter((item): item is NicRealtime => item !== null);
}

function makeDisplayNics(liveNics: NicRealtime[]): NicRealtime[] {
  return Array.from({ length: DISPLAY_NIC_COUNT }, (_, i) =>
    liveNics[i] ?? { name: "--", type: "--", up: 0, down: 0, isWireless: false, isWifi: false, signal: "", isp: "", netMode: "" },
  );
}

export function NetworkPanel({ serialNo, online, payload }: { serialNo: string; online: boolean; payload: unknown }) {
  const [onlineState, setOnlineState] = useState(online);
  const [liveNics, setLiveNics] = useState<NicRealtime[]>([]);
  const displayNics = makeDisplayNics(liveNics);
  const [series, setSeries] = useState<Sample[][]>(() =>
    Array.from({ length: DISPLAY_NIC_COUNT }, () => makeInitial()),
  );
  const latestRef = useRef<NicRealtime[]>(displayNics);
  const lastDataAtRef = useRef<number>(Date.now());

  useEffect(() => {
    setOnlineState(online);
  }, [online]);

  // reset when selected serial changes
  useEffect(() => {
    setLiveNics([]);
    setSeries(Array.from({ length: DISPLAY_NIC_COUNT }, () => makeInitial()));
    lastDataAtRef.current = Date.now();
  }, [serialNo]);

  useEffect(() => {
    latestRef.current = displayNics;
  }, [displayNics]);

  useEffect(() => {
    lastDataAtRef.current = Date.now();
    setLiveNics(parseNetworkPayload(payload));
  }, [payload]);

  useEffect(() => {
    const id = setInterval(() => {
      const hasRecentData = Date.now() - lastDataAtRef.current < DATA_STALE_MS;
      setSeries((prev) =>
        prev.map((arr, i) => {
          const nic = latestRef.current[i];
          const up = onlineState && hasRecentData ? Math.max(0, nic?.up || 0) : 0;
          const down = onlineState && hasRecentData ? Math.max(0, nic?.down || 0) : 0;
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
              className="rounded-md border border-border bg-card/40 px-1 py-1 flex flex-col min-h-0"
            >
              <div className="flex flex-col gap-0.5 mb-1 px-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className={`text-xs font-semibold tracking-wide truncate ${isEmpty ? "text-muted-foreground" : ""}`}>
                    {nic.name}
                  </div>
                  {!isEmpty && nic.isWireless && nic.netMode ? (
                    <span className="inline-flex items-center gap-0.5 shrink-0 rounded-sm border border-primary/40 bg-primary/10 text-primary px-1 text-[9px] leading-[14px] font-medium">
                      {nic.isWifi ? <Wifi className="h-2.5 w-2.5" /> : null}
                      {nic.netMode}
                    </span>
                  ) : null}
                  {!isEmpty && nic.isWireless && nic.isp ? (
                    <span className="inline-block shrink-0 rounded-sm border border-border bg-muted/40 px-1 text-[9px] leading-[14px] text-muted-foreground truncate max-w-[80px]">
                      {nic.isp}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 min-w-0">
                    {!isEmpty && nic.isWireless && nic.signal ? (
                      <span className="inline-flex items-center gap-0.5 rounded-sm border border-primary/40 bg-primary/10 text-primary px-1 text-[9px] leading-[14px] font-medium">
                        <Signal className="h-2.5 w-2.5" />
                        {nic.signal}
                      </span>
                    ) : null}
                  </div>
                  <div className={`font-mono text-xs tabular-nums ${isEmpty ? "text-muted-foreground" : ""}`} style={isEmpty ? undefined : { color }}>
                    {isEmpty ? "--" : `↑${last.up.toFixed(1)} Kbps`}
                    <span className="text-muted-foreground">/</span>
                    {isEmpty ? "--" : `↓${last.down.toFixed(1)} Kbps`}
                  </div>
                </div>
              </div>
              <div className="flex-1 min-h-0 -mx-1 -mb-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`g-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.45} />
                        <stop offset="100%" stopColor={color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke={GRID_COLOR}
                      strokeDasharray="0"
                      horizontalCoordinatesGenerator={({ yAxis }) => {
                        const y = yAxis.y as number;
                        const h = yAxis.height as number;
                        return [y + h * 0.25, y + h * 0.5, y + h * 0.75];
                      }}
                      verticalCoordinatesGenerator={({ xAxis }) => {
                        const x = xAxis.x as number;
                        const w = xAxis.width as number;
                        return [1, 2, 3, 4, 5].map((k) => x + (w * k) / 6);
                      }}
                    />
                    <XAxis
                      dataKey="t"
                      tick={false}
                      tickLine={false}
                      axisLine={{ stroke: GRID_COLOR }}
                      height={0}
                    />
                    <YAxis
                      width={0}
                      tick={false}
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
