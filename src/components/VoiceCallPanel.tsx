import { useEffect, useRef, useState } from "react";
import { Phone, Smartphone, Mic, Loader2 } from "lucide-react";
import { PanelStatusView, type PanelLoadStatus } from "@/components/PanelStatus";
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
import { toast } from "sonner";
import { fetchDeviceRPCReply, requestDeviceRPC } from "@/lib/device-api";

type SipMode = "0" | "1" | "2";

const MODE_OPTIONS: { value: SipMode; label: string }[] = [
  { value: "0", label: "关闭" },
  { value: "1", label: "通话" },
  { value: "2", label: "对讲" },
];

// ── RPC helper ─────────────────────────────────────────────────────────────

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

// ── Call-status shape ──────────────────────────────────────────────────────

interface CallStatus {
  sAccount: string;
  sCall: string;
  iHookStatus: number;
  sRegisterStatus: string;
  sHookStatus: string;
}

const DEFAULT_CALL: CallStatus = {
  sAccount: "",
  sCall: "",
  iHookStatus: 0,
  sRegisterStatus: "",
  sHookStatus: "",
};

// ── Component ──────────────────────────────────────────────────────────────

export function VoiceCallPanel({
  serialNo,
  online,
}: {
  serialNo: string;
  online: boolean;
}) {
  const mountedRef = useRef(true);
  const isRefreshingRef = useRef(false);
  const startedRef = useRef(false);

  const [status, setStatus] = useState<PanelLoadStatus>("loading");
  const [saving, setSaving] = useState(false);
  const [isTalking, setIsTalking] = useState(false);

  // editable form
  const [mode, setMode] = useState<SipMode>("0");
  const [uri, setUri] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [sipCall, setSipCall] = useState("");

  // live status
  const [callStatus, setCallStatus] = useState<CallStatus>(DEFAULT_CALL);

  // ── Load ─────────────────────────────────────────────────────────────────

  async function loadAll() {
    setStatus("loading");
    if (!online) {
      setStatus("error");
      return;
    }
    const [infoReply, callReply] = await Promise.all([
      rpcCall(serialNo, "GET", "/system/deviceinfo"),
      rpcCall(serialNo, "GET", "/system/call"),
    ]);
    if (!mountedRef.current) return;

    if (infoReply?.status !== "ok" || !Array.isArray(infoReply.data)) {
      setStatus("error");
      return;
    }
    for (const item of infoReply.data as { name: string; value: unknown }[]) {
      if (item.name === "sSipMode") setMode(String(item.value) as SipMode);
      if (item.name === "sSipUri") setUri(String(item.value ?? ""));
      if (item.name === "sSipUsername") setUsername(String(item.value ?? ""));
      if (item.name === "sSipPassword") setPassword(String(item.value ?? ""));
      if (item.name === "sSipCall") setSipCall(String(item.value ?? ""));
    }

    if (callReply?.status === "ok" && callReply.data) {
      applyCallStatus(callReply.data);
    }

    setStatus("ready");
  }

  function applyCallStatus(data: unknown) {
    const d = data as Record<string, unknown>;
    setCallStatus({
      sAccount: String(d.sAccount ?? ""),
      sCall: String(d.sCall ?? ""),
      iHookStatus: Number(d.iHookStatus ?? 0),
      sRegisterStatus: String(d.sRegisterStatus ?? ""),
      sHookStatus: String(d.sHookStatus ?? ""),
    });
  }

  async function refreshCall() {
    if (!online || !mountedRef.current || isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    try {
      const reply = await rpcCall(serialNo, "GET", "/system/call");
      if (!mountedRef.current) return;
      if (reply?.status === "ok" && reply.data) applyCallStatus(reply.data);
    } finally {
      isRefreshingRef.current = false;
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    isRefreshingRef.current = false;
    setLoading(true);
    void loadAll();
    const timer = setInterval(refreshCall, 3000);
    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialNo, online]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleConfirm() {
    setSaving(true);
    const body = {
      sSipMode: mode,
      sSipUri: uri,
      sSipUsername: username,
      sSipPassword: password,
      sSipCall: sipCall,
    };
    const result = await rpcCall(serialNo, "POST", "/system/global", body);
    if (!mountedRef.current) return;
    setSaving(false);
    if (result?.status === "ok") toast.success("修改成功！");
    else toast.error("修改失败");
  }

  async function startTalk() {
    if (startedRef.current) return;
    startedRef.current = true;
    setIsTalking(true);
    await rpcCall(serialNo, "POST", "/system/start_talk");
  }

  async function endTalk() {
    if (!startedRef.current) return;
    startedRef.current = false;
    setIsTalking(false);
    await rpcCall(serialNo, "POST", "/system/stop_talk");
  }

  // ── Derived display ───────────────────────────────────────────────────────

  const { iHookStatus, sRegisterStatus, sHookStatus, sAccount, sCall } = callStatus;
  const dotColor =
    iHookStatus === 0
      ? "bg-muted-foreground"
      : iHookStatus === 1
        ? "bg-green-500"
        : "bg-red-500";
  const statusLabel = iHookStatus === 0 ? "disable" : "连接成功";

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">加载中…</span>
      </div>
    );
  }

  return (
    <div className="-mt-2 -ml-2 max-w-3xl">
      <h3 className="text-sm font-medium mb-4">AOIP / Sip Call</h3>

      {/* 状态条 */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-md bg-muted/30 border border-border">
        <div className="flex items-center gap-2 text-sm">
          <Phone
            className={cn(
              "h-4 w-4 text-primary transition-colors",
              isTalking && "text-green-500 animate-pulse",
            )}
          />
          <span className="text-muted-foreground">我的账号：</span>
          <span>{sAccount || "--"}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span>{statusLabel}</span>
          <span className={cn("inline-block w-2.5 h-2.5 rounded-full", dotColor)} />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Smartphone className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground">对方：</span>
          <span>{sCall || "--"}</span>
        </div>
      </div>

      {/* 表单 */}
      <div className="mt-4 grid grid-cols-[6rem_1fr] gap-x-3 gap-y-3 items-center">
        <Label>模式</Label>
        <div className="w-44">
          <Select value={mode} onValueChange={(v) => setMode(v as SipMode)} disabled={!online}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {mode === "1" && (
          <>
            <Label>SIP服务器</Label>
            <Input
              value={uri}
              onChange={(e) => setUri(e.target.value)}
              className="h-8 w-72"
              disabled={!online}
            />

            <Label>SIP账号</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-8 w-72"
              disabled={!online}
            />

            <Label>SIP密码</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-8 w-72"
              disabled={!online}
            />

            <Label>自动拨号</Label>
            <Input
              value={sipCall}
              onChange={(e) => setSipCall(e.target.value)}
              className="h-8 w-72"
              disabled={!online}
            />

            <Label>注册状态</Label>
            <span className="text-sm">{sRegisterStatus || "--"}</span>

            <Label>拨号状态</Label>
            <span className="text-sm">{sHookStatus || "--"}</span>
          </>
        )}

        {mode === "2" && (
          <>
            <Label>对讲服务器</Label>
            <Input
              value={uri}
              onChange={(e) => setUri(e.target.value)}
              className="h-8 w-72"
              disabled={!online}
            />

            <Label>对讲账号</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-8 w-72"
              disabled={!online}
            />

            <Label>对讲密码</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-8 w-72"
              disabled={!online}
            />

            <Label>对讲通道</Label>
            <div className="flex items-center gap-2">
              <Input
                value={sipCall}
                onChange={(e) => setSipCall(e.target.value)}
                className="h-8 w-60"
                disabled={!online}
              />
              <button
                type="button"
                disabled={!online}
                onMouseDown={(e) => {
                  e.preventDefault();
                  startTalk();
                }}
                onMouseUp={(e) => {
                  e.preventDefault();
                  endTalk();
                }}
                onMouseLeave={endTalk}
                onTouchStart={(e) => {
                  e.preventDefault();
                  startTalk();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  endTalk();
                }}
                className={cn(
                  "h-8 w-8 inline-flex items-center justify-center rounded-md border border-border transition-colors select-none disabled:opacity-50",
                  isTalking
                    ? "bg-green-500/20 text-green-500 border-green-500"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted",
                )}
                aria-label="按住说话"
                title="按住说话"
              >
                <Mic className="h-4 w-4" />
              </button>
            </div>

            <Label>状态</Label>
            <span className="text-sm">{sRegisterStatus || "--"}</span>
          </>
        )}
      </div>

      <div className="mt-6">
        <Button size="sm" onClick={handleConfirm} disabled={!online || saving}>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
          确定
        </Button>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-sm text-muted-foreground">{children}：</span>;
}

