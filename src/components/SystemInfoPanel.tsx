import { useState } from "react";
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


export function SystemInfoPanel() {
  // 系统信息
  const [deviceName] = useState("EncodeBox-X1");
  const [model] = useState("v3.2.1");
  const [serialNumber] = useState("SN20260310001");
  const [activated, setActivated] = useState(true);
  const [activationKey, setActivationKey] = useState("XXXX-XXXX-XXXX-XXXX");
  const [editingKey, setEditingKey] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [pageVersion] = useState("v8.5_20260310");
  const [iFrpClientId] = useState("10086");
  const [sFrpServer] = useState("frp.example.com");
  const [ntpStatus, setNtpStatus] = useState("已同步");
  const [feature] = useState("Standard");

  // 系统操作
  const [controlCmd, setControlCmd] = useState("");


  // 服务器配置
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [enteredPassword, setEnteredPassword] = useState("");
  const [serverConfigDialog, setServerConfigDialog] = useState(false);
  const [sserver, setSserver] = useState("agg.example.com");
  const [skey, setSkey] = useState("");
  const [sGTHost] = useState("smux.example.com");
  const [sGTPeer] = useState("PEER-001");
  const [sFileServer, setSFileServer] = useState("file.example.com");

  // 修改密码
  const [changePskDialog, setChangePskDialog] = useState(false);
  const [newPsk, setNewPsk] = useState("");
  const [confirmPsk, setConfirmPsk] = useState("");

  const verifyPassword = () => {
    if (!enteredPassword) {
      toast.error("请输入密码");
      return;
    }
    setPasswordDialog(false);
    setEnteredPassword("");
    setServerConfigDialog(true);
  };

  const confirmServer = () => {
    setServerConfigDialog(false);
    toast.success("服务器配置已保存");
  };

  const confirmActivation = () => {
    setEditingKey(false);
    setActivated(true);
    toast.success("激活成功");
  };

  const sync = () => {
    setNtpStatus("同步中...");
    setTimeout(() => {
      setNtpStatus("已同步");
      toast.success("NTP 同步完成");
    }, 800);
  };

  const handleUpload = () => fileRef.current?.click();
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImgDataUrl(f.name);
    // 模拟升级进度
    setShowProgress(true);
    setCurProgress(0);
    const t = setInterval(() => {
      setCurProgress((p) => {
        if (p >= 100) {
          clearInterval(t);
          setShowProgress(false);
          toast.success("升级完成");
          return 100;
        }
        return p + 10;
      });
    }, 400);
  };

  const reboot = () => {
    if (confirm("确定重启设备?")) toast.success("设备重启指令已发送");
  };

  const confirmChangePsk = () => {
    if (!newPsk || newPsk !== confirmPsk) {
      toast.error("两次密码不一致");
      return;
    }
    setChangePskDialog(false);
    setNewPsk("");
    setConfirmPsk("");
    toast.success("密码已修改");
  };

  const sendControl = () => {
    if (!controlCmd) return;
    toast.success(`指令已发送：${controlCmd}`);
  };

  return (
    <div className="-mt-2 -ml-2 max-w-4xl space-y-6">
      {/* ====== 系统信息 ====== */}
      <section>
        <h3 className="text-sm font-medium mb-3">系统信息</h3>
        <div className="border border-border rounded-md px-4 py-3 grid grid-cols-2 gap-x-8 gap-y-2">
          <Row label="设备型号" value={deviceName} />
          <Row label="管理账号" value={`${iFrpClientId}@${sFrpServer}`} />
          <Row label="系统版本" value={model} />
          <Row
            label="NTP状态"
            value={
              <span className="flex items-center gap-2">
                {ntpStatus}
                <Button size="sm" variant="outline" className="h-6 px-2" onClick={sync}>
                  同步
                </Button>
              </span>
            }
          />
          <Row label="序列号" value={serialNumber} />
          <Row label="特性" value={feature} />
          <Row
            label="激活码"
            value={
              editingKey ? (
                <span className="flex items-center gap-2">
                  <Input
                    value={activationKey}
                    onChange={(e) => setActivationKey(e.target.value)}
                    className="h-7 w-48"
                  />
                  <Button size="sm" className="h-7 px-2" onClick={confirmActivation}>
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
                  onClick={() => setEditingKey(true)}
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
                onClick={() => setPasswordDialog(true)}
                className="text-primary hover:underline"
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
            />
            <Button size="sm" onClick={sendControl}>
              确认
            </Button>
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="outline" size="sm" onClick={reboot}>
              重启
            </Button>
            <Button variant="outline" size="sm" onClick={() => setChangePskDialog(true)}>
              修改密码
            </Button>
          </div>
        </div>
      </section>

      {/* ====== 升级进度 ====== */}
      <Dialog open={showProgress}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>升级中</DialogTitle>
          </DialogHeader>
          <Progress value={curProgress} />
          <p className="text-center text-sm text-muted-foreground">{curProgress}%</p>
        </DialogContent>
      </Dialog>

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
