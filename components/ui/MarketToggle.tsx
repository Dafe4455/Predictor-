"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";

interface MarketToggleProps {
  overLabel: string;
  underLabel: string;
  overProbability: number;
  underProbability: number;
  overValue: number;
  underValue: number;
}

export function MarketToggle({ overLabel, underLabel, overProbability, underProbability }: MarketToggleProps) {
  const [selected, setSelected] = useState<"over" | "under" | null>(null);
  const overPct = Math.round(overProbability * 100);
  const underPct = Math.round(underProbability * 100);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>Market probability</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setSelected("over")}
          className={cn(
            "relative rounded-xl border-2 p-4 text-left transition-all",
            selected === "over" ? "border-pitch-500 bg-pitch-50" : "border-gray-200 hover:border-gray-300 bg-white"
          )}
        >
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Over</div>
          <div className="mt-1 text-lg font-bold text-gray-900">{overLabel}</div>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-pitch-500 transition-all" style={{ width: `${overPct}%` }} />
            </div>
            <span className="text-sm font-semibold text-pitch-700">{overPct}%</span>
          </div>
        </button>

        <button
          onClick={() => setSelected("under")}
          className={cn(
            "relative rounded-xl border-2 p-4 text-left transition-all",
            selected === "under" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300 bg-white"
          )}
        >
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Under</div>
          <div className="mt-1 text-lg font-bold text-gray-900">{underLabel}</div>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${underPct}%` }} />
            </div>
            <span className="text-sm font-semibold text-blue-700">{underPct}%</span>
          </div>
        </button>
      </div>
    </div>
  );
}
