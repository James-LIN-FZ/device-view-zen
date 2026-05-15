import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, KeyRound, Link2, Link2Off, ShieldCheck, User as UserIcon, RefreshCw } from "lucide-react";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAuthUser } from "@/lib/auth";
import {
  createBinding,
  createUser,
  deleteBinding,
  deleteUser,
  fetchBindings,
  fetchUsers,
  updateOwnPassword,
  updateUserPassword,
  type BackendUser,
  type DeviceBinding,
} from "@/lib/users-api";

interface Props {
  onUnauthorized: () => void;
}

export function UserManagementView({ onUnauthorized }: Props) {
  const me = getAuthUser();
  const isAdmin = me?.role === "admin";

  const [users, setUsers] = useState<BackendUser[]>([]);
  const [bindings, setBindings] = useState<DeviceBinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [pwdTarget, setPwdTarget] = useState<BackendUser | null>(null);
  const [bindOpen, setBindOpen] = useState(false);
  const [selfPwdOpen, setSelfPwdOpen] = useState(false);

  const handleErr = (err: unknown, fallback: string) => {
    const message = err instanceof Error ? err.message : fallback;
    if (message === "unauthorized") {
      onUnauthorized();
      return;
    }
    setError(message);
  };

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      if (isAdmin) {
        const [u, b] = await Promise.all([fetchUsers(), fetchBindings()]);
        setUsers(u);
        setBindings(b);
      } else {
        const b = await fetchBindings();
        setBindings(b);
      }
    } catch (err) {
      handleErr(err, "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-full min-h-0 flex flex-col gap-2">
      <div className="panel flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <ShieldCheck size={16} className="text-primary" />
          ) : (
            <UserIcon size={16} className="text-muted-foreground" />
          )}
          <span className="text-sm font-medium">用户管理</span>
          <span className="text-xs text-muted-foreground">
            当前账户：{me?.username} · {isAdmin ? "管理员" : "普通用户"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={reload} disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            刷新
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSelfPwdOpen(true)}>
            <KeyRound size={14} />
            修改我的密码
          </Button>
          {isAdmin ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setBindOpen(true)}>
                <Link2 size={14} />
                绑定设备
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus size={14} />
                新建用户
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="panel border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      <div
        className="flex-1 min-h-0 grid gap-2"
        style={{ gridTemplateColumns: isAdmin ? "1fr 1fr" : "1fr" }}
      >
        {isAdmin ? (
          <UsersTable
            users={users}
            currentUserId={me?.id}
            onDelete={async (u) => {
              if (!confirm(`确定要删除用户 "${u.username}" 吗？`)) return;
              try {
                await deleteUser(u.id);
                setUsers((curr) => curr.filter((x) => x.id !== u.id));
                setBindings((curr) => curr.filter((b) => b.userId !== u.id));
              } catch (err) {
                handleErr(err, "删除用户失败");
              }
            }}
            onChangePassword={(u) => setPwdTarget(u)}
          />
        ) : null}

        <BindingsTable
          bindings={bindings}
          isAdmin={isAdmin}
          onUnbind={async (b) => {
            if (!confirm(`解除 ${b.username} 与 ${b.serialNo} 的绑定？`)) return;
            try {
              await deleteBinding(b.id);
              setBindings((curr) => curr.filter((x) => x.id !== b.id));
            } catch (err) {
              handleErr(err, "解除绑定失败");
            }
          }}
        />
      </div>

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(u) => setUsers((curr) => [...curr, u])}
        onError={(m) => setError(m)}
        onUnauthorized={onUnauthorized}
      />

      <ChangePasswordDialog
        target={pwdTarget}
        onOpenChange={(open) => !open && setPwdTarget(null)}
        onError={(m) => setError(m)}
        onUnauthorized={onUnauthorized}
      />

      <BindDeviceDialog
        open={bindOpen}
        onOpenChange={setBindOpen}
        users={users}
        onCreated={(b) => setBindings((curr) => [...curr, b])}
        onError={(m) => setError(m)}
        onUnauthorized={onUnauthorized}
      />

      <SelfPasswordDialog
        open={selfPwdOpen}
        onOpenChange={setSelfPwdOpen}
        onError={(m) => setError(m)}
        onUnauthorized={onUnauthorized}
      />
    </div>
  );
}

