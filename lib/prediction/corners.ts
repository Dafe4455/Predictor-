import { poissonPMF, poissonCDF } from "./poisson";

export interface CornerFactors {
  homeCornersPerGame: number;
  awayCornersPerGame: number;
  homeConcededPerGame: number;
  awayConcededPerGame: number;
  homeCrossingRate: number;
  awayCrossingRate: number;
  homePossession: number;
  awayPossession: number;
  homeShotsPerGame: number;
  awayShotsPerGame: number;
  matchIntensity: number;
  leagueAvgCorners: number;
}

export interface CornerPrediction {
  expectedTotal: number;
  over95: number;
  over105: number;
  over115: number;
  under95: number;
  under105: number;
  under115: number;
  homeExpected: number;
  awayExpected: number;
  distribution: Record<number, number>;
}

export function predictCorners(factors: CornerFactors): CornerPrediction {
  const baseHome = (factors.homeCornersPerGame + factors.awayConcededPerGame) / 2;
  const baseAway = (factors.awayCornersPerGame + factors.homeConcededPerGame) / 2;

  const crossingMultiplier = 1 + (
    (factors.homeCrossingRate + factors.awayCrossingRate) / 2 - 15
  ) * 0.015;

  const possessionBalance = Math.abs(factors.homePossession - factors.awayPossession);
  const possessionFactor = possessionBalance > 25
    ? 0.95
    : 1.0 + (possessionBalance / 100) * 0.1;

  const avgShots = (factors.homeShotsPerGame + factors.awayShotsPerGame) / 2;
  const shotsFactor = 1 + (avgShots - 12) * 0.02;

  const homeExpected = baseHome * crossingMultiplier * possessionFactor * shotsFactor * factors.matchIntensity;
  const awayExpected = baseAway * crossingMultiplier * possessionFactor * shotsFactor * factors.matchIntensity;
  const totalExpected = homeExpected + awayExpected;

  const distribution: Record<number, number> = {};
  for (let k = 0; k <= 25; k++) {
    distribution[k] = poissonPMF(k, totalExpected);
  }

  return {
    expectedTotal: Math.round(totalExpected * 10) / 10,
    over95: Math.round((1 - poissonCDF(9, totalExpected)) * 1000) / 1000,
    over105: Math.round((1 - poissonCDF(10, totalExpected)) * 1000) / 1000,
    over115: Math.round((1 - poissonCDF(11, totalExpected)) * 1000) / 1000,
    under95: Math.round(poissonCDF(9, totalExpected) * 1000) / 1000,
    under105: Math.round(poissonCDF(10, totalExpected) * 1000) / 1000,
    under115: Math.round(poissonCDF(11, totalExpected) * 1000) / 1000,
    homeExpected: Math.round(homeExpected * 10) / 10,
    awayExpected: Math.round(awayExpected * 10) / 10,
    distribution,
  };
}
