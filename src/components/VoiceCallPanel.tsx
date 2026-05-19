import { useRef, useState } from "react";
import { Phone, Smartphone, Mic } from "lucide-react";
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

type SipMode = "0" | "1" | "2";

const MODE_OPTIONS: { value: SipMode; label: string }[] = [
  { value: "0", label: "关闭" },
  { value: "1", label: "通话" },
  { value: "2", label: "对讲" },
];

export function VoiceCallPanel() {
  const [mode, setMode] = useState<SipMode>("1");
  const [uri, setUri] = useState("sip.example.com");
  const [username, setUsername] = useState("1001");
  const [password, setPassword] = useState("");
  const [call, setCall] = useState("2001");
  const [isTalking, setIsTalking] = useState(false);

  // mock 状态
  const account = username || "-";
  const peer = call || "-";
  const hookStatus: 0 | 1 | 2 = mode === "0" ? 0 : 1;
  const registerStatus = mode === "0" ? "disable" : "已注册";
  const sHookStatus = hookStatus === 0 ? "空闲" : hookStatus === 1 ? "通话中" : "异常";

  const dotColor =
    hookStatus === 0 ? "bg-muted-foreground" : hookStatus === 1 ? "bg-green-500" : "bg-red-500";

  const handleConfirm = () => {
    toast.success("修改成功！");
  };

  const startedRef = useRef(false);
  const startTalk = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setIsTalking(true);
  };
  const endTalk = () => {
    if (!startedRef.current) return;
    startedRef.current = false;
    setIsTalking(false);
  };

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
          <span>{account}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span>{registerStatus}</span>
          <span className={cn("inline-block w-2.5 h-2.5 rounded-full", dotColor)} />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Smartphone className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground">对方：</span>
          <span>{peer}</span>
        </div>
      </div>

      {/* 表单 */}
      <div className="mt-4 grid grid-cols-[6rem_1fr] gap-x-3 gap-y-3 items-center">
        <Label>模式</Label>
        <div className="w-44">
          <Select value={mode} onValueChange={(v) => setMode(v as SipMode)}>
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
            <Input value={uri} onChange={(e) => setUri(e.target.value)} className="h-8 w-72" />

            <Label>SIP账号</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-8 w-72"
            />

            <Label>SIP密码</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-8 w-72"
            />

            <Label>自动拨号</Label>
            <Input value={call} onChange={(e) => setCall(e.target.value)} className="h-8 w-72" />

            <Label>注册状态</Label>
            <span className="text-sm">{registerStatus}</span>

            <Label>拨号状态</Label>
            <span className="text-sm">{sHookStatus}</span>
          </>
        )}

        {mode === "2" && (
          <>
            <Label>对讲服务器</Label>
            <Input value={uri} onChange={(e) => setUri(e.target.value)} className="h-8 w-72" />

            <Label>对讲账号</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-8 w-72"
            />

            <Label>对讲密码</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-8 w-72"
            />

            <Label>对讲通道</Label>
            <div className="flex items-center gap-2">
              <Input
                value={call}
                onChange={(e) => setCall(e.target.value)}
                className="h-8 w-60"
              />
              <button
                type="button"
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
                  "h-8 w-8 inline-flex items-center justify-center rounded-md border border-border transition-colors select-none",
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
            <span className="text-sm">{registerStatus}</span>
          </>
        )}
      </div>

      <div className="mt-6">
        <Button size="sm" onClick={handleConfirm}>
          确定
        </Button>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-sm text-muted-foreground">{children}：</span>;
}
