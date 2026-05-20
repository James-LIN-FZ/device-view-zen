import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchDeviceRPCReply, requestDeviceRPC } from "@/lib/device-api";

const OSD_TYPES = [{ label: "文字", value: "text" }];

const OSD_POSITIONS = [
  { label: "底部居中", value: "bottom_middle" },
  { label: "底部左对齐", value: "bottom_left" },
  { label: "底部右对齐", value: "bottom_right" },
  { label: "顶部居中", value: "top_middle" },
  { label: "顶部左对齐", value: "top_left" },
  { label: "顶部右对齐", value: "top_right" },
];

const OSD_SIZES = [24, 28, 32, 36, 38, 40];

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

export function OsdPanel({
  serialNo,
  online,
}: {
  serialNo: string;
  online: boolean;
}) {
  const mountedRef = useRef(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [osdType, setOsdType] = useState("text");
  const [position, setPosition] = useState("bottom_middle");
  const [size, setSize] = useState(32);
  const [color, setColor] = useState("#ffffff");
  const [text, setText] = useState("");

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    loadOsd();
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialNo, online]);

  async function loadOsd() {
    if (!online) {
      setLoading(false);
      return;
    }
    const reply = await rpcCall(serialNo, "GET", "/osd");
    if (!mountedRef.current) return;
    if (reply?.status === "ok" && reply.data) {
      const d = reply.data as Record<string, unknown>;
      setOsdType(String(d.sType ?? "text"));
      setPosition(String(d.sPosition ?? "bottom_middle"));
      setSize(Number(d.iFontSize ?? 32));
      setColor(String(d.sFontColor ?? "#ffffff"));
      setText(String(d.sText ?? ""));
    }
    setLoading(false);
  }

  async function handleConfirm() {
    if (text.length > 7) {
      toast.error("文字超过7个字，请重新输入！");
      return;
    }
    setSaving(true);
    const body = {
      sType: osdType,
      sPosition: position,
      iFontSize: size,
      sFontColor: color,
      sText: text,
    };
    const result = await rpcCall(serialNo, "POST", "/osd", body);
    if (!mountedRef.current) return;
    setSaving(false);
    if (result?.status === "ok") toast.success("保存成功");
    else toast.error("保存失败");
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">加载中…</span>
      </div>
    );
  }

  return (
    <div className="-mt-2 -ml-2">
      <h3 className="text-sm font-medium mb-4">OSD</h3>

      <div className="max-w-3xl grid grid-cols-[5rem_1fr] gap-x-3 gap-y-3 items-center">
        <Label>OSD类型</Label>
        <div className="w-44">
          <Select value={osdType} onValueChange={setOsdType} disabled={!online}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OSD_TYPES.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Label>对齐位置</Label>
        <div className="w-44">
          <Select value={position} onValueChange={setPosition} disabled={!online}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OSD_POSITIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Label>字体大小</Label>
        <div className="w-44">
          <Select value={String(size)} onValueChange={(v) => setSize(Number(v))} disabled={!online}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OSD_SIZES.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Label>字体颜色</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-12 rounded border border-input bg-transparent cursor-pointer p-1"
            disabled={!online}
          />
          <span className="text-xs text-muted-foreground font-mono">{color}</span>
        </div>

        <Label>OSD文字</Label>
        <div className="flex items-center gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={20}
            className="max-w-xs"
            disabled={!online}
          />
          <span className="text-xs text-muted-foreground">(最多输入7个字符)</span>
        </div>
      </div>

      <div className="max-w-3xl flex gap-3 pt-6">
        <Button onClick={handleConfirm} disabled={!online || saving}>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
          确定
        </Button>
        <Button variant="secondary" onClick={() => toast("已取消！")} disabled={saving}>
          取消
        </Button>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-sm text-muted-foreground text-right">{children}：</label>
  );
}

