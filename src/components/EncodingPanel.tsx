import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Video, Settings2, Save, Play, Square, RefreshCw, X } from "lucide-react";
import { fetchDeviceRPCReply, requestDeviceRPC, type BackendDeviceStatusData } from "@/lib/device-api";
import { AudioLoudnessMeter } from "@/components/AudioLoudnessMeter";

type EncodeTaskTemplateData = {
  id?: number;
  iMainABitrate?: number;
  iMainAChannels?: number;
  iMainASampleRate?: number;
  iMainVBitrate?: number;
  iMainVFps?: number;
  iMainVGop?: number;
  iMainVHeight?: number;
  iMainVWidth?: number;
  iOsd?: number;
  iSubEnable?: number;
  sMainACodec?: string;
  sMainOutput1Addr?: string;
  sMainOutput1Param?: unknown;
  sMainOutput1Protocol?: string;
  sMainOutput2Addr?: string;
  sMainOutput2Param?: string;
  sMainOutput2Protocol?: string;
  sMainVCodec?: string;
  sMainVMode?: string;
  sMainVRC?: string;
  sMainVScaleMode?: string;
  sName?: string;
};

type EncodeTask = {
  key: string;
  id?: number | string;
  name: string;
  enabled: boolean;
  iSubTemplate?: number;
  iTemplate?: number;
  sAudio?: string;
  sDeinterlace?: string;
  sDevice?: string;
  sResolution?: string;
  sSpecial?: string;
  sStatus?: string;
  sSubTemplate?: string;
  sTemplate?: string;
  template?: EncodeTaskTemplateData;
  raw: Record<string, unknown>;
};

const DEFAULT_ENCODE_TASKS: EncodeTask[] = [];

type EncodingForm = {
  videoSource: string;
  videoCodec: string;
  audioCodec: string;
  bitrate: string;
  framerate: string;
  resolution: string;
  streamUrl: string;
};

const EMPTY_FORM: EncodingForm = {
  videoSource: "--",
  videoCodec: "--",
  audioCodec: "--",
  bitrate: "--",
  framerate: "--",
  resolution: "--",
  streamUrl: "--",
};

