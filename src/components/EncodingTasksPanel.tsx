import { useEffect, useRef, useState } from "react";
import { Plus, Play, Square, ArrowLeft, Trash2, Loader2, RefreshCw } from "lucide-react";
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
import { fetchDeviceRPCReply, requestDeviceRPC } from "@/lib/device-api";

// ── Device data types ────────────────────────────────────────────────────────

interface DeviceEncodeTask {
  id: number | string;
  sName?: string;
  sDevice?: string;
  sAudio?: string;
  iTemplate?: number | string;
  sTemplate?: string;
  sDeinterlace?: string;
  iSubTemplate?: number | string;
  sSubTemplate?: string;
  iEnable?: number;
  sResolution?: string;
  sSpecial?: string;
}

interface DeviceTemplate {
  id: number | string;
  sName?: string;
}

// ── Static options (matching original device UI from addencode.vue) ──────────

const VIDEO_SOURCES: { label: string; value: string }[] = [
  { label: "SDI", value: "sdi" },
  { label: "HDMI", value: "hdmi" },
  { label: "DJIPocket3-Preview", value: "DJIPocket3_p0" },
  { label: "DJIPocket3-Normal", value: "DJIPocket3_p1" },
];

const AUDIO_SOURCES: { label: string; value: string }[] = [
  { label: "Default(跟随视频源)", value: "default" },
  { label: "Headset(耳机)", value: "line_in" },
];

const DEINTERLACE_OPTIONS: { label: string; value: string }[] = [
  { label: "关闭", value: "none" },
  { label: "AI质量优先", value: "ai_quality_x2" },
  { label: "AI速度优先", value: "ai_fast_x2" },
  { label: "顶底场分离", value: "split" },
  { label: "Weave", value: "weave" },
  { label: "Bob", value: "bob" },
  { label: "Bob仅顶场", value: "bob_top" },
];

// Sentinel value used in the UI for "sub-template disabled"
const SUB_TEMPLATE_NONE = "__none__";

// ── Helpers ──────────────────────────────────────────────────────────────────

