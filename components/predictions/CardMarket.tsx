"use client";

import { MarketToggle } from "@/components/ui/MarketToggle";
import { Square } from "lucide-react";

interface CardMarketProps {
  prediction: {
    expectedTotalYellows: number;
    overYellows35: number;
    overYellows45: number;
    underYellows35: number;
    underYellows45: number;
  };
}

export function CardMarket({ prediction }: CardMarketProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <div className="flex gap-0.5">
          <Square className="w-5 h-5 text-card-yellow fill-card-yellow" />
          <Square className="w-5 h-5 text-card-red fill-card-red" />
        </div>
        <h3 className="text-lg font-bold text-gray-900">Card Markets</h3>
      </div>

      <div className="mb-6 rounded-xl bg-yellow-50 p-4 text-center">
        <div className="text-3xl font-black text-yellow-700">{prediction.expectedTotalYellows}</div>
        <div className="text-sm text-yellow-700 font-medium mt-1">Expected Total Yellow Cards</div>
      </div>

      <div className="space-y-4">
        <MarketToggle
          overLabel="Over 3.5"
          underLabel="Under 3.5"
          overProbability={prediction.overYellows35}
          underProbability={prediction.underYellows35}
          overValue={3.5}
          underValue={3.5}
        />
        <div className="border-t border-gray-100 pt-4">
          <MarketToggle
            overLabel="Over 4.5"
            underLabel="Under 4.5"
            overProbability={prediction.overYellows45}
            underProbability={prediction.underYellows45}
            overValue={4.5}
            underValue={4.5}
          />
        </div>
      </div>
    </div>
  );
}
