/**
 * Prediction engine with fallback for missing form data
 * When no historical form exists, uses team season xG (Understat) if
 * available, falling back further to league averages as a last resort.
 */

import { db } from "@/lib/db";
import { matches, teamForm, teamSeasonXg, predictions } from "@/lib/db/schema";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import {
  generateScoreMatrix,
  deriveMarketProbabilities,
  getTopScorelines,
  calculateConfidence,
  type LeagueAverages,
} from "./poisson";
import { predictCorners, type CornerFactors } from "./corners";
import { predictCards, type CardFactors } from "./cards";

export interface PredictionInput {
  matchId: number;
  homeTeamId: number;
  awayTeamId: number;
  leagueId: number | null;
}

export interface PredictionResult {
  matchId: number;
  predictedHomeXg: number;
  predictedAwayXg: number;
  mostLikelyScore: string;
  scoreProbabilities: Record<string, number>;
  probHomeWin: number;
  probDraw: number;
  probAwayWin: number;
  expectedTotalGoals: number;
  overUnder25: number;
  under25: number;
  expectedTotalCorners: number;
  overCorners95: number;
  overCorners105: number;
  underCorners95: number;
  underCorners105: number;
  expectedTotalYellows: number;
  overYellows35: number;
  overYellows45: number;
  underYellows35: number;
  underYellows45: number;
  confidenceScore: number;
  featuresUsed: Record<string, unknown>;
}

async function getTeamForm(teamId: number, venue: "home" | "away", limit: number = 10) {
  return db
    .select()
    .from(teamForm)
    .where(and(
      eq(teamForm.teamId, teamId),
      eq(teamForm.venue, venue)
    ))
    .orderBy(desc(teamForm.matchDate))
    .limit(limit);
}

async function getTeamSeasonXg(teamId: number): Promise<{ xgPerGame: number; xgaPerGame: number } | null> {
  const [row] = await db
    .select()
    .from(teamSeasonXg)
    .where(eq(teamSeasonXg.teamId, teamId))
    .orderBy(desc(teamSeasonXg.season))
    .limit(1);

  if (!row) return null;
  return {
    xgPerGame: Number(row.xgPerGame),
    xgaPerGame: Number(row.xgaPerGame),
  };
}

async function getLeagueAverages(leagueId: number | null): Promise<LeagueAverages> {
  if (!leagueId) {
    return {
      avgHomeXg: 1.45,
      avgAwayXg: 1.15,
      avgHomeGoals: 1.55,
      avgAwayGoals: 1.20,
      avgTotalCorners: 9.5,
      avgTotalYellows: 3.8,
    };
  }

  const result = await db.execute(sql`
    SELECT
      AVG(home_xg) as avg_home_xg,
      AVG(away_xg) as avg_away_xg,
      AVG(home_goals) as avg_home_goals,
      AVG(away_goals) as avg_away_goals,
      AVG(home_corners + away_corners) as avg_corners,
      AVG(home_yellows + away_yellows) as avg_yellows
    FROM matches
    WHERE league_id = ${leagueId}
      AND status = 'finished'
      AND match_date > NOW() - INTERVAL '1 year'
  `);

  const row = result.rows[0] as Record<string, number>;

  return {
    avgHomeXg: Number(row?.avg_home_xg) || 1.45,
    avgAwayXg: Number(row?.avg_away_xg) || 1.15,
    avgHomeGoals: Number(row?.avg_home_goals) || 1.55,
    avgAwayGoals: Number(row?.avg_away_goals) || 1.20,
    avgTotalCorners: Number(row?.avg_corners) || 9.5,
    avgTotalYellows: Number(row?.avg_yellows) || 3.8,
  };
}

// ─── Fallback form data generator ─────────────────────────────
// Prefers team-specific Understat season xG when available; falls back
// to flat league averages only when neither match-level form nor
// season xG exists for a team.
function createFallbackForm(
  leagueAverages: LeagueAverages,
  venue: "home" | "away",
  seasonXg: { xgPerGame: number; xgaPerGame: number } | null
) {
  const isHome = venue === "home";

  if (seasonXg) {
    return {
      xgFor: seasonXg.xgPerGame,
      xgAgainst: seasonXg.xgaPerGame,
      goalsScored: seasonXg.xgPerGame,
      goalsConceded: seasonXg.xgaPerGame,
      cornersFor: leagueAverages.avgTotalCorners / 2,
      cornersAgainst: leagueAverages.avgTotalCorners / 2,
      possession: 50,
      shots: isHome ? 12 : 10,
      yellows: leagueAverages.avgTotalYellows / 2,
    };
  }

  return {
    xgFor: isHome ? leagueAverages.avgHomeXg : leagueAverages.avgAwayXg,
    xgAgainst: isHome ? leagueAverages.avgAwayXg : leagueAverages.avgHomeXg,
    goalsScored: isHome ? leagueAverages.avgHomeGoals : leagueAverages.avgAwayGoals,
    goalsConceded: isHome ? leagueAverages.avgAwayGoals : leagueAverages.avgHomeGoals,
    cornersFor: leagueAverages.avgTotalCorners / 2,
    cornersAgainst: leagueAverages.avgTotalCorners / 2,
    possession: 50,
    shots: 12,
    yellows: leagueAverages.avgTotalYellows / 2,
  };
}

