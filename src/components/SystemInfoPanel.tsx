import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { requestDeviceRPC, fetchDeviceRPCReply } from "@/lib/device-api";

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
      if (reply !== null) return reply;
    }
    return null;
  } catch {
    return null;
  }
}

export function SystemInfoPanel({ serialNo, online }: { serialNo: string; online: boolean }) {
  const mountedRef = useRef(true);

  // 系统信息
  const [loading, setLoading] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [activated, setActivated] = useState(false);
  const [activationKey, setActivationKey] = useState("");
  const [editingKey, setEditingKey] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const pageVersion = "v8.5_20260310";
  const [iFrpClientId, setIFrpClientId] = useState("");
  const [sFrpServer, setSFrpServer] = useState("");
  const [ntpStatus, setNtpStatus] = useState("--");
  const [feature, setFeature] = useState("--");

  // 系统操作
  const [controlCmd, setControlCmd] = useState("");

  // 服务器配置
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [enteredPassword, setEnteredPassword] = useState("");
  const [serverConfigDialog, setServerConfigDialog] = useState(false);
  const [sserver, setSserver] = useState("");
  const [skey, setSkey] = useState("");
  const [sGTHost, setSGTHost] = useState("");
  const [sGTPeer, setSGTPeer] = useState("");
  const [sFileServer, setSFileServer] = useState("");

  // 修改密码
  const [changePskDialog, setChangePskDialog] = useState(false);
  const [newPsk, setNewPsk] = useState("");
  const [confirmPsk, setConfirmPsk] = useState("");

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!online) return;
    void loadInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialNo, online]);

  async function loadInfo() {
    if (!mountedRef.current) return;
    setLoading(true);
    try {
      const infoReply = await rpcCall(serialNo, "GET", "/system/deviceinfo");
      if (!mountedRef.current) return;
      if (infoReply?.status === "ok" && Array.isArray(infoReply.data)) {
        const items = infoReply.data as { name: string; value: unknown }[];
        const get = (n: string) => (items.find((i) => i.name === n)?.value as string) ?? "";
        setDeviceName(get("deviceName"));
        setModel(get("model"));
        setSerialNumber(get("serialNumber"));
        setActivationKey(get("key"));
        setIFrpClientId(get("iFrpClientId"));
        setSFrpServer(get("sFrpServer"));
        setNtpStatus(get("sNtpStatus") || "--");
        setFeature(get("sFeature") || "--");
        setSserver(get("sSSServer"));
        setSkey(get("sSSKey"));
        setSGTHost(get("sGTHost"));
        setSGTPeer(get("sGTPeer"));
        setSFileServer(get("sFileServer"));
        setActivated(get("iVerifyResult") === "1");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  const confirmActivation = async () => {
    const reply = await rpcCall(serialNo, "POST", "/system/key", { key: activationKey });
    if (!mountedRef.current) return;
    if (reply?.status === "ok") {
      setEditingKey(false);
      setActivated(true);
      toast.success("激活成功");
    } else {
      toast.error("激活失败");
    }
  };

  const syncNtp = async () => {
    setNtpStatus("同步中...");
    const reply = await rpcCall(serialNo, "POST", "/system/ntp");
    if (!mountedRef.current) return;
    if (reply?.status === "ok") {
      setNtpStatus("已同步");
      toast.success("NTP 同步完成");
    } else {
      setNtpStatus("同步失败");
      toast.error("NTP 同步失败");
    }
  };

  const reboot = async () => {
    if (!confirm("确定重启设备?")) return;
    const reply = await rpcCall(serialNo, "POST", "/system/reboot");
    if (reply?.status === "ok") {
      toast.success("设备重启指令已发送");
    } else {
      toast.error("重启指令发送失败");
    }
  };

  const sendControl = async () => {
    if (!controlCmd) return;
    const reply = await rpcCall(serialNo, "POST", "/system/control", { cmd: controlCmd });
    if (reply?.status === "ok") {
      toast.success("指令已发送");
    } else {
      toast.error("指令发送失败");
    }
  };

  const verifyPassword = () => {
    if (enteredPassword === "5g4kpassword") {
      setPasswordDialog(false);
      setEnteredPassword("");
      setServerConfigDialog(true);
    } else {
      toast.error("密码错误");
    }
  };

  const confirmServer = async () => {
    const reply = await rpcCall(serialNo, "POST", "/net/ss_server", {
      sSSServer: sserver,
      sSSKey: skey,
      sGTHost,
      sGTPeer,
      sFileServer,
    });
    if (!mountedRef.current) return;
    if (reply?.status === "ok") {
      setServerConfigDialog(false);
      toast.success("服务器配置已保存");
    } else {
      toast.error("保存失败");
    }
  };

  const confirmChangePsk = async () => {
    if (!newPsk || newPsk.length < 6) {
      toast.error("密码长度不能小于6位");
      return;
    }
    if (newPsk !== confirmPsk) {
      toast.error("两次密码不一致");
      return;
    }
    const reply = await rpcCall(serialNo, "POST", "/system/psk", { psk: newPsk });
    if (!mountedRef.current) return;
    if (reply?.status === "ok") {
      setChangePskDialog(false);
      setNewPsk("");
      setConfirmPsk("");
      toast.success("密码修改成功");
    } else {
      toast.error("修改密码失败");
    }
  };

  return (
    <div className="-mt-2 -ml-2 max-w-4xl space-y-6">
      {/* ====== 系统信息 ====== */}
      <section>
        <h3 className="text-sm font-medium mb-3">系统信息</h3>
        <div className="border border-border rounded-md px-4 py-3 grid grid-cols-2 gap-x-8 gap-y-2">
          <Row label="设备型号" value={loading ? "加载中..." : deviceName} />
          <Row label="管理账号" value={loading ? "加载中..." : `${iFrpClientId}@${sFrpServer}`} />
          <Row label="系统版本" value={loading ? "加载中..." : model} />
          <Row
            label="NTP状态"
            value={
              <span className="flex items-center gap-2">
                {loading ? "加载中..." : ntpStatus}
                <Button size="sm" variant="outline" className="h-6 px-2" onClick={syncNtp} disabled={!online}>
                  同步
                </Button>
              </span>
            }
          />
          <Row label="序列号" value={loading ? "加载中..." : serialNumber} />
          <Row label="特性" value={loading ? "加载中..." : feature} />
          <Row
            label="激活码"
            value={
              editingKey ? (
                <span className="flex items-center gap-2">
                  <Input
                    value={activationKey}
                    onChange={(e) => setActivationKey(e.target.value)}
                    className="h-7 w-48"
                    disabled={!online}
                  />
                  <Button size="sm" className="h-7 px-2" onClick={confirmActivation} disabled={!online}>
                    确认
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2"
                    onClick={() => setEditingKey(false)}
                  >
                    取消
                  </Button>
                </span>
              ) : (
                <span
                  className="flex items-center gap-1 cursor-pointer"
                  onClick={() => online && setEditingKey(true)}
                >
                  <span>{showKey ? activationKey : "••••-••••-••••-••••"}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowKey((v) => !v);
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  {activated ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 ml-1" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500 ml-1" />
                  )}
                </span>
              )
            }
          />
          <Row
            label="服务器配置"
            value={
              <button
                onClick={() => online && setPasswordDialog(true)}
                disabled={!online}
                className="text-primary hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
              >
                配置
              </button>
            }
          />
          <Row label="页面版本号" value={pageVersion} />
        </div>
      </section>

      {/* ====== 系统操作 ====== */}
      <section>
        <h3 className="text-sm font-medium mb-3">系统操作</h3>
        <div className="border border-border rounded-md px-4 py-3 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-20 shrink-0">特权指令：</span>
            <Input
              value={controlCmd}
              onChange={(e) => setControlCmd(e.target.value)}
              className="h-8 w-80"
              disabled={!online}
            />
            <Button size="sm" onClick={sendControl} disabled={!online}>
              确认
            </Button>
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="outline" size="sm" onClick={reboot} disabled={!online}>
              重启
            </Button>
            <Button variant="outline" size="sm" onClick={() => setChangePskDialog(true)} disabled={!online}>
              修改密码
            </Button>
          </div>
        </div>
      </section>

      {/* ====== 管理员密码 ====== */}
      <Dialog open={passwordDialog} onOpenChange={setPasswordDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>请输入管理员密码</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-12 shrink-0">密码：</span>
            <Input
              type="password"
              value={enteredPassword}
              onChange={(e) => setEnteredPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && verifyPassword()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPasswordDialog(false);
                setEnteredPassword("");
              }}
            >
              取消
            </Button>
            <Button onClick={verifyPassword}>确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== 服务器配置 ====== */}
      <Dialog open={serverConfigDialog} onOpenChange={setServerConfigDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>服务器配置</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <DlgField label="聚合服务器">
              <Input value={sserver} onChange={(e) => setSserver(e.target.value)} />
            </DlgField>
            <DlgField label="密钥">
              <Input value={skey} onChange={(e) => setSkey(e.target.value)} />
            </DlgField>
            <DlgField label="S-MUX服务器">
              <Input value={sGTHost} disabled />
            </DlgField>
            <DlgField label="S-MUX ID">
              <Input value={sGTPeer} disabled />
            </DlgField>
            <DlgField label="文件服务器">
              <Input value={sFileServer} onChange={(e) => setSFileServer(e.target.value)} />
            </DlgField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServerConfigDialog(false)}>
              取消
            </Button>
            <Button onClick={confirmServer}>确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== 修改密码 ====== */}
      <Dialog open={changePskDialog} onOpenChange={setChangePskDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>修改密码</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">新密码</label>
              <Input
                type="password"
                value={newPsk}
                onChange={(e) => setNewPsk(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">确认新密码</label>
              <Input
                type="password"
                value={confirmPsk}
                onChange={(e) => setConfirmPsk(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePskDialog(false)}>
              取消
            </Button>
            <Button onClick={confirmChangePsk}>确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 min-h-7">
      <span className="text-xs text-muted-foreground w-24 shrink-0">{label}：</span>
      <div className="text-sm flex-1">{value}</div>
    </div>
  );
}

function DlgField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground w-24 shrink-0">{label}：</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}
