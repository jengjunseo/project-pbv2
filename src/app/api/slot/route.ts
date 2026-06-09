import { NextResponse } from "next/server";
import { clearSlot, readSlot, saveSlot } from "@/lib/slot";
import { validateSaveSlotInput, validateSlotId } from "@/lib/validation";
import type { PBErrorCode } from "@/types/pb";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const id = slotIdFromRequest(request);
  if (!id.ok) {
    return errorResponse(id.code, id.message, 400);
  }

  try {
    const result = await readSlot(id.value);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse("REDIS_ERROR", messageFrom(error), 500);
  }
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse("UNKNOWN_ERROR", "Request body must be valid JSON.", 400);
  }

  const input = validateSaveSlotInput(body);
  if (!input.ok) {
    return errorResponse(input.code, input.message, 400);
  }

  try {
    const slot = await saveSlot(input.value);
    return NextResponse.json({
      ok: true,
      empty: false,
      slot,
      remainingSeconds: 600,
    });
  } catch (error) {
    return errorResponse("REDIS_ERROR", messageFrom(error), 500);
  }
}

export async function DELETE(request: Request) {
  const id = slotIdFromRequest(request);
  if (!id.ok) {
    return errorResponse(id.code, id.message, 400);
  }

  try {
    const result = await clearSlot(id.value);
    return NextResponse.json({
      ok: true,
      deleted: result.existed,
      cleanup: result.blobCleanup,
    });
  } catch (error) {
    return errorResponse("REDIS_ERROR", messageFrom(error), 500);
  }
}

function slotIdFromRequest(request: Request) {
  const url = new URL(request.url);
  return validateSlotId(url.searchParams.get("id"));
}

function errorResponse(code: PBErrorCode, message: string, status: number) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
      },
    },
    { status },
  );
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}
