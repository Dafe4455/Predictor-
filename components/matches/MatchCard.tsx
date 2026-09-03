import Link from "next/link";
import { format } from "date-fns";
import { cn } from "@/lib/utils/cn";
import { Calendar, Clock, TrendingUp } from "lucide-react";
import type { MatchWithTeams } from "@/types";

interface MatchCardProps {
  match: MatchWithTeams;
}

export function MatchCard({ match }: MatchCardProps) {
  const matchDate = new Date(match.matchDate);
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const prediction = match.prediction;
  const confidence = prediction ? Math.round(prediction.confidenceScore * 100) : null;

  return (
    <Link href={`/matches/${match.id}`}>
      <div className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-pitch-300 transition-all duration-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {match.league?.logo && (
              <img src={match.league.logo} alt={match.league.name} className="w-5 h-5 object-contain" />
            )}
            <span className="text-xs font-medium text-gray-500">{match.league?.name || "Unknown League"}</span>
          </div>
          <div className="flex items-center gap-2">
            {isLive && (
              <span className="flex items-center gap-1 text-xs font-bold text-red-600">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                LIVE
              </span>
            )}
            {prediction && (
              <span className={cn(
                "text-xs font-semibold px-2 py-0.5 rounded-full",
                confidence && confidence >= 70 ? "bg-emerald-100 text-emerald-700" :
                confidence && confidence >= 50 ? "bg-amber-100 text-amber-700" :
                "bg-red-100 text-red-700"
              )}>
                {confidence}% confidence
              </span>
            )}
          </div>
        </div>

        {/* Teams */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
              {match.homeTeam.logo ? (
                <img src={match.homeTeam.logo} alt={match.homeTeam.name} className="w-9 h-9 object-contain" />
              ) : (
                <span className="text-lg font-bold text-gray-400">{match.homeTeam.name[0]}</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-gray-900 truncate">{match.homeTeam.name}</div>
              {prediction && <div className="text-xs text-pitch-600 font-medium">xG: {prediction.predictedHomeXg}</div>}
            </div>
          </div>

          <div className="flex flex-col items-center px-4">
            {isFinished && match.homeGoals !== null ? (
              <div className="text-2xl font-black text-gray-900">{match.homeGoals} - {match.awayGoals}</div>
            ) : prediction ? (
              <div className="text-center">
                <div className="text-2xl font-black text-pitch-600">{prediction.mostLikelyScore}</div>
                <div className="text-xs text-gray-500 mt-0.5">Predicted</div>
              </div>
            ) : (
              <div className="text-lg font-bold text-gray-400">vs</div>
            )}
          </div>

          <div className="flex items-center gap-3 flex-1 justify-end">
            <div className="min-w-0 text-right">
              <div className="font-semibold text-gray-900 truncate">{match.awayTeam.name}</div>
              {prediction && <div className="text-xs text-blue-600 font-medium">xG: {prediction.predictedAwayXg}</div>}
            </div>
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
              {match.awayTeam.logo ? (
                <img src={match.awayTeam.logo} alt={match.awayTeam.name} className="w-9 h-9 object-contain" />
              ) : (
                <span className="text-lg font-bold text-gray-400">{match.awayTeam.name[0]}</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {format(matchDate, "MMM d, yyyy")}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {format(matchDate, "HH:mm")}
            </span>
          </div>
          {prediction && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <TrendingUp className="w-3.5 h-3.5" />
              <span className={cn("font-medium", prediction.probHomeWin > prediction.probAwayWin ? "text-pitch-600" : "text-blue-600")}>
                {prediction.probHomeWin > prediction.probAwayWin
                  ? `${Math.round(prediction.probHomeWin * 100)}% Home`
                  : `${Math.round(prediction.probAwayWin * 100)}% Away`}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
