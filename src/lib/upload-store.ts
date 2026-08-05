import { head } from "@vercel/blob";
import {
  MAX_PENDING_SWEEP,
  PENDING_ORDER_KEY,
  PENDING_UPLOAD_GRACE_MS,
  PENDING_UPLOAD_TTL_SECONDS,
} from "@/lib/constants";
import { getRedis, pendingKey } from "@/lib/redis";
import { sameFile, validateBlobPath } from "@/lib/validation";
import type { PBFileMeta, PBSlot, PendingUpload } from "@/types/pb";

export async function registerPendingUpload(input: {
  slotId: number;
  pathname: string;
  name: string;
  size: number;
  type: string;
}): Promise<void> {
  const pending: PendingUpload = {
    slotId: input.slotId,
    pathname: input.pathname,
    expectedName: input.name,
    expectedSize: input.size,
    expectedType: normalizeType(input.type),
    issuedAt: Date.now(),
    completedAt: null,
    blob: null,
  };

  const redis = getRedis();
  const pipeline = redis.pipeline();
  pipeline.set(pendingKey(input.pathname), pending, {
    ex: PENDING_UPLOAD_TTL_SECONDS,
  });
  pipeline.zadd(PENDING_ORDER_KEY, {
    score: pending.issuedAt,
    member: input.pathname,
  });
  await pipeline.exec();
}

export async function completePendingUpload(input: {
  slotId: number;
  pathname: string;
  url: string;
  downloadUrl: string;
  contentType: string;
}): Promise<void> {
  const redis = getRedis();
  const key = pendingKey(input.pathname);
  const pending = await redis.get<PendingUpload>(key);
  if (!pending) {
    // The slot save may have already consumed this pending record.
    return;
  }
  if (pending.slotId !== input.slotId) {
    throw new Error("Upload authorization does not match the slot.");
  }

  const file: PBFileMeta = {
    url: input.url,
    downloadUrl: input.downloadUrl,
    pathname: input.pathname,
    name: pending.expectedName,
    size: pending.expectedSize,
    type: normalizeType(input.contentType || pending.expectedType),
    uploadedAt: Date.now(),
  };

  const completed: PendingUpload = {
    ...pending,
    completedAt: Date.now(),
    blob: file,
  };

  await redis.set(key, completed, {
    ex: PENDING_UPLOAD_TTL_SECONDS,
    xx: true,
  });
}

export async function authorizeFileForSave(
  slotId: number,
  file: PBFileMeta | null,
  existing: PBSlot | null,
): Promise<{ file: PBFileMeta | null; consumePath: string | null }> {
  if (!file) return { file: null, consumePath: null };
  if (!validateBlobPath(slotId, file.pathname)) {
    throw new Error("파일 경로가 슬롯과 일치하지 않습니다.");
  }

  if (existing?.file && sameFile(existing.file, file)) {
    return { file: existing.file, consumePath: null };
  }

  const pending = await waitForPending(file.pathname);
  if (!pending || pending.slotId !== slotId) {
    throw new Error("이 파일의 업로드 권한을 확인할 수 없습니다. 다시 선택해 주세요.");
  }

  assertExpectedMetadata(pending, file);

  // Always HEAD a newly attached Blob. The completion callback does not
  // include authoritative size metadata, while logical quota accounting does.
  const verified = await verifyBlob(file, pending);
  return { file: verified, consumePath: file.pathname };
}

export async function consumePendingUpload(pathname: string): Promise<void> {
  const redis = getRedis();
  const pipeline = redis.pipeline();
  pipeline.del(pendingKey(pathname));
  pipeline.zrem(PENDING_ORDER_KEY, pathname);
  await pipeline.exec();
}

export async function removePendingUpload(
  slotId: number,
  pathname: string,
): Promise<boolean> {
  const redis = getRedis();
  const pending = await redis.get<PendingUpload>(pendingKey(pathname));
  if (!pending || pending.slotId !== slotId) return false;

  await consumePendingUpload(pathname);
  return true;
}

export async function collectStalePendingPaths(
  now = Date.now(),
): Promise<string[]> {
  const redis = getRedis();
  const cutoff = now - PENDING_UPLOAD_GRACE_MS;
  const stale = await redis.zrange<string[]>(
    PENDING_ORDER_KEY,
    0,
    cutoff,
    { byScore: true, offset: 0, count: MAX_PENDING_SWEEP },
  );

  if (stale.length === 0) return [];

  const pipeline = redis.pipeline();
  for (const pathname of stale) {
    pipeline.del(pendingKey(pathname));
    pipeline.zrem(PENDING_ORDER_KEY, pathname);
  }
  await pipeline.exec();

  return stale;
}

async function waitForPending(pathname: string): Promise<PendingUpload | null> {
  const redis = getRedis();
  const delays = [0, 60, 120, 240, 420];

  for (const delay of delays) {
    if (delay > 0) await sleep(delay);
    const pending = await redis.get<PendingUpload>(pendingKey(pathname));
    if (pending) return pending;
  }

  return null;
}

async function verifyBlob(
  file: PBFileMeta,
  pending: PendingUpload,
): Promise<PBFileMeta> {
  const blob = await head(file.url);

  if (blob.pathname !== pending.pathname) {
    throw new Error("업로드된 파일 경로가 일치하지 않습니다.");
  }

  if (blob.size !== pending.expectedSize) {
    throw new Error("업로드된 파일 크기가 일치하지 않습니다.");
  }

  return {
    url: blob.url,
    downloadUrl: blob.downloadUrl,
    pathname: blob.pathname,
    name: pending.expectedName,
    size: blob.size,
    type: normalizeType(blob.contentType || pending.expectedType),
    uploadedAt: Date.now(),
  };
}

function assertExpectedMetadata(
  pending: PendingUpload,
  file: PBFileMeta,
): void {
  if (
    pending.pathname !== file.pathname ||
    pending.expectedName !== file.name ||
    pending.expectedSize !== file.size ||
    pending.expectedType !== normalizeType(file.type)
  ) {
    throw new Error("업로드 메타데이터가 발급된 권한과 일치하지 않습니다.");
  }
}

function normalizeType(type: string): string {
  return type.trim().toLowerCase() || "application/octet-stream";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
