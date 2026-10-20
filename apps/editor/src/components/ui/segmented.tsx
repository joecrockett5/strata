import { cn } from "@/lib/cn";

/** A small radio-group of buttons (device widths, alignment, …). */
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onValueChange,
  disabled = false,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; icon?: React.ReactNode }[];
  onValueChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-md border border-slate-300 bg-white p-0.5"
    >
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          disabled={disabled}
          aria-label={option.icon ? option.label : undefined}
          title={option.label}
          onClick={() => {
            onValueChange(option.value);
          }}
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded px-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50",
            option.value === value ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100",
          )}
        >
          {option.icon ?? option.label}
        </button>
      ))}
    </div>
  );
}
