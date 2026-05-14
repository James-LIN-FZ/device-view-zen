import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Radio, LogOut, UserCircle2 } from "lucide-react";

export function TopBar() {
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());
  const [user, setUser] = useState("admin");

  useEffect(() => {
    try {
      const u = sessionStorage.getItem("vtx-user");
      if (u) setUser(u);
    } catch {}
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;

  const logout = () => {
    try { sessionStorage.removeItem("vtx-user"); } catch {}
    navigate({ to: "/login" });
  };

  return (
    <header className="h-14 shrink-0 border-b border-border bg-panel/80 backdrop-blur flex items-center px-5 gap-6">
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-md bg-primary/15 border border-primary/40 flex items-center justify-center">
          <Radio className="h-4 w-4 text-primary" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-wide">VTX Console</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">视频传输设备管理平台</div>
        </div>
      </div>

      <div className="flex-1" />

      <div className="font-mono text-sm text-muted-foreground tabular-nums">{fmt(now)}</div>

      <div className="flex items-center gap-3 pl-4 border-l border-border">
        <UserCircle2 className="h-5 w-5 text-primary" />
        <span className="text-sm">{user}</span>
        <button
          onClick={logout}
          className="ml-2 inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-primary/60 transition"
        >
          <LogOut className="h-3.5 w-3.5" /> 退出
        </button>
      </div>
    </header>
  );
}
