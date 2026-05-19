import { useState } from "react";
import { Plus, ArrowLeft, Trash2 } from "lucide-react";
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

interface Template {
  id: string;
  name: string;
  badges: { label: string; color: "hd" | "srt" | "follow" }[];
  // video
  videoCodec: string;
  rateControl: string;
  resolution: string;
  customWidth: string;
  customHeight: string;
  bitrateMode: string; // one of BITRATE_OPTIONS labels
  customBitrate: string; // kbps when bitrateMode = 自定义
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
  pullKey: string;
  subStream: string;
  subUrl: string;
  subDelayMs: number;
  localRecord: boolean;
}

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

const DEFAULTS: Template[] = [
  {
    id: "tpl1",
    name: "test_h264",
    badges: [
      { label: "HD", color: "hd" },
      { label: "SRT", color: "srt" },
    ],
    videoCodec: "H.264",
    rateControl: "CBR",
    resolution: "1920x1080",
    customWidth: "",
    customHeight: "",
    bitrateMode: "自定义",
    customBitrate: "3500",
    frameRate: "50",
    osd: false,
    gop: 50,
    audioCodec: "AAC",
    channels: "2",
    sampleRate: "48KHz",
    audioBitrate: "64Kbps",
    mainStream: "S-MUX",
    mainUrl: "",
    delayMs: 300,
    pullKey: "",
    subStream: "关闭",
    subUrl: "",
    subDelayMs: 500,
    localRecord: false,
  },
  {
    id: "tpl2",
    name: "test_h265",
    badges: [
      { label: "Follow", color: "follow" },
      { label: "SRT", color: "srt" },
    ],
    videoCodec: "H.265",
    rateControl: "CBR",
    resolution: "1920x1080",
    customWidth: "",
    customHeight: "",
    bitrateMode: "自定义",
    customBitrate: "6000",
    frameRate: "50",
    osd: false,
    gop: 50,
    audioCodec: "MP2",
    channels: "2",
    sampleRate: "48KHz",
    audioBitrate: "64Kbps",
    mainStream: "S-MUX",
    mainUrl: "",
    delayMs: 300,
    pullKey: "",
    subStream: "关闭",
    subUrl: "",
    subDelayMs: 500,
    localRecord: false,
  },
];

const badgeClass = (color: "hd" | "srt" | "follow") =>
  color === "srt" ? "bg-green-500 text-black" : "bg-yellow-400 text-black";

const subtitleFor = (t: Template) => {
  const bitrate =
    t.bitrateMode === "自定义"
      ? `${Math.round(Number(t.customBitrate || 0) / 1000) || (Number(t.customBitrate) / 1000).toFixed(1)}Mbps`
      : t.bitrateMode;
  return `${t.videoCodec}-${bitrate}/${t.audioCodec}-${t.audioBitrate}`;
};

export function TemplatesPanel() {
  const [items, setItems] = useState<Template[]>(DEFAULTS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const editing = items.find((t) => t.id === editingId) ?? null;
  const patch = (p: Partial<Template>) => {
    if (!editing) return;
    setItems((prev) => prev.map((t) => (t.id === editing.id ? { ...t, ...p } : t)));
  };

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    const id = `tpl${Date.now()}`;
    setItems((prev) => [
      ...prev,
      {
        ...DEFAULTS[0],
        id,
        name,
        badges: [{ label: "SRT", color: "srt" }],
      },
    ]);
    setNewName("");
    setCreateOpen(false);
    setEditingId(id);
  };

  const handleDelete = () => {
    if (!editing) return;
    setItems((prev) => prev.filter((t) => t.id !== editing.id));
    setEditingId(null);
  };

  if (editing) {
    const isSmux = editing.mainStream === "S-MUX";
    const mainOff = editing.mainStream === "关闭";
    const subOff = editing.subStream === "关闭";
    const mainShowDelay = editing.mainStream === "SRT" || isSmux;
    const subShowDelay = editing.subStream === "SRT";
    const customRes = editing.resolution === "自定义";
    const customBr = editing.bitrateMode === "自定义";

    // CBR is always selectable; ABR/SBR only when main is S-MUX (per reference)
    const rateDisabled = (v: string) => (v === "ABR" || v === "SBR") && !isSmux;

    return (
      <div className="-mt-2 -ml-2">
        <div className="flex items-center gap-2 mb-5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditingId(null)}
            className="gap-1 h-7 px-2 text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </Button>
          <h3 className="text-sm font-medium">修改模板</h3>
        </div>

        <div className="max-w-4xl grid grid-cols-[5rem_11rem_5rem_1fr] gap-x-3 gap-y-2.5 items-center">
          {/* ===== 视频部分 ===== */}
          <GLabel>模板名</GLabel>
          <div className="col-span-3">
            <Input value={editing.name} disabled className="max-w-xs" />
          </div>

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
            disabledOption={rateDisabled}
            onChange={(v) => patch({ rateControl: v })}
          />

          <GLabel>画面大小</GLabel>
          <Sel
            value={editing.resolution}
            options={RESOLUTIONS}
            onChange={(v) => patch({ resolution: v })}
          />
          {customRes ? (
            <div className="col-span-2 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">宽：</span>
              <Input
                value={editing.customWidth}
                onChange={(e) => patch({ customWidth: e.target.value })}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">高：</span>
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
                // S-MUX 时副流强制变为转发可选项；切回非 S-MUX 不动副流
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

          {/* 主流 延迟 + 拉流密钥(仅 S-MUX) */}
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
            <Button onClick={() => setEditingId(null)}>确定</Button>
            <Button variant="secondary" onClick={() => setEditingId(null)}>
              取消
            </Button>
          </div>
          <Button variant="destructive" onClick={handleDelete} className="gap-1">
            <Trash2 className="h-4 w-4" />
            删除
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="-mt-2 -ml-2">
      <h3 className="text-sm font-medium mb-4">模板列表</h3>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(208px,1fr))] gap-4">
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="aspect-[16/10] rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors flex items-center justify-center group"
        >
          <div className="h-11 w-11 rounded-full bg-muted/60 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
            <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
          </div>
        </button>

        {items.map((t) => (
          <div
            key={t.id}
            onClick={() => setEditingId(t.id)}
            className="aspect-[16/10] rounded-lg border-2 border-primary/60 bg-muted/30 hover:border-primary hover:shadow-lg transition-all cursor-pointer p-2.5 flex flex-col"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1.5">
                {t.badges.map((b, i) => (
                  <span
                    key={i}
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded",
                      badgeClass(b.color),
                    )}
                  >
                    {b.label}
                  </span>
                ))}
              </div>
              <span className="text-sm font-semibold truncate">{t.name}</span>
            </div>
            <div className="flex-1 flex items-center justify-center px-2 text-center">
              <span className="text-xs text-foreground/90">{subtitleFor(t)}</span>
            </div>
          </div>
        ))}
      </div>

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
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreate} disabled={!newName.trim()}>
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
    <label className="text-sm text-muted-foreground text-right">
      {children}：
    </label>
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
