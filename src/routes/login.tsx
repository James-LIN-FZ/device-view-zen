import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Radio, Lock, User } from "lucide-react";
import { login } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "登录 — 视频传输设备管理平台" },
      { name: "description", content: "登录视频传输设备管理平台" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;

    setError("");
    setPending(true);

    try {
      await login(username.trim(), password);
      navigate({ to: "/" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "登录失败，请稍后重试";
      setError(message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md panel p-8 glow-primary">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-md bg-primary/15 border border-primary/40 flex items-center justify-center">
            <Radio className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-wide">VTX Console</h1>
            <p className="text-xs text-muted-foreground">视频传输设备管理平台</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">账号</span>
            <div className="mt-1 flex items-center gap-2 rounded-md border border-border bg-input/40 px-3 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
              <User className="h-4 w-4 text-muted-foreground" />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="flex-1 bg-transparent py-2 text-sm outline-none"
                placeholder="请输入账号"
              />
            </div>
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">密码</span>
            <div className="mt-1 flex items-center gap-2 rounded-md border border-border bg-input/40 px-3 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1 bg-transparent py-2 text-sm outline-none"
                placeholder="请输入密码"
              />
            </div>
          </label>

          {error ? <p className="text-xs text-red-400">{error}</p> : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground transition hover:brightness-110 glow-primary"
          >
            {pending ? "登录中..." : "登 录"}
          </button>

          <p className="text-center text-xs text-muted-foreground pt-2">
            使用后端账号密码进行登录
          </p>
        </form>
      </div>
    </div>
  );
}
