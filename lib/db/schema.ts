import {
  pgTable,
  serial,
  varchar,
  integer,
  decimal,
  timestamp,
  jsonb,
  text,
  boolean,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Leagues
export const leagues = pgTable("leagues", {
  id: serial("id").primaryKey(),
  apiId: varchar("api_id", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  country: varchar("country", { length: 50 }),
  countryCode: varchar("country_code", { length: 10 }),
  logo: varchar("logo", { length: 255 }),
  flag: varchar("flag", { length: 255 }),
  tier: integer("tier").default(1),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const leaguesRelations = relations(leagues, ({ many }) => ({
  teams: many(teams),
  matches: many(matches),
}));

// Teams
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  apiId: varchar("api_id", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  shortName: varchar("short_name", { length: 50 }),
  country: varchar("country", { length: 50 }),
  leagueId: integer("league_id").references(() => leagues.id),
  logo: varchar("logo", { length: 255 }),
  founded: integer("founded"),
  venueName: varchar("venue_name", { length: 100 }),
  venueCapacity: integer("venue_capacity"),
  eloRating: decimal("elo_rating", { precision: 6, scale: 2 }).default("1500"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("teams_league_idx").on(table.leagueId),
]);

export const teamsRelations = relations(teams, ({ one, many }) => ({
  league: one(leagues, { fields: [teams.leagueId], references: [leagues.id] }),
  homeMatches: many(matches, { relationName: "homeTeam" }),
  awayMatches: many(matches, { relationName: "awayTeam" }),
  formEntries: many(teamForm),
  seasonXg: many(teamSeasonXg),
}));

// Matches
export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  apiId: varchar("api_id", { length: 50 }).notNull().unique(),
  leagueId: integer("league_id").references(() => leagues.id),
  season: varchar("season", { length: 10 }),
  round: integer("round"),
  homeTeamId: integer("home_team_id").notNull().references(() => teams.id),
  awayTeamId: integer("away_team_id").notNull().references(() => teams.id),
  matchDate: timestamp("match_date", { withTimezone: true }).notNull(),
  status: varchar("status", { length: 20 }).default("scheduled"),
  venue: varchar("venue", { length: 100 }),
  referee: varchar("referee", { length: 100 }),
  homeGoals: integer("home_goals"),
  awayGoals: integer("away_goals"),
  homeXg: decimal("home_xg", { precision: 4, scale: 2 }),
  awayXg: decimal("away_xg", { precision: 4, scale: 2 }),
  homeNpxg: decimal("home_npxg", { precision: 4, scale: 2 }),
  awayNpxg: decimal("away_npxg", { precision: 4, scale: 2 }),
  homeYellows: integer("home_yellows").default(0),
  awayYellows: integer("away_yellows").default(0),
  homeReds: integer("home_reds").default(0),
  awayReds: integer("away_reds").default(0),
  homeCorners: integer("home_corners").default(0),
  awayCorners: integer("away_corners").default(0),
  homePossession: decimal("home_possession", { precision: 4, scale: 1 }),
  awayPossession: decimal("away_possession", { precision: 4, scale: 1 }),
  homeShots: integer("home_shots"),
  awayShots: integer("away_shots"),
  homeShotsOnTarget: integer("home_shots_on_target"),
  awayShotsOnTarget: integer("away_shots_on_target"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("matches_date_idx").on(table.matchDate),
  index("matches_status_idx").on(table.status),
  index("matches_league_idx").on(table.leagueId),
  index("matches_home_team_idx").on(table.homeTeamId),
  index("matches_away_team_idx").on(table.awayTeamId),
]);

export const matchesRelations = relations(matches, ({ one, many }) => ({
  league: one(leagues, { fields: [matches.leagueId], references: [leagues.id] }),
  homeTeam: one(teams, { fields: [matches.homeTeamId], references: [teams.id], relationName: "homeTeam" }),
  awayTeam: one(teams, { fields: [matches.awayTeamId], references: [teams.id], relationName: "awayTeam" }),
  formEntries: many(teamForm),
  prediction: one(predictions),
}));

// Team Form
export const teamForm = pgTable("team_form", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id),
  matchId: integer("match_id").notNull().references(() => matches.id),
  matchDate: timestamp("match_date", { withTimezone: true }).notNull(),
  venue: varchar("venue", { length: 10 }).notNull(),
  goalsScored: integer("goals_scored"),
  xgFor: decimal("xg_for", { precision: 4, scale: 2 }),
  npxgFor: decimal("npxg_for", { precision: 4, scale: 2 }),
  shots: integer("shots"),
  shotsOnTarget: integer("shots_on_target"),
  bigChances: integer("big_chances"),
  goalsConceded: integer("goals_conceded"),
  xgAgainst: decimal("xg_against", { precision: 4, scale: 2 }),
  npxgAgainst: decimal("npxg_against", { precision: 4, scale: 2 }),
  shotsFaced: integer("shots_faced"),
  shotsOnTargetFaced: integer("shots_on_target_faced"),
  bigChancesConceded: integer("big_chances_conceded"),
  yellows: integer("yellows").default(0),
  reds: integer("reds").default(0),
  foulsCommitted: integer("fouls_committed"),
  foulsDrawn: integer("fouls_drawn"),
  cornersFor: integer("corners_for").default(0),
  cornersAgainst: integer("corners_against").default(0),
  possession: decimal("possession", { precision: 4, scale: 1 }),
  ppda: decimal("ppda", { precision: 5, scale: 2 }),
  rolling5XgFor: decimal("rolling_5_xg_for", { precision: 4, scale: 2 }),
  rolling5XgAgainst: decimal("rolling_5_xg_against", { precision: 4, scale: 2 }),
  rolling5GoalsFor: decimal("rolling_5_goals_for", { precision: 4, scale: 2 }),
  rolling5GoalsAgainst: decimal("rolling_5_goals_against", { precision: 4, scale: 2 }),
  rolling5CornersFor: decimal("rolling_5_corners_for", { precision: 4, scale: 2 }),
  rolling5CornersAgainst: decimal("rolling_5_corners_against", { precision: 4, scale: 2 }),
  rolling5Yellows: decimal("rolling_5_yellows", { precision: 4, scale: 2 }),
  rolling10XgFor: decimal("rolling_10_xg_for", { precision: 4, scale: 2 }),
  rolling10XgAgainst: decimal("rolling_10_xg_against", { precision: 4, scale: 2 }),
  rolling10GoalsFor: decimal("rolling_10_goals_for", { precision: 4, scale: 2 }),
  rolling10GoalsAgainst: decimal("rolling_10_goals_against", { precision: 4, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("form_team_date_idx").on(table.teamId, table.matchDate.desc()),
  index("form_team_venue_idx").on(table.teamId, table.venue, table.matchDate.desc()),
]);

export const teamFormRelations = relations(teamForm, ({ one }) => ({
  team: one(teams, { fields: [teamForm.teamId], references: [teams.id] }),
  match: one(matches, { fields: [teamForm.matchId], references: [matches.id] }),
}));

// Team Season xG (Understat season aggregates — fallback signal when
// match-level form data is insufficient)
export const teamSeasonXg = pgTable("team_season_xg", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id),
  season: varchar("season", { length: 10 }).notNull(),
  xgPerGame: decimal("xg_per_game", { precision: 4, scale: 2 }).notNull(),
  xgaPerGame: decimal("xga_per_game", { precision: 4, scale: 2 }).notNull(),
  matchesPlayed: integer("matches_played").notNull(),
  source: varchar("source", { length: 20 }).notNull().default("understat"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("team_season_xg_team_idx").on(table.teamId),
  unique("team_season_xg_team_season_unique").on(table.teamId, table.season),
]);

export const teamSeasonXgRelations = relations(teamSeasonXg, ({ one }) => ({
  team: one(teams, { fields: [teamSeasonXg.teamId], references: [teams.id] }),
}));

// Predictions
export const predictions = pgTable("predictions", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull().references(() => matches.id).unique(),
  modelVersion: varchar("model_version", { length: 20 }).notNull().default("v1.0"),
  computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow(),
  predictedHomeXg: decimal("predicted_home_xg", { precision: 4, scale: 2 }),
  predictedAwayXg: decimal("predicted_away_xg", { precision: 4, scale: 2 }),
  mostLikelyScore: varchar("most_likely_score", { length: 10 }),
  scoreProbabilities: jsonb("score_probabilities"),
  probHomeWin: decimal("prob_home_win", { precision: 5, scale: 3 }),
  probDraw: decimal("prob_draw", { precision: 5, scale: 3 }),
  probAwayWin: decimal("prob_away_win", { precision: 5, scale: 3 }),
  expectedTotalGoals: decimal("expected_total_goals", { precision: 4, scale: 2 }),
  overUnder25: decimal("over_under_25", { precision: 5, scale: 3 }),
  under25: decimal("under_25", { precision: 5, scale: 3 }),
  expectedTotalCorners: decimal("expected_total_corners", { precision: 4, scale: 2 }),
  overCorners95: decimal("over_corners_95", { precision: 5, scale: 3 }),
  overCorners105: decimal("over_corners_105", { precision: 5, scale: 3 }),
  underCorners95: decimal("under_corners_95", { precision: 5, scale: 3 }),
  underCorners105: decimal("under_corners_105", { precision: 5, scale: 3 }),
  expectedTotalYellows: decimal("expected_total_yellows", { precision: 4, scale: 2 }),
  overYellows35: decimal("over_yellows_35", { precision: 5, scale: 3 }),
  overYellows45: decimal("over_yellows_45", { precision: 5, scale: 3 }),
  underYellows35: decimal("under_yellows_35", { precision: 5, scale: 3 }),
  underYellows45: decimal("under_yellows_45", { precision: 5, scale: 3 }),
  confidenceScore: decimal("confidence_score", { precision: 3, scale: 2 }),
  featuresUsed: jsonb("features_used"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("predictions_match_idx").on(table.matchId),
  index("predictions_computed_idx").on(table.computedAt),
]);

export const predictionsRelations = relations(predictions, ({ one }) => ({
  match: one(matches, { fields: [predictions.matchId], references: [matches.id] }),
}));

// Prediction Accuracy
export const predictionAccuracy = pgTable("prediction_accuracy", {
  id: serial("id").primaryKey(),
  predictionId: integer("prediction_id").notNull().references(() => predictions.id),
  matchId: integer("match_id").notNull().references(() => matches.id),
  actualHomeGoals: integer("actual_home_goals"),
  actualAwayGoals: integer("actual_away_goals"),
  actualTotalCorners: integer("actual_total_corners"),
  actualTotalYellows: integer("actual_total_yellows"),
  scoreCorrect: boolean("score_correct"),
  resultCorrect: boolean("result_correct"),
  brierScore: decimal("brier_score", { precision: 5, scale: 4 }),
  logLoss: decimal("log_loss", { precision: 5, scale: 4 }),
  ou25Correct: boolean("ou_25_correct"),
  cornersOu95Correct: boolean("corners_ou_95_correct"),
  yellowsOu35Correct: boolean("yellows_ou_35_correct"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type League = typeof leagues.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type TeamForm = typeof teamForm.$inferSelect;
export type TeamSeasonXg = typeof teamSeasonXg.$inferSelect;
export type Prediction = typeof predictions.$inferSelect;
export type PredictionAccuracy = typeof predictionAccuracy.$inferSelect;

export type NewLeague = typeof leagues.$inferInsert;
export type NewTeam = typeof teams.$inferInsert;
export type NewMatch = typeof matches.$inferInsert;
export type NewTeamForm = typeof teamForm.$inferInsert;
export type NewTeamSeasonXg = typeof teamSeasonXg.$inferInsert;
export type NewPrediction = typeof predictions.$inferInsert;
