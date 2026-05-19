import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const OSD_TYPES = [{ label: "文字", value: "text" }];

const OSD_POSITIONS = [
  { label: "底部居中", value: "bottom_middle" },
  { label: "底部左对齐", value: "bottom_left" },
  { label: "底部右对齐", value: "bottom_right" },
  { label: "顶部居中", value: "top_middle" },
  { label: "顶部左对齐", value: "top_left" },
  { label: "顶部右对齐", value: "top_right" },
];

const OSD_SIZES = ["24", "28", "32", "36", "38", "40"];

export function OsdPanel() {
  const [osdType, setOsdType] = useState("text");
  const [position, setPosition] = useState("bottom_middle");
  const [size, setSize] = useState("32");
  const [color, setColor] = useState("#ffffff");
  const [text, setText] = useState("");

  const handleConfirm = () => {
    if (text.length > 7) {
      toast.error("文字超过7个字，请重新输入！");
      return;
    }
    toast.success("保存成功");
  };

  const handleCancel = () => {
    toast("已取消！");
  };

  return (
    <div className="-mt-2 -ml-2">
      <h3 className="text-sm font-medium mb-4">OSD</h3>

      <div className="max-w-3xl grid grid-cols-[5rem_1fr] gap-x-3 gap-y-3 items-center">
        <Label>OSD类型</Label>
        <div className="w-44">
          <Sel
            value={osdType}
            options={OSD_TYPES.map((o) => o.label)}
            onChange={(v) => {
              const found = OSD_TYPES.find((o) => o.label === v);
              if (found) setOsdType(found.value);
            }}
          />
        </div>

        <Label>对齐位置</Label>
        <div className="w-44">
          <Select
            value={position}
            onValueChange={(v) => setPosition(v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OSD_POSITIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Label>字体大小</Label>
        <div className="w-44">
          <Sel value={size} options={OSD_SIZES} onChange={setSize} />
        </div>

        <Label>字体颜色</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-12 rounded border border-input bg-transparent cursor-pointer p-1"
          />
          <span className="text-xs text-muted-foreground font-mono">{color}</span>
        </div>

        <Label>OSD文字</Label>
        <div className="flex items-center gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={20}
            className="max-w-xs"
          />
          <span className="text-xs text-muted-foreground">(最多输入7个字符)</span>
        </div>
      </div>

      <div className="max-w-3xl flex gap-3 pt-6">
        <Button onClick={handleConfirm}>确定</Button>
        <Button variant="secondary" onClick={handleCancel}>取消</Button>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-sm text-muted-foreground text-right">
      {children}：
    </label>
  );
}

function Sel({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
