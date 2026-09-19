import { NextResponse } from "next/server";
import { getSessionId } from "@/lib/memory/session";
import { getDocumentsCollection } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sessionId = await getSessionId();
    const docsCol = await getDocumentsCollection();

    const documents = await docsCol
      .find({ sessionId })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      documents,
      sessionId,
    });
  } catch (error: unknown) {
    console.error("Fetch documents error:", error);
    return NextResponse.json(
      { error: "Failed to fetch session documents." },
      { status: 500 }
    );
  }
}
