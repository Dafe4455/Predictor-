import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { matches } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { format } from "date-fns";
import Link from "next/link";
import { ArrowLeft, Calendar, Clock, MapPin, User } from "lucide-react";
import { ScorePrediction } from "@/components/predictions/ScorePrediction";
import { CornerMarket } from "@/components/predictions/CornerMarket";
import { CardMarket } from "@/components/predictions/CardMarket";
import { TeamFormSection } from "@/components/matches/TeamFormSection";

interface MatchPageProps {
  params: Promise<{ id: string }>;
}

export default async function MatchPage({ params }: MatchPageProps) {
  const { id } = await params;
  const matchId = parseInt(id);
  if (isNaN(matchId)) notFound();

  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
    with: {
      homeTeam: true,
      awayTeam: true,
      league: true,
      prediction: true,
    },
  });

  if (!match) notFound();
  const prediction = match.prediction;

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to matches
      </Link>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 mb-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
          {match.league?.logo && <img src={match.league.logo} alt="" className="w-5 h-5 object-contain" />}
          <span>{match.league?.name}</span>
          <span>•</span>
          <span>Matchday {match.round}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center gap-3 flex-1">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
              {match.homeTeam.logo ? (
                <img src={match.homeTeam.logo} alt={match.homeTeam.name} className="w-16 h-16 object-contain" />
              ) : (
                <span className="text-3xl font-bold text-gray-400">{match.homeTeam.name[0]}</span>
              )}
            </div>
            <h2 className="text-lg font-bold text-gray-900 text-center">{match.homeTeam.name}</h2>
          </div>

          <div className="flex flex-col items-center px-8">
            <div className="text-3xl font-black text-gray-400 mb-2">vs</div>
            <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-1">
              <Calendar className="w-3.5 h-3.5" />
              {format(new Date(match.matchDate), "MMM d, yyyy")}
            </div>
            <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-1">
              <Clock className="w-3.5 h-3.5" />
              {format(new Date(match.matchDate), "HH:mm")}
            </div>
            {match.venue && (
              <div className="flex items-center gap-1.5 text-sm text-gray-400">
                <MapPin className="w-3.5 h-3.5" />
                {match.venue}
              </div>
            )}
            {match.referee && (
              <div className="flex items-center gap-1.5 text-sm text-gray-400 mt-1">
                <User className="w-3.5 h-3.5" />
                {match.referee}
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-3 flex-1">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
              {match.awayTeam.logo ? (
                <img src={match.awayTeam.logo} alt={match.awayTeam.name} className="w-16 h-16 object-contain" />
              ) : (
                <span className="text-3xl font-bold text-gray-400">{match.awayTeam.name[0]}</span>
              )}
            </div>
            <h2 className="text-lg font-bold text-gray-900 text-center">{match.awayTeam.name}</h2>
          </div>
        </div>
      </div>

      {prediction ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <ScorePrediction
            homeTeam={match.homeTeam.name}
            awayTeam={match.awayTeam.name}
            homeLogo={match.homeTeam.logo}
            awayLogo={match.awayTeam.logo}
            predictedHomeXg={Number(prediction.predictedHomeXg)}
            predictedAwayXg={Number(prediction.predictedAwayXg)}
            mostLikelyScore={prediction.mostLikelyScore || "0-0"}
            scoreProbabilities={(prediction.scoreProbabilities as Record<string, number>) || {}}
            probHomeWin={Number(prediction.probHomeWin)}
            probDraw={Number(prediction.probDraw)}
            probAwayWin={Number(prediction.probAwayWin)}
            expectedTotalGoals={Number(prediction.expectedTotalGoals)}
            confidenceScore={Number(prediction.confidenceScore)}
          />

          <div className="space-y-6">
            <CornerMarket prediction={{
              expectedTotalCorners: Number(prediction.expectedTotalCorners),
              overCorners95: Number(prediction.overCorners95),
              overCorners105: Number(prediction.overCorners105),
              underCorners95: Number(prediction.underCorners95),
              underCorners105: Number(prediction.underCorners105),
            }} />
            <CardMarket prediction={{
              expectedTotalYellows: Number(prediction.expectedTotalYellows),
              overYellows35: Number(prediction.overYellows35),
              overYellows45: Number(prediction.overYellows45),
              underYellows35: Number(prediction.underYellows35),
              underYellows45: Number(prediction.underYellows45),
            }} />
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm mb-6">
          <div className="w-16 h-16 rounded-full bg-gray-100 mx-auto mb-4 flex items-center justify-center">
            <Clock className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700">Prediction pending</h3>
          <p className="text-gray-500 mt-1">Predictions typically available 48 hours before kickoff.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TeamFormSection teamId={match.homeTeamId} teamName={match.homeTeam.name} venue="home" currentMatchId={match.id} />
        <TeamFormSection teamId={match.awayTeamId} teamName={match.awayTeam.name} venue="away" currentMatchId={match.id} />
      </div>
    </main>
  );
}
