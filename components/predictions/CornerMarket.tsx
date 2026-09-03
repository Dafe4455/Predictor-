"use client";

import { MarketToggle } from "@/components/ui/MarketToggle";
import { Flag } from "lucide-react";

interface CornerMarketProps {
  prediction: {
    expectedTotalCorners: number;
    overCorners95: number;
    overCorners105: number;
    underCorners95: number;
    underCorners105: number;
  };
}

export function CornerMarket({ prediction }: CornerMarketProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <Flag className="w-5 h-5 text-orange-500" />
        <h3 className="text-lg font-bold text-gray-900">Corner Markets</h3>
      </div>

      <div className="mb-6 rounded-xl bg-orange-50 p-4 text-center">
        <div className="text-3xl font-black text-orange-700">{prediction.expectedTotalCorners}</div>
        <div className="text-sm text-orange-600 font-medium mt-1">Expected Total Corners</div>
      </div>

      <div className="space-y-4">
        <MarketToggle
          overLabel="Over 9.5"
          underLabel="Under 9.5"
          overProbability={prediction.overCorners95}
          underProbability={prediction.underCorners95}
          overValue={9.5}
          underValue={9.5}
        />
        <div className="border-t border-gray-100 pt-4">
          <MarketToggle
            overLabel="Over 10.5"
            underLabel="Under 10.5"
            overProbability={prediction.overCorners105}
            underProbability={prediction.underCorners105}
            overValue={10.5}
            underValue={10.5}
          />
        </div>
      </div>
    </div>
  );
}
