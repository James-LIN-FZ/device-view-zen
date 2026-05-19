import { useMemo } from "react";
import { Settings } from "lucide-react";
import type { BackendDevice } from "@/lib/device-api";

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

      <div className="flex-1 overflow-y-auto p-6">
        {!device ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            请选择左侧设备
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            配置项即将上线，敬请期待。
          </div>
        )}
      </div>
    </section>
  );
}