function waitMs(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Fire a device RPC call and poll until the reply arrives (or timeout).
 * Returns { status, data } on completion, or null on timeout/error.
 */
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

function parseEncodeTasks(data: unknown): DeviceEncodeTask[] {
  if (!Array.isArray(data)) return [];
  return data.filter((item): item is DeviceEncodeTask => !!item && typeof item === "object");
}

function parseTemplates(data: unknown): DeviceTemplate[] {
  if (!Array.isArray(data)) return [];
  return data.filter((item): item is DeviceTemplate => !!item && typeof item === "object");
}

function labelForVideoSource(value?: string): string {
  if (!value) return "--";
  return VIDEO_SOURCES.find((o) => o.value === value)?.label ?? value;
}

// ── Edit form ────────────────────────────────────────────────────────────────

interface EditForm {
  sName: string;
  sDevice: string;
  sAudio: string;
  sDeinterlace: string;
  /** String id of selected main template, or "" when none */
  iTemplate: string;
  sTemplate: string;
  /** String id of selected sub-template, or SUB_TEMPLATE_NONE when disabled */
  iSubTemplate: string;
  sSubTemplate: string;
}

const EMPTY_FORM: EditForm = {
  sName: "",
  sDevice: "sdi",
  sAudio: "default",
  sDeinterlace: "none",
  iTemplate: "",
  sTemplate: "",
  iSubTemplate: SUB_TEMPLATE_NONE,
  sSubTemplate: "",
};

function taskToForm(task: DeviceEncodeTask): EditForm {
  const rawSub = task.iSubTemplate;
  const subDisabled =
    rawSub == null ||
    rawSub === "" ||
    rawSub === -1 ||
    rawSub === "-1" ||
    rawSub === "none";
  return {
    sName: task.sName ?? "",
    sDevice: task.sDevice ?? "sdi",
    sAudio: task.sAudio ?? "default",
    sDeinterlace: task.sDeinterlace ?? "none",
    iTemplate: task.iTemplate != null ? String(task.iTemplate) : "",
    sTemplate: task.sTemplate ?? "",
    iSubTemplate: subDisabled ? SUB_TEMPLATE_NONE : String(rawSub),
    sSubTemplate: subDisabled ? "" : (task.sSubTemplate ?? ""),
  };
}

/** Convert the UI form to the request body expected by POST /encode or POST /encode/{id} */
function formToBody(form: EditForm): Record<string, unknown> {
  const iSubTemplate =
    form.iSubTemplate === SUB_TEMPLATE_NONE ? -1 : Number(form.iSubTemplate);
  return {
    sName: form.sName.trim(),
    sDevice: form.sDevice,
    sAudio: form.sAudio,
    iTemplate: form.iTemplate ? Number(form.iTemplate) : undefined,
    sTemplate: form.sTemplate,
    sDeinterlace: form.sDeinterlace,
    iSubTemplate,
    sSubTemplate: form.iSubTemplate === SUB_TEMPLATE_NONE ? "" : form.sSubTemplate,
  };
}

// ── Component ────────────────────────────────────────────────────────────────

export function EncodingTasksPanel({
  serialNo,
  online,
}: {
  serialNo: string;
  online: boolean;
}) {
  const [tasks, setTasks] = useState<DeviceEncodeTask[]>([]);
  const [templates, setTemplates] = useState<DeviceTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingTask, setEditingTask] = useState<DeviceEncodeTask | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_FORM);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<EditForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadTasks = async () => {
    if (!serialNo || !online) {
      setTasks([]);
      return;
    }
    setLoading(true);
    const result = await rpcCall(serialNo, "GET", "/encode");
    if (!mountedRef.current) return;
    setLoading(false);
    if (result?.status === "ok") {
      setTasks(parseEncodeTasks(result.data));
    }
  };

  const loadTemplates = async () => {
    if (!serialNo || !online) return;
    const result = await rpcCall(serialNo, "GET", "/template");
    if (!mountedRef.current) return;
    if (result?.status === "ok") {
      setTemplates(parseTemplates(result.data));
    }
  };

  useEffect(() => {
    setTasks([]);
    void loadTasks();
    void loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialNo, online]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const togglePlay = async (task: DeviceEncodeTask, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!online || !serialNo || submitting || task.id == null) return;
    setSubmitting(true);
    const path =
      task.iEnable === 1
        ? `/encode/${task.id}/disable`
        : `/encode/${task.id}/enable`;
    await rpcCall(serialNo, "POST", path);
    await loadTasks();
    if (mountedRef.current) setSubmitting(false);
  };

  const openEdit = (task: DeviceEncodeTask) => {
    setEditingTask(task);
    setEditForm(taskToForm(task));
  };

  const saveEdit = async () => {
    if (!editingTask || !serialNo || !online) return;
    setSubmitting(true);
    // sName is read-only in edit; keep the original name
    const body = { ...formToBody(editForm), sName: editingTask.sName };
    await rpcCall(serialNo, "POST", `/encode/${editingTask.id}`, body);
    await loadTasks();
    if (mountedRef.current) {
      setSubmitting(false);
      setEditingTask(null);
    }
  };

  const deleteTask = async () => {
    if (!editingTask || !serialNo || !online) return;
    setSubmitting(true);
    await rpcCall(serialNo, "DELETE", `/encode/${editingTask.id}`);
    await loadTasks();
    if (mountedRef.current) {
      setSubmitting(false);
      setEditingTask(null);
    }
  };

  const handleCreate = async () => {
    if (!serialNo || !online || !createForm.sName.trim() || !createForm.iTemplate) return;
    setSubmitting(true);
    await rpcCall(serialNo, "POST", "/encode", formToBody(createForm));
    await loadTasks();
    if (mountedRef.current) {
      setSubmitting(false);
      setCreateOpen(false);
      setCreateForm(EMPTY_FORM);
    }
  };

  // ── Dropdown options ──────────────────────────────────────────────────────

  const mainTemplateOptions = templates.map((t) => ({
    label: t.sName ?? String(t.id),
    value: String(t.id),
  }));

  const subTemplateOptions: { label: string; value: string }[] = [
    { label: "关闭", value: SUB_TEMPLATE_NONE },
    ...templates.map((t) => ({
      label: t.sName ?? String(t.id),
      value: String(t.id),
    })),
  ];

  const patchMainTemplate = (
    v: string,
    setter: React.Dispatch<React.SetStateAction<EditForm>>,
  ) => {
    const t = templates.find((x) => String(x.id) === v);
    setter((f) => ({ ...f, iTemplate: v, sTemplate: t?.sName ?? "" }));
  };

  const patchSubTemplate = (
    v: string,
    setter: React.Dispatch<React.SetStateAction<EditForm>>,
  ) => {
    const t = templates.find((x) => String(x.id) === v);
    setter((f) => ({
      ...f,
      iSubTemplate: v,
      sSubTemplate: v === SUB_TEMPLATE_NONE ? "" : (t?.sName ?? ""),
    }));
  };

  // ── Edit panel ────────────────────────────────────────────────────────────

  if (editingTask) {
    return (
      <div className="-mt-2 -ml-2">
        <div className="flex items-center gap-2 mb-5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditingTask(null)}
            className="gap-1 h-7 px-2 text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </Button>
          <h3 className="text-sm font-medium">修改任务</h3>
        </div>

        <div className="max-w-3xl space-y-5">
          {/* Task name is read-only (matches original modifyencode.vue: input disabled) */}
          <Row label="任务名">
            <Input value={editingTask.sName ?? ""} disabled className="max-w-md" />
          </Row>
          <Row label="视频源">
            <LabeledSelect
              value={editForm.sDevice}
              options={VIDEO_SOURCES}
              onChange={(v) => setEditForm((f) => ({ ...f, sDevice: v }))}
            />
          </Row>
          <Row label="音频源">
            <LabeledSelect
              value={editForm.sAudio}
              options={AUDIO_SOURCES}
              onChange={(v) => setEditForm((f) => ({ ...f, sAudio: v }))}
            />
          </Row>
          <Row label="源去交错">
            <LabeledSelect
              value={editForm.sDeinterlace}
              options={DEINTERLACE_OPTIONS}
              onChange={(v) => setEditForm((f) => ({ ...f, sDeinterlace: v }))}
            />
          </Row>
          <div className="flex items-center gap-4">
            <label className="text-sm text-muted-foreground w-20 shrink-0 text-right">
              主模版：
            </label>
            <div className="flex-1 min-w-0">
              <LabeledSelect
                value={editForm.iTemplate}
                options={mainTemplateOptions}
                onChange={(v) => patchMainTemplate(v, setEditForm)}
              />
            </div>
            <label className="text-sm text-muted-foreground shrink-0 text-right">
              副模版：
            </label>
            <div className="flex-1 min-w-0">
              <LabeledSelect
                value={editForm.iSubTemplate}
                options={subTemplateOptions}
                onChange={(v) => patchSubTemplate(v, setEditForm)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-6">
            <div className="flex gap-3">
              <Button
                onClick={() => void saveEdit()}
                disabled={!online || submitting || !editForm.iTemplate}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                确定
              </Button>
              <Button variant="secondary" onClick={() => setEditingTask(null)}>
                取消
              </Button>
            </div>
            <Button
              variant="destructive"
              onClick={() => void deleteTask()}
              disabled={!online || submitting}
              className="gap-1"
            >
              <Trash2 className="h-4 w-4" />
              删除
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Task grid ─────────────────────────────────────────────────────────────

  return (
    <div className="-mt-2 -ml-2">
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-sm font-medium">任务列表</h3>
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : (
          <button
            type="button"
            onClick={() => void loadTasks()}
            disabled={!online}
            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            title="刷新"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(208px,1fr))] gap-4">
        {/* Add new task */}
        <button
          type="button"
          onClick={() => {
            setCreateForm(EMPTY_FORM);
            setCreateOpen(true);
          }}
          disabled={!online}
          className="aspect-[16/10] rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors flex items-center justify-center group disabled:opacity-40 disabled:pointer-events-none"
        >
          <div className="h-11 w-11 rounded-full bg-muted/60 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
            <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
          </div>
        </button>

        {tasks.map((task) => {
          const running = task.iEnable === 1;
          return (
            <div
              key={String(task.id)}
              onClick={() => openEdit(task)}
              className={cn(
                "aspect-[16/10] rounded-lg border-2 bg-muted/30 hover:shadow-lg transition-all cursor-pointer p-2.5 flex flex-col",
                running
                  ? "border-green-500/70 hover:border-green-500"
                  : "border-primary/60 hover:border-primary",
              )}
            >
              {/* Badges */}
              <div className="flex gap-1.5">
                {task.sResolution ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-400 text-black">
                    {task.sResolution}
                  </span>
                ) : null}
                {task.sSpecial ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-green-500 text-black">
                    {task.sSpecial}
                  </span>
                ) : null}
              </div>

              {/* Task name + video source */}
              <div className="flex-1 flex flex-col items-center justify-center">
                <span
                  className={cn(
                    "text-base font-semibold text-center",
                    running && "text-green-400",
                  )}
                >
                  {task.sName ?? `任务 ${task.id}`}
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  {labelForVideoSource(task.sDevice)}
                </span>
              </div>

              {/* Play / Stop */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={(e) => void togglePlay(task, e)}
                  disabled={!online || submitting}
                  className={cn(
                    "text-xs font-bold px-2.5 py-1 rounded transition-colors flex items-center gap-1 disabled:opacity-40",
                    running
                      ? "bg-white text-red-600 hover:bg-white/90"
                      : "border border-border text-muted-foreground hover:border-primary hover:text-primary",
                  )}
                >
                  {running ? (
                    <>
                      <Square className="h-3 w-3" fill="currentColor" />
                      STOP
                    </>
                  ) : (
                    <>
                      <Play className="h-3 w-3" fill="currentColor" />
                      PLAY
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建编码任务</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">任务名</label>
              <Input
                autoFocus
                value={createForm.sName}
                onChange={(e) => setCreateForm((f) => ({ ...f, sName: e.target.value }))}
                placeholder="请输入任务名"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreate();
                }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">视频源</label>
              <LabeledSelect
                value={createForm.sDevice}
                options={VIDEO_SOURCES}
                onChange={(v) => setCreateForm((f) => ({ ...f, sDevice: v }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">音频源</label>
              <LabeledSelect
                value={createForm.sAudio}
                options={AUDIO_SOURCES}
                onChange={(v) => setCreateForm((f) => ({ ...f, sAudio: v }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">源去交错</label>
              <LabeledSelect
                value={createForm.sDeinterlace}
                options={DEINTERLACE_OPTIONS}
                onChange={(v) => setCreateForm((f) => ({ ...f, sDeinterlace: v }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">主模版</label>
              <LabeledSelect
                value={createForm.iTemplate}
                options={mainTemplateOptions}
                onChange={(v) => patchMainTemplate(v, setCreateForm)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">副模版</label>
              <LabeledSelect
                value={createForm.iSubTemplate}
                options={subTemplateOptions}
                onChange={(v) => patchSubTemplate(v, setCreateForm)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => void handleCreate()}
              disabled={!createForm.sName.trim() || !createForm.iTemplate || submitting}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

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

function LabeledSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="max-w-md">
        <SelectValue placeholder="请选择" />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
