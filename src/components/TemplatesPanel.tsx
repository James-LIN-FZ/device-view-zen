import { useEffect, useRef, useState } from "react";
import { Plus, ArrowLeft, Trash2, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { fetchDeviceRPCReply, requestDeviceRPC } from "@/lib/device-api";

// ── Device data types ─────────────────────────────────────────────────────────

interface DeviceTemplate {
  id: number | string;
  sName?: string;
  sDescriptor?: string;
  sResolution?: string;
  sSpecial?: string;
  // video
  sMainVCodec?: string;
  sMainVRC?: string;
  iMainVWidth?: number;
  iMainVHeight?: number;
  iMainVBitrate?: number;
  iMainVFps?: number;
  iMainVGop?: number;
  iOsd?: number;
  // audio
  sMainACodec?: string;
  iMainAChannels?: number;
  iMainASampleRate?: number;
  iMainABitrate?: number;
  // stream output 1 (main)
  sMainOutput1Protocol?: string;
  sMainOutput1Addr?: string;
  sMainOutput1Param?: string;
  // stream output 2 (sub/forward)
  sMainOutput2Protocol?: string;
  sMainOutput2Addr?: string;
  sMainOutput2Param?: string;
  // local recording
  iSubEnable?: number;
}

// ── UI edit form type ─────────────────────────────────────────────────────────

interface EditForm {
  sName: string; // read-only in edit mode
  // video
  videoCodec: string;
  rateControl: string;
  resolution: string;
  customWidth: string;
  customHeight: string;
  bitrateMode: string;
  customBitrate: string; // kbps when bitrateMode = "自定义"
  frameRate: string;
  osd: boolean;
  gop: number;
  // audio
  audioCodec: string;
  channels: string;
  sampleRate: string;
  audioBitrate: string;
  // stream
  mainStream: string;
  mainUrl: string;
  delayMs: number;
  pullKey: string; // S-MUX token
  subStream: string;
  subUrl: string;
  subDelayMs: number;
  localRecord: boolean;
}

// ── Static option lists ───────────────────────────────────────────────────────

const VIDEO_CODECS = ["H.265", "H.264"];
const RATE_CTRL = ["CBR", "ABR", "SBR", "GDR"];
const RESOLUTIONS = [
  "跟随源",
  "3840x2160",
  "1920x1080",
  "1280x720",
  "自定义",
  "960x540",
  "640x360",
  "720x576",
  "720x480",
];
const BITRATE_OPTIONS = [
  "2Mbps",
  "3Mbps",
  "4Mbps",
  "自定义",
  "6Mbps",
  "8Mbps",
  "10Mbps",
  "12Mbps",
  "14Mbps",
  "16Mbps",
  "20Mbps",
];
const FRAME_RATES = ["跟随源", "60", "50", "30", "25", "24"];
const AUDIO_CODECS = ["AAC", "MP2"];
const CHANNELS = ["1", "2"];
const SAMPLE_RATES = ["44.1KHz", "48KHz"];
const AUDIO_BITRATES = [
  "16Kbps",
  "32Kbps",
  "48Kbps",
  "64Kbps",
  "96Kbps",
  "128Kbps",
  "192Kbps",
  "256Kbps",
];
const STREAM_OPTIONS_MAIN = [
  "关闭",
  "S-MUX",
  "RTSP",
  "RTP",
  "TS Over UDP",
  "RTMP",
  "SRT",
];
const STREAM_OPTIONS_SUB = ["关闭", "RTSP", "RTP", "TS Over UDP", "RTMP", "SRT"];

const STREAM_PREFIX: Record<string, string> = {
  RTSP: "rtsp://",
  RTP: "rtp://",
  "TS Over UDP": "udp://",
  RTMP: "rtmp://",
  SRT: "srt://",
  "S-MUX": "srt://",
};

// ── Default form values for new templates ─────────────────────────────────────

const DEFAULT_FORM: EditForm = {
  sName: "",
  videoCodec: "H.265",
  rateControl: "CBR",
  resolution: "跟随源",
  customWidth: "",
  customHeight: "",
  bitrateMode: "4Mbps",
  customBitrate: "",
  frameRate: "跟随源",
  osd: false,
  gop: 50,
  audioCodec: "MP2",
  channels: "2",
  sampleRate: "48KHz",
  audioBitrate: "64Kbps",
  mainStream: "关闭",
  mainUrl: "",
  delayMs: 500,
  pullKey: "",
  subStream: "关闭",
  subUrl: "",
  subDelayMs: 500,
  localRecord: false,
};

// ── RPC helpers ───────────────────────────────────────────────────────────────

function waitMs(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function rpcCall(
  serialNo: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: string; data?: unknown } | null> {
  try {
    const ack = await requestDeviceRPC(serialNo, { method, path, body });
    const requestId = (ack.requestId || "").trim();
    if (!requestId) return null;
    const deadline = Date.now() + (ack.timeoutSeconds || 15) * 1000;
    while (Date.now() < deadline) {
      const reply = await fetchDeviceRPCReply(serialNo, requestId);
      if (reply && reply.status !== "pending") {
        return { status: reply.status, data: reply.data };
      }
      await waitMs(500);
    }
    return null;
  } catch {
    return null;
  }
}

function parseTemplates(data: unknown): DeviceTemplate[] {
  if (!Array.isArray(data)) return [];
  return data.filter(
    (item): item is DeviceTemplate => !!item && typeof item === "object",
  );
}

// ── Data conversion helpers ───────────────────────────────────────────────────

function extractLatency(param: string | undefined, defaultMs = 500): number {
  if (!param) return defaultMs;
  try {
    return (JSON.parse(param) as { latency?: number }).latency ?? defaultMs;
  } catch {
    return defaultMs;
  }
}

function addrToMainStream(protocol: string, addr: string): string {
  if (!protocol || protocol === "none" || !addr || addr === "none") return "关闭";
  if (protocol === "rtsp") return "RTSP";
  if (protocol === "rtp") return "RTP";
  if (protocol === "flv") return "RTMP";
  if (protocol === "mpegts") {
    if (addr.startsWith("srt://")) {
      return addr.includes("aggregation=1") ? "S-MUX" : "SRT";
    }
    if (addr.startsWith("udp://")) return "TS Over UDP";
  }
  return "关闭";
}

function addrToSubStream(protocol: string, addr: string): string {
  if (!protocol || protocol === "none" || !addr || addr === "none") return "关闭";
  if (protocol === "rtsp") return "RTSP";
  if (protocol === "rtp") return "RTP";
  if (protocol === "flv") return "RTMP";
  if (protocol === "mpegts") {
    if (addr.startsWith("srt://")) return "SRT";
    if (addr.startsWith("udp://")) return "TS Over UDP";
  }
  return "关闭";
}

const PRESET_RESOLUTIONS = [
  "3840x2160",
  "1920x1080",
  "1280x720",
  "960x540",
  "640x360",
  "720x576",
  "720x480",
];
const PRESET_MBPS = [2, 3, 4, 6, 8, 10, 12, 14, 16, 20];

function deviceToForm(t: DeviceTemplate): EditForm {
  // Resolution
  let resolution = "跟随源";
  let customWidth = "";
  let customHeight = "";
  const w = t.iMainVWidth ?? 0;
  const h = t.iMainVHeight ?? 0;
  if (w === 0 && h === 0) {
    resolution = "跟随源";
  } else {
    const key = `${w}x${h}`;
    if (PRESET_RESOLUTIONS.includes(key)) {
      resolution = key;
    } else {
      resolution = "自定义";
      customWidth = String(w);
      customHeight = String(h);
    }
  }

  // Bitrate
  let bitrateMode = "自定义";
  let customBitrate = "";
  const bps = t.iMainVBitrate ?? 0;
  const mbps = bps / 1_000_000;
  if (PRESET_MBPS.includes(mbps)) {
    bitrateMode = `${mbps}Mbps`;
  } else {
    bitrateMode = "自定义";
    customBitrate = String(Math.round(bps / 1000));
  }

  // Sample rate
  const sr = t.iMainASampleRate ?? 48000;
  const sampleRate = sr <= 44100 ? "44.1KHz" : "48KHz";

  // Audio bitrate
  const abr = t.iMainABitrate ?? 64000;
  const audioBitrate = `${Math.round(abr / 1000)}Kbps`;

  // Main stream
  const proto1 = t.sMainOutput1Protocol ?? "";
  const addr1 = t.sMainOutput1Addr ?? "none";
  const mainStream = addrToMainStream(proto1, addr1);
  let mainUrl = "";
  let pullKey = "";
  if (mainStream === "S-MUX") {
    const tokenMatch = addr1.match(/token=([^&]*)/);
    if (tokenMatch) pullKey = decodeURIComponent(tokenMatch[1]);
  } else if (mainStream !== "关闭") {
    const prefix = STREAM_PREFIX[mainStream] ?? "";
    mainUrl = addr1.startsWith(prefix) ? addr1.slice(prefix.length) : addr1;
  }
  const delayMs =
    mainStream === "SRT" || mainStream === "S-MUX"
      ? extractLatency(t.sMainOutput1Param)
      : 500;

  // Sub stream
  const proto2 = t.sMainOutput2Protocol ?? "";
  const addr2 = t.sMainOutput2Addr ?? "none";
  const subStream = addrToSubStream(proto2, addr2);
  let subUrl = "";
  if (subStream !== "关闭") {
    const prefix = STREAM_PREFIX[subStream] ?? "";
    subUrl = addr2.startsWith(prefix) ? addr2.slice(prefix.length) : addr2;
  }
  const subDelayMs = subStream === "SRT" ? extractLatency(t.sMainOutput2Param) : 500;

  const fps = t.iMainVFps ?? 0;
  const frameRate = fps === 0 ? "跟随源" : String(fps);

  return {
    sName: t.sName ?? "",
    videoCodec: t.sMainVCodec === "h264" ? "H.264" : "H.265",
    rateControl: (t.sMainVRC ?? "cbr").toUpperCase(),
    resolution,
    customWidth,
    customHeight,
    bitrateMode,
    customBitrate,
    frameRate,
    osd: (t.iOsd ?? 0) === 1,
    gop: t.iMainVGop ?? 50,
    audioCodec: (t.sMainACodec ?? "mp2").toUpperCase(),
    channels: String(t.iMainAChannels ?? 2),
    sampleRate,
    audioBitrate,
    mainStream,
    mainUrl,
    delayMs,
    pullKey,
    subStream,
    subUrl,
    subDelayMs,
    localRecord: (t.iSubEnable ?? 0) === 1,
  };
}

function buildOutput(
  stream: string,
  url: string,
  delayMs: number,
  token: string,
): { protocol: string; addr: string; param: string } {
  if (stream === "关闭") return { protocol: "none", addr: "none", param: "" };
  const prefixMap: Record<string, string> = {
    RTSP: "rtsp://",
    RTP: "rtp://",
    "TS Over UDP": "udp://",
    RTMP: "rtmp://",
    SRT: "srt://",
    "S-MUX": "srt://",
  };
  const protocolMap: Record<string, string> = {
    RTSP: "rtsp",
    RTP: "rtp",
    "TS Over UDP": "mpegts",
    RTMP: "flv",
    SRT: "mpegts",
    "S-MUX": "mpegts",
  };
  const protocol = protocolMap[stream] ?? "none";
  const prefix = prefixMap[stream] ?? "";
  let addr: string;
  if (stream === "S-MUX") {
    addr = token
      ? `srt://aggregation=1&token=${encodeURIComponent(token)}`
      : "srt://aggregation=1";
  } else {
    addr = prefix + url;
  }
  const hasSrtDelay = stream === "SRT" || stream === "S-MUX";
  const param = hasSrtDelay ? JSON.stringify({ latency: delayMs }) : "";
  return { protocol, addr, param };
}

function formToBody(form: EditForm): Record<string, unknown> {
  // Resolution
  let iMainVWidth = 0;
  let iMainVHeight = 0;
  if (form.resolution === "跟随源") {
    iMainVWidth = 0;
    iMainVHeight = 0;
  } else if (form.resolution === "自定义") {
    iMainVWidth = parseInt(form.customWidth) || 0;
    iMainVHeight = parseInt(form.customHeight) || 0;
  } else {
    const parts = form.resolution.split("x");
    iMainVWidth = parseInt(parts[0]) || 0;
    iMainVHeight = parseInt(parts[1]) || 0;
  }

  // Bitrate
  let iMainVBitrate = 0;
  if (form.bitrateMode === "自定义") {
    iMainVBitrate = (parseInt(form.customBitrate) || 0) * 1000;
  } else {
    const mbps = parseFloat(form.bitrateMode); // "4Mbps" → 4
    iMainVBitrate = mbps * 1_000_000;
  }

  const iMainVFps = form.frameRate === "跟随源" ? 0 : parseInt(form.frameRate) || 0;
  const iMainASampleRate = form.sampleRate === "44.1KHz" ? 44100 : 48000;
  const iMainABitrate = parseInt(form.audioBitrate) * 1000;

  const main = buildOutput(form.mainStream, form.mainUrl, form.delayMs, form.pullKey);
  const sub = buildOutput(form.subStream, form.subUrl, form.subDelayMs, "");

  return {
    sName: form.sName,
    sMainVCodec: form.videoCodec === "H.264" ? "h264" : "h265",
    sMainVRC: form.rateControl.toLowerCase(),
    iMainVWidth,
    iMainVHeight,
    iMainVBitrate,
    iMainVFps,
    iMainVGop: form.gop,
    iMainVGOP: form.gop,
    iOsd: form.osd ? 1 : 0,
    sMainACodec: form.audioCodec.toLowerCase(),
    iMainAChannels: parseInt(form.channels),
    iMainASampleRate,
    iMainABitrate,
    sMainOutput1Protocol: main.protocol,
    sMainOutput1Addr: main.addr,
    sMainOutput1Param: main.param,
    sMainOutput2Protocol: sub.protocol,
    sMainOutput2Addr: sub.addr,
    sMainOutput2Param: sub.param,
    iSubEnable: form.localRecord ? 1 : 0,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TemplatesPanel({
  serialNo,
  online,
}: {
  serialNo: string;
  online: boolean;
}) {
  const [templates, setTemplates] = useState<DeviceTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DeviceTemplate | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(DEFAULT_FORM);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!serialNo) return;
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialNo, online]);

  async function loadTemplates() {
    setLoading(true);
    const result = await rpcCall(serialNo, "GET", "/template");
    if (!mountedRef.current) return;
    setLoading(false);
    if (result?.status === "ok") {
      setTemplates(parseTemplates(result.data));
    }
  }

  function openEdit(t: DeviceTemplate) {
    setEditingTemplate(t);
    setEditForm(deviceToForm(t));
  }

  function closeEdit() {
    setEditingTemplate(null);
  }

  const patch = (fields: Partial<EditForm>) =>
    setEditForm((prev) => ({ ...prev, ...fields }));

  async function saveEdit() {
    if (!editingTemplate) return;
    setSaving(true);
    const body = formToBody(editForm);
    await rpcCall(serialNo, "POST", `/template/${editingTemplate.id}`, body);
    if (!mountedRef.current) return;
    setSaving(false);
    closeEdit();
    await loadTemplates();
  }

  async function handleDelete() {
    if (!editingTemplate) return;
    setSaving(true);
    await rpcCall(serialNo, "DELETE", `/template/${editingTemplate.id}`);
    if (!mountedRef.current) return;
    setSaving(false);
    closeEdit();
    await loadTemplates();
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    const body = formToBody({ ...DEFAULT_FORM, sName: name });
    await rpcCall(serialNo, "POST", "/template", body);
    if (!mountedRef.current) return;
    setCreating(false);
    setCreateOpen(false);
    setNewName("");
    await loadTemplates();
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const editing = editForm;
  const mainOff = editing.mainStream === "关闭";
  const isSmux = editing.mainStream === "S-MUX";
  const mainShowDelay = !mainOff && (editing.mainStream === "SRT" || isSmux);
  const subOff = editing.subStream === "关闭";
  const subShowDelay = !subOff && editing.subStream === "SRT";
  const customRes = editing.resolution === "自定义";
  const customBr = editing.bitrateMode === "自定义";

  // ── Edit panel ────────────────────────────────────────────────────────────

  if (editingTemplate) {
    return (
      <div className="-mt-2 -ml-2">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="sm" onClick={closeEdit} className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            返回
          </Button>
          <h3 className="text-sm font-medium">{editingTemplate.sName}</h3>
        </div>

        <div className="grid grid-cols-[5rem_1fr_5rem_1fr] items-center gap-x-4 gap-y-3 max-w-4xl">
          {/* ===== 视频部分 ===== */}
          <GLabel>视频编码</GLabel>
          <Sel
            value={editing.videoCodec}
            options={VIDEO_CODECS}
            onChange={(v) => patch({ videoCodec: v })}
          />
          <GLabel>码率控制</GLabel>
          <Sel
            value={editing.rateControl}
            options={RATE_CTRL}
            onChange={(v) => patch({ rateControl: v })}
            disabledOption={(v) => (v === "ABR" || v === "SBR") && !isSmux}
          />

          <GLabel>画面大小</GLabel>
          <Sel
            value={editing.resolution}
            options={RESOLUTIONS}
            onChange={(v) =>
              patch({
                resolution: v,
                customWidth: v === "自定义" ? editing.customWidth : "",
                customHeight: v === "自定义" ? editing.customHeight : "",
              })
            }
          />
          {customRes ? (
            <div className="col-span-2 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">宽</span>
              <Input
                value={editing.customWidth}
                onChange={(e) => patch({ customWidth: e.target.value })}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">高</span>
              <Input
                value={editing.customHeight}
                onChange={(e) => patch({ customHeight: e.target.value })}
                className="w-24"
              />
            </div>
          ) : (
            <div className="col-span-2" />
          )}

          <GLabel>视频码率</GLabel>
          <Sel
            value={editing.bitrateMode}
            options={BITRATE_OPTIONS}
            onChange={(v) => patch({ bitrateMode: v })}
          />
          {customBr ? (
            <div className="col-span-2 flex items-center gap-2">
              <Input
                value={editing.customBitrate}
                onChange={(e) => patch({ customBitrate: e.target.value })}
                className="w-32"
              />
              <span className="text-sm text-muted-foreground">kbps</span>
            </div>
          ) : (
            <div className="col-span-2" />
          )}

          <GLabel>输出帧率</GLabel>
          <Sel
            value={editing.frameRate}
            options={FRAME_RATES}
            onChange={(v) => patch({ frameRate: v })}
          />
          <GLabel>OSD</GLabel>
          <div>
            <Checkbox
              checked={editing.osd}
              onCheckedChange={(v) => patch({ osd: !!v })}
            />
          </div>

          <GLabel>GOP</GLabel>
          <div className="col-span-3">
            <Input
              type="number"
              min={1}
              max={200}
              value={editing.gop}
              onChange={(e) => patch({ gop: Number(e.target.value) })}
              className="w-32"
            />
          </div>

          {/* ===== 音频部分 ===== */}
          <div className="col-span-4 border-t border-border my-2" />

          <GLabel>音频编码</GLabel>
          <Sel
            value={editing.audioCodec}
            options={AUDIO_CODECS}
            onChange={(v) => patch({ audioCodec: v })}
          />
          <GLabel>声道数</GLabel>
          <Sel
            value={editing.channels}
            options={CHANNELS}
            onChange={(v) => patch({ channels: v })}
          />

          <GLabel>采样率</GLabel>
          <Sel
            value={editing.sampleRate}
            options={SAMPLE_RATES}
            onChange={(v) => patch({ sampleRate: v })}
          />
          <div className="col-span-2" />

          <GLabel>音频码率</GLabel>
          <Sel
            value={editing.audioBitrate}
            options={AUDIO_BITRATES}
            onChange={(v) => patch({ audioBitrate: v })}
          />
          <div className="col-span-2" />

          {/* ===== 流配置 ===== */}
          <div className="col-span-4 border-t border-border my-2" />

          {/* 主流 + 推流/聚合地址 */}
          <GLabel>主流</GLabel>
          <Sel
            value={editing.mainStream}
            options={STREAM_OPTIONS_MAIN}
            onChange={(v) =>
              patch({
                mainStream: v,
                mainUrl: v === "S-MUX" ? "" : editing.mainUrl,
              })
            }
          />
          {mainOff ? (
            <div className="col-span-2" />
          ) : isSmux ? (
            <>
              <GLabel>聚合地址</GLabel>
              <Input
                value="Auto (后台自动配置)"
                readOnly
                className="max-w-md bg-muted/40"
              />
            </>
          ) : (
            <>
              <GLabel>推流地址</GLabel>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {STREAM_PREFIX[editing.mainStream] ?? ""}
                </span>
                <Input
                  value={editing.mainUrl}
                  onChange={(e) => patch({ mainUrl: e.target.value })}
                  className="max-w-md"
                />
              </div>
            </>
          )}

          {/* 主流延迟 + 拉流密钥（仅 S-MUX） */}
          {mainShowDelay && (
            <>
              <GLabel>延迟(ms)</GLabel>
              <Input
                type="number"
                min={50}
                max={15000}
                step={50}
                value={editing.delayMs}
                onChange={(e) => patch({ delayMs: Number(e.target.value) })}
                className="w-32"
              />
              {isSmux ? (
                <>
                  <GLabel>拉流密钥</GLabel>
                  <Input
                    value={editing.pullKey}
                    onChange={(e) => patch({ pullKey: e.target.value })}
                    placeholder="默认空"
                    className="max-w-xs"
                  />
                </>
              ) : (
                <div className="col-span-2" />
              )}
            </>
          )}

          {/* 副流 / 转发 */}
          <GLabel>{isSmux ? "转发" : "副流"}</GLabel>
          <Sel
            value={editing.subStream}
            options={STREAM_OPTIONS_SUB}
            onChange={(v) => patch({ subStream: v })}
          />
          {subOff ? (
            <div className="col-span-2" />
          ) : (
            <>
              <GLabel>推流地址</GLabel>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {STREAM_PREFIX[editing.subStream] ?? ""}
                </span>
                <Input
                  value={editing.subUrl}
                  onChange={(e) => patch({ subUrl: e.target.value })}
                  className="max-w-md"
                />
              </div>
            </>
          )}

          {subShowDelay && (
            <>
              <GLabel>延迟(ms)</GLabel>
              <div className="col-span-3">
                <Input
                  type="number"
                  min={50}
                  max={15000}
                  step={50}
                  value={editing.subDelayMs}
                  onChange={(e) => patch({ subDelayMs: Number(e.target.value) })}
                  className="w-32"
                />
              </div>
            </>
          )}

          <GLabel>本地录制</GLabel>
          <div className="col-span-3">
            <Checkbox
              checked={editing.localRecord}
              onCheckedChange={(v) => patch({ localRecord: !!v })}
            />
          </div>
        </div>

        <div className="max-w-4xl flex items-center justify-between pt-6">
          <div className="flex gap-3">
            <Button onClick={saveEdit} disabled={saving} className="gap-1">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              保存
            </Button>
            <Button variant="secondary" onClick={closeEdit} disabled={saving}>
              取消
            </Button>
          </div>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={saving}
            className="gap-1"
          >
            <Trash2 className="h-4 w-4" />
            删除
          </Button>
        </div>
      </div>
    );
  }

  // ── Template list ─────────────────────────────────────────────────────────

  return (
    <div className="-mt-2 -ml-2">
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-sm font-medium">模板列表</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={loadTemplates}
          disabled={loading}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </Button>
      </div>

      {loading && templates.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载中…
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(208px,1fr))] gap-4">
          {templates.length < 10 && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="aspect-[16/10] rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors flex items-center justify-center group"
            >
              <div className="h-11 w-11 rounded-full bg-muted/60 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
                <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
              </div>
            </button>
          )}

          {templates.map((t) => (
            <div
              key={t.id}
              onClick={() => openEdit(t)}
              className="relative aspect-[16/10] rounded-lg border-2 border-primary/60 bg-muted/30 hover:border-primary hover:shadow-lg transition-all cursor-pointer p-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-1.5 shrink-0">
                  {t.sResolution && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-400 text-black">
                      {t.sResolution}
                    </span>
                  )}
                  {t.sSpecial && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-green-500 text-black">
                      {t.sSpecial}
                    </span>
                  )}
                </div>
                <span className="text-sm font-semibold truncate">{t.sName}</span>
              </div>
              <div className="absolute inset-0 flex items-center justify-center px-3 text-center pointer-events-none">
                <span className="text-sm text-foreground/90 leading-snug">{t.sDescriptor ?? ""}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建模板</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-sm text-muted-foreground">模板名</label>
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="请输入模板名"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              取消
            </Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || creating}>
              {creating && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-sm text-muted-foreground text-right">{children}：</label>
  );
}

function Sel({
  value,
  options,
  onChange,
  disabledOption,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  disabledOption?: (v: string) => boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o} disabled={disabledOption?.(o)}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