type RPCNoticePayload = {
  requestId?: string;
  status?: string;
  path?: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function parseTaskBitrateKbps(value: unknown): number {
  const raw = toNumber(value);
  if (!raw || raw <= 0) {
    return 8000;
  }
  if (raw > 50_000) {
    // Stored in bps (e.g. 200000 = 200 Kbps)
    return clamp(Math.round(raw / 1_000), 200, 50000);
  }
  // Already in Kbps
  return clamp(Math.round(raw), 200, 50000);
}

function parseLatencyMs(value: unknown): number {
  const defaultLatency = 500;
  if (value && typeof value === "object") {
    const objValue = (value as Record<string, unknown>).latency;
    const num = toNumber(objValue);
    return num ? clamp(Math.round(num), 100, 5000) : defaultLatency;
  }
  if (typeof value !== "string") {
    return defaultLatency;
  }
  const text = value.trim();
  if (!text) {
    return defaultLatency;
  }
  try {
    const decoded = JSON.parse(text) as Record<string, unknown>;
    const num = toNumber(decoded.latency);
    return num ? clamp(Math.round(num), 100, 5000) : defaultLatency;
  } catch {
    return defaultLatency;
  }
}

function getTaskBitrateKbps(task: EncodeTask | null | undefined): number {
  return parseTaskBitrateKbps(task?.template?.iMainVBitrate);
}

function getTaskLatencyMs(task: EncodeTask | null | undefined): number {
  return parseLatencyMs(task?.template?.sMainOutput1Param);
}

function cloneTask(task: EncodeTask | null | undefined): EncodeTask | null {
  if (!task) {
    return null;
  }
  return {
    ...task,
    template: task.template ? { ...task.template } : undefined,
    raw: { ...task.raw },
  };
}

function updateTaskLatency(task: EncodeTask | null, latencyMs: number): EncodeTask | null {
  if (!task) {
    return null;
  }
  const nextLatency = clamp(Math.round(latencyMs), 100, 5000);
  const nextTemplate: EncodeTaskTemplateData = {
    ...(task.template || {}),
    sMainOutput1Param: JSON.stringify({ latency: nextLatency }),
  };
  return {
    ...task,
    template: nextTemplate,
  };
}

function updateTaskBitrate(task: EncodeTask | null, bitrateKbps: number): EncodeTask | null {
  if (!task) {
    return null;
  }
  const nextBitrate = clamp(Math.round(bitrateKbps), 200, 50000);
  const nextTemplate: EncodeTaskTemplateData = {
    ...(task.template || {}),
    iMainVBitrate: nextBitrate * 1000,
  };
  return {
    ...task,
    template: nextTemplate,
  };
}

function parseEncodeTasks(payload: unknown): EncodeTask[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((item, index): EncodeTask | null => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const row = item as Record<string, unknown>;
      const id = row.id;
      const key =
        typeof id === "string" || typeof id === "number"
          ? String(id)
          : `task_${index + 1}`;
      const name =
        (typeof row.sName === "string" && row.sName.trim()) ||
        (typeof row.name === "string" && row.name.trim()) ||
        (typeof row.title === "string" && row.title.trim()) ||
        (typeof id === "string" || typeof id === "number" ? `任务 ${id}` : `任务 ${index + 1}`);
      const rawTemplate = row.template && typeof row.template === "object"
        ? (row.template as Record<string, unknown>)
        : undefined;
      const enableValue = row.iEnable;
      const enabled = enableValue === 1 || enableValue === "1" || enableValue === true;
      const bitrateSource = rawTemplate?.iMainVBitrate ?? row.iMainVBitrate;
      const latencySource = rawTemplate?.sMainOutput1Param ?? row.sMainOutput1Param;
      const template: EncodeTaskTemplateData = {
        iMainVBitrate: toNumber(bitrateSource) ?? undefined,
        sMainOutput1Param: latencySource,
      };

      if (rawTemplate && typeof rawTemplate === "object") {
        template.id = toNumber(rawTemplate.id) ?? undefined;
        template.iMainABitrate = toNumber(rawTemplate.iMainABitrate) ?? undefined;
        template.iMainAChannels = toNumber(rawTemplate.iMainAChannels) ?? undefined;
        template.iMainASampleRate = toNumber(rawTemplate.iMainASampleRate) ?? undefined;
        template.iMainVFps = toNumber(rawTemplate.iMainVFps) ?? undefined;
        template.iMainVGop = toNumber(rawTemplate.iMainVGop) ?? undefined;
        template.iMainVHeight = toNumber(rawTemplate.iMainVHeight) ?? undefined;
        template.iMainVWidth = toNumber(rawTemplate.iMainVWidth) ?? undefined;
        template.iOsd = toNumber(rawTemplate.iOsd) ?? undefined;
        template.iSubEnable = toNumber(rawTemplate.iSubEnable) ?? undefined;
        template.sMainACodec = typeof rawTemplate.sMainACodec === "string" ? rawTemplate.sMainACodec : undefined;
        template.sMainOutput1Addr = typeof rawTemplate.sMainOutput1Addr === "string" ? rawTemplate.sMainOutput1Addr : undefined;
        template.sMainOutput1Protocol = typeof rawTemplate.sMainOutput1Protocol === "string" ? rawTemplate.sMainOutput1Protocol : undefined;
        template.sMainOutput2Addr = typeof rawTemplate.sMainOutput2Addr === "string" ? rawTemplate.sMainOutput2Addr : undefined;
        template.sMainOutput2Param = typeof rawTemplate.sMainOutput2Param === "string" ? rawTemplate.sMainOutput2Param : undefined;
        template.sMainOutput2Protocol = typeof rawTemplate.sMainOutput2Protocol === "string" ? rawTemplate.sMainOutput2Protocol : undefined;
        template.sMainVCodec = typeof rawTemplate.sMainVCodec === "string" ? rawTemplate.sMainVCodec : undefined;
        template.sMainVMode = typeof rawTemplate.sMainVMode === "string" ? rawTemplate.sMainVMode : undefined;
        template.sMainVRC = typeof rawTemplate.sMainVRC === "string" ? rawTemplate.sMainVRC : undefined;
        template.sMainVScaleMode = typeof rawTemplate.sMainVScaleMode === "string" ? rawTemplate.sMainVScaleMode : undefined;
        template.sName = typeof rawTemplate.sName === "string" ? rawTemplate.sName : undefined;
      }

      return {
        key,
        id: typeof id === "string" || typeof id === "number" ? id : undefined,
        name,
        enabled,
        iSubTemplate: toNumber(row.iSubTemplate) ?? undefined,
        iTemplate: toNumber(row.iTemplate) ?? undefined,
        sAudio: typeof row.sAudio === "string" ? row.sAudio : undefined,
        sDeinterlace: typeof row.sDeinterlace === "string" ? row.sDeinterlace : undefined,
        sDevice: typeof row.sDevice === "string" ? row.sDevice : undefined,
        sResolution: typeof row.sResolution === "string" ? row.sResolution : undefined,
        sSpecial: typeof row.sSpecial === "string" ? row.sSpecial : undefined,
        sStatus: typeof row.sStatus === "string" ? row.sStatus : undefined,
        sSubTemplate: typeof row.sSubTemplate === "string" ? row.sSubTemplate : undefined,
        sTemplate: typeof row.sTemplate === "string" ? row.sTemplate : undefined,
        template,
        raw: row,
      };
    })
    .filter((item): item is EncodeTask => item !== null);
}

function normalizeVideoSource(value?: string): string {
  if (!value) return "--";
  const upper = value.toUpperCase();
  if (upper.includes("HDMI")) return "HDMI-1";
  if (upper.includes("SDI")) return "SDI-1";
  if (upper.includes("USB")) return "USB";
  if (upper.includes("NDI")) return "NDI";
  return value;
}

