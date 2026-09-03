import { poissonPMF, poissonCDF } from "./poisson";

export interface CardFactors {
  homeYellowsPerGame: number;
  awayYellowsPerGame: number;
  homeFoulsPerGame: number;
  awayFoulsPerGame: number;
  refereeAvgCards: number;
  refereeAvgYellows: number;
  leagueAvgCards: number;
  leagueAvgYellows: number;
  matchIntensity: number;
  isDerby: boolean;
  temperature: number;
  timeOfSeason: number;
  homeTacklesPerGame: number;
  awayTacklesPerGame: number;
  homeDuelsWon: number;
  awayDuelsWon: number;
}

export interface CardPrediction {
  expectedTotal: number;
  over35: number;
  over45: number;
  over55: number;
  under35: number;
  under45: number;
  under55: number;
  homeExpected: number;
  awayExpected: number;
  distribution: Record<number, number>;
}

export function predictCards(factors: CardFactors): CardPrediction {
  const baseHome = factors.homeYellowsPerGame;
  const baseAway = factors.awayYellowsPerGame;

  const refereeFactor = factors.refereeAvgCards / factors.leagueAvgCards;
  const intensityFactor = factors.matchIntensity;
  const derbyFactor = factors.isDerby ? 1.2 : 1.0;
  const tempFactor = factors.temperature > 25
    ? 1 + (factors.temperature - 25) * 0.008
    : 1.0;
  const seasonFactor = 1 + 0.1 * (4 * Math.pow(factors.timeOfSeason - 0.5, 2));
  const avgTackles = (factors.homeTacklesPerGame + factors.awayTacklesPerGame) / 2;
  const avgFouls = (factors.homeFoulsPerGame + factors.awayFoulsPerGame) / 2;
  const aggressionFactor = 1 + ((avgTackles + avgFouls) / 2 - 25) * 0.01;

  const homeExpected = baseHome * refereeFactor * intensityFactor * derbyFactor * tempFactor * seasonFactor * aggressionFactor;
  const awayExpected = baseAway * refereeFactor * intensityFactor * derbyFactor * tempFactor * seasonFactor * aggressionFactor;
  const totalExpected = homeExpected + awayExpected;

  const distribution: Record<number, number> = {};
  for (let k = 0; k <= 15; k++) {
    distribution[k] = poissonPMF(k, totalExpected);
  }

  return {
    expectedTotal: Math.round(totalExpected * 10) / 10,
    over35: Math.round((1 - poissonCDF(3, totalExpected)) * 1000) / 1000,
    over45: Math.round((1 - poissonCDF(4, totalExpected)) * 1000) / 1000,
    over55: Math.round((1 - poissonCDF(5, totalExpected)) * 1000) / 1000,
    under35: Math.round(poissonCDF(3, totalExpected) * 1000) / 1000,
    under45: Math.round(poissonCDF(4, totalExpected) * 1000) / 1000,
    under55: Math.round(poissonCDF(5, totalExpected) * 1000) / 1000,
    homeExpected: Math.round(homeExpected * 10) / 10,
    awayExpected: Math.round(awayExpected * 10) / 10,
    distribution,
  };
}
