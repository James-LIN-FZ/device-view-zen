import { useState } from "react";
import { Plus, Play, ArrowLeft, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface EncodingTask {
  id: string;
  name: string;
  videoSource: string;
  audioSource: string;
  deinterlace: string;
  mainTemplate: string;
  subTemplate: string;
  badges: { label: string; color: "hd" | "srt" | "follow" }[];
  playing: boolean;
}

const DEFAULT_TASKS: EncodingTask[] = [
  {
    id: "t1",
    name: "MGTV",
    videoSource: "HDMI",
    audioSource: "Default(跟随视频源)",
    deinterlace: "关闭",
    mainTemplate: "test_h264",
    subTemplate: "关闭",
    badges: [
      { label: "HD", color: "hd" },
      { label: "SRT", color: "srt" },
    ],
    playing: true,
  },
  {
    id: "t2",
    name: "新的模板",
    videoSource: "SDI",
    audioSource: "Default(跟随视频源)",
    deinterlace: "关闭",
    mainTemplate: "test_h264",
    subTemplate: "关闭",
    badges: [
      { label: "Follow", color: "follow" },
      { label: "SRT", color: "srt" },
    ],
    playing: false,
  },
];

const VIDEO_SOURCES = ["HDMI", "SDI", "USB", "NDI"];
const AUDIO_SOURCES = ["Default(跟随视频源)", "Line In", "Mic In"];
const DEINTERLACE_OPTIONS = ["关闭", "开启"];
const TEMPLATES = ["test_h264", "test_h265", "高清直播", "标清直播"];
const SUB_TEMPLATES = ["关闭", "test_h264", "test_h265"];

const badgeClass = (color: "hd" | "srt" | "follow") =>
  color === "hd"
    ? "bg-yellow-400 text-black"
    : color === "srt"
      ? "bg-green-500 text-black"
      : "bg-yellow-400 text-black";

export function EncodingTasksPanel() {
  const [tasks, setTasks] = useState<EncodingTask[]>(DEFAULT_TASKS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const editing = tasks.find((t) => t.id === editingId) ?? null;

  const updateEditing = (patch: Partial<EncodingTask>) => {
    if (!editing) return;
    setTasks((prev) =>
      prev.map((t) => (t.id === editing.id ? { ...t, ...patch } : t)),
    );
  };

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    const id = `t${Date.now()}`;
    setTasks((prev) => [
      ...prev,
      {
        id,
        name,
        videoSource: "HDMI",
        audioSource: "Default(跟随视频源)",
        deinterlace: "关闭",
        mainTemplate: "test_h264",
        subTemplate: "关闭",
        badges: [{ label: "SRT", color: "srt" }],
        playing: false,
      },
    ]);
    setNewName("");
    setCreateOpen(false);
    setEditingId(id);
  };

  const handleDelete = () => {
    if (!editing) return;
    setTasks((prev) => prev.filter((t) => t.id !== editing.id));
    setEditingId(null);
  };

  const togglePlay = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, playing: !t.playing } : t)),
    );
  };

  if (editing) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditingId(null)}
            className="gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </Button>
          <h3 className="text-base font-semibold">修改任务</h3>
        </div>

        <div className="max-w-3xl space-y-5">
          <Row label="任务名">
            <Input
              value={editing.name}
              onChange={(e) => updateEditing({ name: e.target.value })}
              className="max-w-md"
            />
          </Row>
          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            <Row label="视频源">
              <SelectBox
                value={editing.videoSource}
                options={VIDEO_SOURCES}
                onChange={(v) => updateEditing({ videoSource: v })}
              />
            </Row>
            <Row label="音频源">
              <SelectBox
                value={editing.audioSource}
                options={AUDIO_SOURCES}
                onChange={(v) => updateEditing({ audioSource: v })}
              />
            </Row>
            <Row label="源去交错">
              <SelectBox
                value={editing.deinterlace}
                options={DEINTERLACE_OPTIONS}
                onChange={(v) => updateEditing({ deinterlace: v })}
              />
            </Row>
            <Row label="主模版">
              <SelectBox
                value={editing.mainTemplate}
                options={TEMPLATES}
                onChange={(v) => updateEditing({ mainTemplate: v })}
              />
            </Row>
            <Row label="副模版">
              <SelectBox
                value={editing.subTemplate}
                options={SUB_TEMPLATES}
                onChange={(v) => updateEditing({ subTemplate: v })}
              />
            </Row>
          </div>

          <div className="flex items-center justify-between pt-6">
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
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-base font-semibold mb-5">任务列表</h3>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5">
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="aspect-[16/10] rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors flex items-center justify-center group"
        >
          <div className="h-14 w-14 rounded-full bg-muted/60 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
            <Plus className="h-7 w-7 text-muted-foreground group-hover:text-primary" />
          </div>
        </button>

        {tasks.map((task) => (
          <div
            key={task.id}
            onClick={() => setEditingId(task.id)}
            className="aspect-[16/10] rounded-lg border-2 border-primary/60 bg-muted/30 hover:border-primary hover:shadow-lg transition-all cursor-pointer p-3 flex flex-col"
          >
            <div className="flex gap-1.5">
              {task.badges.map((b, i) => (
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
            <div className="flex-1 flex items-center justify-center">
              <span className="text-lg font-semibold">{task.name}</span>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={(e) => togglePlay(task.id, e)}
                className={cn(
                  "text-xs font-bold px-3 py-1 rounded border transition-colors flex items-center gap-1",
                  task.playing
                    ? "border-green-500 text-green-400 bg-green-500/10"
                    : "border-border text-muted-foreground hover:border-primary hover:text-primary",
                )}
              >
                <Play className="h-3 w-3" fill="currentColor" />
                PLAY
              </button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建编码任务</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-sm text-muted-foreground">任务名</label>
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="请输入任务名"
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <label className="text-sm text-muted-foreground w-20 shrink-0 text-right">
        {label}：
      </label>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function SelectBox({
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
      <SelectTrigger className="max-w-md">
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
