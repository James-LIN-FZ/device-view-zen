import { useState } from "react";
import {
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Monitor,
  Wifi,
  Signal,
  Network as NetworkIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
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

type AddressMode = "manual" | "dhcp";

interface EthernetIf {
  name: string; // eth0
  up: string;
  down: string;
  ip: string;
  gateway: string;
  mac: string;
  status: string; // 已连接/未连接
  mode: AddressMode;
  netmask: string;
  dns1: string;
  dns2: string;
  routePriority: number;
}

interface Modem {
  id: string;
  name: string; // wlan0 / wwan0 / wwan1
  interfaceName: string; // 例如 wwan0
  isp: string;
  mode: string;
  tx: string;
  rx: string;
  model: string;
  imei: string;
  status: 0 | 1 | 2;
  imsi: string;
  signal: string;
  band: string;
  cellId: string;
  ipv4: string;
  // editable
  autoConnect: boolean;
  nicMode: string; // 制式
  ext: string; // 指令
  routePriority: number;
  // wlan only
  wifiMode?: string; // close/client/ap
  wifiSsid?: string;
  wifiPsk?: string;
}

const DEFAULT_ETH: EthernetIf[] = [
  {
    name: "eth0",
    up: "0bps",
    down: "0bps",
    ip: "192.168.3.187",
    gateway: "192.168.3.1",
    mac: "AA:BB:CC:11:22:33",
    status: "已连接",
    mode: "dhcp",
    netmask: "255.255.255.0",
    dns1: "192.168.3.1",
    dns2: "8.8.8.8",
    routePriority: 1,
  },
  {
    name: "eth1",
    up: "0bps",
    down: "0bps",
    ip: "10.0.0.12",
    gateway: "10.0.0.1",
    mac: "AA:BB:CC:11:22:34",
    status: "未连接",
    mode: "manual",
    netmask: "255.255.255.0",
    dns1: "8.8.8.8",
    dns2: "",
    routePriority: 2,
  },
];

const DEFAULT_MODEMS: Modem[] = [
  {
    id: "m0",
    name: "wlan0",
    interfaceName: "wlan0",
    isp: "-  -",
    mode: "client",
    tx: "0bps",
    rx: "0bps",
    model: "MT7921",
    imei: "-  -",
    status: 2,
    imsi: "-  -",
    signal: "-65dBm",
    band: "5GHz",
    cellId: "150Mbps",
    ipv4: "192.168.1.23",
    autoConnect: true,
    nicMode: "",
    ext: "",
    routePriority: 3,
    wifiMode: "client",
    wifiSsid: "MyWiFi",
    wifiPsk: "",
  },
  {
    id: "m1",
    name: "wwan0",
    interfaceName: "wwan0",
    isp: "中国移动",
    mode: "5G",
    tx: "0bps",
    rx: "0bps",
    model: "RM500U",
    imei: "860000000000001",
    status: 2,
    imsi: "460000000000001",
    signal: "-72dBm",
    band: "n78",
    cellId: "0x12345",
    ipv4: "10.151.32.18",
    autoConnect: true,
    nicMode: "",
    ext: "",
    routePriority: 4,
  },
  {
    id: "m2",
    name: "wwan1",
    interfaceName: "wwan1",
    isp: "中国联通",
    mode: "LTE",
    tx: "0bps",
    rx: "0bps",
    model: "EC20",
    imei: "860000000000002",
    status: 1,
    imsi: "460010000000001",
    signal: "-80dBm",
    band: "B3",
    cellId: "0x23456",
    ipv4: "10.45.12.7",
    autoConnect: false,
    nicMode: "LTE+NR",
    ext: "",
    routePriority: 5,
  },
];

const ADDRESS_OPTIONS = [
  { label: "手动", value: "manual" },
  { label: "DHCP", value: "dhcp" },
];

const BAND_OPTIONS = ["LTE+NR", "NR_ONLY", "LTE_ONLY", "NR_79"];
const WIFI_MODE_OPTIONS = ["close", "client", "ap"];

function statusText(s: 0 | 1 | 2) {
  return s === 2 ? "已连接" : s === 1 ? "拨号中" : "未连接";
}

export function NetworkSettingsPanel() {
  const [eths, setEths] = useState<EthernetIf[]>(DEFAULT_ETH);
  const [modems, setModems] = useState<Modem[]>(DEFAULT_MODEMS);
  const [gwEnabled, setGwEnabled] = useState(false);
  const [aggEnabled, setAggEnabled] = useState(true);
  const [openEth, setOpenEth] = useState<string | null>("eth0");
  const [openModem, setOpenModem] = useState<string | null>("m0");
  const [wifiOpen, setWifiOpen] = useState(false);

  const upMbps = "0.0";
  const downMbps = "0.0";
  const wifiUp = "0bps";
  const wifiDown = "0bps";

  const patchEth = (name: string, p: Partial<EthernetIf>) =>
    setEths((prev) => prev.map((e) => (e.name === name ? { ...e, ...p } : e)));

  const patchModem = (id: string, p: Partial<Modem>) =>
    setModems((prev) => prev.map((m) => (m.id === id ? { ...m, ...p } : m)));

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
        <Stat icon={<ArrowDown className="h-3.5 w-3.5 text-blue-400" />} text={`${downMbps}Mbps`} />
        <div className="ml-auto flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm">超级网关：</span>
            <Switch checked={gwEnabled} onCheckedChange={setGwEnabled} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">聚合：</span>
            <Switch checked={aggEnabled} onCheckedChange={setAggEnabled} />
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
                <span className="text-xs text-muted-foreground">IP: {e.ip}</span>
                <span className="text-xs text-muted-foreground">Gateway: {e.gateway}</span>
                <ChevronDown
                  className={cn("h-4 w-4 ml-auto transition-transform", isOpen && "rotate-180")}
                />
              </button>
              {isOpen && (
                <div className="px-4 py-3 space-y-3">
                  <Grid>
                    <Field label="接口">{e.name}</Field>
                    <Field label="MAC">{e.mac}</Field>
                    <Field label="状态">{e.status}</Field>
                    <Field label="类型">WAN/ETH</Field>
                  </Grid>

                  <Grid>
                    <Field label="地址获取">
                      <div className="w-32">
                        <Select
                          value={e.mode}
                          onValueChange={(v) => patchEth(e.name, { mode: v as AddressMode })}
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
                            value={e.ip}
                            onChange={(ev) => patchEth(e.name, { ip: ev.target.value })}
                            className="h-8 w-32"
                          />
                        </Field>
                        <Field label="网关">
                          <Input
                            value={e.gateway}
                            onChange={(ev) => patchEth(e.name, { gateway: ev.target.value })}
                            className="h-8 w-32"
                          />
                        </Field>
                        <Field label="子网掩码">
                          <Input
                            value={e.netmask}
                            onChange={(ev) => patchEth(e.name, { netmask: ev.target.value })}
                            className="h-8 w-32"
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
                      />
                    </Field>
                    <Field label="DNS2">
                      <Input
                        value={e.dns2}
                        onChange={(ev) => patchEth(e.name, { dns2: ev.target.value })}
                        className="h-8 w-32"
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
                      />
                    </Field>
                    <div className="flex items-end">
                      <Button size="sm" onClick={() => toast.success(`${e.name} 已修改`)}>
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
          const isOpen = openModem === m.id;
          return (
            <div key={m.id} className="border border-border rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenModem(isOpen ? null : m.id)}
                className="w-full flex items-center gap-4 px-3 py-2.5 bg-muted/20 hover:bg-muted/40 text-left"
              >
                <span className="text-xs text-muted-foreground w-5 text-center">{idx + 1}</span>
                <span className="text-sm min-w-20">{m.name}:</span>
                <Signal className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground min-w-20">{m.isp}</span>
                <span className="text-xs text-muted-foreground min-w-16">{m.mode}</span>
                <Stat icon={<ArrowUp className="h-3.5 w-3.5 text-green-400" />} text={m.tx} />
                <Stat icon={<ArrowDown className="h-3.5 w-3.5 text-blue-400" />} text={m.rx} />
                <ChevronDown
                  className={cn("h-4 w-4 ml-auto transition-transform", isOpen && "rotate-180")}
                />
              </button>
              {isOpen && (
                <div className="px-4 py-3 space-y-3">
                  <Grid>
                    <Field label="模块型号">{m.model}</Field>
                    <Field label="IMEI">{m.imei}</Field>
                    <Field label="状态">{statusText(m.status)}</Field>
                    <Field label="IMSI">{m.imsi}</Field>
                  </Grid>
                  <Grid>
                    <Field label="信号强度">{m.signal}</Field>
                    <Field label="Band">{m.band}</Field>
                    <Field label={m.name === "wlan0" ? "Speed" : "CellID"}>{m.cellId}</Field>
                    <Field label="IP">{m.ipv4}</Field>
                  </Grid>

                  {/* 不同接口的可编辑区 */}
                  {m.name === "wlan0" ? (
                    <Grid>
                      <Field label="模式">
                        <div className="w-32">
                          <Select
                            value={m.wifiMode}
                            onValueChange={(v) => patchModem(m.id, { wifiMode: v })}
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
                              onChange={(e) => patchModem(m.id, { wifiSsid: e.target.value })}
                              className="h-8 w-44"
                            />
                          </Field>
                          <Field label="PSK">
                            <Input
                              type="password"
                              value={m.wifiPsk}
                              onChange={(e) => patchModem(m.id, { wifiPsk: e.target.value })}
                              className="h-8 w-44"
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
                          onChange={(e) =>
                            patchModem(m.id, { routePriority: Number(e.target.value) })
                          }
                          className="h-8 w-20"
                        />
                      </Field>
                    </Grid>
                  ) : m.name === "wwan0" ? (
                    <Grid>
                      <Field label="自动拨号">
                        <Checkbox
                          checked={m.autoConnect}
                          onCheckedChange={(v) => patchModem(m.id, { autoConnect: !!v })}
                        />
                      </Field>
                      <Field label="路由优先级">
                        <Input
                          type="number"
                          min={0}
                          max={10}
                          value={m.routePriority}
                          onChange={(e) =>
                            patchModem(m.id, { routePriority: Number(e.target.value) })
                          }
                          className="h-8 w-20"
                        />
                      </Field>
                      <Field label="指令">
                        <Input
                          value={m.ext}
                          maxLength={32}
                          placeholder="文本输入框"
                          onChange={(e) => patchModem(m.id, { ext: e.target.value })}
                          className="h-8 w-40"
                        />
                      </Field>
                    </Grid>
                  ) : (
                    <Grid>
                      <Field label="自动拨号">
                        <Checkbox
                          checked={m.autoConnect}
                          onCheckedChange={(v) => patchModem(m.id, { autoConnect: !!v })}
                        />
                      </Field>
                      <Field label="制式">
                        <div className="w-32">
                          <Select
                            value={m.nicMode}
                            onValueChange={(v) => patchModem(m.id, { nicMode: v })}
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
                      <Field label="路由优先级">
                        <Input
                          type="number"
                          min={0}
                          max={10}
                          value={m.routePriority}
                          onChange={(e) =>
                            patchModem(m.id, { routePriority: Number(e.target.value) })
                          }
                          className="h-8 w-20"
                        />
                      </Field>
                      <Field label="指令">
                        <Input
                          value={m.ext}
                          maxLength={32}
                          placeholder="文本输入框"
                          onChange={(e) => patchModem(m.id, { ext: e.target.value })}
                          className="h-8 w-60"
                        />
                      </Field>
                    </Grid>
                  )}

                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => toast.success(`${m.name} 已修改`)}>
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
