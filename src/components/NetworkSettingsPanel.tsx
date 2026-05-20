import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Monitor,
  Wifi,
  Signal,
  Network as NetworkIcon,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PanelStatusView, type PanelLoadStatus } from "@/components/PanelStatus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { fetchDeviceRPCReply, requestDeviceRPC } from "@/lib/device-api";

// ── Device API shapes ──────────────────────────────────────────────────────

interface NetItemLink {
  sType: string;
  sInterface: string;
  sAddress: string;
  sDNS1: string;
  sDNS2: string;
  iDuplex: number;
  iAutoConnect: number;
  sSN?: string;
  sNicSpeed?: string;
  sExt?: string;
}

interface NetItemIpv4 {
  sV4Address: string;
  sV4Gateway: string;
  sV4Method: string; // "dhcp"/"manual" for eth; JSON for wlan
  sV4Netmask: string;
  iOrder: number;
}

interface NetItemStats {
  iTxSpeed: number;
  iRxSpeed: number;
  sTxSpeed: string;
  sRxSpeed: string;
}

interface NetItemModem {
  sISP?: string;
  sMode?: string;
  sModel?: string;
  sName?: string;
  iStatus?: number;
  sSignal?: string;
  iBand?: string | number;
  sCellId?: string;
  sImsi?: string;
}

interface NetItem {
  link: NetItemLink;
  ipv4: NetItemIpv4;
  statistics: NetItemStats;
  modem?: NetItemModem;
}

// ── UI shapes ──────────────────────────────────────────────────────────────

type AddressMode = "manual" | "dhcp";

interface EthernetIf {
  name: string;
  // live (updated by refresh)
  up: string;
  down: string;
  ip: string;
  gateway: string;
  status: string;
  // static info
  mac: string;
  // editable
  mode: AddressMode;
  ipInput: string;
  gwInput: string;
  netmask: string;
  dns1: string;
  dns2: string;
  routePriority: number;
}

interface ModemIf {
  interfaceName: string;
  sn: string;
  // live
  tx: string;
  rx: string;
  status: number;
  ipv4: string;
  // static info
  isp: string;
  mode: string;
  model: string;
  imei: string;
  imsi: string;
  signal: string;
  band: string;
  cellId: string;
  // editable
  autoConnect: boolean;
  nicMode: string;
  ext: string;
  routePriority: number;
  wifiMode: string;
  wifiSsid: string;
  wifiPsk: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const ADDRESS_OPTIONS = [
  { label: "手动", value: "manual" },
  { label: "DHCP", value: "dhcp" },
];

const BAND_OPTIONS = ["LTE+NR", "NR_ONLY", "LTE_ONLY", "NR_79"];
const WIFI_MODE_OPTIONS = ["close", "client", "ap"];

// ── Helpers ────────────────────────────────────────────────────────────────

function statusText(s: number) {
  return s === 2 ? "已连接" : s === 1 ? "拨号中" : "未连接";
}

function formatWifiSpeed(bps: number): string {
  if (bps > 10000) return Math.floor(bps / 1024) + "kbps";
  return bps + "bps";
}

async function rpcCall(
  serialNo: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: string; data?: unknown } | null> {
  try {
    const ack = await requestDeviceRPC(serialNo, { method, path, body });
    if (!ack?.requestId) return null;
    const deadline = Date.now() + (ack.timeoutSeconds ?? 10) * 1000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 500));
      const reply = await fetchDeviceRPCReply(serialNo, ack.requestId);
      if (reply?.status !== "pending") return reply;
    }
    return null;
  } catch {
    return null;
  }
}

function parseNetItems(data: unknown): NetItem[] {
  if (!Array.isArray(data)) return [];
  return data.filter(
    (x): x is NetItem =>
      x != null && typeof x === "object" && "link" in x && "ipv4" in x && "statistics" in x,
  );
}

