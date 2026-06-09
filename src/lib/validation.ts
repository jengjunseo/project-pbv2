import { z } from "zod";
import type { PBErrorCode, PBFileMeta, SlotId } from "@/types/pb";

export const MAX_TEXT_LENGTH = 10_000;
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/json",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export const BLOCKED_EXTENSIONS = [
  "exe",
  "bat",
  "cmd",
  "sh",
  "ps1",
  "apk",
  "dmg",
  "msi",
  "jar",
  "js",
  "vbs",
  "scr",
] as const;

export type ValidationFailure = {
  ok: false;
  code: PBErrorCode;
  message: string;
};

export type ValidationSuccess<T> = {
  ok: true;
  value: T;
};

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

export function getFileExtension(name: string): string {
  const cleanName = name.trim().toLowerCase();
  const index = cleanName.lastIndexOf(".");
  return index >= 0 ? cleanName.slice(index + 1) : "";
}

export function sanitizeFileName(name: string): string {
  const fallback = "file";
  const sanitized = name
    .normalize("NFKD")
    .replace(/[^\w.\-() ]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 120);

  return sanitized || fallback;
}

export function validateSlotId(input: unknown): ValidationResult<SlotId> {
  if (typeof input !== "string" && typeof input !== "number") {
    return invalidSlotId();
  }

  const normalized =
    typeof input === "string" ? input.trim() : Number.isFinite(input) ? String(input) : "";

  if (!/^\d+$/.test(normalized)) {
    return invalidSlotId();
  }

  const id = Number(normalized);
  if (!Number.isInteger(id) || id < 0 || id > 99) {
    return invalidSlotId();
  }

  return { ok: true, value: id };
}

export function validateText(input: unknown): ValidationResult<string> {
  if (typeof input !== "string") {
    return { ok: true, value: "" };
  }

  if (input.length > MAX_TEXT_LENGTH) {
    return {
      ok: false,
      code: "TEXT_TOO_LONG",
      message: `Text must be ${MAX_TEXT_LENGTH.toLocaleString()} characters or fewer.`,
    };
  }

  return { ok: true, value: input };
}

export const fileMetaSchema = z.object({
  url: z.string().url(),
  pathname: z.string().optional(),
  name: z.string().min(1),
  size: z.number().int().nonnegative(),
  type: z.string().default(""),
  uploadedAt: z.number().int().positive(),
});

export function validateFileMeta(input: unknown): ValidationResult<PBFileMeta | null> {
  if (input === undefined || input === null) {
    return { ok: true, value: null };
  }

  const parsed = fileMetaSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "FILE_TYPE_NOT_ALLOWED",
      message: "File metadata is invalid.",
    };
  }

  return validateFileBasics(parsed.data);
}

export function validateFileBasics(file: {
  name: string;
  size: number;
  type?: string;
}): ValidationResult<PBFileMeta | null> {
  const extension = getFileExtension(file.name);

  if (BLOCKED_EXTENSIONS.includes(extension as (typeof BLOCKED_EXTENSIONS)[number])) {
    return {
      ok: false,
      code: "FILE_EXTENSION_BLOCKED",
      message: "This file extension is blocked.",
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      code: "FILE_TOO_LARGE",
      message: "Files must be 5MB or smaller.",
    };
  }

  const type = file.type || "";
  const allowedByMime = ALLOWED_MIME_TYPES.includes(
    type as (typeof ALLOWED_MIME_TYPES)[number],
  );
  const allowedByExtension = extension === "ipynb";

  if (!allowedByMime && !allowedByExtension) {
    return {
      ok: false,
      code: "FILE_TYPE_NOT_ALLOWED",
      message: "This file type is not allowed.",
    };
  }

  if ("url" in file && "uploadedAt" in file) {
    return { ok: true, value: file as PBFileMeta };
  }

  return { ok: true, value: null };
}

export const saveSlotSchema = z.object({
  id: z.union([z.string(), z.number()]),
  text: z.string().optional().default(""),
  file: z.unknown().optional().nullable(),
});

export type SaveSlotInput = {
  id: SlotId;
  text: string;
  file: PBFileMeta | null;
};

export function validateSaveSlotInput(input: unknown): ValidationResult<SaveSlotInput> {
  const parsed = saveSlotSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "UNKNOWN_ERROR",
      message: "Request body is invalid.",
    };
  }

  const id = validateSlotId(parsed.data.id);
  if (!id.ok) {
    return id;
  }

  const text = validateText(parsed.data.text);
  if (!text.ok) {
    return text;
  }

  const file = validateFileMeta(parsed.data.file);
  if (!file.ok) {
    return file;
  }

  if (!text.value.trim() && !file.value) {
    return {
      ok: false,
      code: "EMPTY_PAYLOAD",
      message: "Add text or a file before saving.",
    };
  }

  return {
    ok: true,
    value: {
      id: id.value,
      text: text.value,
      file: file.value,
    },
  };
}

function invalidSlotId(): ValidationFailure {
  return {
    ok: false,
    code: "INVALID_SLOT_ID",
    message: "Slot id must be an integer between 0 and 99.",
  };
}
