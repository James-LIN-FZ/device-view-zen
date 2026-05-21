import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export type PanelLoadStatus = "loading" | "ready" | "error";

/**
 * Centered loading spinner (Windows-style green ring) for panel contents.
 */
export function PanelLoading({ label = "加载中…" }: { label?: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 rounded-full border-[3px] border-muted/40" />
        <Loader2
          className="absolute inset-0 h-12 w-12 animate-spin text-green-500"
          strokeWidth={2.5}
        />
      </div>
      <span className="text-sm">{label}</span>
    </div>
  );
}

/**
 * Centered failure state with a refresh button. Renders inside the panel.
 */
export function PanelError({
  message = "加载失败",
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
      <AlertCircle className="h-10 w-10 text-red-500" />
      <span className="text-sm">{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md",
          "text-sm text-foreground bg-muted/40 hover:bg-muted",
          "border border-border transition-colors",
        )}
      >
        <RefreshCw className="h-3.5 w-3.5" />
        刷新
      </button>
    </div>
  );
}

/**
 * Wraps panel content. While `status` is "loading" or "error", displays
 * the centered overlay; otherwise renders `children`.
 */
export function PanelStatusView({
  status,
  onRetry,
  loadingLabel,
  errorLabel,
  children,
}: {
  status: PanelLoadStatus;
  onRetry: () => void;
  loadingLabel?: string;
  errorLabel?: string;
  children?: React.ReactNode;
}) {
  if (status === "loading") {
    return (
      <div className="relative w-full h-full min-h-[240px]">
        <PanelLoading label={loadingLabel} />
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="relative w-full h-full min-h-[240px]">
        <PanelError message={errorLabel} onRetry={onRetry} />
      </div>
    );
  }
  return <>{children}</>;
}
