/**
 * Poisson-based football prediction engine
 * Uses xG-adjusted team strength ratings
 */

export interface TeamStrength {
  attackStrength: number;
  defenseWeakness: number;
  homeAdvantage: number;
  recentFormWeight: number;
}

export interface LeagueAverages {
  avgHomeXg: number;
  avgAwayXg: number;
  avgHomeGoals: number;
  avgAwayGoals: number;
  avgTotalCorners: number;
  avgTotalYellows: number;
}

const factorialCache: Map<number, number> = new Map([
  [0, 1], [1, 1], [2, 2], [3, 6], [4, 24], [5, 120],
  [6, 720], [7, 5040], [8, 40320], [9, 362880], [10, 3628800]
]);

function factorial(n: number): number {
  if (factorialCache.has(n)) return factorialCache.get(n)!;
  let result = factorialCache.get(10)!;
  for (let i = 11; i <= n; i++) result *= i;
  factorialCache.set(n, result);
  return result;
}

export function poissonPMF(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  if (k < 0) return 0;
  const logProb = k * Math.log(lambda) - lambda - Math.log(factorial(k));
  return Math.exp(logProb);
}

export function poissonCDF(k: number, lambda: number): number {
  let sum = 0;
  for (let i = 0; i <= k; i++) {
    sum += poissonPMF(i, lambda);
  }
  return sum;
}

function dixonColesAdjustment(
  homeGoals: number,
  awayGoals: number,
  homeLambda: number,
  awayLambda: number,
  rho: number = -0.08
): number {
  if (homeGoals === 0 && awayGoals === 0) return 1 - homeLambda * awayLambda * rho;
  if (homeGoals === 0 && awayGoals === 1) return 1 + homeLambda * rho;
  if (homeGoals === 1 && awayGoals === 0) return 1 + awayLambda * rho;
  if (homeGoals === 1 && awayGoals === 1) return 1 - rho;
  return 1;
}

export interface ScoreMatrix {
  matrix: number[][];
  probabilities: Record<string, number>;
  mostLikelyScore: string;
  mostLikelyProbability: number;
  homeExpected: number;
  awayExpected: number;
}

export function generateScoreMatrix(
  homeAttack: number,
  homeDefense: number,
  awayAttack: number,
  awayDefense: number,
  leagueAverages: LeagueAverages,
  maxGoals: number = 7,
  useDixonColes: boolean = true
): ScoreMatrix {
  const homeExpected = homeAttack * awayDefense * leagueAverages.avgHomeXg;
  const awayExpected = awayAttack * homeDefense * leagueAverages.avgAwayXg;

  const matrix: number[][] = [];
  const probabilities: Record<string, number> = {};
  let maxProb = 0;
  let mostLikelyScore = "0-0";
  let totalProb = 0;

  for (let i = 0; i <= maxGoals; i++) {
    matrix[i] = [];
    for (let j = 0; j <= maxGoals; j++) {
      let prob = poissonPMF(i, homeExpected) * poissonPMF(j, awayExpected);
      if (useDixonColes) {
        prob *= dixonColesAdjustment(i, j, homeExpected, awayExpected);
      }
      matrix[i][j] = prob;
      probabilities[`${i}-${j}`] = prob;
      totalProb += prob;
      if (prob > maxProb) {
        maxProb = prob;
        mostLikelyScore = `${i}-${j}`;
      }
    }
  }

  for (const key in probabilities) {
    probabilities[key] = Math.round((probabilities[key] / totalProb) * 10000) / 10000;
  }
  for (let i = 0; i <= maxGoals; i++) {
    for (let j = 0; j <= maxGoals; j++) {
      matrix[i][j] /= totalProb;
    }
  }

  return {
    matrix,
    probabilities,
    mostLikelyScore,
    mostLikelyProbability: Math.round((maxProb / totalProb) * 10000) / 10000,
    homeExpected: Math.round(homeExpected * 100) / 100,
    awayExpected: Math.round(awayExpected * 100) / 100,
  };
}

export interface MarketProbabilities {
  homeWin: number;
  draw: number;
  awayWin: number;
  over25: number;
  under25: number;
  over15: number;
  under15: number;
  bttsYes: number;
  bttsNo: number;
}

export function deriveMarketProbabilities(
  matrix: number[][],
  maxGoals: number = 7
): MarketProbabilities {
  let homeWin = 0, draw = 0, awayWin = 0;
  let over25 = 0, under25 = 0;
  let over15 = 0, under15 = 0;
  let bttsYes = 0, bttsNo = 0;

  for (let i = 0; i <= maxGoals; i++) {
    for (let j = 0; j <= maxGoals; j++) {
      const prob = matrix[i][j];
      const totalGoals = i + j;
      if (i > j) homeWin += prob;
      else if (i === j) draw += prob;
      else awayWin += prob;
      if (totalGoals > 2.5) over25 += prob;
      else under25 += prob;
      if (totalGoals > 1.5) over15 += prob;
      else under15 += prob;
      if (i > 0 && j > 0) bttsYes += prob;
      else bttsNo += prob;
    }
  }

  return {
    homeWin: Math.round(homeWin * 1000) / 1000,
    draw: Math.round(draw * 1000) / 1000,
    awayWin: Math.round(awayWin * 1000) / 1000,
    over25: Math.round(over25 * 1000) / 1000,
    under25: Math.round(under25 * 1000) / 1000,
    over15: Math.round(over15 * 1000) / 1000,
    under15: Math.round(under15 * 1000) / 1000,
    bttsYes: Math.round(bttsYes * 1000) / 1000,
    bttsNo: Math.round(bttsNo * 1000) / 1000,
  };
}

export function getTopScorelines(
  probabilities: Record<string, number>,
  n: number = 5
): Array<{ score: string; probability: number }> {
  return Object.entries(probabilities)
    .map(([score, probability]) => ({ score, probability }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, n);
}

export function calculateConfidence(
  marketProbs: MarketProbabilities,
  homeExpected: number,
  awayExpected: number,
  homeFormGames: number,
  awayFormGames: number
): number {
  const maxResultProb = Math.max(marketProbs.homeWin, marketProbs.draw, marketProbs.awayWin);
  const resultClarity = (maxResultProb - 1 / 3) / (2 / 3);
  const minGames = Math.min(homeFormGames, awayFormGames);
  const dataQuality = Math.min(minGames / 5, 1);
  const totalExpected = homeExpected + awayExpected;
  const goalsReasonable = totalExpected > 1.5 && totalExpected < 5 ? 1 : 0.7;
  const confidence = resultClarity * 0.4 + dataQuality * 0.4 + goalsReasonable * 0.2;
  return Math.round(Math.min(confidence, 1) * 100) / 100;
}
