import { Monitor, Smartphone, Tablet } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { type Device, deviceWidths } from "./devices";

export function DeviceToggle({ value, onChange }: { value: Device; onChange: (device: Device) => void }) {
  return (
    <Segmented
      label="Preview width"
      value={value}
      onValueChange={onChange}
      options={[
        {
          value: "mobile",
          label: `Mobile (${deviceWidths.mobile}px)`,
          icon: <Smartphone className="size-4" />,
        },
        { value: "tablet", label: `Tablet (${deviceWidths.tablet}px)`, icon: <Tablet className="size-4" /> },
        {
          value: "desktop",
          label: `Desktop (${deviceWidths.desktop}px)`,
          icon: <Monitor className="size-4" />,
        },
      ]}
    />
  );
}