function normalizeVideoCodec(value?: string): string {
  if (!value) return "--";
  const upper = value.toUpperCase();
  if (upper.includes("H264")) return "H.264 / AVC";
  if (upper.includes("H265")) return "H.265 / HEVC";
  if (upper.includes("AV1")) return "AV1";
  return value;
}

function normalizeAudioCodec(value?: string): string {
  if (!value) return "--";
  const upper = value.toUpperCase();
  if (upper.includes("AAC")) return "AAC-LC 48kHz";
  if (upper.includes("OPUS")) return "Opus 48kHz";
  if (upper.includes("MP3")) return "MP3 44.1kHz";
  return value;
}

function normalizeResolution(status: BackendDeviceStatusData | null | undefined): string {
  if (!status) return "--";
  const raw = status.sVideoCodec?.sResolution || status.sVideoParams?.sResolution || "--";
  const width = status.sVideoCodec?.iWidth || status.sVideoParams?.iWidth || 0;
  const height = status.sVideoCodec?.iHeight || status.sVideoParams?.iHeight || 0;
  if (width > 0 && height > 0) {
    return `${width} × ${height}`;
  }
  if (raw.toLowerCase() === "nosignal" || raw.toLowerCase() === "no signal") {
    return "—";
  }
  if (raw.includes("1080")) return "1920 × 1080";
  if (raw.includes("720")) return "1280 × 720";
  if (raw.includes("2160") || raw.includes("4k")) return "3840 × 2160";
  return raw || "--";
}

function normalizeFramerate(status: BackendDeviceStatusData | null | undefined): string {
  if (!status) return "--";
  const fps = status.sVideoCodec?.iFPS || status.sVideoParams?.iFPS || 0;
  if (fps > 0) return `${fps} fps`;
  const raw = status.sVideoCodec?.sResolution || status.sVideoParams?.sResolution || "";
  const match = raw.match(/(\d{2,3})p(\d{2})/i);
  if (match) return `${match[2]} fps`;
  return "--";
}

function parseVideoBitrate(status: BackendDeviceStatusData | null | undefined): number {
  if (!status) return 0;
  if ((status.sVideoCodec?.iBitrate || 0) > 0) {
    return Math.max(1, Math.round((status.sVideoCodec?.iBitrate || 0) / 1_000_000));
  }
  const raw = status.sVideoCodec?.sBitrate || status.sVideoCodec?.sActBitrate || "";
  const match = raw.match(/([\d.]+)\s*(k|m|g)?bps/i);
  if (!match) return 0;
  const value = Number(match[1]);
  const unit = (match[2] || "m").toLowerCase();
  if (Number.isNaN(value)) return 0;
  if (unit === "k") return Math.max(1, Math.round(value / 1000));
  if (unit === "g") return Math.max(1, Math.round(value * 1000));
  return Math.max(1, Math.round(value));
}

function isNoSignal(status: BackendDeviceStatusData | null | undefined): boolean {
  if (!status) return true;
  const codecRes = (status.sVideoCodec?.sResolution || "").trim().toLowerCase();
  const paramsRes = (status.sVideoParams?.sResolution || "").trim().toLowerCase();
  const resolutionText = `${codecRes} ${paramsRes}`.trim();
  if (resolutionText.includes("nosignal") || resolutionText.includes("no signal")) {
    return true;
  }

  // Some devices only report symbolic resolution (for example 1080p50) while width/height stay 0.
  if (/\b\d{3,4}p\d{2}\b/i.test(resolutionText) || /\b\d{3,4}\s*[x×]\s*\d{3,4}\b/i.test(resolutionText)) {
    return false;
  }

  const width = status.sVideoCodec?.iWidth || status.sVideoParams?.iWidth || 0;
  const height = status.sVideoCodec?.iHeight || status.sVideoParams?.iHeight || 0;
  return width <= 0 || height <= 0;
}

function getPreviewBaseUrl(streamUrl: string): string | null {
  if (!streamUrl || streamUrl === "--") return null;
  try {
    const parsed = new URL(streamUrl);
    if (parsed.protocol.toLowerCase() !== "srt:") return null;
    const srtPort = Number(parsed.port);
    if (!Number.isFinite(srtPort) || srtPort < 15000 || srtPort > 15099) return null;
    const previewPort = 19000 + (srtPort - 15000);
    return `http://${parsed.hostname}:${previewPort}/api/frame.jpeg?src=main`;
  } catch {
    return null;
  }
}

function getWebrtcBaseUrl(streamUrl: string): string | null {
  if (!streamUrl || streamUrl === "--") return null;
  try {
    const parsed = new URL(streamUrl);
    if (parsed.protocol.toLowerCase() !== "srt:") return null;
    const srtPort = Number(parsed.port);
    if (!Number.isFinite(srtPort) || srtPort < 15000 || srtPort > 15099) return null;
    const webrtcPort = 19000 + (srtPort - 15000);
    return `http://${parsed.hostname}:${webrtcPort}/stream.html?src=540p`;
  } catch {
    return null;
  }
}