export async function computeMatchPrediction(
  input: PredictionInput
): Promise<PredictionResult> {
  const { matchId, homeTeamId, awayTeamId, leagueId } = input;

  const [homeFormData, awayFormData] = await Promise.all([
    getTeamForm(homeTeamId, "home", 10),
    getTeamForm(awayTeamId, "away", 10),
  ]);

  const leagueAverages = await getLeagueAverages(leagueId);

  // Use fallback data if insufficient form (fresh database / new season)
  const hasHomeForm = homeFormData.length >= 3;
  const hasAwayForm = awayFormData.length >= 3;

  const [homeSeasonXg, awaySeasonXg] = await Promise.all([
    hasHomeForm ? Promise.resolve(null) : getTeamSeasonXg(homeTeamId),
    hasAwayForm ? Promise.resolve(null) : getTeamSeasonXg(awayTeamId),
  ]);

  const homeFallback = createFallbackForm(leagueAverages, "home", homeSeasonXg);
  const awayFallback = createFallbackForm(leagueAverages, "away", awaySeasonXg);

  const home5 = hasHomeForm ? homeFormData.slice(0, 5) : [homeFallback, homeFallback, homeFallback];
  const away5 = hasAwayForm ? awayFormData.slice(0, 5) : [awayFallback, awayFallback, awayFallback];

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  const homeAttack = avg(home5.map(f => Number(f.xgFor) || Number(f.goalsScored) || 0));
  const homeDefense = avg(home5.map(f => Number(f.xgAgainst) || Number(f.goalsConceded) || 0));
  const awayAttack = avg(away5.map(f => Number(f.xgFor) || Number(f.goalsScored) || 0));
  const awayDefense = avg(away5.map(f => Number(f.xgAgainst) || Number(f.goalsConceded) || 0));

  const homeAttackStrength = homeAttack / leagueAverages.avgHomeXg;
  const homeDefenseStrength = homeDefense / leagueAverages.avgAwayXg;
  const awayAttackStrength = awayAttack / leagueAverages.avgAwayXg;
  const awayDefenseStrength = awayDefense / leagueAverages.avgHomeXg;

  const scoreMatrix = generateScoreMatrix(
    homeAttackStrength,
    homeDefenseStrength,
    awayAttackStrength,
    awayDefenseStrength,
    leagueAverages,
    7,
    true
  );

  const marketProbs = deriveMarketProbabilities(scoreMatrix.matrix, 7);
  const topScores = getTopScorelines(scoreMatrix.probabilities, 10);

  const cornerFactors: CornerFactors = {
    homeCornersPerGame: avg(home5.map(f => Number(f.cornersFor) || 0)),
    awayCornersPerGame: avg(away5.map(f => Number(f.cornersFor) || 0)),
    homeConcededPerGame: avg(home5.map(f => Number(f.cornersAgainst) || 0)),
    awayConcededPerGame: avg(away5.map(f => Number(f.cornersAgainst) || 0)),
    homeCrossingRate: 18,
    awayCrossingRate: 16,
    homePossession: avg(home5.map(f => Number(f.possession) || 50)),
    awayPossession: avg(away5.map(f => Number(f.possession) || 50)),
    homeShotsPerGame: avg(home5.map(f => Number(f.shots) || 12)),
    awayShotsPerGame: avg(away5.map(f => Number(f.shots) || 10)),
    matchIntensity: 1.0,
    leagueAvgCorners: leagueAverages.avgTotalCorners,
  };

  const cornerPred = predictCorners(cornerFactors);

  const cardFactors: CardFactors = {
    homeYellowsPerGame: avg(home5.map(f => Number(f.yellows) || 0)),
    awayYellowsPerGame: avg(away5.map(f => Number(f.yellows) || 0)),
    homeFoulsPerGame: 12,
    awayFoulsPerGame: 11,
    refereeAvgCards: 4.0,
    refereeAvgYellows: 3.5,
    leagueAvgCards: leagueAverages.avgTotalYellows,
    leagueAvgYellows: leagueAverages.avgTotalYellows,
    matchIntensity: 1.0,
    isDerby: false,
    temperature: 20,
    timeOfSeason: 0.5,
    homeTacklesPerGame: 18,
    awayTacklesPerGame: 17,
    homeDuelsWon: 52,
    awayDuelsWon: 48,
  };

  const cardPred = predictCards(cardFactors);

  const confidence = calculateConfidence(
    marketProbs,
    scoreMatrix.homeExpected,
    scoreMatrix.awayExpected,
    homeFormData.length,
    awayFormData.length
  );

  // Lower confidence when using fallback data. Season-xG-backed fallback
  // carries more real signal than a flat league average, so it gets a
  // slightly higher cap.
  const usingSeasonXgFallback = (!hasHomeForm && !!homeSeasonXg) || (!hasAwayForm && !!awaySeasonXg);
  const fallbackCap = usingSeasonXgFallback ? 0.55 : 0.45;
  const adjustedConfidence = (hasHomeForm && hasAwayForm)
    ? confidence
    : Math.min(confidence, fallbackCap);

  const scoreProbs: Record<string, number> = {};
  topScores.forEach(({ score, probability }) => {
    scoreProbs[score] = Math.round(probability * 10000) / 10000;
  });

  return {
    matchId,
    predictedHomeXg: scoreMatrix.homeExpected,
    predictedAwayXg: scoreMatrix.awayExpected,
    mostLikelyScore: scoreMatrix.mostLikelyScore,
    scoreProbabilities: scoreProbs,
    probHomeWin: marketProbs.homeWin,
    probDraw: marketProbs.draw,
    probAwayWin: marketProbs.awayWin,
    expectedTotalGoals: Math.round((scoreMatrix.homeExpected + scoreMatrix.awayExpected) * 100) / 100,
    overUnder25: marketProbs.over25,
    under25: marketProbs.under25,
    expectedTotalCorners: cornerPred.expectedTotal,
    overCorners95: cornerPred.over95,
    overCorners105: cornerPred.over105,
    underCorners95: cornerPred.under95,
    underCorners105: cornerPred.under105,
    expectedTotalYellows: cardPred.expectedTotal,
    overYellows35: cardPred.over35,
    overYellows45: cardPred.over45,
    underYellows35: cardPred.under35,
    underYellows45: cardPred.under45,
    confidenceScore: adjustedConfidence,
    featuresUsed: {
      homeFormGames: homeFormData.length,
      awayFormGames: awayFormData.length,
      usingFallback: !hasHomeForm || !hasAwayForm,
      usingSeasonXgFallback,
      homeAttackStrength: Math.round(homeAttackStrength * 100) / 100,
      awayAttackStrength: Math.round(awayAttackStrength * 100) / 100,
      leagueAvgHomeXg: leagueAverages.avgHomeXg,
      leagueAvgAwayXg: leagueAverages.avgAwayXg,
      model: "poisson-dixon-coles",
    },
  };
}

