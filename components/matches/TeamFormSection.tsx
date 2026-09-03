import { db } from "@/lib/db";
import { teamForm, matches, teams } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { format } from "date-fns";
import { FormIndicator } from "./FormIndicator";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

interface TeamFormSectionProps {
  teamId: number;
  teamName: string;
  venue: "home" | "away";
  currentMatchId?: number;
}

export async function TeamFormSection({ teamId, teamName, venue }: TeamFormSectionProps) {
  const formData = await db
    .select()
    .from(teamForm)
    .where(and(eq(teamForm.teamId, teamId), eq(teamForm.venue, venue)))
    .orderBy(desc(teamForm.matchDate))
    .limit(5);

  const formWithMatches = await Promise.all(
    formData.map(async (entry) => {
      const matchDetails = await db.select().from(matches).where(eq(matches.id, entry.matchId)).limit(1);
      const match = matchDetails[0];
      const isHome = venue === "home";
      const goalsFor = isHome ? match?.homeGoals : match?.awayGoals;
      const goalsAgainst = isHome ? match?.awayGoals : match?.homeGoals;

      let result: "W" | "D" | "L" = "D";
      if (goalsFor !== null && goalsAgainst !== null) {
        if (goalsFor > goalsAgainst) result = "W";
        else if (goalsFor < goalsAgainst) result = "L";
      }

      const opponentId = isHome ? match?.awayTeamId : match?.homeTeamId;
      const opponentTeam = opponentId
        ? await db.select({ name: teams.name }).from(teams).where(eq(teams.id, opponentId)).limit(1)
        : null;

      return {
        ...entry,
        result,
        matchDate: match?.matchDate,
        opponentName: opponentTeam?.[0]?.name || `Team ${opponentId}`,
        score: match ? `${match.homeGoals}-${match.awayGoals}` : "?-?",
      };
    })
  );

  const results = formWithMatches.map(f => f.result);
  const wins = results.filter(r => r === "W").length;
  const draws = results.filter(r => r === "D").length;
  const losses = results.filter(r => r === "L").length;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-bold text-gray-900">{teamName} — Last 5 {venue === "home" ? "Home" : "Away"}</h4>
        <FormIndicator results={results} />
      </div>

      <div className="flex items-center gap-4 mb-4 text-sm">
        <span className="flex items-center gap-1 text-emerald-600"><ArrowUp className="w-3.5 h-3.5" /> {wins}W</span>
        <span className="flex items-center gap-1 text-amber-600"><Minus className="w-3.5 h-3.5" /> {draws}D</span>
        <span className="flex items-center gap-1 text-red-600"><ArrowDown className="w-3.5 h-3.5" /> {losses}L</span>
      </div>

      <div className="space-y-2">
        {formWithMatches.map((entry, i) => (
          <div key={entry.id} className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white
              ${entry.result === "W" ? "bg-emerald-500" : entry.result === "D" ? "bg-amber-500" : "bg-red-500"}`}>
              {entry.result}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-700 truncate">vs {entry.opponentName}</div>
              <div className="text-xs text-gray-400">
                {entry.matchDate ? format(new Date(entry.matchDate), "MMM d") : "Unknown date"}
              </div>
            </div>
            <div className="text-sm font-mono font-bold text-gray-700">{entry.score}</div>
            <div className="text-xs text-gray-500 w-20 text-right">xG: {Number(entry.xgFor).toFixed(1)}</div>
          </div>
        ))}
      </div>

      {formData[0] && (
        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-500">xG For (5):</span><span className="ml-2 font-semibold text-pitch-700">{Number(formData[0].rolling5XgFor).toFixed(2)}</span></div>
          <div><span className="text-gray-500">xG Against (5):</span><span className="ml-2 font-semibold text-red-600">{Number(formData[0].rolling5XgAgainst).toFixed(2)}</span></div>
          <div><span className="text-gray-500">Goals For (5):</span><span className="ml-2 font-semibold text-gray-900">{Number(formData[0].rolling5GoalsFor).toFixed(2)}</span></div>
          <div><span className="text-gray-500">Goals Against (5):</span><span className="ml-2 font-semibold text-gray-900">{Number(formData[0].rolling5GoalsAgainst).toFixed(2)}</span></div>
        </div>
      )}
    </div>
  );
}
