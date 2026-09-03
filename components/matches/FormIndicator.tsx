"use client";

import { cn } from "@/lib/utils/cn";

interface FormIndicatorProps {
  results: Array<"W" | "D" | "L">;
  size?: "sm" | "md";
}

export function FormIndicator({ results, size = "md" }: FormIndicatorProps) {
  const sizeClasses = { sm: "w-5 h-5 text-[10px]", md: "w-7 h-7 text-xs" };

  return (
    <div className="flex items-center gap-1">
      {results.map((result, i) => (
        <div
          key={i}
          className={cn(
            "rounded-full flex items-center justify-center font-bold",
            sizeClasses[size],
            result === "W" && "bg-emerald-500 text-white",
            result === "D" && "bg-amber-500 text-white",
            result === "L" && "bg-red-500 text-white"
          )}
        >
          {result}
        </div>
      ))}
    </div>
  );
}
