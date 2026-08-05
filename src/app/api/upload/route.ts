import { after, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { deleteBlobPaths } from "@/lib/blob-cleanup";
import { getMaxFileBytes, getUploadRateLimit } from "@/lib/config";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  completePendingUpload,
  registerPendingUpload,
  removePendingUpload,
} from "@/lib/upload-store";
import {
  parseSlotId,
  validateBlobPath,
  validateUploadMeta,
} from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { ok: false, error: { message: "Vercel Blob이 설정되지 않았습니다." } },
      { status: 500 },
    );
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: { message: "잘못된 업로드 요청입니다." } },
      { status: 400 },
    );
  }

  const action = (body as { type?: string }).type;
  if (
    action === "blob.generate-client-token" &&
    !(await checkRateLimit(request, "upload", getUploadRateLimit()))
  ) {
    return NextResponse.json(
      { ok: false, error: { message: "업로드 요청이 너무 많습니다." } },
      { status: 429 },
    );
  }

  try {
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = parseClientPayload(clientPayload);
        const id = parseSlotId(payload.slotId);
        if (id === null) throw new Error("슬롯 번호가 올바르지 않습니다.");

        const validation = validateUploadMeta(payload);
        if (!validation.ok) throw new Error(validation.message);
        if (!validateBlobPath(id, pathname)) {
          throw new Error("파일 경로가 슬롯과 일치하지 않습니다.");
        }

        await registerPendingUpload({
          slotId: id,
          pathname,
          name: payload.name,
          size: payload.size,
          type: payload.type,
        });

        return {
          allowedContentTypes: [payload.type || "application/octet-stream"],
          maximumSizeInBytes: getMaxFileBytes(),
          addRandomSuffix: false,
          validUntil: Date.now() + 5 * 60 * 1000,
          cacheControlMaxAge: 60,
          tokenPayload: JSON.stringify({ slotId: id, pathname }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const payload = parseTokenPayload(tokenPayload);
        await completePendingUpload({
          slotId: payload.slotId,
          pathname: blob.pathname,
          url: blob.url,
          downloadUrl: blob.downloadUrl,
          contentType: blob.contentType,
        });
      },
    });

    return NextResponse.json(response);
  } catch (cause) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          message: cause instanceof Error ? cause.message : "업로드에 실패했습니다.",
        },
      },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ ok: true });
  }

  let payload: { slotId?: unknown; pathname?: unknown };
  try {
    payload = (await request.json()) as {
      slotId?: unknown;
      pathname?: unknown;
    };
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const slotId = parseSlotId(payload.slotId);
  const pathname = typeof payload.pathname === "string" ? payload.pathname : "";
  if (slotId === null || !validateBlobPath(slotId, pathname)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const removable = await removePendingUpload(slotId, pathname);
  if (removable) after(() => deleteBlobPaths([pathname]));

  return NextResponse.json({ ok: true });
}

function parseClientPayload(raw: string | null | undefined): {
  slotId: unknown;
  name: string;
  size: number;
  type: string;
} {
  if (!raw) throw new Error("업로드 메타데이터가 없습니다.");

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("업로드 메타데이터가 올바른 JSON이 아닙니다.");
  }

  if (
    typeof parsed.name !== "string" ||
    typeof parsed.size !== "number" ||
    typeof parsed.type !== "string"
  ) {
    throw new Error("업로드 메타데이터가 올바르지 않습니다.");
  }

  return {
    slotId: parsed.slotId,
    name: parsed.name,
    size: parsed.size,
    type: parsed.type,
  };
}

function parseTokenPayload(raw: string | null | undefined): {
  slotId: number;
  pathname: string;
} {
  if (!raw) throw new Error("Upload token payload is missing.");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const slotId = parseSlotId(parsed.slotId);
  if (slotId === null || typeof parsed.pathname !== "string") {
    throw new Error("Upload token payload is invalid.");
  }
  return { slotId, pathname: parsed.pathname };
}
