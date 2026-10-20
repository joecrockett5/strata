import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export interface SelectProps<T extends string> extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "onChange" | "value"
> {
  value: T;
  options: readonly SelectOption<T>[];
  onValueChange: (value: T) => void;
}

export function Select<T extends string>({
  value,
  options,
  onValueChange,
  className,
  ...props
}: SelectProps<T>) {
  return (
    <select
      value={value}
      onChange={(e) => {
        onValueChange(e.target.value as T);
      }}
      className={cn(
        "h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm focus-visible:border-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600/30 disabled:bg-slate-100",
        className,
      )}
      {...props}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
