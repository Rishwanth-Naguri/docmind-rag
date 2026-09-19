import { NextRequest, NextResponse } from "next/server";
import { getAnalyticsMetrics } from "@/lib/analytics/aggregation";
import { getSessionId } from "@/lib/memory/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope"); // "all" or "session"

    let sessionId: string | undefined = undefined;
    if (scope === "session") {
      sessionId = await getSessionId();
    }

    const metrics = await getAnalyticsMetrics(sessionId);

    return NextResponse.json({
      success: true,
      metrics,
      scope: scope || "all",
    });
  } catch (error: unknown) {
    console.error("Analytics API error:", error);
    return NextResponse.json(
      { error: "Failed to compute analytics." },
      { status: 500 }
    );
  }
}
