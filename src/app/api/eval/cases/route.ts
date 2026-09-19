import { NextResponse } from "next/server";
import { getEvalCases } from "@/lib/eval/benchmark";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cases = await getEvalCases();
    return NextResponse.json({
      success: true,
      cases,
    });
  } catch (error: unknown) {
    console.error("Fetch eval cases error:", error);
    return NextResponse.json(
      { error: "Failed to fetch evaluation test cases." },
      { status: 500 }
    );
  }
}
