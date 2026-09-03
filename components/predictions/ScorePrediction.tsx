"use client";

import { useState } from "react";
import { ProbabilityBar } from "@/components/ui/ProbabilityBar";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { cn } from "@/lib/utils/cn";
import { Trophy, Target, BarChart3 } from "lucide-react";

interface ScorePredictionProps {
  homeTeam: string;
  awayTeam: string;
  homeLogo?: string | null;
  awayLogo?: string | null;
  predictedHomeXg: number;
  predictedAwayXg: number;
  mostLikelyScore: string;
  scoreProbabilities: Record<string, number>;
  probHomeWin: number;
  probDraw: number;
  probAwayWin: number;
  expectedTotalGoals: number;
  confidenceScore: number;
}

export function ScorePrediction({
  homeTeam, awayTeam, homeLogo, awayLogo,
  predictedHomeXg, predictedAwayXg, mostLikelyScore,
  scoreProbabilities, probHomeWin, probDraw, probAwayWin,
  expectedTotalGoals, confidenceScore,
}: ScorePredictionProps) {
  const [showAllScores, setShowAllScores] = useState(false);

  const sortedScores = Object.entries(scoreProbabilities)
    .map(([score, probability]) => ({ score, probability }))
    .sort((a, b) => b.probability - a.probability);

  const displayScores = showAllScores ? sortedScores : sortedScores.slice(0, 5);
  const [homeGoals, awayGoals] = mostLikelyScore.split("-").map(Number);
  const isHomeWin = homeGoals > awayGoals;
  const isDraw = homeGoals === awayGoals;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Target className="w-5 h-5 text-pitch-600" />
          Match Result Prediction
        </h3>
        <ConfidenceBadge score={confidenceScore} />
      </div>

      {/* Teams & Most Likely Score */}
      <div className="flex items-center justify-center gap-4 mb-8">
        <div className="flex flex-col items-center gap-2 flex-1">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
            {homeLogo ? (
              <img src={homeLogo} alt={homeTeam} className="w-12 h-12 object-contain" />
            ) : (
              <span className="text-2xl font-bold text-gray-400">{homeTeam[0]}</span>
            )}
          </div>
          <span className="font-semibold text-gray-900 text-center text-sm">{homeTeam}</span>
          <span className="text-xs text-pitch-600 font-medium">xG: {predictedHomeXg}</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <div className={cn("text-4xl font-black tracking-tight", isHomeWin ? "text-pitch-600" : isDraw ? "text-amber-600" : "text-blue-600")}>
            {mostLikelyScore}
          </div>
          <span className="text-xs text-gray-500">Most Likely</span>
          <div className="flex items-center gap-1 mt-1">
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-medium text-amber-700">
              {Math.round((scoreProbabilities[mostLikelyScore] || 0) * 100)}%
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 flex-1">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
            {awayLogo ? (
              <img src={awayLogo} alt={awayTeam} className="w-12 h-12 object-contain" />
            ) : (
              <span className="text-2xl font-bold text-gray-400">{awayTeam[0]}</span>
            )}
          </div>
          <span className="font-semibold text-gray-900 text-center text-sm">{awayTeam}</span>
          <span className="text-xs text-blue-600 font-medium">xG: {predictedAwayXg}</span>
        </div>
      </div>

      {/* 1X2 Probabilities */}
      <div className="space-y-3 mb-6">
        <ProbabilityBar label={`${homeTeam} Win`} probability={probHomeWin} color="bg-pitch-500" />
        <ProbabilityBar label="Draw" probability={probDraw} color="bg-amber-500" />
        <ProbabilityBar label={`${awayTeam} Win`} probability={probAwayWin} color="bg-blue-500" />
      </div>

      {/* Expected Goals */}
      <div className="rounded-xl bg-gray-50 p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">Expected Goals</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600">{homeTeam}</span>
              <span className="font-bold text-pitch-700">{predictedHomeXg}</span>
            </div>
            <div className="h-3 rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full bg-pitch-500 rounded-full" style={{ width: `${(predictedHomeXg / expectedTotalGoals) * 100}%` }} />
            </div>
          </div>
          <div className="text-lg font-bold text-gray-400">vs</div>
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span className="font-bold text-blue-700">{predictedAwayXg}</span>
              <span className="text-gray-600">{awayTeam}</span>
            </div>
            <div className="h-3 rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(predictedAwayXg / expectedTotalGoals) * 100}%` }} />
            </div>
          </div>
        </div>
        <div className="mt-2 text-center text-xs text-gray-500">
          Total Expected Goals: <span className="font-semibold text-gray-700">{expectedTotalGoals}</span>
        </div>
      </div>

      {/* Top Scorelines */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-gray-700">Top Scorelines</span>
          <button
            onClick={() => setShowAllScores(!showAllScores)}
            className="text-xs text-pitch-600 hover:text-pitch-700 font-medium"
          >
            {showAllScores ? "Show less" : `Show all ${sortedScores.length}`}
          </button>
        </div>
        <div className="space-y-1.5">
          {displayScores.map(({ score, probability }, i) => {
            const isMostLikely = score === mostLikelyScore;
            return (
              <div key={score} className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                isMostLikely ? "bg-pitch-50 border border-pitch-200" : "hover:bg-gray-50"
              )}>
                <span className="text-xs text-gray-400 w-5">{i + 1}</span>
                <span className={cn("font-mono font-bold text-sm", isMostLikely ? "text-pitch-700" : "text-gray-700")}>{score}</span>
                <div className="flex-1 h-1.5 rounded-full bg-gray-100">
                  <div className={cn("h-full rounded-full transition-all", isMostLikely ? "bg-pitch-500" : "bg-gray-300")} style={{ width: `${probability * 100}%` }} />
                </div>
                <span className={cn("text-xs font-semibold w-10 text-right", isMostLikely ? "text-pitch-700" : "text-gray-500")}>
                  {Math.round(probability * 100)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
