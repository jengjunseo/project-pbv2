import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import {
  ALLOWED_MIME_TYPES,
  getFileExtension,
  validateFileBasics,
  validateSlotId,
} from "@/lib/validation";
import type { PBErrorCode } from "@/types/pb";

export const runtime = "nodejs";

type ClientPayload = {
  slotId: unknown;
  name: string;
  size: number;
  type: string;
};

export async function POST(request: Request): Promise<NextResponse> {
  let body: HandleUploadBody;

  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return errorResponse("UNKNOWN_ERROR", "Request body must be valid JSON.", 400);
  }

  try {
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = parseClientPayload(clientPayload);
        const slotId = validateSlotId(payload.slotId);

        if (!slotId.ok) {
          throw new Error(slotId.message);
        }

        const file = validateFileBasics({
          name: payload.name,
          size: payload.size,
          type: payload.type,
        });

        if (!file.ok) {
          throw new Error(file.message);
        }

        const expectedPrefix = `pb/slot-${slotId.value}/`;
        if (!pathname.startsWith(expectedPrefix)) {
          throw new Error("Blob path does not match the requested slot.");
        }

        const pathCheck = validateFileBasics({
          name: pathname,
          size: payload.size,
          type: payload.type,
        });

        if (!pathCheck.ok) {
          throw new Error(pathCheck.message);
        }

        const isNotebook = getFileExtension(payload.name) === "ipynb";
        const contentTypes = isNotebook
          ? [...ALLOWED_MIME_TYPES, "application/x-ipynb+json", "application/octet-stream"]
          : [...ALLOWED_MIME_TYPES];

        return {
          allowedContentTypes: contentTypes,
          maximumSizeInBytes: 5 * 1024 * 1024,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({
            slotId: slotId.value,
            name: payload.name,
            size: payload.size,
            type: payload.type,
          }),
        };
      },
      onUploadCompleted: async () => {
        return;
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    return errorResponse("BLOB_ERROR", messageFrom(error), 400);
  }
}

function parseClientPayload(rawPayload: string | null | undefined): ClientPayload {
  if (!rawPayload) {
    throw new Error("Upload metadata is missing.");
  }

  const parsed = JSON.parse(rawPayload) as ClientPayload;

  if (
    typeof parsed.name !== "string" ||
    typeof parsed.size !== "number" ||
    typeof parsed.type !== "string"
  ) {
    throw new Error("Upload metadata is invalid.");
  }

  return parsed;
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
  return error instanceof Error ? error.message : "Unknown Blob error.";
}
