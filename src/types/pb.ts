export type PBFileMeta = {
  url: string;
  downloadUrl?: string;
  pathname: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: number;
};

export type PBSlot = {
  id: number;
  text: string;
  file: PBFileMeta | null;
  createdAt: number;
  updatedAt: number;
  bytes: number;
  revision: number;
};

export type PendingUpload = {
  slotId: number;
  pathname: string;
  expectedName: string;
  expectedSize: number;
  expectedType: string;
  issuedAt: number;
  completedAt: number | null;
  blob: PBFileMeta | null;
};

export type SlotReadResponse =
  | { ok: true; empty: true; slot: null }
  | { ok: true; empty: false; slot: PBSlot };

export type SlotWriteResponse = {
  ok: true;
  slot: PBSlot;
  evictedIds: number[];
};

export type PBErrorResponse = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};
