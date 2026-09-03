import { db } from "@/lib/db";
import { matches } from "@/lib/db/schema";
import { and, gte, sql } from "drizzle-orm";
import { format, startOfDay, addDays } from "date-fns";
import { MatchCard } from "@/components/matches/MatchCard";
import { unstable_cache } from "next/cache";
import { Calendar, Filter } from "lucide-react";

const getTodayMatches = unstable_cache(
  async () => {
    const today = startOfDay(new Date());
    const nextWeek = addDays(today, 7);

    return db.query.matches.findMany({
      where: and(
        gte(matches.matchDate, today),
        sql`${matches.matchDate} <= ${nextWeek}`,
        sql`${matches.status} IN ('scheduled', 'upcoming')`
      ),
      with: {
        homeTeam: true,
        awayTeam: true,
        league: true,
        prediction: true,
      },
      orderBy: [matches.matchDate, matches.leagueId],
      limit: 50,
    });
  },
  ["today-matches-v2"],
  { revalidate: 1800 }
);

export default async function HomePage() {
  const matchesList = await getTodayMatches();

  const grouped = matchesList.reduce((acc, match) => {
    const dateKey = format(new Date(match.matchDate), "yyyy-MM-dd");
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(match as any);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-900 mb-2">Match Predictions</h1>
        <p className="text-gray-600">xG-powered predictions for upcoming fixtures</p>
      </div>

      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
        {Object.keys(grouped).map((dateKey) => (
          <a
            key={dateKey}
            href={`#${dateKey}`}
            className="px-3 py-1.5 rounded-full text-sm font-medium bg-white border border-gray-200 hover:border-pitch-400 hover:text-pitch-700 transition-colors whitespace-nowrap"
          >
            {format(new Date(dateKey), "EEE, MMM d")}
          </a>
        ))}
      </div>

      <div className="space-y-8">
        {Object.entries(grouped).map(([dateKey, dayMatches]) => (
          <section key={dateKey} id={dateKey}>
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">
                {format(new Date(dateKey), "EEEE, MMMM d, yyyy")}
              </h2>
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 font-medium">{dayMatches.length} matches</span>
            </div>
            <div className="space-y-3">
              {dayMatches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </section>
        ))}

        {matchesList.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-gray-100 mx-auto mb-4 flex items-center justify-center">
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700">No upcoming matches</h3>
            <p className="text-gray-500 mt-1">Check back later for new fixtures</p>
          </div>
        )}
      </div>
    </main>
  );
}
