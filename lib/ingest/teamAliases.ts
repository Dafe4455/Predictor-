// lib/ingest/teamAliases.ts

// Understat and BigBallsData will almost never agree on team names verbatim.
// Normalize first, then fall back to an explicit override table for the
// genuinely ambiguous cases (nicknames, abbreviations).

export function normalizeTeamName(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/\b(fc|cf|afc|ac|sc|calcio|club|de|cd)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// Understat name -> canonical override key, only for cases normalization
// alone won't solve. Extend as mismatches turn up in [Match] logs.
const MANUAL_ALIASES: Record<string, string> = {
  "manchesterunited": "manutd",
  "manutd": "manutd",
  "manchestercity": "mancity",
  "mancity": "mancity",
  "tottenham": "spurs",
  "spurs": "spurs",
  "wolverhamptonwanderers": "wolves",
  "wolves": "wolves",
  "newcastleunited": "newcastle",
  "westhamunited": "westham",
  "brightonhovealbion": "brighton",
  "nottinghamforest": "nottmforest",
  "parissaintgermain": "psg",
  "psg": "psg",
  "atleticomadrid": "atletico",
  "realsociedad": "sociedad",
  "athleticclub": "athleticbilbao",
  "athleticbilbao": "athleticbilbao",
  "internazionale": "inter",
  "inter": "inter",
  "acmilan": "milan",
  "milan": "milan",
  "borussiadortmund": "dortmund",
  "bayernmunich": "bayern",
  "bayernmunchen": "bayern",
  "rbleipzig": "leipzig",
  "bayerleverkusen": "leverkusen",
  "olympiquedemarseille": "marseille",
  "olympiquelyonnais": "lyon",
  "saintetienne": "stetienne",
};

export function resolveAliasKey(rawName: string): string {
  const normalized = normalizeTeamName(rawName);
  return MANUAL_ALIASES[normalized] || normalized;
}
