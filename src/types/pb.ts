export type SlotId = number;

export type PBFileMeta = {
  url: string;
  pathname?: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: number;
};

export type PBSlot = {
  id: SlotId;
  text: string;
  file?: PBFileMeta | null;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
};

export type PBErrorCode =
  | "INVALID_SLOT_ID"
  | "TEXT_TOO_LONG"
  | "EMPTY_PAYLOAD"
  | "FILE_TOO_LARGE"
  | "FILE_TYPE_NOT_ALLOWED"
  | "FILE_EXTENSION_BLOCKED"
  | "SLOT_NOT_FOUND"
  | "REDIS_ERROR"
  | "BLOB_ERROR"
  | "UNKNOWN_ERROR";

export type PBErrorResponse = {
  ok: false;
  error: {
    code: PBErrorCode;
    message: string;
  };
};

export type PBSlotResponse = {
  ok: true;
  empty: boolean;
  slot: PBSlot | null;
  remainingSeconds: number;
};