function buildForm(status: BackendDeviceStatusData | null | undefined): EncodingForm {
  if (!status) return EMPTY_FORM;
  return {
    videoSource: `${normalizeVideoSource(status.sVideoParams?.sDevice)}${status.sVideoParams?.sResolution ? ` (${status.sVideoParams.sResolution})` : ""}`,
    videoCodec: normalizeVideoCodec(status.sVideoCodec?.sCodec),
    audioCodec: normalizeAudioCodec(status.sAudioCodec?.sCodec),
    bitrate: status.sVideoCodec?.sBitrate || status.sVideoCodec?.sActBitrate || "--",
    framerate: normalizeFramerate(status),
    resolution: normalizeResolution(status),
    streamUrl: status.sMuxer?.sURL || "--",
  };
}

export function EncodingPanel({
  serialNo,
  deviceName,
  online,
  status,
  rpcNotice,
}: {
  serialNo: string;
  deviceName: string;
  online: boolean;
  status: BackendDeviceStatusData | null;
  rpcNotice: RPCNoticePayload | null;
}) {
  const fallbackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [form, setForm] = useState<EncodingForm>(() => buildForm(status));
  const [encodeTasks, setEncodeTasks] = useState<EncodeTask[]>(DEFAULT_ENCODE_TASKS);
  const [taskLoading, setTaskLoading] = useState(false);
  const [task, setTask] = useState("");
  const [currentTask, setCurrentTask] = useState<EncodeTask | null>(null);
  const [running, setRunning] = useState(false);
  const [hasRunningTask, setHasRunningTask] = useState(false);
  const [localRecordingEnabled, setLocalRecordingEnabled] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [webrtcOpen, setWebrtcOpen] = useState(false);
  const [previewNonce, setPreviewNonce] = useState(0);
  const [previewLoadFailed, setPreviewLoadFailed] = useState(false);
  const [webrtcNonce, setWebrtcNonce] = useState(0);
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const pendingRequestIdRef = useRef("");
  const recentWSRequestIdRef = useRef("");
  const pollTimerRef = useRef<number | null>(null);
  const timeoutTimerRef = useRef<number | null>(null);

  const delay = (ms: number) => new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

  const isEncodePath = (value: string): boolean => {
    const path = value.trim();
    return path === "/encode" || path.startsWith("/encode/");
  };

  const clearReplyTimers = () => {
    if (pollTimerRef.current != null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (timeoutTimerRef.current != null) {
      window.clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
  };

  const applyReplyResult = (statusValue: string, data: unknown) => {
    if (statusValue !== "ok") {
      setEncodeTasks(DEFAULT_ENCODE_TASKS);
      setTask("");
      setRunning(false);
      setHasRunningTask(false);
      return true;
    }
    const parsedTasks = parseEncodeTasks(data);
    setEncodeTasks(parsedTasks.length > 0 ? parsedTasks : DEFAULT_ENCODE_TASKS);
    if (parsedTasks.length === 0) {
      setTask("");
      setRunning(false);
      setHasRunningTask(false);
      return true;
    }

    const enabledTask = parsedTasks.find((item) => item.enabled);
    const activeTask = enabledTask || parsedTasks[0];
    setTask(activeTask.key);
    const taskClone = cloneTask(activeTask);
    setCurrentTask(taskClone);
    setRunning(activeTask.enabled);
    setHasRunningTask(!!enabledTask);
    setDirty(false);
    return true;
  };

  const fetchReplyByID = async (requestId: string): Promise<boolean> => {
    if (!serialNo || !requestId) {
      return false;
    }
    const reply = await fetchDeviceRPCReply(serialNo, requestId);
    if (!reply) {
      return false;
    }
    const replyPath = (reply.path || "").trim();
    if (!isEncodePath(replyPath)) {
      return false;
    }
    if (reply.status === "pending") {
      return false;
    }
    const done = replyPath === "/encode"
      ? applyReplyResult(reply.status, reply.data)
      : true;
    if (done) {
      pendingRequestIdRef.current = "";
      setTaskLoading(false);
      clearReplyTimers();
    }
    return done;
  };

  const resetEditPanel = () => {
    const selectedTask = encodeTasks.find((item) => item.key === task) || encodeTasks[0] || null;
    const taskClone = cloneTask(selectedTask);
    setCurrentTask(taskClone);
    setTask(selectedTask?.key || "");
    setRunning(selectedTask?.enabled ?? false);
    setLocalRecordingEnabled(false);
    setDirty(false);
  };

  const refreshEncodeTasks = () => {
    if (!serialNo || !online) {
      setEncodeTasks(DEFAULT_ENCODE_TASKS);
      setTask("");
      setCurrentTask(null);
      setRunning(false);
      setHasRunningTask(false);
      setTaskLoading(false);
      pendingRequestIdRef.current = "";
      clearReplyTimers();
      return;
    }

    let active = true;
    pendingRequestIdRef.current = "";
    clearReplyTimers();
    setTaskLoading(true);

    requestDeviceRPC(serialNo, { method: "GET", path: "/encode" })
      .then((ack) => {
        if (!active) {
          return;
        }
        const requestId = (ack.requestId || "").trim();
        if (!requestId) {
          setTaskLoading(false);
          return;
        }
        pendingRequestIdRef.current = requestId;

        // If WS notice arrived slightly earlier than pending id assignment, fetch immediately.
        if (recentWSRequestIdRef.current === requestId) {
          void fetchReplyByID(requestId);
        }

        const poll = async () => {
          if (!pendingRequestIdRef.current || pendingRequestIdRef.current !== requestId) {
            return;
          }
          try {
            await fetchReplyByID(requestId);
          } catch {
            // Keep waiting until timeout.
          }
        };

        void poll();
        pollTimerRef.current = window.setInterval(() => {
          void poll();
        }, 5000);
        timeoutTimerRef.current = window.setTimeout(() => {
          if (pendingRequestIdRef.current !== requestId) {
            return;
          }
          pendingRequestIdRef.current = "";
          clearReplyTimers();
          setTaskLoading(false);
          setEncodeTasks(DEFAULT_ENCODE_TASKS);
          setTask("");
          setCurrentTask(null);
          setRunning(false);
          setHasRunningTask(false);
        }, 15000);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setEncodeTasks(DEFAULT_ENCODE_TASKS);
        setTask("");
        setCurrentTask(null);
        setRunning(false);
        setHasRunningTask(false);
        setTaskLoading(false);
      });

    return () => {
      active = false;
      pendingRequestIdRef.current = "";
      clearReplyTimers();
    };
  };

  const waitRPCDone = async (requestId: string, timeoutMs = 15000): Promise<boolean> => {
    if (!serialNo || !requestId) {
      return false;
    }
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const reply = await fetchDeviceRPCReply(serialNo, requestId);
      if (reply && reply.status !== "pending") {
        return reply.status === "ok";
      }
      await delay(500);
    }
    return false;
  };

  const toggleTaskRunning = async () => {
    if (!serialNo || !online || !currentTask) {
      return;
    }
    const taskId = currentTask.id ?? currentTask.key;
    if (taskId === undefined || taskId === null || String(taskId).trim() === "") {
      return;
    }

    const action = running ? "disable" : "enable";
    try {
      setTaskLoading(true);
      const ack = await requestDeviceRPC(serialNo, {
        method: "POST",
        path: `/encode/${String(taskId).trim()}/${action}`,
      });
      const requestId = (ack.requestId || "").trim();
      if (requestId) {
        const ok = await waitRPCDone(requestId, (ack.timeoutSeconds || 15) * 1000);
        if (!ok) {
          setTaskLoading(false);
          return;
        }
      }
      refreshEncodeTasks();
    } catch {
      setTaskLoading(false);
    }
  };

  const saveBitrate = async () => {
    if (!serialNo || !online || !currentTask) {
      return;
    }
    if (currentTask.iTemplate == null) {
      return;
    }

    const templateID = String(currentTask.iTemplate).trim();
    if (!templateID) {
      return;
    }

    const bitrateToSave = getTaskBitrateKbps(currentTask) * 1000;
    try {
      setTaskLoading(true);
      const ack = await requestDeviceRPC(serialNo, {
        method: "POST",
        path: `/template/${templateID}`,
        body: { iMainVBitrate: bitrateToSave },
      });
      const requestId = (ack.requestId || "").trim();
      if (requestId) {
        const ok = await waitRPCDone(requestId, (ack.timeoutSeconds || 15) * 1000);
        if (!ok) {
          setTaskLoading(false);
          return;
        }
      }
      setDirty(false);
      refreshEncodeTasks();
    } catch {
      setTaskLoading(false);
    }
  };

  useEffect(() => {
    setForm(buildForm(status));
    // 只在没有编辑或设备离线时重置 dirty
    if (!dirty || !online) {
      setDirty(false);
    }
  }, [status, dirty, online]);

  useEffect(() => {
    if (encodeTasks.length === 0) {
      if (task !== "") {
        setTask("");
      }
      if (currentTask !== null) {
        setCurrentTask(null);
      }
      setRunning(false);
      setHasRunningTask(false);
      return;
    }
    const selectedTask = encodeTasks.find((item) => item.key === task);
    if (!selectedTask) {
      const first = encodeTasks[0];
      setTask(first.key);
      const taskClone = cloneTask(first);
      setCurrentTask(taskClone);
      setRunning(first.enabled);
      setHasRunningTask(first.enabled);
      return;
    }
    setRunning(selectedTask.enabled);
    setHasRunningTask(selectedTask.enabled);
  }, [encodeTasks, task]);

  useEffect(() => {
    const cleanup = refreshEncodeTasks();
    return cleanup;
  }, [online, serialNo]);

  const taskSelectDisabled = !online || hasRunningTask;
  const currentTaskLatency = getTaskLatencyMs(currentTask);
  const currentTaskBitrate = getTaskBitrateKbps(currentTask);
  useEffect(() => {
    if (!rpcNotice || !serialNo) {
      return;
    }
    const requestId = (rpcNotice.requestId || "").trim();
    if (requestId) {
      recentWSRequestIdRef.current = requestId;
    }
    if (!requestId || requestId !== pendingRequestIdRef.current) {
      return;
    }
    // RequestId is unique per RPC call; matching it is enough to trigger immediate reply fetch.
    void fetchReplyByID(requestId);
  }, [rpcNotice, serialNo]);

  const noSignal = online ? isNoSignal(status) : true;
  const previewBaseUrl = useMemo(() => getPreviewBaseUrl(form.streamUrl), [form.streamUrl]);
  const webrtcBaseUrl = useMemo(() => getWebrtcBaseUrl(form.streamUrl), [form.streamUrl]);
  const canShowPreview = online && !noSignal && !!previewBaseUrl;
  const canPlayWebrtc = canShowPreview && !previewLoadFailed && !!webrtcBaseUrl;
  const previewSrc = useMemo(() => {
    if (!canShowPreview || !previewBaseUrl) return "";
    return `${previewBaseUrl}&_r=${previewNonce}`;
  }, [canShowPreview, previewBaseUrl, previewNonce]);
  const webrtcSrc = useMemo(() => {
    if (!canPlayWebrtc || !webrtcBaseUrl) return "";
    const sep = webrtcBaseUrl.includes("?") ? "&" : "?";
    return `${webrtcBaseUrl}${sep}_r=${webrtcNonce}`;
  }, [canPlayWebrtc, webrtcBaseUrl, webrtcNonce]);

  useEffect(() => {
    setPreviewLoadFailed(false);
    setPreviewNonce((v) => v + 1);
    setWebrtcOpen(false);
    setWebrtcNonce(0);
  }, [previewBaseUrl, online, noSignal]);

  // Draw a 360p RGB fallback frame for offline / no-signal states.
  useEffect(() => {
    if (canShowPreview && !previewLoadFailed) return;
    const canvas = fallbackCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = 640;
    const h = 360;
    canvas.width = w;
    canvas.height = h;

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#330000");
    grad.addColorStop(0.33, "#003300");
    grad.addColorStop(0.66, "#001033");
    grad.addColorStop(1, "#220022");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    for (let x = 0; x < w; x += 24) {
      const r = (x / w) * 255;
      const g = ((w - x) / w) * 255;
      const b = ((x % 120) / 120) * 255;
      ctx.fillStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, 0.18)`;
      ctx.fillRect(x, 0, 12, h);
    }

    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    for (let y = 0; y < h; y += 3) {
      ctx.fillRect(0, y, w, 1);
    }

    let label = "No Signal";
    if (!online) {
      label = "Device Offline";
    } else if (!noSignal && !previewBaseUrl) {
      label = "Preview Not Configured";
    } else if (!noSignal && previewLoadFailed) {
      label = "Preview Unavailable";
    }
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#f3f6ff";
    ctx.font = "600 30px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, w / 2, h / 2);
  }, [canShowPreview, previewLoadFailed, online, noSignal, previewBaseUrl, deviceName]);

  const live = online;
  const realtimeBitrate = status?.sVideoCodec?.sActBitrate || "--";
  const realtimeFramerate = status?.sVideoCodec?.iActFPS != null
    ? `${status.sVideoCodec.iActFPS} fps`
    : "--";
  const audioSource = status?.sAudioParams?.sDevice || "--";
  const audioParams = (() => {
    const sr = status?.sAudioCodec?.iSampleRate || status?.sAudioParams?.iSampleRate || 0;
    const ch = status?.sAudioCodec?.iChannels || status?.sAudioParams?.iChannels || 0;
    if (!sr && !ch) return "--";
    const parts: string[] = [];
    if (sr) parts.push(`${sr}Hz`);
    if (ch) parts.push(`${ch}ch`);
    return parts.join(" / ");
  })();
  const realtimeRtt = status?.sMuxer?.sSrt?.iMsRTT
    ? `${status.sMuxer.sSrt.iMsRTT} ms`
    : "--";
  const realtimeRetrans = (() => {
    const sent = status?.sMuxer?.sSrt?.iPktSent || 0;
    const retrans = status?.sMuxer?.sSrt?.iPktRetrans || 0;
    if (!sent) return "--";
    return `${((retrans / sent) * 100).toFixed(2)}%`;
  })();
  const localRecording = "--";
  const realtimeTime = online ? new Date(nowTick).toLocaleTimeString() : "--";
  const transmissionQuality = (() => {
    if (!online) return "--";
    const rtt = status?.sMuxer?.sSrt?.iMsRTT || 0;
    const sent = status?.sMuxer?.sSrt?.iPktSent || 0;
    const lossPkt = status?.sMuxer?.sSrt?.iPktLoss || 0;
    const lossRate = sent ? (lossPkt / sent) * 100 : 0;
    if (lossRate > 5 || rtt > 300) return "差";
    if (lossRate > 1 || rtt > 150) return "中";
    if (rtt > 60) return "良";
    return "优";
  })();




  return (
    <section className="panel flex flex-col h-full overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between bg-card/30">
        <div className="flex items-center gap-2">
          <Video className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-xs font-semibold tracking-wide uppercase">编码状态</h3>
          <span className="text-[11px] text-muted-foreground">· {deviceName}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className={`status-dot inline-block h-1.5 w-1.5 rounded-full ${live ? "bg-destructive" : "bg-muted-foreground"}`} />
            <span className={live ? "text-destructive font-medium" : "text-muted-foreground"}>
              {live ? "LIVE" : "OFFLINE"}
            </span>
          </span>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-7 gap-2 p-2 min-h-0">
        {/* Preview */}
        <div className="lg:col-span-3 flex flex-row min-h-0 gap-1">
          <div className="group relative flex-1 min-h-0 rounded-sm overflow-hidden border border-border bg-black">

            {webrtcOpen ? (
              <>
                <iframe
                  src={webrtcSrc}
                  className="absolute inset-0 h-full w-full border-0"
                  allow="autoplay; camera; microphone"
                  title="WebRTC 预览"
                />
                <div className="absolute top-1.5 right-1.5 z-20 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => setWebrtcNonce((v) => v + 1)}
                    className="inline-flex items-center justify-center rounded-sm border border-border/60 bg-black/70 p-1 text-muted-foreground hover:text-foreground transition"
                    title="刷新播放"
                    aria-label="刷新播放"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setWebrtcOpen(false)}
                    className="inline-flex items-center justify-center rounded-sm border border-border/60 bg-black/70 p-1 text-muted-foreground hover:text-foreground transition"
                    title="关闭预览"
                    aria-label="关闭预览"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </>
            ) : (
              <>
                {canShowPreview && !previewLoadFailed ? (
                  <img
                    src={previewSrc}
                    alt="设备预览图"
                    className="h-full w-full object-cover"
                    onError={() => setPreviewLoadFailed(true)}
                  />
                ) : (
                  <canvas ref={fallbackCanvasRef} width={640} height={360} className="h-full w-full object-cover" />
                )}
                {canPlayWebrtc ? (
                  <button
                    type="button"
                    onClick={() => setWebrtcOpen(true)}
                    className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:pointer-events-auto group-hover:bg-black/20 group-hover:opacity-100"
                    
                  >
                    <span className="inline-flex items-center justify-center rounded-full border border-primary/70 bg-black/65 p-2.5 text-primary shadow-sm">
                      <Play className="h-5 w-5" />
                    </span>
                  </button>
                ) : null}
                {canShowPreview ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewLoadFailed(false);
                      setPreviewNonce((v) => v + 1);
                    }}
                    className="absolute top-1.5 right-1.5 z-20 inline-flex items-center justify-center rounded-sm border border-border/60 bg-black/70 p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-foreground"
                    title="刷新预览图"
                    aria-label="刷新预览图"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </button>
                ) : null}
              </>
            )}
          </div>
          {/* OBS-style audio loudness meter — sibling on the right, does not overlay video */}
          <div className="h-full shrink-0">
            <AudioLoudnessMeter active={webrtcOpen} />
          </div>
        </div>



        {/* Params (read-only display) */}
        <div className="lg:col-span-2 min-h-0 overflow-y-auto rounded-sm border border-border bg-card/40">
          <div className="px-2.5 py-1.5 border-b border-border flex items-center gap-1.5 bg-background/30">
            <Activity className="h-3 w-3 text-primary" />
            <span className="text-[11px] font-medium tracking-wide uppercase">参数详情</span>
          </div>
          <div className="text-[11px]">
            <div className="grid grid-cols-2 divide-x divide-y divide-border">
              <Row k="视频源" v={form.videoSource} />
              <Row k="音频源" v={audioSource} />
              <Row k="视频编码" v={form.videoCodec} />
              <Row k="音频编码" v={form.audioCodec} />
              <Row k="编码分辨率" v={form.resolution} />
              <Row k="音频参数" v={audioParams} />
              <Row k="实时码率" v={realtimeBitrate} highlight />
              <Row k="实时RTT" v={realtimeRtt} highlight />
              <Row k="实时帧率" v={realtimeFramerate} highlight />
              <Row k="实时重传率" v={realtimeRetrans} highlight />
              <Row k="实时时间" v={realtimeTime} />
              <Row k="传输质量" v={transmissionQuality} highlight />
            </div>
            <div className="divide-y divide-border border-t border-border">
              <Row k="本地录制" v={localRecording} />
              <Row k="流地址" v={form.streamUrl} mono />
            </div>
          </div>

        </div>

        {/* Edit Panel */}
        <div className="lg:col-span-2 min-h-0 overflow-y-auto rounded-sm border border-border bg-card/40 flex flex-col">
          <div className="px-2.5 py-1.5 border-b border-border flex items-center gap-1.5 bg-background/30">
            <Settings2 className="h-3 w-3 text-primary" />
            <span className="text-[11px] font-medium tracking-wide uppercase">参数修改</span>
            <div className="ml-auto flex items-center gap-1.5">
              {dirty && <span className="text-[10px] text-warning">未保存</span>}
              <button
                type="button"
                onClick={resetEditPanel}
                className="inline-flex items-center justify-center rounded-sm border border-border bg-secondary/30 p-1 text-muted-foreground hover:border-primary/50 hover:text-primary transition"
                title="刷新"
                aria-label="刷新"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            </div>
          </div>
          <div className="p-2.5 space-y-3 text-[11px]">
            <Field label="延迟设置 (ms)">
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={100}
                  max={5000}
                  step={50}
                  value={currentTaskLatency}
                  onChange={(e) => {
                    const next = updateTaskLatency(currentTask, +e.target.value);
                    setCurrentTask(next);
                    setDirty(true);
                  }}
                  className="flex-1 accent-[var(--color-primary)]"
                  disabled={!online || !currentTask}
                />
                <input
                  type="number"
                  min={100}
                  max={5000}
                  step={50}
                  value={currentTaskLatency}
                  onChange={(e) => {
                    const next = updateTaskLatency(currentTask, +e.target.value);
                    setCurrentTask(next);
                    setDirty(true);
                  }}
                  className="w-16 bg-input border border-border rounded-sm px-1.5 py-0.5 text-[11px] text-right focus:outline-none focus:border-primary"
                  disabled={!online || !currentTask}
                />
              </div>
            </Field>
            <Field label="码率 (Kbps)">
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={200}
                  max={50000}
                  step={100}
                  value={currentTaskBitrate}
                  onChange={(e) => {
                    const next = updateTaskBitrate(currentTask, +e.target.value);
                    setCurrentTask(next);
                    setDirty(true);
                  }}
                  className="flex-1 accent-[var(--color-primary)]"
                  disabled={!online || !currentTask}
                />
                <input
                  type="number"
                  min={200}
                  max={50000}
                  step={100}
                  value={currentTaskBitrate}
                  onChange={(e) => {
                    const next = updateTaskBitrate(currentTask, +e.target.value);
                    setCurrentTask(next);
                    setDirty(true);
                  }}
                  className="w-16 bg-input border border-border rounded-sm px-1.5 py-0.5 text-[11px] text-right focus:outline-none focus:border-primary"
                  disabled={!online || !currentTask}
                />
              </div>
            </Field>
            <Field label="本地录制开关">
              <button
                type="button"
                onClick={() => { setLocalRecordingEnabled((v) => !v); setDirty(true); }}
                className={`w-full inline-flex items-center justify-between rounded-sm border px-2 py-1.5 text-[11px] transition ${
                  localRecordingEnabled
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-secondary/30 text-muted-foreground"
                }`}
                disabled={!online}
              >
                <span>本地录制</span>
                <span className="font-medium">{localRecordingEnabled ? "开启" : "关闭"}</span>
              </button>
            </Field>
            <button
              onClick={() => {
                void saveBitrate();
              }}
              disabled={!dirty || !online || !currentTask || taskLoading}
              className="w-full inline-flex items-center justify-center gap-1 rounded-sm bg-primary text-primary-foreground px-2 py-1.5 text-[11px] font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Save className="h-3 w-3" /> 应用
            </button>
            <Field label="编码任务">
              <Select
                value={task}
                onChange={(v) => {
                  setTask(v);
                  const selectedTask = encodeTasks.find((item) => item.key === v);
                  if (selectedTask) {
                    const taskClone = cloneTask(selectedTask);
                    setCurrentTask(taskClone);
                    setRunning(selectedTask.enabled);
                  }
                  setDirty(true);
                }}
                options={encodeTasks}
                disabled={taskSelectDisabled}
              />
              {taskLoading ? <div className="mt-1 text-[10px] text-muted-foreground">后台同步任务中...</div> : null}
              {hasRunningTask ? <div className="mt-1 text-[10px] text-warning">任务运行中，无法切换</div> : null}
            </Field>
            <button
              onClick={() => {
                void toggleTaskRunning();
              }}
              disabled={!online || !currentTask || taskLoading}
              className={`w-full inline-flex items-center justify-center gap-1.5 rounded-sm px-2 py-2 text-[11px] font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${
                running
                  ? "bg-destructive/15 text-destructive border border-destructive/40 hover:bg-destructive/25"
                  : "bg-primary/15 text-primary border border-primary/40 hover:bg-primary/25"
              }`}
            >
              {running ? <><Square className="h-3 w-3" /> 停止任务</> : <><Play className="h-3 w-3" /> 开始任务</>}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({ k, v, mono, highlight }: { k: string; v: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-start gap-2 px-2.5 py-1.5">
      <span className="w-16 shrink-0 text-muted-foreground">{k}</span>
      <span className={`flex-1 break-all ${mono ? "font-mono text-[10px]" : ""} ${highlight ? "text-primary font-medium" : ""}`}>
        {v}
      </span>
    </div>

  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] tracking-wide text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: EncodeTask[];
  disabled?: boolean;
}) {
  const has = options.some((item) => item.key === value);
  return (
    <select
      value={has ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full bg-input border border-border rounded-sm px-2 py-1 text-[11px] focus:outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {!has && <option value="" disabled>{value || "—"}</option>}
      {options.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
    </select>
  );
}
