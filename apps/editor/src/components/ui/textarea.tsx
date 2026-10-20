import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:border-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600/30",
        className,
      )}
      {...props}
    />
  );
}
