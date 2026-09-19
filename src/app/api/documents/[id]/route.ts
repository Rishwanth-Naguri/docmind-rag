import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSessionId } from "@/lib/memory/session";
import { getDocumentsCollection, getChunksCollection } from "@/lib/mongodb";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionId = await getSessionId();
    const { id } = await params;

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid document ID" }, { status: 400 });
    }

    const docObjectId = new ObjectId(id);
    const [docsCol, chunksCol] = await Promise.all([
      getDocumentsCollection(),
      getChunksCollection(),
    ]);

    // Ensure document belongs to this session
    const doc = await docsCol.findOne({ _id: docObjectId, sessionId });
    if (!doc) {
      return NextResponse.json({ error: "Document not found or access denied" }, { status: 404 });
    }

    // Delete document and all associated chunks
    await Promise.all([
      docsCol.deleteOne({ _id: docObjectId, sessionId }),
      chunksCol.deleteMany({ documentId: docObjectId, sessionId }),
    ]);

    return NextResponse.json({
      success: true,
      message: `Document "${doc.filename}" and its chunks were deleted successfully.`,
    });
  } catch (error: unknown) {
    console.error("Delete document error:", error);
    return NextResponse.json({ error: "Failed to delete document." }, { status: 500 });
  }
}
