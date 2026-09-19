import { NextRequest, NextResponse } from "next/server";
import { getSessionId } from "@/lib/memory/session";
import { getMessagesCollection } from "@/lib/mongodb";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const activeSessionId = await getSessionId();
    const { id } = await params;

    // Security check: restrict message retrieval to the caller's active session
    if (id !== activeSessionId) {
      return NextResponse.json(
        { error: "Access denied. You may only access your own session messages." },
        { status: 403 }
      );
    }

    const messagesCol = await getMessagesCollection();
    const messages = await messagesCol
      .find({ sessionId: id })
      .sort({ createdAt: 1 })
      .toArray();

    return NextResponse.json({
      sessionId: id,
      messages,
    });
  } catch (error: unknown) {
    console.error("Fetch messages error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve conversation messages." },
      { status: 500 }
    );
  }
}