function toEth(item: NetItem): EthernetIf {
  const isManual = item.ipv4.sV4Method !== "dhcp";
  return {
    name: item.link.sInterface,
    up: item.statistics.sTxSpeed,
    down: item.statistics.sRxSpeed,
    ip: item.ipv4.sV4Address,
    gateway: item.ipv4.sV4Gateway,
    status: item.link.iDuplex === 1 ? "已连接" : "未连接",
    mac: item.link.sAddress ?? "",
    mode: isManual ? "manual" : "dhcp",
    ipInput: item.ipv4.sV4Address,
    gwInput: item.ipv4.sV4Gateway,
    netmask: item.ipv4.sV4Netmask,
    dns1: item.link.sDNS1 ?? "",
    dns2: item.link.sDNS2 ?? "",
    routePriority: item.ipv4.iOrder ?? 1,
  };
}

function toModem(item: NetItem): ModemIf {
  let wifiMode = "close",
    wifiSsid = "",
    wifiPsk = "";
  try {
    const parsed = JSON.parse(item.ipv4.sV4Method ?? "{}") as Record<string, unknown>;
    if (parsed && typeof parsed === "object") {
      wifiMode = String(parsed.sMethod ?? "close");
      wifiSsid = String(parsed.sSsid ?? "");
      wifiPsk = String(parsed.sPassword ?? "");
    }
  } catch {
    /* not JSON — plain method like "dhcp" */
  }
  return {
    interfaceName: item.link.sInterface,
    sn: item.link.sSN ?? "",
    tx: item.statistics.sTxSpeed,
    rx: item.statistics.sRxSpeed,
    status: item.modem?.iStatus ?? 0,
    ipv4: item.ipv4.sV4Address,
    isp: item.modem?.sISP ?? "",
    mode: item.modem?.sMode ?? "",
    model: item.modem?.sModel ?? "",
    imei: item.modem?.sName ?? "",
    imsi: item.modem?.sImsi ?? "",
    signal: item.modem?.sSignal ?? "",
    band: String(item.modem?.iBand ?? ""),
    cellId: item.modem?.sCellId ?? "",
    autoConnect: item.link.iAutoConnect === 1,
    nicMode: item.link.sNicSpeed ?? "",
    ext: item.link.sExt ?? "",
    routePriority: item.ipv4.iOrder ?? 1,
    wifiMode,
    wifiSsid,
    wifiPsk,
  };
}

// ── Component ──────────────────────────────────────────────────────────────

