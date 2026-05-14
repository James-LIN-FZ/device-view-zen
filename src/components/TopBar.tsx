import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Radio, LogOut, UserCircle2 } from "lucide-react";
import { getAuthUser, logout as logoutRequest } from "@/lib/auth";

export function TopBar() {
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());
  const [user, setUser] = useState("-");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const currentUser = getAuthUser();
    if (currentUser?.username) setUser(currentUser.username);

    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;

  const logout = async () => {
    if (pending) return;
    setPending(true);
    await logoutRequest();
    setPending(false);
    navigate({ to: "/login" });
  };

  return (
    <header className="h-12 shrink-0 border-b border-border bg-panel flex items-center px-4 gap-5">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-sm bg-primary/15 border border-primary/50 flex items-center justify-center">
          <Radio className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold tracking-wide text-primary">VTX Console</div>
          <div className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">视频传输设备管理平台</div>
        </div>
      </div>

      <div className="flex-1" />

      <div className="font-mono text-[12px] text-muted-foreground tabular-nums">{fmt(now)}</div>

      <div className="flex items-center gap-2 pl-4 border-l border-border">
        <UserCircle2 className="h-4 w-4 text-primary" />
        <span className="text-[12px]">{user}</span>
        <button
          onClick={logout}
          disabled={pending}
          className="ml-1 inline-flex items-center gap-1 rounded-sm border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/60 transition"
        >
          <LogOut className="h-3 w-3" /> {pending ? "退出中..." : "退出"}
        </button>
      </div>
    </header>
  );
}
