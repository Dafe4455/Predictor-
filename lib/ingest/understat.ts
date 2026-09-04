// lib/ingest/understat.ts
import { db } from "@/lib/db";
import { teams, leagues, teamSeasonXg } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveAliasKey } from "./teamAliases";

const UNDERSTAT_LEAGUE_MAP: Record<string, string> = {
  "epl": "Premier League",
  "laliga": "La Liga",
  "serie-a": "Serie A",
  "bundesliga": "Bundesliga",
  "ligue-1": "Ligue 1",
};

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const APIFY_ACTOR_ID = process.env.UNDERSTAT_APIFY_ACTOR_ID;

interface UnderstatTeamRow {
  title: string;
  matches: number;
  xG: number;
  xGA: number;
}

async function fetchLeagueTeams(leagueKey: string, season: string): Promise<UnderstatTeamRow[]> {
  const leagueName = UNDERSTAT_LEAGUE_MAP[leagueKey];
  if (!leagueName) throw new Error(`No Understat mapping for ${leagueKey}`);
  if (!APIFY_TOKEN || !APIFY_ACTOR_ID) {
    throw new Error("APIFY_TOKEN / UNDERSTAT_APIFY_ACTOR_ID not configured");
  }

  const url = `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      leagues: [leagueName], // must be an array per actor's validation
      dataType: "league_teams",
      season,
      useProxy: false,
    }),
  });

  if (!res.ok) {
    throw new Error(`Understat fetch failed: HTTP ${res.status}`);
  }

  const items = await res.json();
  return items
    .filter((it: any) => it.dataType === "league_teams" && it.title)
    .map((it: any) => ({
      title: it.title,
      matches: Number(it.matches) || 0,
      xG: Number(it.xG) || 0,
      xGA: Number(it.xGA) || 0,
    }));
}

async function buildTeamResolver(leagueId: number): Promise<Map<string, number>> {
  const leagueTeams = await db.select().from(teams).where(eq(teams.leagueId, leagueId));
  const map = new Map<string, number>();
  for (const t of leagueTeams) {
    map.set(resolveAliasKey(t.name), t.id);
  }
  return map;
}

export async function ingestTeamSeasonXg(leagueKey: string, season: string): Promise<{
  updated: number;
  unmatched: number;
}> {
  const [leagueRow] = await db.select().from(leagues).where(eq(leagues.apiId, leagueKey)).limit(1);
  if (!leagueRow) throw new Error(`League ${leagueKey} not in DB`);

  const teamRows = await fetchLeagueTeams(leagueKey, season);
  const resolver = await buildTeamResolver(leagueRow.id);

  let updated = 0, unmatched = 0;

  for (const row of teamRows) {
    const teamId = resolver.get(resolveAliasKey(row.title));
    if (!teamId) {
      console.warn(`[Understat] Unresolved team "${row.title}" in ${leagueKey} — add to teamAliases.ts if this recurs`);
      unmatched++;
      continue;
    }
    if (row.matches === 0) {
      unmatched++;
      continue;
    }

    const xgPerGame = row.xG / row.matches;
    const xgaPerGame = row.xGA / row.matches;

    await db.insert(teamSeasonXg).values([{
      teamId,
      season,
      xgPerGame: String(xgPerGame),
      xgaPerGame: String(xgaPerGame),
      matchesPlayed: row.matches,
      source: "understat",
    }]).onConflictDoUpdate({
      target: [teamSeasonXg.teamId, teamSeasonXg.season],
      set: {
        xgPerGame: String(xgPerGame),
        xgaPerGame: String(xgaPerGame),
        matchesPlayed: row.matches,
        updatedAt: new Date(),
      },
    });
    updated++;
  }

  console.log(`[Understat] ${leagueKey} ${season}: ${updated} team-seasons updated, ${unmatched} unmatched`);
  return { updated, unmatched };
}

export async function backfillTeamSeasonXg(seasons: string[]): Promise<void> {
  const leagueKeys = Object.keys(UNDERSTAT_LEAGUE_MAP);
  for (const leagueKey of leagueKeys) {
    for (const season of seasons) {
      try {
        await ingestTeamSeasonXg(leagueKey, season);
      } catch (error) {
        console.error(`[Understat] Failed ${leagueKey} ${season}:`, error);
      }
    }
  }
}
