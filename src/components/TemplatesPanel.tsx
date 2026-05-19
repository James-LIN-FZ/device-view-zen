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
  bitrateMode: string;
  videoBitrate: number; // kbps
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
  aggregateAddress: string;
  delayMs: number;
  pullKey: string;
  forward: string;
  localRecord: boolean;
}

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
    bitrateMode: "自定义",
    videoBitrate: 3500,
    frameRate: "50",
    osd: false,
    gop: 50,
    audioCodec: "AAC",
    channels: "2",
    sampleRate: "48KHz",
    audioBitrate: "64Kbps",
    mainStream: "S-MUX",
    aggregateAddress: "Auto (后台自动配置)",
    delayMs: 300,
    pullKey: "",
    forward: "关闭",
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
    bitrateMode: "自定义",
    videoBitrate: 6000,
    frameRate: "50",
    osd: false,
    gop: 50,
    audioCodec: "MP2",
    channels: "2",
    sampleRate: "48KHz",
    audioBitrate: "64Kbps",
    mainStream: "S-MUX",
    aggregateAddress: "Auto (后台自动配置)",
    delayMs: 300,
    pullKey: "",
    forward: "关闭",
    localRecord: false,
  },
];

const VIDEO_CODECS = ["H.264", "H.265"];
const RATE_CTRL = ["CBR", "VBR"];
const RESOLUTIONS = ["1920x1080", "1280x720", "3840x2160"];
const BITRATE_MODES = ["自定义", "自动"];
const FRAME_RATES = ["25", "30", "50", "60"];
const AUDIO_CODECS = ["AAC", "MP2", "Opus"];
const CHANNELS = ["1", "2"];
const SAMPLE_RATES = ["32KHz", "44.1KHz", "48KHz"];
const AUDIO_BITRATES = ["64Kbps", "128Kbps", "192Kbps", "256Kbps"];
const MAIN_STREAMS = ["S-MUX", "RTMP", "SRT"];
const FORWARDS = ["关闭", "开启"];

const badgeClass = (color: "hd" | "srt" | "follow") =>
  color === "srt"
    ? "bg-green-500 text-black"
    : "bg-yellow-400 text-black";

const subtitleFor = (t: Template) =>
  `${t.videoCodec}-${(t.videoBitrate / 1000).toFixed(0)}Mbps/${t.audioCodec}-${t.audioBitrate}`;

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
          <GLabel>模板名</GLabel>
          <div className="col-span-3">
            <Input
              value={editing.name}
              onChange={(e) => patch({ name: e.target.value })}
              className="max-w-xs"
            />
          </div>

          <GLabel>视频编码</GLabel>
          <Sel value={editing.videoCodec} options={VIDEO_CODECS} onChange={(v) => patch({ videoCodec: v })} />
          <GLabel>码率控制</GLabel>
          <div className="w-44">
            <Sel value={editing.rateControl} options={RATE_CTRL} onChange={(v) => patch({ rateControl: v })} />
          </div>

          <GLabel>画面大小</GLabel>
          <div className="col-span-3 w-60">
            <Sel value={editing.resolution} options={RESOLUTIONS} onChange={(v) => patch({ resolution: v })} />
          </div>

          <GLabel>视频码率</GLabel>
          <Sel value={editing.bitrateMode} options={BITRATE_MODES} onChange={(v) => patch({ bitrateMode: v })} />
          <div className="col-span-2 flex items-center gap-2">
            <Input
              type="number"
              value={editing.videoBitrate}
              onChange={(e) => patch({ videoBitrate: Number(e.target.value) })}
              className="w-32"
            />
            <span className="text-sm text-muted-foreground">kbps</span>
          </div>

          <GLabel>输出帧率</GLabel>
          <Sel value={editing.frameRate} options={FRAME_RATES} onChange={(v) => patch({ frameRate: v })} />
          <GLabel>OSD</GLabel>
          <div>
            <Checkbox checked={editing.osd} onCheckedChange={(v) => patch({ osd: !!v })} />
          </div>

          <GLabel>GOP</GLabel>
          <div className="col-span-3">
            <Input
              type="number"
              value={editing.gop}
              onChange={(e) => patch({ gop: Number(e.target.value) })}
              className="w-32"
            />
          </div>

          <div className="col-span-4 border-t border-border my-2" />

          <GLabel>音频编码</GLabel>
          <Sel value={editing.audioCodec} options={AUDIO_CODECS} onChange={(v) => patch({ audioCodec: v })} />
          <GLabel>声道数</GLabel>
          <div className="w-44">
            <Sel value={editing.channels} options={CHANNELS} onChange={(v) => patch({ channels: v })} />
          </div>

          <GLabel>采样率</GLabel>
          <div className="col-span-3">
            <Sel value={editing.sampleRate} options={SAMPLE_RATES} onChange={(v) => patch({ sampleRate: v })} />
          </div>

          <GLabel>音频码率</GLabel>
          <div className="col-span-3">
            <Sel value={editing.audioBitrate} options={AUDIO_BITRATES} onChange={(v) => patch({ audioBitrate: v })} />
          </div>

          <div className="col-span-4 border-t border-border my-2" />

          <GLabel>主流</GLabel>
          <Sel value={editing.mainStream} options={MAIN_STREAMS} onChange={(v) => patch({ mainStream: v })} />
          <GLabel>聚合地址</GLabel>
          <Input
            value={editing.aggregateAddress}
            onChange={(e) => patch({ aggregateAddress: e.target.value })}
            className="max-w-md"
          />

          <GLabel>延迟(ms)</GLabel>
          <Input
            type="number"
            value={editing.delayMs}
            onChange={(e) => patch({ delayMs: Number(e.target.value) })}
            className="w-32"
          />
          <GLabel>拉流密钥</GLabel>
          <Input
            value={editing.pullKey}
            onChange={(e) => patch({ pullKey: e.target.value })}
            placeholder="默认空"
            className="max-w-xs"
          />

          <GLabel>转发</GLabel>
          <div className="col-span-3">
            <Sel value={editing.forward} options={FORWARDS} onChange={(v) => patch({ forward: v })} />
          </div>

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
            <Button variant="secondary" onClick={() => setEditingId(null)}>取消</Button>
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
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={!newName.trim()}>确定</Button>
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
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
