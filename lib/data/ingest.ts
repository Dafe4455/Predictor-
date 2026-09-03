/**
 * Football data ingestion pipeline — BigBallsData version (timeout fix)
 * Only fetches stats for FINISHED matches. Upcoming matches get null stats.
 * This cuts API calls from ~250 to ~5-15 per run.
 */

import { db } from "@/lib/db";
import { matches, teams, leagues, teamForm } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

const API_BASE = "https://api.bigballsdata.com";
const API_KEY = process.env.BIGBALLSDATA_API_KEY;

if (!API_KEY) {
  console.error("[Ingest] CRITICAL: BIGBALLSDATA_API_KEY is not set!");
}

// ─── League mapping ───────────────────────────────────────────
const LEAGUE_CONFIG = [
  { key: "epl", name: "Premier League", country: "England" },
  { key: "laliga", name: "La Liga", country: "Spain" },
  { key: "serie-a", name: "Serie A", country: "Italy" },
  { key: "bundesliga", name: "Bundesliga", country: "Germany" },
  { key: "ligue-1", name: "Ligue 1", country: "France" },
];

// ─── Rate limiter ─────────────────────────────────────────────
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 650;

async function rateLimitDelay() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise(r => setTimeout(r, MIN_REQUEST_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

// ─── API fetch ──────────────────────────────────────────────────
async function apiFetch(endpoint: string, params?: Record<string, string>): Promise<any> {
  await rateLimitDelay();

  const url = new URL(`${API_BASE}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  console.log(`[API] ${endpoint}${params ? " → " + url.searchParams.toString() : ""}`);

  const response = await fetch(url.toString(), {
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status} — ${text}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`API error: ${JSON.stringify(data.error)}`);
  }

  console.log(`[API] ${endpoint} → ${data.data?.length ?? "?"} results`);
  return data;
}

// ─── Safe date parser ───────────────────────────────────────────
function parseMatchDate(match: any): Date {
  const candidates = [
    match.start_time,
    match.date,
    match.kickoff,
    match.scheduled,
    match.timestamp,
    match.created_at,
  ];

  for (const raw of candidates) {
    if (raw) {
      const parsed = new Date(raw);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }

  console.warn(`[Date] Could not parse date for match ${match.id}. Fields:`, {
    start_time: match.start_time,
    date: match.date,
    kickoff: match.kickoff,
    scheduled: match.scheduled,
    timestamp: match.timestamp,
  });
  return new Date();
}

// ─── Ingest leagues ─────────────────────────────────────────────
export async function ingestLeagues(): Promise<number> {
  let count = 0;

  for (const config of LEAGUE_CONFIG) {
    try {
      await db.insert(leagues).values([{
        apiId: config.key,
        name: config.name,
        country: config.country,
        countryCode: null,
        logo: null,
        flag: null,
        isActive: true,
      }]).onConflictDoUpdate({
        target: leagues.apiId,
        set: {
          name: config.name,
          country: config.country,
        },
      });
      count++;
      console.log(`[Leagues] Upserted: ${config.name} (${config.key})`);
    } catch (error) {
      console.error(`[Leagues] FAILED ${config.key}:`, error);
    }
  }

  return count;
}

// ─── Ingest teams ─────────────────────────────────────────────
export async function ingestTeams(leagueKey: string): Promise<number> {
  const [leagueRow] = await db.select().from(leagues).where(eq(leagues.apiId, leagueKey)).limit(1);
  if (!leagueRow) {
    throw new Error(`League ${leagueKey} not in DB`);
  }

  const data = await apiFetch("/v1/matches", { sport: "football", league: leagueKey });
  const fixtures = data.data || [];

  if (!fixtures.length) {
    console.warn(`[Teams] No matches found for league ${leagueKey}`);
    return 0;
  }

  const teamMap = new Map<string, { apiId: string; name: string; logo?: string }>();

  let loggedFirstMatch = false;
for (const match of fixtures) {
  if (!loggedFirstMatch) {
    console.log("[DEBUG] Full match object:");
    console.log(JSON.stringify(match, null, 2));
    loggedFirstMatch = true;
  }
  // ... rest of code


    if (match.home?.id && !teamMap.has(String(match.home.id))) {
      teamMap.set(String(match.home.id), {
        apiId: String(match.home.id),
        name: match.home.name,
        logo: match.home.logo,
      });
    }
    if (match.away?.id && !teamMap.has(String(match.away.id))) {
      teamMap.set(String(match.away.id), {
        apiId: String(match.away.id),
        name: match.away.name,
        logo: match.away.logo,
      });
    }
  }

  let count = 0;
  for (const team of teamMap.values()) {
    await db.insert(teams).values([{
      apiId: team.apiId,
      name: team.name,
      shortName: team.name.slice(0, 20),
      country: null,
      leagueId: leagueRow.id,
      logo: team.logo || null,
      founded: null,
      venueName: null,
      venueCapacity: null,
    }]).onConflictDoUpdate({
      target: teams.apiId,
      set: {
        name: team.name,
        logo: team.logo || null,
      },
    });
    count++;
  }

  console.log(`[Teams] Upserted ${count} teams for league ${leagueKey}`);
  return count;
}

// ─── Fetch match stats (only for finished matches) ──────────────
async function fetchMatchStats(matchApiId: string, matchStatus: string): Promise<Record<string, any>> {
  // Skip stats for upcoming/live matches — they don't have meaningful stats yet
  if (matchStatus !== "finished") {
    return {};
  }

  try {
    const data = await apiFetch(`/v1/stored/matches/${matchApiId}/stats`, { sport: "football" });
    return data.data || {};
  } catch (error) {
    console.warn(`[Stats] Failed to fetch stats for match ${matchApiId}:`, error);
    return {};
  }
}

// ─── Ingest matches ───────────────────────────────────────────
export async function ingestMatches(leagueKey: string): Promise<number> {
  const [leagueRow] = await db.select().from(leagues).where(eq(leagues.apiId, leagueKey)).limit(1);
  if (!leagueRow) {
    throw new Error(`League ${leagueKey} not in DB`);
  }

  const data = await apiFetch("/v1/matches", { sport: "football", league: leagueKey });
  const fixtures = data.data || [];

  if (!fixtures.length) {
    console.warn(`[Matches] No matches for league ${leagueKey}`);
    return 0;
  }

  let count = 0;
  let skipped = 0;
  let statsFetched = 0;

  for (const match of fixtures) {
    const homeTeam = match.home;
    const awayTeam = match.away;

    const [homeDb] = await db.select().from(teams).where(eq(teams.apiId, String(homeTeam.id))).limit(1);
    const [awayDb] = await db.select().from(teams).where(eq(teams.apiId, String(awayTeam.id))).limit(1);

    if (!homeDb || !awayDb) {
      console.warn(`[Matches] Skipping ${match.id}: teams not in DB (${homeTeam.id}, ${awayTeam.id})`);
      skipped++;
      continue;
    }

    // Map BigBallsData status to our schema
    const statusMap: Record<string, string> = {
      "finished": "finished",
      "live": "live",
      "upcoming": "scheduled",
      "postponed": "postponed",
      "cancelled": "postponed",
    };
    const mappedStatus = statusMap[match.status] || "scheduled";

    // Only fetch stats for finished matches (saves ~90% of API calls)
    const stats = await fetchMatchStats(String(match.id), mappedStatus);
    if (mappedStatus === "finished") statsFetched++;

    const homeStats = stats.home || {};
    const awayStats = stats.away || {};

    const matchDate = parseMatchDate(match);

    const matchValues = {
      apiId: String(match.id),
      leagueId: leagueRow.id,
      season: String(new Date().getFullYear()),
      round: match.round || null,
      homeTeamId: homeDb.id,
      awayTeamId: awayDb.id,
      matchDate,
      status: mappedStatus,
      venue: match.venue?.name || null,
      referee: match.referee || null,
      homeGoals: match.score?.home ?? null,
      awayGoals: match.score?.away ?? null,
      homeXg: homeStats.xg != null ? String(homeStats.xg) : null,
      awayXg: awayStats.xg != null ? String(awayStats.xg) : null,
      homeYellows: homeStats.yellow_cards || 0,
      awayYellows: awayStats.yellow_cards || 0,
      homeReds: homeStats.red_cards || 0,
      awayReds: awayStats.red_cards || 0,
      homeCorners: homeStats.corners || 0,
      awayCorners: awayStats.corners || 0,
      homePossession: homeStats.possession != null ? String(homeStats.possession) : null,
      awayPossession: awayStats.possession != null ? String(awayStats.possession) : null,
      homeShots: homeStats.shots || null,
      awayShots: awayStats.shots || null,
      homeShotsOnTarget: homeStats.shots_on_target || null,
      awayShotsOnTarget: awayStats.shots_on_target || null,
    };

    await db.insert(matches).values([matchValues as any]).onConflictDoUpdate({
      target: matches.apiId,
      set: {
        status: mappedStatus,
        homeGoals: match.score?.home ?? null,
        awayGoals: match.score?.away ?? null,
        homeXg: homeStats.xg != null ? String(homeStats.xg) : null,
        awayXg: awayStats.xg != null ? String(awayStats.xg) : null,
        homeYellows: homeStats.yellow_cards || 0,
        awayYellows: awayStats.yellow_cards || 0,
        homeReds: homeStats.red_cards || 0,
        awayReds: awayStats.red_cards || 0,
        homeCorners: homeStats.corners || 0,
        awayCorners: awayStats.corners || 0,
        homePossession: homeStats.possession != null ? String(homeStats.possession) : null,
        awayPossession: awayStats.possession != null ? String(awayStats.possession) : null,
        homeShots: homeStats.shots || null,
        awayShots: awayStats.shots || null,
        homeShotsOnTarget: homeStats.shots_on_target || null,
        awayShotsOnTarget: awayStats.shots_on_target || null,
        updatedAt: new Date(),
      },
    });
    count++;
  }

  console.log(`[Matches] Upserted ${count}, skipped ${skipped}, stats fetched for ${statsFetched} finished matches`);
  return count;
}

// ─── Compute form ─────────────────────────────────────────────
export async function computeForm(): Promise<number> {
  const finishedMatches = await db.execute(sql`
    SELECT m.* FROM matches m
    LEFT JOIN team_form tf ON tf.match_id = m.id
    WHERE m.status = 'finished'
      AND tf.id IS NULL
    ORDER BY m.match_date ASC
  `);

  const rows = finishedMatches.rows as any[];
  console.log(`[Form] ${rows.length} finished matches need form entries`);

  let count = 0;
  for (const match of rows) {
    await computeTeamFormEntry(match.home_team_id, match.id, new Date(match.match_date), "home", match);
    await computeTeamFormEntry(match.away_team_id, match.id, new Date(match.match_date), "away", match);
    count += 2;
  }

  console.log(`[Form] Computed ${count} form entries`);
  return count;
}

async function computeTeamFormEntry(
  teamId: number,
  matchId: number,
  matchDate: Date,
  venue: "home" | "away",
  match: any
) {
  const isHome = venue === "home";

  const previousForm = await db
    .select()
    .from(teamForm)
    .where(and(
      eq(teamForm.teamId, teamId),
      sql`${teamForm.matchDate} < ${matchDate}`
    ))
    .orderBy(sql`${teamForm.matchDate} DESC`)
    .limit(10);

  const goalsScored = isHome ? match.home_goals : match.away_goals;
  const goalsConceded = isHome ? match.away_goals : match.home_goals;
  const xgFor = isHome ? match.home_xg : match.away_xg;
  const xgAgainst = isHome ? match.away_xg : match.home_xg;
  const yellows = isHome ? match.home_yellows : match.away_yellows;
  const cornersFor = isHome ? match.home_corners : match.away_corners;
  const cornersAgainst = isHome ? match.away_corners : match.home_corners;
  const possession = isHome ? match.home_possession : match.away_possession;
  const shots = isHome ? match.home_shots : match.away_shots;
  const shotsOnTarget = isHome ? match.home_shots_on_target : match.away_shots_on_target;

  const allEntries = [
    {
      xgFor: Number(xgFor) || goalsScored || 0,
      xgAgainst: Number(xgAgainst) || goalsConceded || 0,
      goalsScored: goalsScored || 0,
      goalsConceded: goalsConceded || 0,
      cornersFor: cornersFor || 0,
      cornersAgainst: cornersAgainst || 0,
      yellows: yellows || 0,
    },
    ...previousForm.map(f => ({
      xgFor: Number(f.xgFor) || f.goalsScored || 0,
      xgAgainst: Number(f.xgAgainst) || f.goalsConceded || 0,
      goalsScored: f.goalsScored || 0,
      goalsConceded: f.goalsConceded || 0,
      cornersFor: f.cornersFor || 0,
      cornersAgainst: f.cornersAgainst || 0,
      yellows: f.yellows || 0,
    })),
  ];

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
  const first5 = allEntries.slice(0, 5);
  const first10 = allEntries.slice(0, 10);

  await db.insert(teamForm).values([{
    teamId,
    matchId,
    matchDate,
    venue,
    goalsScored: goalsScored || 0,
    goalsConceded: goalsConceded || 0,
    xgFor: xgFor ? String(xgFor) : null,
    xgAgainst: xgAgainst ? String(xgAgainst) : null,
    npxgFor: null,
    npxgAgainst: null,
    shots: shots || null,
    shotsOnTarget: shotsOnTarget || null,
    bigChances: null,
    shotsFaced: null,
    shotsOnTargetFaced: null,
    bigChancesConceded: null,
    yellows: yellows || 0,
    reds: isHome ? match.home_reds || 0 : match.away_reds || 0,
    foulsCommitted: null,
    foulsDrawn: null,
    cornersFor: cornersFor || 0,
    cornersAgainst: cornersAgainst || 0,
    possession: possession ? String(possession) : null,
    ppda: null,
    rolling5XgFor: String(avg(first5.map(e => e.xgFor))),
    rolling5XgAgainst: String(avg(first5.map(e => e.xgAgainst))),
    rolling5GoalsFor: String(avg(first5.map(e => e.goalsScored))),
    rolling5GoalsAgainst: String(avg(first5.map(e => e.goalsConceded))),
    rolling5CornersFor: String(avg(first5.map(e => e.cornersFor))),
    rolling5CornersAgainst: String(avg(first5.map(e => e.cornersAgainst))),
    rolling5Yellows: String(avg(first5.map(e => e.yellows))),
    rolling10XgFor: first10.length >= 5 ? String(avg(first10.map(e => e.xgFor))) : null,
    rolling10XgAgainst: first10.length >= 5 ? String(avg(first10.map(e => e.xgAgainst))) : null,
    rolling10GoalsFor: first10.length >= 5 ? String(avg(first10.map(e => e.goalsScored))) : null,
    rolling10GoalsAgainst: first10.length >= 5 ? String(avg(first10.map(e => e.goalsConceded))) : null,
  } as any]);
}

// ─── Main pipeline ──────────────────────────────────────────────
export async function runIngestionPipeline(): Promise<{
  leagues: number;
  teams: number;
  matches: number;
  formEntries: number;
  errors: string[];
  apiCalls: number;
}> {
  const errors: string[] = [];
  let apiCalls = 0;
  const results = {
    leagues: 0,
    teams: 0,
    matches: 0,
    formEntries: 0,
    errors,
    apiCalls,
  };

  console.log("[Pipeline] ===== Starting BigBallsData ingestion =====");
  console.log(`[Pipeline] API_KEY present: ${!!API_KEY}`);

  try {
    results.leagues = await ingestLeagues();
    console.log(`[Pipeline] Leagues: ${results.leagues}`);
  } catch (error) {
    const msg = `Leagues failed: ${error}`;
    console.error(`[Pipeline] ${msg}`);
    errors.push(msg);
  }

  for (const config of LEAGUE_CONFIG) {
    try {
      console.log(`[Pipeline] --- League ${config.key} ---`);

      const teamsCount = await ingestTeams(config.key);
      results.teams += teamsCount;
      apiCalls += 1;
      console.log(`[Pipeline] ${config.key}: ${teamsCount} teams`);

      if (teamsCount === 0) {
        console.warn(`[Pipeline] ${config.key}: 0 teams, skipping matches`);
        continue;
      }

      const matchesCount = await ingestMatches(config.key);
      results.matches += matchesCount;
      apiCalls += 1;
      console.log(`[Pipeline] ${config.key}: ${matchesCount} matches`);
    } catch (error) {
      const msg = `League ${config.key}: ${error}`;
      console.error(`[Pipeline] ${msg}`);
      errors.push(msg);
    }
  }

  try {
    results.formEntries = await computeForm();
    console.log(`[Pipeline] Form entries: ${results.formEntries}`);
  } catch (error) {
    const msg = `Form failed: ${error}`;
    console.error(`[Pipeline] ${msg}`);
    errors.push(msg);
  }

  results.apiCalls = apiCalls;

  console.log("[Pipeline] ===== Complete =====");
  console.log(`[Pipeline] API calls used: ${apiCalls}/1000`);
  console.log(`[Pipeline] Results:`, results);

  return results;
}
