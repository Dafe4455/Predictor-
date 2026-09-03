import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { predictions, matches } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { computeMatchPrediction } from "@/lib/prediction";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;
  const id = parseInt(matchId);

  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid match ID" }, { status: 400 });
  }

  try {
    const cached = await db.query.predictions.findFirst({
      where: eq(predictions.matchId, id),
      with: {
        match: {
          with: {
            homeTeam: true,
            awayTeam: true,
            league: true,
          },
        },
      },
    });

    if (cached && cached.computedAt) {
      const age = Date.now() - new Date(cached.computedAt).getTime();
      if (age < 6 * 60 * 60 * 1000) {
        return NextResponse.json({
          prediction: cached,
          cached: true,
          computedAt: cached.computedAt,
        });
      }
    }

    const match = await db.query.matches.findFirst({
      where: eq(matches.id, id),
      with: {
        homeTeam: true,
        awayTeam: true,
        league: true,
      },
    });

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

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

    return NextResponse.json({
      prediction: result,
      match,
      cached: false,
      computedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`Prediction error for match ${id}:`, error);
    return NextResponse.json({
      error: "Failed to compute prediction",
      details: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}
