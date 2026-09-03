import { NextRequest, NextResponse } from "next/server";
import { runIngestionPipeline } from "@/lib/data/ingest";
import { batchComputePredictions } from "@/lib/prediction";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const startTime = Date.now();
    const ingestionResult = await runIngestionPipeline();
    const predictionsComputed = await batchComputePredictions();
    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      ingestion: ingestionResult,
      predictionsComputed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron job failed:", error);
    return NextResponse.json({
      error: "Job failed",
      details: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
