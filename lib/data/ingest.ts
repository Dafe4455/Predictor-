/**
 * Football data ingestion pipeline
 */

import { db } from "@/lib/db";
import { matches, teams, leagues, teamForm } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

const API_BASE = process.env.FOOTBALL_API_BASE || "https://v3.football.api-sports.io";
const API_KEY = process.env.FOOTBALL_API_KEY;

interface ApiMatch {
  fixture: {
    id: number;
    date: string;
    status: { short: string; long: string };
    venue: { name: string; city: string };
    referee: string;
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string;
    season: number;
    round: string;
  };
  teams: {
    home: { id: number; name: string; logo: string; winner: boolean | null };
    away: { id: number; name: string; logo: string; winner: boolean | null };
  };
  goals: { home: number | null; away: number | null };
  statistics?: Array<{
    team: { id: number; name: string };
    statistics: Array<{ type: string; value: number | string | null }>;
  }>;
}

async function apiFetch(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(`${API_BASE}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const response = await fetch(url.toString(), {
    headers: {
      "x-apisports-key": API_KEY || "",
      "Content-Type": "application/json",
    },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.response || [];
}

export async function ingestLeagues(): Promise<number> {
  const leaguesData = await apiFetch("/leagues");

  let count = 0;
  for (const item of leaguesData) {
    const league = item.league;
    const country = item.country;

    await db.insert(leagues).values({
      apiId: String(league.id),
      name: league.name,
      country: country.name,
      countryCode: country.code,
      logo: league.logo,
      flag: country.flag,
      isActive: true,
    }).onConflictDoUpdate({
      target: leagues.apiId,
      set: {
        name: league.name,
        country: country.name,
        logo: league.logo,
        flag: country.flag,
      },
    });
    count++;
  }

  return count;
}

export async function ingestTeams(leagueApiId: string, season: string): Promise<number> {
  const teamsData = await apiFetch("/teams", { league: leagueApiId, season });

  let count = 0;
  for (const item of teamsData) {
    const team = item.team;
    const venue = item.venue;

    const league = await db.select().from(leagues).where(eq(leagues.apiId, leagueApiId)).limit(1);
    const leagueId = league[0]?.id;

    await db.insert(teams).values({
      apiId: String(team.id),
      name: team.name,
      shortName: team.code || team.name.slice(0, 20),
      country: team.country,
      leagueId,
      logo: team.logo,
      founded: team.founded,
      venueName: venue?.name,
      venueCapacity: venue?.capacity,
    }).onConflictDoUpdate({
      target: teams.apiId,
      set: {
        name: team.name,
        shortName: team.code || team.name.slice(0, 20),
        logo: team.logo,
        venueName: venue?.name,
        venueCapacity: venue?.capacity,
      },
    });
    count++;
  }

  return count;
}

export async function ingestMatches(
  leagueApiId: string,
  season: string,
  from?: string,
  to?: string
): Promise<number> {
  const params: Record<string, string> = { league: leagueApiId, season };
  if (from) params.from = from;
  if (to) params.to = to;

  const matchesData: ApiMatch[] = await apiFetch("/fixtures", params);

  let count = 0;
  for (const item of matchesData) {
    const fixture = item.fixture;
    const league = item.league;
    const homeTeam = item.teams.home;
    const awayTeam = item.teams.away;
    const goals = item.goals;

    const [homeDb] = await db.select().from(teams).where(eq(teams.apiId, String(homeTeam.id))).limit(1);
    const [awayDb] = await db.select().from(teams).where(eq(teams.apiId, String(awayTeam.id))).limit(1);
    const [leagueDb] = await db.select().from(leagues).where(eq(leagues.apiId, String(league.id))).limit(1);

    if (!homeDb || !awayDb) {
      console.warn(`Skipping match ${fixture.id}: teams not found`);
      continue;
    }

    let homeStats: Record<string, number> = {};
    let awayStats: Record<string, number> = {};

    if (item.statistics) {
      for (const stat of item.statistics) {
        const isHome = stat.team.id === homeTeam.id;
        const target = isHome ? homeStats : awayStats;
        for (const s of stat.statistics) {
          const val = typeof s.value === "string" ? parseFloat(s.value) || 0 : (s.value || 0);
          target[s.type] = val;
        }
      }
    }

    const statusMap: Record<string, string> = {
      "FT": "finished", "AET": "finished", "PEN": "finished",
      "NS": "scheduled", "TBD": "scheduled",
      "LIVE": "live", "1H": "live", "HT": "live", "2H": "live", "ET": "live", "P": "live",
      "SUSP": "postponed", "INT": "postponed", "PST": "postponed",
      "CANC": "postponed", "ABD": "postponed", "AWD": "postponed", "WO": "postponed",
    };

    await db.insert(matches).values({
      apiId: String(fixture.id),
      leagueId: leagueDb?.id,
      season: String(league.season),
      round: parseInt(league.round?.replace(/\D/g, "")) || null,
      homeTeamId: homeDb.id,
      awayTeamId: awayDb.id,
      matchDate: new Date(fixture.date),
      status: statusMap[fixture.status.short] || "scheduled",
      venue: fixture.venue?.name,
      referee: fixture.referee,
      homeGoals: goals.home,
      awayGoals: goals.away,
      homeXg: homeStats["Expected Goals"] || null,
      awayXg: awayStats["Expected Goals"] || null,
      homeYellows: homeStats["Yellow Cards"] || 0,
      awayYellows: awayStats["Yellow Cards"] || 0,
      homeReds: homeStats["Red Cards"] || 0,
      awayReds: awayStats["Red Cards"] || 0,
      homeCorners: homeStats["Corner Kicks"] || 0,
      awayCorners: awayStats["Corner Kicks"] || 0,
      homePossession: homeStats["Ball Possession"] || null,
      awayPossession: awayStats["Ball Possession"] || null,
      homeShots: homeStats["Total Shots"] || null,
      awayShots: awayStats["Total Shots"] || null,
      homeShotsOnTarget: homeStats["Shots on Goal"] || null,
      awayShotsOnTarget: awayStats["Shots on Goal"] || null,
    }).onConflictDoUpdate({
      target: matches.apiId,
      set: {
        status: statusMap[fixture.status.short] || "scheduled",
        homeGoals: goals.home,
        awayGoals: goals.away,
        homeXg: homeStats["Expected Goals"] || null,
        awayXg: awayStats["Expected Goals"] || null,
        homeYellows: homeStats["Yellow Cards"] || 0,
        awayYellows: awayStats["Yellow Cards"] || 0,
        homeReds: homeStats["Red Cards"] || 0,
        awayReds: awayStats["Red Cards"] || 0,
        homeCorners: homeStats["Corner Kicks"] || 0,
        awayCorners: awayStats["Corner Kicks"] || 0,
        homePossession: homeStats["Ball Possession"] || null,
        awayPossession: awayStats["Ball Possession"] || null,
        homeShots: homeStats["Total Shots"] || null,
        awayShots: awayStats["Total Shots"] || null,
        homeShotsOnTarget: homeStats["Shots on Goal"] || null,
        awayShotsOnTarget: awayStats["Shots on Goal"] || null,
        updatedAt: new Date(),
      },
    });
    count++;
  }

  return count;
}

export async function computeForm(): Promise<number> {
  const finishedMatches = await db.execute(sql`
    SELECT m.* FROM matches m
    LEFT JOIN team_form tf ON tf.match_id = m.id
    WHERE m.status = 'finished'
      AND tf.id IS NULL
    ORDER BY m.match_date ASC
  `);

  let count = 0;

  for (const match of finishedMatches.rows as any[]) {
    const matchId = match.id;
    const homeTeamId = match.home_team_id;
    const awayTeamId = match.away_team_id;
    const matchDate = new Date(match.match_date);

    await computeTeamFormEntry(homeTeamId, matchId, matchDate, "home", match);
    await computeTeamFormEntry(awayTeamId, matchId, matchDate, "away", match);
    count += 2;
  }

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

  await db.insert(teamForm).values({
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
  });
}

export async function runIngestionPipeline(): Promise<{
  leagues: number;
  teams: number;
  matches: number;
  formEntries: number;
}> {
  const results = { leagues: 0, teams: 0, matches: 0, formEntries: 0 };

  results.leagues = await ingestLeagues();

  const activeLeagues = [39, 140, 135, 78, 61];
  const season = "2025";

  for (const leagueId of activeLeagues) {
    try {
      results.teams += await ingestTeams(String(leagueId), season);

      const today = new Date();
      const from = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const to = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      results.matches += await ingestMatches(String(leagueId), season, from, to);
    } catch (error) {
      console.error(`Failed to ingest league ${leagueId}:`, error);
    }
  }

  results.formEntries = await computeForm();

  return results;
}
