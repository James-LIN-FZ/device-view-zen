import { useMemo, useState } from "react";
import {
  Settings,
  SlidersHorizontal,
  LayoutTemplate,
  Captions,
  Globe,
  Phone,
  FolderUp,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BackendDevice } from "@/lib/device-api";
import { EncodingTasksPanel } from "@/components/EncodingTasksPanel";
import { TemplatesPanel } from "@/components/TemplatesPanel";
import { OsdPanel } from "@/components/OsdPanel";
import { NetworkSettingsPanel } from "@/components/NetworkSettingsPanel";
import { VoiceCallPanel } from "@/components/VoiceCallPanel";
import { SystemInfoPanel } from "@/components/SystemInfoPanel";

type SectionKey =
  | "encoding"
  | "template"
  | "osd"
  | "network"
  | "voice"
  | "file"
  | "system";

const SECTIONS: { key: SectionKey; label: string; Icon: typeof Settings }[] = [
  { key: "encoding", label: "编码配置", Icon: SlidersHorizontal },
  { key: "template", label: "模板配置", Icon: LayoutTemplate },
  { key: "osd", label: "OSD", Icon: Captions },
  { key: "network", label: "网络设置", Icon: Globe },
  { key: "voice", label: "语音通话", Icon: Phone },
  { key: "file", label: "文件传输", Icon: FolderUp },
  { key: "system", label: "系统信息", Icon: Info },
];

export function DeviceConfigView({
  devices,
  selectedSn,
}: {
  devices: BackendDevice[];
  selectedSn: string;
}) {
  const device = useMemo(
    () => devices.find((d) => d.serialNo === selectedSn) ?? null,
    [devices, selectedSn],
  );
  const [active, setActive] = useState<SectionKey>("encoding");
  const activeMeta = SECTIONS.find((s) => s.key === active)!;

  return (
    <section className="panel flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Settings className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold tracking-wide">设备配置</h2>
        {device ? (
          <span className="ml-2 text-xs text-muted-foreground truncate">
            {device.name?.trim() || "未命名设备"} · {device.serialNo}
          </span>
        ) : null}
      </div>

      {!device ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          请选择左侧设备
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Secondary nav */}
          <nav className="w-56 shrink-0 border-r border-border overflow-y-auto py-3">
            {SECTIONS.map(({ key, label, Icon }) => {
              const isActive = active === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActive(key)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3.5 text-sm text-left border-l-2 transition-colors",
                    isActive
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right panel */}
          <div className="flex-1 min-w-0 overflow-y-auto px-4 py-3">
            {active === "encoding" ? (
              <EncodingTasksPanel serialNo={device.serialNo} online={device.online} />
            ) : active === "template" ? (
              <TemplatesPanel serialNo={device.serialNo} online={device.online} />
            ) : active === "osd" ? (
              <OsdPanel />
            ) : active === "network" ? (
              <NetworkSettingsPanel />
            ) : active === "voice" ? (
              <VoiceCallPanel />
            ) : active === "system" ? (
              <SystemInfoPanel />
            ) : (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <activeMeta.Icon className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">{activeMeta.label}</h3>
                </div>
                <div className="text-sm text-muted-foreground">
                  {activeMeta.label}项即将上线，敬请期待。
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
