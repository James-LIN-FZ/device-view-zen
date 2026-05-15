import { SlidersHorizontal, MonitorPlay, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewKey = "control" | "monitor" | "users";

const items: { key: ViewKey; label: string; Icon: typeof SlidersHorizontal }[] = [
  { key: "control", label: "控制台", Icon: SlidersHorizontal },
  { key: "monitor", label: "监看", Icon: MonitorPlay },
  { key: "users", label: "用户管理", Icon: Users },
];

export function ViewSwitcher({
  active,
  onChange,
}: {
  active: ViewKey;
  onChange: (key: ViewKey) => void;
}) {
  return (
    <div className="panel flex flex-col items-center gap-2 p-2 w-14">
      {items.map(({ key, label, Icon }) => {
        const isActive = key === active;
        return (
          <button
            key={key}
            type="button"
            title={label}
            aria-label={label}
            onClick={() => onChange(key)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 w-full rounded-md py-2 text-[10px] transition-colors cursor-pointer",
              isActive
                ? "bg-accent text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <Icon size={18} />
            <span className="leading-none">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