export function NetworkSettingsPanel({
  serialNo,
  online,
}: {
  serialNo: string;
  online: boolean;
}) {
  const mountedRef = useRef(true);

  const [status, setStatus] = useState<PanelLoadStatus>("loading");
  const [eths, setEths] = useState<EthernetIf[]>([]);
  const [modems, setModems] = useState<ModemIf[]>([]);
  const [gwEnabled, setGwEnabled] = useState(false);
  const [aggEnabled, setAggEnabled] = useState(false);
  const [upMbps, setUpMbps] = useState("0.0");
  const [downMbps, setDownMbps] = useState("0.0");
  const [wifiUp, setWifiUp] = useState("0bps");
  const [wifiDown, setWifiDown] = useState("0bps");
  const [openEth, setOpenEth] = useState<string | null>(null);
  const [openModem, setOpenModem] = useState<string | null>(null);
  const [wifiOpen, setWifiOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const patchEth = (name: string, p: Partial<EthernetIf>) =>
    setEths((prev) => prev.map((e) => (e.name === name ? { ...e, ...p } : e)));

  const patchModem = (iface: string, p: Partial<ModemIf>) =>
    setModems((prev) => prev.map((m) => (m.interfaceName === iface ? { ...m, ...p } : m)));

  // ── Data loading ───────────────────────────────────────────────────────────

  function applyNetItems(items: NetItem[]) {
    let totalTx = 0,
      totalRx = 0,
      wTx = 0,
      wRx = 0;
    const newEths: EthernetIf[] = [];
    const newModems: ModemIf[] = [];

    for (const item of items) {
      totalTx += item.statistics.iTxSpeed;
      totalRx += item.statistics.iRxSpeed;
      if (item.link.sType === "ethernet") {
        newEths.push(toEth(item));
      } else {
        wTx += item.statistics.iTxSpeed;
        wRx += item.statistics.iRxSpeed;
        newModems.push(toModem(item));
      }
    }

    setUpMbps((totalTx / 1_000_000).toFixed(1));
    setDownMbps((totalRx / 1_000_000).toFixed(1));
    setWifiUp(formatWifiSpeed(wTx));
    setWifiDown(formatWifiSpeed(wRx));

    setEths(newEths);
    setModems(newModems);
    if (newEths.length > 0) setOpenEth(newEths[0].name);
  }

  async function loadAll() {
    setStatus("loading");
    if (!online) {
      setStatus("error");
      return;
    }
    const [netReply, aggReply, gwReply] = await Promise.all([
      rpcCall(serialNo, "GET", "/net"),
      rpcCall(serialNo, "GET", "/net/aggregation"),
      rpcCall(serialNo, "GET", "/net/gw"),
    ]);
    if (!mountedRef.current) return;
    if (netReply?.status !== "ok") {
      setStatus("error");
      return;
    }
    applyNetItems(parseNetItems(netReply.data));
    if (aggReply?.status === "ok") {
      const d = aggReply.data as Record<string, unknown>;
      setAggEnabled(d?.iPower === 1);
    }
    if (gwReply?.status === "ok") {
      const d = gwReply.data as Record<string, unknown>;
      setGwEnabled(d?.iPower === 1);
    }
    setStatus("ready");
  }

  useEffect(() => {
    mountedRef.current = true;
    void loadAll();
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialNo, online]);

  // ── Save handlers ──────────────────────────────────────────────────────────

  async function saveEth(e: EthernetIf) {
    setSaving(e.name);
    const body: Record<string, unknown> = {
      ipv4: {
        sV4Address: e.ipInput,
        sV4Gateway: e.gwInput,
        sV4Method: e.mode,
        sV4Netmask: e.netmask,
        iOrder: e.routePriority,
      },
      link: { sDNS1: e.dns1, sDNS2: e.dns2 },
    };
    const result = await rpcCall(serialNo, "POST", `/net/${e.name}`, body);
    if (!mountedRef.current) return;
    setSaving(null);
    if (result?.status === "ok") {
      toast.success(`${e.name} 已修改`);
      void loadAll();
    } else toast.error(`${e.name} 修改失败`);
  }

  async function saveModem(m: ModemIf) {
    setSaving(m.interfaceName);
    const isWlan = m.interfaceName === "wlan0";
    const body: Record<string, unknown> = {
      link: {
        iAutoConnect: m.autoConnect ? 1 : 0,
        sSN: m.sn,
        sNicSpeed: m.nicMode,
        sExt: m.ext,
      },
      ipv4: {
        iOrder: m.routePriority,
        ...(isWlan
          ? {
              sV4Method: JSON.stringify({
                sMethod: m.wifiMode,
                sPassword: m.wifiPsk,
                sSsid: m.wifiSsid,
              }),
            }
          : {}),
      },
    };
    const result = await rpcCall(serialNo, "POST", `/net/${m.interfaceName}`, body);
    if (!mountedRef.current) return;
    setSaving(null);
    if (result?.status === "ok") {
      toast.success(`${m.interfaceName} 已修改`);
      void loadAll();
    } else toast.error(`${m.interfaceName} 修改失败`);
  }

  async function toggleAgg(enabled: boolean) {
    setAggEnabled(enabled);
    await rpcCall(serialNo, "POST", "/net/aggregation", { iPower: enabled ? 1 : 0 });
  }

  async function toggleGw(enabled: boolean) {
    setGwEnabled(enabled);
    await rpcCall(serialNo, "POST", "/net/gw", { iPower: enabled ? 1 : 0 });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (status !== "ready") {
    return <PanelStatusView status={status} onRetry={() => void loadAll()} />;
  }

  return (
    <div className="-mt-2 -ml-2">
      <h3 className="text-sm font-medium mb-4">网络设置</h3>

      {/* ====== 聚合网络 ====== */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2 px-3 py-3 rounded-md bg-muted/30 border border-border">
        <div className="flex items-center gap-2 min-w-32">
          <NetworkIcon className="h-4 w-4 text-primary" />
          <span className="text-sm">聚合网络:</span>
        </div>
        <Stat icon={<ArrowUp className="h-3.5 w-3.5 text-green-400" />} text={`${upMbps}Mbps`} />
        <Stat
          icon={<ArrowDown className="h-3.5 w-3.5 text-blue-400" />}
          text={`${downMbps}Mbps`}
        />
        <div className="ml-auto flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm">超级网关：</span>
            <Switch checked={gwEnabled} onCheckedChange={toggleGw} disabled={!online} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">聚合：</span>
            <Switch checked={aggEnabled} onCheckedChange={toggleAgg} disabled={!online} />
          </div>
        </div>
      </div>

      {/* ====== 有线网络 ====== */}
      <div className="mt-3 space-y-2">
        {eths.map((e) => {
          const isOpen = openEth === e.name;
          return (
            <div key={e.name} className="border border-border rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenEth(isOpen ? null : e.name)}
                className="w-full flex items-center gap-6 px-3 py-2.5 bg-muted/20 hover:bg-muted/40 text-left"
              >
                <div className="flex items-center gap-2 min-w-28">
                  <Monitor className="h-4 w-4 text-primary" />
                  <span className="text-sm">{e.name}:</span>
                </div>
                <Stat icon={<ArrowUp className="h-3.5 w-3.5 text-green-400" />} text={e.up} />
                <Stat icon={<ArrowDown className="h-3.5 w-3.5 text-blue-400" />} text={e.down} />
                <span className="text-xs text-muted-foreground">IP: {e.ip || "--"}</span>
                <span className="text-xs text-muted-foreground">Gateway: {e.gateway || "--"}</span>
                <ChevronDown
                  className={cn("h-4 w-4 ml-auto transition-transform", isOpen && "rotate-180")}
                />
              </button>

              {isOpen && (
                <div className="px-4 py-3 space-y-3">
                  <Grid>
                    <Field label="接口">{e.name}</Field>
                    <Field label="MAC">{e.mac || "--"}</Field>
                    <Field label="状态">{e.status}</Field>
                    <Field label="类型">WAN/ETH</Field>
                  </Grid>

                  <Grid>
                    <Field label="地址获取">
                      <div className="w-32">
                        <Select
                          value={e.mode}
                          onValueChange={(v) => patchEth(e.name, { mode: v as AddressMode })}
                          disabled={!online}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ADDRESS_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </Field>
                    {e.mode === "manual" && (
                      <>
                        <Field label="IP地址">
                          <Input
                            value={e.ipInput}
                            onChange={(ev) => patchEth(e.name, { ipInput: ev.target.value })}
                            className="h-8 w-32"
                            disabled={!online}
                          />
                        </Field>
                        <Field label="网关">
                          <Input
                            value={e.gwInput}
                            onChange={(ev) => patchEth(e.name, { gwInput: ev.target.value })}
                            className="h-8 w-32"
                            disabled={!online}
                          />
                        </Field>
                        <Field label="子网掩码">
                          <Input
                            value={e.netmask}
                            onChange={(ev) => patchEth(e.name, { netmask: ev.target.value })}
                            className="h-8 w-32"
                            disabled={!online}
                          />
                        </Field>
                      </>
                    )}
                  </Grid>

                  <Grid>
                    <Field label="DNS1">
                      <Input
                        value={e.dns1}
                        onChange={(ev) => patchEth(e.name, { dns1: ev.target.value })}
                        className="h-8 w-32"
                        disabled={!online}
                      />
                    </Field>
                    <Field label="DNS2">
                      <Input
                        value={e.dns2}
                        onChange={(ev) => patchEth(e.name, { dns2: ev.target.value })}
                        className="h-8 w-32"
                        disabled={!online}
                      />
                    </Field>
                    <Field label="路由优先级">
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        value={e.routePriority}
                        onChange={(ev) =>
                          patchEth(e.name, { routePriority: Number(ev.target.value) })
                        }
                        className="h-8 w-20"
                        disabled={!online}
                      />
                    </Field>
                    <div className="flex items-end">
                      <Button
                        size="sm"
                        onClick={() => saveEth(e)}
                        disabled={!online || saving === e.name}
                      >
                        {saving === e.name && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        )}
                        修改
                      </Button>
                    </div>
                  </Grid>
                </div>
              )}
            </div>
          );
        })}

        {/* ====== 无线网络汇总头 ====== */}
        <div className="border border-border rounded-md overflow-hidden">
          <button
            type="button"
            onClick={() => setWifiOpen(!wifiOpen)}
            className="w-full flex items-center gap-6 px-3 py-2.5 bg-muted/20 hover:bg-muted/40 text-left"
          >
            <div className="flex items-center gap-2 min-w-28">
              <Wifi className="h-4 w-4 text-primary" />
              <span className="text-sm">无线网络:</span>
            </div>
            <Stat icon={<ArrowUp className="h-3.5 w-3.5 text-green-400" />} text={wifiUp} />
            <Stat icon={<ArrowDown className="h-3.5 w-3.5 text-blue-400" />} text={wifiDown} />
            <ChevronDown
              className={cn("h-4 w-4 ml-auto transition-transform", wifiOpen && "rotate-180")}
            />
          </button>
        </div>

        {/* ====== 各 modem / wlan ====== */}
        {modems.map((m, idx) => {
          const isOpen = openModem === m.interfaceName;
          const isWlan = m.interfaceName === "wlan0";
          const isWwan0 = m.interfaceName === "wwan0";
          return (
            <div key={m.interfaceName} className="border border-border rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenModem(isOpen ? null : m.interfaceName)}
                className="w-full flex items-center gap-4 px-3 py-2.5 bg-muted/20 hover:bg-muted/40 text-left"
              >
                <span className="text-xs text-muted-foreground w-5 text-center">{idx + 1}</span>
                <span className="text-sm min-w-20">{m.interfaceName}:</span>
                <Signal className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground min-w-20">{m.isp || "--"}</span>
                <span className="text-xs text-muted-foreground min-w-16">{m.mode || "--"}</span>
                <Stat icon={<ArrowUp className="h-3.5 w-3.5 text-green-400" />} text={m.tx} />
                <Stat icon={<ArrowDown className="h-3.5 w-3.5 text-blue-400" />} text={m.rx} />
                <ChevronDown
                  className={cn("h-4 w-4 ml-auto transition-transform", isOpen && "rotate-180")}
                />
              </button>

              {isOpen && (
                <div className="px-4 py-3 space-y-3">
                  <Grid>
                    <Field label="模块型号">{m.model || "--"}</Field>
                    <Field label="IMEI">{m.imei || "--"}</Field>
                    <Field label="状态">{statusText(m.status)}</Field>
                    <Field label="IMSI">{m.imsi || "--"}</Field>
                  </Grid>
                  <Grid>
                    <Field label="信号强度">{m.signal || "--"}</Field>
                    <Field label="Band">{m.band || "--"}</Field>
                    <Field label={isWlan ? "Speed" : "CellID"}>{m.cellId || "--"}</Field>
                    <Field label="IP">{m.ipv4 || "--"}</Field>
                  </Grid>

                  {isWlan ? (
                    <Grid>
                      <Field label="模式">
                        <div className="w-32">
                          <Select
                            value={m.wifiMode}
                            onValueChange={(v) => patchModem(m.interfaceName, { wifiMode: v })}
                            disabled={!online}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {WIFI_MODE_OPTIONS.map((o) => (
                                <SelectItem key={o} value={o}>
                                  {o}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </Field>
                      {m.wifiMode !== "close" && (
                        <>
                          <Field label="SSID">
                            <Input
                              value={m.wifiSsid}
                              onChange={(ev) =>
                                patchModem(m.interfaceName, { wifiSsid: ev.target.value })
                              }
                              className="h-8 w-44"
                              disabled={!online}
                            />
                          </Field>
                          <Field label="PSK">
                            <Input
                              type="password"
                              value={m.wifiPsk}
                              onChange={(ev) =>
                                patchModem(m.interfaceName, { wifiPsk: ev.target.value })
                              }
                              className="h-8 w-44"
                              disabled={!online}
                            />
                          </Field>
                        </>
                      )}
                      <Field label="路由优先级">
                        <Input
                          type="number"
                          min={0}
                          max={10}
                          value={m.routePriority}
                          onChange={(ev) =>
                            patchModem(m.interfaceName, {
                              routePriority: Number(ev.target.value),
                            })
                          }
                          className="h-8 w-20"
                          disabled={!online}
                        />
                      </Field>
                    </Grid>
                  ) : isWwan0 ? (
                    <Grid>
                      <Field label="自动拨号">
                        <Checkbox
                          checked={m.autoConnect}
                          onCheckedChange={(v) =>
                            patchModem(m.interfaceName, { autoConnect: !!v })
                          }
                          disabled={!online}
                        />
                      </Field>
                      <Field label="路由优先级">
                        <Input
                          type="number"
                          min={0}
                          max={10}
                          value={m.routePriority}
                          onChange={(ev) =>
                            patchModem(m.interfaceName, {
                              routePriority: Number(ev.target.value),
                            })
                          }
                          className="h-8 w-20"
                          disabled={!online}
                        />
                      </Field>
                      <Field label="指令">
                        <Input
                          value={m.ext}
                          maxLength={32}
                          placeholder="文本输入框"
                          onChange={(ev) =>
                            patchModem(m.interfaceName, { ext: ev.target.value })
                          }
                          className="h-8 w-40"
                          disabled={!online}
                        />
                      </Field>
                    </Grid>
                  ) : (
                    <Grid>
                      <Field label="自动拨号">
                        <Checkbox
                          checked={m.autoConnect}
                          onCheckedChange={(v) =>
                            patchModem(m.interfaceName, { autoConnect: !!v })
                          }
                          disabled={!online}
                        />
                      </Field>
                      <Field label="制式">
                        <div className="w-32">
                          <Select
                            value={m.nicMode || "LTE+NR"}
                            onValueChange={(v) => patchModem(m.interfaceName, { nicMode: v })}
                            disabled={!online}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {BAND_OPTIONS.map((o) => (
                                <SelectItem key={o} value={o}>
                                  {o}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </Field>
                      <Field label="指令">
                        <Input
                          value={m.ext}
                          maxLength={32}
                          placeholder="文本输入框"
                          onChange={(ev) =>
                            patchModem(m.interfaceName, { ext: ev.target.value })
                          }
                          className="h-8 w-40"
                          disabled={!online}
                        />
                      </Field>
                      <Field label="路由优先级">
                        <Input
                          type="number"
                          min={0}
                          max={10}
                          value={m.routePriority}
                          onChange={(ev) =>
                            patchModem(m.interfaceName, {
                              routePriority: Number(ev.target.value),
                            })
                          }
                          className="h-8 w-20"
                          disabled={!online}
                        />
                      </Field>
                    </Grid>
                  )}

                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => saveModem(m)}
                      disabled={!online || saving === m.interfaceName}
                    >
                      {saving === m.interfaceName && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      )}
                      修改
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-20">
      {icon}
      <span>{text}</span>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-4 gap-x-6 gap-y-2 items-start">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 min-h-8">
      <span className="text-xs text-muted-foreground whitespace-nowrap">{label}：</span>
      <div className="text-sm flex items-center">{children}</div>
    </div>
  );
}
