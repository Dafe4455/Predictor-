CREATE TABLE IF NOT EXISTS leagues (
    id SERIAL PRIMARY KEY,
    api_id VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    country VARCHAR(50),
    country_code VARCHAR(5),
    logo VARCHAR(255),
    flag VARCHAR(255),
    tier INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    api_id VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    short_name VARCHAR(50),
    country VARCHAR(50),
    league_id INTEGER REFERENCES leagues(id),
    logo VARCHAR(255),
    founded INTEGER,
    venue_name VARCHAR(100),
    venue_capacity INTEGER,
    elo_rating DECIMAL(6,2) DEFAULT 1500,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS teams_league_idx ON teams(league_id);

CREATE TABLE IF NOT EXISTS matches (
    id SERIAL PRIMARY KEY,
    api_id VARCHAR(50) NOT NULL UNIQUE,
    league_id INTEGER REFERENCES leagues(id),
    season VARCHAR(10),
    round INTEGER,
    home_team_id INTEGER NOT NULL REFERENCES teams(id),
    away_team_id INTEGER NOT NULL REFERENCES teams(id),
    match_date TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled',
    venue VARCHAR(100),
    referee VARCHAR(100),
    home_goals INTEGER,
    away_goals INTEGER,
    home_xg DECIMAL(4,2),
    away_xg DECIMAL(4,2),
    home_npxg DECIMAL(4,2),
    away_npxg DECIMAL(4,2),
    home_yellows INTEGER DEFAULT 0,
    away_yellows INTEGER DEFAULT 0,
    home_reds INTEGER DEFAULT 0,
    away_reds INTEGER DEFAULT 0,
    home_corners INTEGER DEFAULT 0,
    away_corners INTEGER DEFAULT 0,
    home_possession DECIMAL(4,1),
    away_possession DECIMAL(4,1),
    home_shots INTEGER,
    away_shots INTEGER,
    home_shots_on_target INTEGER,
    away_shots_on_target INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS matches_date_idx ON matches(match_date);
CREATE INDEX IF NOT EXISTS matches_status_idx ON matches(status);
CREATE INDEX IF NOT EXISTS matches_league_idx ON matches(league_id);
CREATE INDEX IF NOT EXISTS matches_home_team_idx ON matches(home_team_id);
CREATE INDEX IF NOT EXISTS matches_away_team_idx ON matches(away_team_id);

CREATE TABLE IF NOT EXISTS team_form (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES teams(id),
    match_id INTEGER NOT NULL REFERENCES matches(id),
    match_date TIMESTAMPTZ NOT NULL,
    venue VARCHAR(10) NOT NULL CHECK (venue IN ('home', 'away')),
    goals_scored INTEGER,
    xg_for DECIMAL(4,2),
    npxg_for DECIMAL(4,2),
    shots INTEGER,
    shots_on_target INTEGER,
    big_chances INTEGER,
    goals_conceded INTEGER,
    xg_against DECIMAL(4,2),
    npxg_against DECIMAL(4,2),
    shots_faced INTEGER,
    shots_on_target_faced INTEGER,
    big_chances_conceded INTEGER,
    yellows INTEGER DEFAULT 0,
    reds INTEGER DEFAULT 0,
    fouls_committed INTEGER,
    fouls_drawn INTEGER,
    corners_for INTEGER DEFAULT 0,
    corners_against INTEGER DEFAULT 0,
    possession DECIMAL(4,1),
    ppda DECIMAL(5,2),
    rolling_5_xg_for DECIMAL(4,2),
    rolling_5_xg_against DECIMAL(4,2),
    rolling_5_goals_for DECIMAL(4,2),
    rolling_5_goals_against DECIMAL(4,2),
    rolling_5_corners_for DECIMAL(4,2),
    rolling_5_corners_against DECIMAL(4,2),
    rolling_5_yellows DECIMAL(4,2),
    rolling_10_xg_for DECIMAL(4,2),
    rolling_10_xg_against DECIMAL(4,2),
    rolling_10_goals_for DECIMAL(4,2),
    rolling_10_goals_against DECIMAL(4,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS form_team_date_idx ON team_form(team_id, match_date DESC);
CREATE INDEX IF NOT EXISTS form_team_venue_idx ON team_form(team_id, venue, match_date DESC);

CREATE TABLE IF NOT EXISTS predictions (
    id SERIAL PRIMARY KEY,
    match_id INTEGER NOT NULL REFERENCES matches(id) UNIQUE,
    model_version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    predicted_home_xg DECIMAL(4,2),
    predicted_away_xg DECIMAL(4,2),
    most_likely_score VARCHAR(10),
    score_probabilities JSONB,
    prob_home_win DECIMAL(5,3),
    prob_draw DECIMAL(5,3),
    prob_away_win DECIMAL(5,3),
    expected_total_goals DECIMAL(4,2),
    over_under_25 DECIMAL(5,3),
    under_25 DECIMAL(5,3),
    expected_total_corners DECIMAL(4,2),
    over_corners_95 DECIMAL(5,3),
    over_corners_105 DECIMAL(5,3),
    under_corners_95 DECIMAL(5,3),
    under_corners_105 DECIMAL(5,3),
    expected_total_yellows DECIMAL(4,2),
    over_yellows_35 DECIMAL(5,3),
    over_yellows_45 DECIMAL(5,3),
    under_yellows_35 DECIMAL(5,3),
    under_yellows_45 DECIMAL(5,3),
    confidence_score DECIMAL(3,2),
    features_used JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS predictions_match_idx ON predictions(match_id);
CREATE INDEX IF NOT EXISTS predictions_computed_idx ON predictions(computed_at);

CREATE TABLE IF NOT EXISTS prediction_accuracy (
    id SERIAL PRIMARY KEY,
    prediction_id INTEGER NOT NULL REFERENCES predictions(id),
    match_id INTEGER NOT NULL REFERENCES matches(id),
    actual_home_goals INTEGER,
    actual_away_goals INTEGER,
    actual_total_corners INTEGER,
    actual_total_yellows INTEGER,
    score_correct BOOLEAN,
    result_correct BOOLEAN,
    brier_score DECIMAL(5,4),
    log_loss DECIMAL(5,4),
    ou_25_correct BOOLEAN,
    corners_ou_95_correct BOOLEAN,
    yellows_ou_35_correct BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
