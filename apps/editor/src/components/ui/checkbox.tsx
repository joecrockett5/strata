import { useId } from "react";

export function Checkbox({
  label,
  checked,
  onCheckedChange,
  disabled,
  description,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  description?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-2">
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-4 rounded border-slate-300 accent-slate-900"
        checked={checked}
        disabled={disabled}
        onChange={(e) => {
          onCheckedChange(e.target.checked);
        }}
      />
      <label htmlFor={id} className="text-sm leading-tight">
        <span className="font-medium text-slate-800">{label}</span>
        {description ? <span className="block text-xs text-slate-500">{description}</span> : null}
      </label>
    </div>
  );
}
