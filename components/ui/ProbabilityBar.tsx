"use client";

import { cn } from "@/lib/utils/cn";

interface ProbabilityBarProps {
  label: string;
  probability: number;
  color?: string;
  showValue?: boolean;
}

export function ProbabilityBar({ label, probability, color = "bg-pitch-500", showValue = true }: ProbabilityBarProps) {
  const percentage = Math.round(probability * 100);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        {showValue && <span className="font-semibold text-gray-900">{percentage}%</span>}
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div className={cn("h-full rounded-full transition-all duration-500 ease-out", color)} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
