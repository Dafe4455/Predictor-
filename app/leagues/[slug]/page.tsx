import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { leagues, matches, teams } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface LeaguePageProps {
  params: Promise<{ slug: string }>;
}

export default async function LeaguePage({ params }: LeaguePageProps) {
  const { slug } = await params;
  const leagueId = parseInt(slug);
  if (isNaN(leagueId)) notFound();

  const league = await db.query.leagues.findFirst({
    where: eq(leagues.id, leagueId),
  });
  if (!league) notFound();

  const finishedMatches = await db.query.matches.findMany({
    where: and(
      eq(matches.leagueId, leagueId),
      eq(matches.status, "finished"),
      sql`${matches.season} = '2025'`
    ),
    with: {
      homeTeam: true,
      awayTeam: true,
    },
  });

  const standingsMap = new Map<number, any>();

  for (const match of finishedMatches) {
    const { homeTeam, awayTeam, homeGoals, awayGoals } = match;
    if (homeGoals === null || awayGoals === null) continue;

    if (!standingsMap.has(homeTeam.id)) {
      standingsMap.set(homeTeam.id, {
        team: homeTeam,
        played: 0, won: 0, drawn: 0, lost: 0,
        goalsFor: 0, goalsAgainst: 0, points: 0, form: [],
      });
    }
    if (!standingsMap.has(awayTeam.id)) {
      standingsMap.set(awayTeam.id, {
        team: awayTeam,
        played: 0, won: 0, drawn: 0, lost: 0,
        goalsFor: 0, goalsAgainst: 0, points: 0, form: [],
      });
    }

    const home = standingsMap.get(homeTeam.id)!;
    const away = standingsMap.get(awayTeam.id)!;

    home.played++; away.played++;
    home.goalsFor += homeGoals; home.goalsAgainst += awayGoals;
    away.goalsFor += awayGoals; away.goalsAgainst += homeGoals;

    let homeResult: "W" | "D" | "L" = "D";
    let awayResult: "W" | "D" | "L" = "D";

    if (homeGoals > awayGoals) {
      home.won++; away.lost++;
      home.points += 3;
      homeResult = "W"; awayResult = "L";
    } else if (homeGoals < awayGoals) {
      home.lost++; away.won++;
      away.points += 3;
      homeResult = "L"; awayResult = "W";
    } else {
      home.drawn++; away.drawn++;
      home.points++; away.points++;
    }

    home.form.unshift(homeResult);
    away.form.unshift(awayResult);
  }

  const standings = Array.from(standingsMap.values())
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const aGd = a.goalsFor - a.goalsAgainst;
      const bGd = b.goalsFor - b.goalsAgainst;
      if (bGd !== aGd) return bGd - aGd;
      return b.goalsFor - a.goalsFor;
    })
    .map((s, i) => ({ ...s, position: i + 1 }));

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to matches
      </Link>

      <div className="flex items-center gap-3 mb-8">
        {league.logo && (
          <img src={league.logo} alt={league.name} className="w-12 h-12 object-contain" />
        )}
        <div>
          <h1 className="text-2xl font-black text-gray-900">{league.name}</h1>
          <p className="text-gray-500">{league.country} • 2025-26 Season</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left font-semibold text-gray-600 w-12">#</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Team</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600 w-12">P</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600 w-12">W</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600 w-12">D</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600 w-12">L</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600 w-16">GF</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600 w-16">GA</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600 w-16">GD</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-900 w-16">Pts</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">Form</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => (
              <tr
                key={row.team.id}
                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <td className="px-4 py-3 font-bold text-gray-500">
                  {row.position <= 4 ? (
                    <span className="text-pitch-600">{row.position}</span>
                  ) : row.position >= standings.length - 2 ? (
                    <span className="text-red-500">{row.position}</span>
                  ) : (
                    row.position
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {row.team.logo && (
                      <img src={row.team.logo} alt="" className="w-6 h-6 object-contain" />
                    )}
                    <span className="font-semibold text-gray-900">{row.team.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center text-gray-600">{row.played}</td>
                <td className="px-4 py-3 text-center text-emerald-600 font-medium">{row.won}</td>
                <td className="px-4 py-3 text-center text-amber-600 font-medium">{row.drawn}</td>
                <td className="px-4 py-3 text-center text-red-600 font-medium">{row.lost}</td>
                <td className="px-4 py-3 text-center text-gray-700">{row.goalsFor}</td>
                <td className="px-4 py-3 text-center text-gray-700">{row.goalsAgainst}</td>
                <td className="px-4 py-3 text-center font-medium">
                  <span className={row.goalsFor - row.goalsAgainst >= 0 ? "text-emerald-600" : "text-red-600"}>
                    {row.goalsFor - row.goalsAgainst > 0 ? "+" : ""}
                    {row.goalsFor - row.goalsAgainst}
                  </span>
                </td>
                <td className="px-4 py-3 text-center font-black text-gray-900">{row.points}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-0.5">
                    {row.form.slice(0, 5).map((result: string, i: number) => (
                      <div
                        key={i}
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white
                          ${result === "W" ? "bg-emerald-500" : result === "D" ? "bg-amber-500" : "bg-red-500"}`}
                      >
                        {result}
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
