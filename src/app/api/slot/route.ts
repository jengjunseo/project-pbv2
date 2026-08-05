import { after, NextResponse } from "next/server";
import { deleteBlobPaths } from "@/lib/blob-cleanup";
import { getWriteRateLimit } from "@/lib/config";
import { checkRateLimit } from "@/lib/rate-limit";
import { clearSlot, readSlot, saveSlot } from "@/lib/slot-store";
import { collectStalePendingPaths } from "@/lib/upload-store";
import {
  parseSlotId,
  slotWriteSchema,
  validateUploadMeta,
} from "@/lib/validation";
import type {
  PBErrorResponse,
  SlotReadResponse,
  SlotWriteResponse,
} from "@/types/pb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
): Promise<NextResponse<SlotReadResponse | PBErrorResponse>> {
  const id = parseSlotId(new URL(request.url).searchParams.get("id"));
  if (id === null) {
    return error("INVALID_SLOT", "슬롯 번호는 0~99여야 합니다.", 400);
  }

  try {
    const slot = await readSlot(id);
    return NextResponse.json(
      slot
        ? { ok: true, empty: false, slot }
        : { ok: true, empty: true, slot: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (cause) {
    return error("READ_FAILED", messageFrom(cause, "슬롯을 불러오지 못했습니다."), 500);
  }
}

export async function POST(
  request: Request,
): Promise<NextResponse<SlotWriteResponse | PBErrorResponse>> {
  if (!(await checkRateLimit(request, "write", getWriteRateLimit()))) {
    return error(
      "RATE_LIMITED",
      "저장 요청이 너무 많습니다. 잠시 후 다시 시도하세요.",
      429,
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return error("INVALID_JSON", "요청 본문이 올바른 JSON이 아닙니다.", 400);
  }

  const parsed = slotWriteSchema.safeParse(json);
  if (!parsed.success) {
    return error("INVALID_PAYLOAD", "저장할 내용을 확인해 주세요.", 400);
  }

  const { id, text, file, baseRevision } = parsed.data;
  if (!text.trim() && !file) {
    return error("EMPTY_SLOT", "텍스트나 파일 중 하나는 있어야 합니다.", 400);
  }

  if (file) {
    const fileCheck = validateUploadMeta(file);
    if (!fileCheck.ok) {
      return error("INVALID_FILE", fileCheck.message, 400);
    }
  }

  try {
    await scheduleStaleUploadCleanup();
    const resolvedBaseRevision =
      baseRevision === undefined ? (await readSlot(id))?.revision ?? null : baseRevision;
    const result = await saveSlot({
      id,
      text,
      file,
      baseRevision: resolvedBaseRevision,
    });
    after(() => deleteBlobPaths(result.cleanupPaths));
    return NextResponse.json({
      ok: true,
      slot: result.slot,
      evictedIds: result.evictedIds,
    });
  } catch (cause) {
    return error("SAVE_FAILED", messageFrom(cause, "저장하지 못했습니다."), 500);
  }
}

export async function DELETE(
  request: Request,
): Promise<NextResponse<{ ok: true; cleared: boolean } | PBErrorResponse>> {
  if (!(await checkRateLimit(request, "write", getWriteRateLimit()))) {
    return error(
      "RATE_LIMITED",
      "요청이 너무 많습니다. 잠시 후 다시 시도하세요.",
      429,
    );
  }

  const id = parseSlotId(new URL(request.url).searchParams.get("id"));
  if (id === null) {
    return error("INVALID_SLOT", "슬롯 번호는 0~99여야 합니다.", 400);
  }

  try {
    await scheduleStaleUploadCleanup();
    const result = await clearSlot(id);
    after(() => deleteBlobPaths(result.cleanupPaths));
    return NextResponse.json({ ok: true, cleared: result.cleared });
  } catch (cause) {
    return error("CLEAR_FAILED", messageFrom(cause, "슬롯을 비우지 못했습니다."), 500);
  }
}

async function scheduleStaleUploadCleanup(): Promise<void> {
  try {
    const paths = await collectStalePendingPaths();
    if (paths.length > 0) after(() => deleteBlobPaths(paths));
  } catch {
    // Cleanup is best-effort and must never block a user write.
  }
}

function error(
  code: string,
  message: string,
  status: number,
): NextResponse<PBErrorResponse> {
  return NextResponse.json(
    { ok: false, error: { code, message } },
    { status },
  );
}

function messageFrom(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}
