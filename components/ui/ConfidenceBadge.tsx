"use client";

import { cn } from "@/lib/utils/cn";

interface ConfidenceBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

export function ConfidenceBadge({ score, size = "md" }: ConfidenceBadgeProps) {
  const getColor = () => {
    if (score >= 0.7) return "bg-emerald-100 text-emerald-800 border-emerald-300";
    if (score >= 0.5) return "bg-amber-100 text-amber-800 border-amber-300";
    return "bg-red-100 text-red-800 border-red-300";
  };

  const getLabel = () => {
    if (score >= 0.7) return "High";
    if (score >= 0.5) return "Medium";
    return "Low";
  };

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-1.5",
  };

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full border font-medium",
      getColor(),
      sizeClasses[size]
    )}>
      <span className={cn(
        "h-2 w-2 rounded-full",
        score >= 0.7 ? "bg-emerald-500" : score >= 0.5 ? "bg-amber-500" : "bg-red-500"
      )} />
      {getLabel()} Confidence
      <span className="opacity-70">({Math.round(score * 100)}%)</span>
    </span>
  );
}
