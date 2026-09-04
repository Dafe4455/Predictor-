// lib/ingest/understat.ts
import { db } from "@/lib/db";
import { matches, teams, leagues } from "@/lib/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { resolveAliasKey } from "./teamAliases";

// Understat league codes differ from your internal keys.
const UNDERSTAT_LEAGUE_MAP: Record<string, string> = {
  "epl": "EPL",
  "laliga": "La_liga",
  "serie-a": "Serie_A",
  "bundesliga": "Bundesliga",
  "ligue-1": "Ligue_1",
};

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const APIFY_ACTOR_ID = process.env.UNDERSTAT_APIFY_ACTOR_ID; // e.g. "mirthful_radish~understat-xg-football-scraper"

interface UnderstatMatch {
  home_team: string;
  away_team: string;
  date: string; // ISO-ish date string
  home_goals: number;
  away_goals: number;
  home_xg: number;
  away_xg: number;
}

async function fetchUnderstatSeason(leagueKey: string, season: string): Promise<UnderstatMatch[]> {
  const understatLeague = UNDERSTAT_LEAGUE_MAP[leagueKey];
  if (!understatLeague) throw new Error(`No Understat mapping for ${leagueKey}`);
  if (!APIFY_TOKEN || !APIFY_ACTOR_ID) {
    throw new Error("APIFY_TOKEN / UNDERSTAT_APIFY_ACTOR_ID not configured");
  }

  const url = `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ league: understatLeague, season }),
  });

  if (!res.ok) {
    throw new Error(`Understat fetch failed: HTTP ${res.status}`);
  }

  const items = await res.json();
  // Adjust field mapping here once you've confirmed the actor's actual
  // output shape — dataset schemas vary by actor version.
  return items.map((it: any) => ({
    home_team: it.home_team ?? it.home ?? it.homeTeam,
    away_team: it.away_team ?? it.away ?? it.awayTeam,
    date: it.date ?? it.datetime,
    home_goals: Number(it.home_goals ?? it.homeGoals ?? 0),
    away_goals: Number(it.away_goals ?? it.awayGoals ?? 0),
    home_xg: Number(it.home_xg ?? it.xG_home ?? it.homeXg ?? 0),
    away_xg: Number(it.away_xg ?? it.xG_away ?? it.awayXg ?? 0),
  })).filter((m: UnderstatMatch) => m.home_team && m.away_team && m.date);
}

// ─── Build team resolver for a league ──────────────────────────
async function buildTeamResolver(leagueId: number): Promise<Map<string, number>> {
  const leagueTeams = await db.select().from(teams).where(eq(teams.leagueId, leagueId));
  const map = new Map<string, number>();
  for (const t of leagueTeams) {
    map.set(resolveAliasKey(t.name), t.id);
  }
  return map;
}

// ─── Ingest one league/season of historical xG ────────────────
export async function ingestHistoricalXg(leagueKey: string, season: string): Promise<{
  updated: number;
  inserted: number;
  unmatched: number;
}> {
  const [leagueRow] = await db.select().from(leagues).where(eq(leagues.apiId, leagueKey)).limit(1);
  if (!leagueRow) throw new Error(`League ${leagueKey} not in DB`);

  const understatMatches = await fetchUnderstatSeason(leagueKey, season);
  const teamResolver = await buildTeamResolver(leagueRow.id);

  let updated = 0, inserted = 0, unmatched = 0;

  for (const um of understatMatches) {
    const homeId = teamResolver.get(resolveAliasKey(um.home_team));
    const awayId = teamResolver.get(resolveAliasKey(um.away_team));

    if (!homeId || !awayId) {
      console.warn(`[Understat] Unresolved team(s): "${um.home_team}" / "${um.away_team}" — add to teamAliases.ts if these recur`);
      unmatched++;
      continue;
    }

    const matchDate = new Date(um.date);
    if (isNaN(matchDate.getTime())) {
      unmatched++;
      continue;
    }

    // ±2 day window absorbs kickoff-time/timezone drift between sources
    const windowStart = new Date(matchDate.getTime() - 2 * 86400000);
    const windowEnd = new Date(matchDate.getTime() + 2 * 86400000);

    const existing = await db
      .select()
      .from(matches)
      .where(and(
        eq(matches.leagueId, leagueRow.id),
        eq(matches.homeTeamId, homeId),
        eq(matches.awayTeamId, awayId),
        gte(matches.matchDate, windowStart),
        lte(matches.matchDate, windowEnd),
      ))
      .limit(1);

    if (existing.length > 0) {
      // BigBallsData already has this fixture — just backfill xG (and
      // goals/status if BigBallsData's finished-match stats were also empty).
      await db.update(matches)
        .set({
          homeXg: String(um.home_xg),
          awayXg: String(um.away_xg),
          homeGoals: existing[0].homeGoals ?? um.home_goals,
          awayGoals: existing[0].awayGoals ?? um.away_goals,
          status: "finished",
          updatedAt: new Date(),
        })
        .where(eq(matches.id, existing[0].id));
      updated++;
    } else {
      // Historical season BigBallsData doesn't cover — insert a new row.
      const syntheticApiId = `understat-${leagueKey}-${season}-${homeId}-${awayId}-${matchDate.toISOString().slice(0, 10)}`;
      await db.insert(matches).values([{
        apiId: syntheticApiId,
        leagueId: leagueRow.id,
        season,
        round: null,
        homeTeamId: homeId,
        awayTeamId: awayId,
        matchDate,
        status: "finished",
        venue: null,
        referee: null,
        homeGoals: um.home_goals,
        awayGoals: um.away_goals,
        homeXg: String(um.home_xg),
        awayXg: String(um.away_xg),
        homeYellows: 0,
        awayYellows: 0,
        homeReds: 0,
        awayReds: 0,
        homeCorners: 0,
        awayCorners: 0,
      } as any]).onConflictDoNothing({ target: matches.apiId });
      inserted++;
    }
  }

  console.log(`[Understat] ${leagueKey} ${season}: ${updated} updated, ${inserted} inserted, ${unmatched} unmatched`);
  return { updated, inserted, unmatched };
}

// ─── Backfill multiple seasons for all leagues ─────────────────
export async function backfillHistoricalXg(seasons: string[]): Promise<void> {
  const leagueKeys = Object.keys(UNDERSTAT_LEAGUE_MAP);
  for (const leagueKey of leagueKeys) {
    for (const season of seasons) {
      try {
        await ingestHistoricalXg(leagueKey, season);
      } catch (error) {
        console.error(`[Understat] Failed ${leagueKey} ${season}:`, error);
      }
    }
  }
}