export async function batchComputePredictions(): Promise<number> {
  const upcomingMatches = await db
    .select()
    .from(matches)
    .where(and(
      gte(matches.matchDate, new Date()),
      sql`${matches.status} IN ('scheduled', 'upcoming')`
    ));

  let computed = 0;

  for (const match of upcomingMatches) {
    try {
      const result = await computeMatchPrediction({
        matchId: match.id,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        leagueId: match.leagueId,
      });

      await db.insert(predictions).values([{
        matchId: result.matchId,
        modelVersion: "v1.0",
        predictedHomeXg: String(result.predictedHomeXg),
        predictedAwayXg: String(result.predictedAwayXg),
        mostLikelyScore: result.mostLikelyScore,
        scoreProbabilities: result.scoreProbabilities,
        probHomeWin: String(result.probHomeWin),
        probDraw: String(result.probDraw),
        probAwayWin: String(result.probAwayWin),
        expectedTotalGoals: String(result.expectedTotalGoals),
        overUnder25: String(result.overUnder25),
        under25: String(result.under25),
        expectedTotalCorners: String(result.expectedTotalCorners),
        overCorners95: String(result.overCorners95),
        overCorners105: String(result.overCorners105),
        underCorners95: String(result.underCorners95),
        underCorners105: String(result.underCorners105),
        expectedTotalYellows: String(result.expectedTotalYellows),
        overYellows35: String(result.overYellows35),
        overYellows45: String(result.overYellows45),
        underYellows35: String(result.underYellows35),
        underYellows45: String(result.underYellows45),
        confidenceScore: String(result.confidenceScore),
        featuresUsed: result.featuresUsed,
      }] as any).onConflictDoUpdate({
        target: predictions.matchId,
        set: {
          modelVersion: "v1.0",
          predictedHomeXg: String(result.predictedHomeXg),
          predictedAwayXg: String(result.predictedAwayXg),
          mostLikelyScore: result.mostLikelyScore,
          scoreProbabilities: result.scoreProbabilities,
          probHomeWin: String(result.probHomeWin),
          probDraw: String(result.probDraw),
          probAwayWin: String(result.probAwayWin),
          expectedTotalGoals: String(result.expectedTotalGoals),
          overUnder25: String(result.overUnder25),
          under25: String(result.under25),
          expectedTotalCorners: String(result.expectedTotalCorners),
          overCorners95: String(result.overCorners95),
          overCorners105: String(result.overCorners105),
          underCorners95: String(result.underCorners95),
          underCorners105: String(result.underCorners105),
          expectedTotalYellows: String(result.expectedTotalYellows),
          overYellows35: String(result.overYellows35),
          overYellows45: String(result.overYellows45),
          underYellows35: String(result.underYellows35),
          underYellows45: String(result.underYellows45),
          confidenceScore: String(result.confidenceScore),
          featuresUsed: result.featuresUsed,
          computedAt: new Date(),
        },
      });

      computed++;
    } catch (error) {
      console.error(`Failed to compute prediction for match ${match.id}:`, error);
    }
  }

  return computed;
}
