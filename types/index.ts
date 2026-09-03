export interface ScoreProbability {
  score: string;
  probability: number;
}

export interface MatchPrediction {
  id: number;
  matchId: number;
  modelVersion: string;
  computedAt: string;
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
}

export interface TeamFormData {
  id: number;
  teamId: number;
  matchId: number;
  matchDate: string;
  venue: "home" | "away";
  goalsScored: number;
  goalsConceded: number;
  xgFor: number;
  xgAgainst: number;
  result: "W" | "D" | "L";
  rolling5XgFor: number;
  rolling5XgAgainst: number;
  rolling5GoalsFor: number;
  rolling5GoalsAgainst: number;
  rolling5CornersFor: number;
  rolling5CornersAgainst: number;
  rolling5Yellows: number;
  rolling10XgFor: number;
  rolling10XgAgainst: number;
}

export interface MatchWithTeams {
  id: number;
  apiId: string;
  leagueId: number | null;
  season: string | null;
  round: number | null;
  homeTeamId: number;
  awayTeamId: number;
  matchDate: string;
  status: string;
  venue: string | null;
  referee: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
  homeXg: number | null;
  awayXg: number | null;
  homeYellows: number;
  awayYellows: number;
  homeReds: number;
  awayReds: number;
  homeCorners: number;
  awayCorners: number;
  homePossession: number | null;
  awayPossession: number | null;
  homeTeam: {
    id: number;
    name: string;
    shortName: string | null;
    logo: string | null;
    country: string | null;
  };
  awayTeam: {
    id: number;
    name: string;
    shortName: string | null;
    logo: string | null;
    country: string | null;
  };
  league: {
    id: number;
    name: string;
    country: string | null;
    logo: string | null;
  } | null;
  prediction: MatchPrediction | null;
}

export interface LeagueStandings {
  position: number;
  team: {
    id: number;
    name: string;
    logo: string | null;
  };
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: string;
}
