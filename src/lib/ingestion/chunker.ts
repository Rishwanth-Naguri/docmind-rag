import { ParsedPage } from "./parser";
import { ChunkMetadata } from "../types/database";

export interface GeneratedChunk {
  text: string;
  metadata: ChunkMetadata;
}

export interface ChunkingOptions {
  targetTokens?: number; // Target ~800 tokens
  overlapTokens?: number; // Overlap ~100 tokens
  charsPerToken?: number; // Approx 4 chars per token
}

/**
 * Splits text into overlapping chunks respecting sentence and paragraph boundaries where possible.
 */
export function chunkPages(
  pages: ParsedPage[],
  filename: string,
  options: ChunkingOptions = {}
): GeneratedChunk[] {
  const targetTokens = options.targetTokens || 800;
  const overlapTokens = options.overlapTokens || 100;
  const charsPerToken = options.charsPerToken || 4;

  const targetChars = targetTokens * charsPerToken; // ~3200 chars
  const overlapChars = overlapTokens * charsPerToken; // ~400 chars
  const stepChars = Math.max(100, targetChars - overlapChars);

  const chunks: GeneratedChunk[] = [];
  let globalChunkIndex = 0;

  for (const page of pages) {
    const rawText = page.text.trim();
    if (!rawText) continue;

    // If page is smaller than target size, emit as single chunk
    if (rawText.length <= targetChars) {
      chunks.push({
        text: rawText,
        metadata: {
          source: filename,
          page: page.pageNumber,
          chunkIndex: globalChunkIndex++,
        },
      });
      continue;
    }

    // Split page into overlapping windows
    let start = 0;
    while (start < rawText.length) {
      let end = Math.min(start + targetChars, rawText.length);

      // If we are not at the end of text, try to find a natural boundary (. , \n, space)
      if (end < rawText.length) {
        const lookaheadWindow = rawText.slice(end - 100, end + 100);
        const match = lookaheadWindow.match(/[\.\n\?!]\s/);
        if (match && match.index !== undefined) {
          end = end - 100 + match.index + 1;
        } else {
          // Fall back to nearest whitespace
          const lastSpace = rawText.lastIndexOf(" ", end);
          if (lastSpace > start + stepChars / 2) {
            end = lastSpace;
          }
        }
      }

      const chunkSlice = rawText.slice(start, end).trim();
      if (chunkSlice.length > 20) {
        chunks.push({
          text: chunkSlice,
          metadata: {
            source: filename,
            page: page.pageNumber,
            chunkIndex: globalChunkIndex++,
          },
        });
      }

      if (end >= rawText.length) break;
      start = Math.max(start + 1, end - overlapChars);
    }
  }

  return chunks;
}