function UsersTable({
  users,
  currentUserId,
  onDelete,
  onChangePassword,
}: {
  users: BackendUser[];
  currentUserId?: number;
  onDelete: (u: BackendUser) => void;
  onChangePassword: (u: BackendUser) => void;
}) {
  return (
    <div className="panel flex flex-col min-h-0">
      <div className="px-3 py-2 border-b text-xs text-muted-foreground">
        用户列表（{users.length}）
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground sticky top-0 bg-panel">
            <tr className="border-b">
              <th className="text-left px-3 py-2 font-medium">用户名</th>
              <th className="text-left px-3 py-2 font-medium">角色</th>
              <th className="text-right px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b hover:bg-secondary/40">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {u.role === "admin" ? (
                      <ShieldCheck size={14} className="text-primary" />
                    ) : (
                      <UserIcon size={14} className="text-muted-foreground" />
                    )}
                    {u.username}
                    {u.id === currentUserId ? (
                      <span className="text-[10px] text-muted-foreground">(我)</span>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={
                      u.role === "admin"
                        ? "text-xs text-primary"
                        : "text-xs text-muted-foreground"
                    }
                  >
                    {u.role === "admin" ? "管理员" : "普通用户"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onChangePassword(u)}
                      title="修改密码"
                    >
                      <KeyRound size={14} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDelete(u)}
                      disabled={u.id === currentUserId}
                      title="删除"
                    >
                      <Trash2 size={14} className="text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  暂无用户
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BindingsTable({
  bindings,
  isAdmin,
  onUnbind,
}: {
  bindings: DeviceBinding[];
  isAdmin: boolean;
  onUnbind: (b: DeviceBinding) => void;
}) {
  return (
    <div className="panel flex flex-col min-h-0">
      <div className="px-3 py-2 border-b text-xs text-muted-foreground">
        {isAdmin ? `所有设备绑定记录（${bindings.length}）` : `我绑定的设备（${bindings.length}）`}
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground sticky top-0 bg-panel">
            <tr className="border-b">
              {isAdmin ? <th className="text-left px-3 py-2 font-medium">用户</th> : null}
              <th className="text-left px-3 py-2 font-medium">设备序列号</th>
              <th className="text-left px-3 py-2 font-medium">设备名</th>
              {isAdmin ? <th className="text-right px-3 py-2 font-medium">操作</th> : null}
            </tr>
          </thead>
          <tbody>
            {bindings.map((b) => (
              <tr key={b.id} className="border-b hover:bg-secondary/40">
                {isAdmin ? <td className="px-3 py-2">{b.username}</td> : null}
                <td className="px-3 py-2 font-mono text-xs">{b.serialNo}</td>
                <td className="px-3 py-2 text-muted-foreground">{b.deviceName || "—"}</td>
                {isAdmin ? (
                  <td className="px-3 py-2">
                    <div className="flex justify-end">
                      <Button size="sm" variant="ghost" onClick={() => onUnbind(b)} title="解除绑定">
                        <Link2Off size={14} className="text-destructive" />
                      </Button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
            {bindings.length === 0 ? (
              <tr>
                <td
                  colSpan={isAdmin ? 4 : 3}
                  className="px-3 py-6 text-center text-xs text-muted-foreground"
                >
                  暂无绑定记录
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
  onError,
  onUnauthorized,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (u: BackendUser) => void;
  onError: (m: string) => void;
  onUnauthorized: () => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setUsername("");
      setPassword("");
      setRole("user");
    }
  }, [open]);

  const submit = async () => {
    if (!username.trim() || !password) return;
    setBusy(true);
    try {
      const u = await createUser({ username: username.trim(), password, role });
      onCreated(u);
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "创建用户失败";
      if (message === "unauthorized") onUnauthorized();
      else onError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建用户</DialogTitle>
          <DialogDescription>创建一个新的平台账户</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">用户名</label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={64} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">初始密码</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={128}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">角色</label>
            <Select value={role} onValueChange={(v) => setRole(v as "admin" | "user")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">普通用户</SelectItem>
                <SelectItem value="admin">管理员</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={submit} disabled={busy || !username.trim() || !password}>
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChangePasswordDialog({
  target,
  onOpenChange,
  onError,
  onUnauthorized,
}: {
  target: BackendUser | null;
  onOpenChange: (open: boolean) => void;
  onError: (m: string) => void;
  onUnauthorized: () => void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (target) setPassword("");
  }, [target]);

  const submit = async () => {
    if (!target || !password) return;
    setBusy(true);
    try {
      await updateUserPassword(target.id, password);
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "修改密码失败";
      if (message === "unauthorized") onUnauthorized();
      else onError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>修改密码</DialogTitle>
          <DialogDescription>为用户 {target?.username} 设置新密码</DialogDescription>
        </DialogHeader>
        <div>
          <label className="text-xs text-muted-foreground">新密码</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={128}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={submit} disabled={busy || !password}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BindDeviceDialog({
  open,
  onOpenChange,
  users,
  onCreated,
  onError,
  onUnauthorized,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: BackendUser[];
  onCreated: (b: DeviceBinding) => void;
  onError: (m: string) => void;
  onUnauthorized: () => void;
}) {
  const [userId, setUserId] = useState("");
  const [serialNo, setSerialNo] = useState("");
  const [busy, setBusy] = useState(false);

  const userOptions = useMemo(() => users.filter((u) => u.role !== "admin"), [users]);

  useEffect(() => {
    if (open) {
      setUserId("");
      setSerialNo("");
    }
  }, [open]);

  const submit = async () => {
    if (!userId || !serialNo.trim()) return;
    setBusy(true);
    try {
      const b = await createBinding({ userId: Number(userId), serialNo: serialNo.trim() });
      onCreated(b);
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "绑定失败";
      if (message === "unauthorized") onUnauthorized();
      else onError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>绑定设备</DialogTitle>
          <DialogDescription>将设备序列号绑定到指定用户</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">目标用户</label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="选择用户..." />
              </SelectTrigger>
              <SelectContent>
                {userOptions.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">设备序列号</label>
            <Input
              value={serialNo}
              onChange={(e) => setSerialNo(e.target.value)}
              placeholder="例如：VTX-XXXXXXXX"
              maxLength={128}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={submit} disabled={busy || !userId || !serialNo.trim()}>
            绑定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SelfPasswordDialog({
  open,
  onOpenChange,
  onError,
  onUnauthorized,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onError: (m: string) => void;
  onUnauthorized: () => void;
}) {
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setOldPwd("");
      setNewPwd("");
    }
  }, [open]);

  const submit = async () => {
    if (!oldPwd || !newPwd) return;
    setBusy(true);
    try {
      await updateOwnPassword(oldPwd, newPwd);
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "修改密码失败";
      if (message === "unauthorized") onUnauthorized();
      else onError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>修改我的密码</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">当前密码</label>
            <Input type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">新密码</label>
            <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={submit} disabled={busy || !oldPwd || !newPwd}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
