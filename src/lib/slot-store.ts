import { del as deleteBlob } from "@vercel/blob";
import { ORDER_KEY, USAGE_KEY, WRITE_LOCK_KEY } from "@/lib/constants";
import { getStorageLimitBytes } from "@/lib/config";
import { getRedis, slotKey } from "@/lib/redis";
import type { PBFileMeta, PBSlot } from "@/types/pb";

const LOCK_TTL_MS = 30_000;
const LOCK_ATTEMPTS = 20;

export async function readSlot(id: number): Promise<PBSlot | null> {
  return (await getRedis().get<PBSlot>(slotKey(id))) ?? null;
}

export async function saveSlot(input: {
  id: number;
  text: string;
  file: PBFileMeta | null;
}): Promise<{ slot: PBSlot; evictedIds: number[] }> {
  const token = await acquireWriteLock();
  const blobCleanup = new Set<string>();
  let result: { slot: PBSlot; evictedIds: number[] } | null = null;

  try {
    const redis = getRedis();
    const now = Date.now();
    const previous = await redis.get<PBSlot>(slotKey(input.id));
    const bytes = payloadBytes(input.text, input.file);
    const limit = getStorageLimitBytes();

    if (bytes > limit) {
      throw new Error("이 슬롯 하나가 전체 저장공간 한도를 넘습니다.");
    }

    const slot: PBSlot = {
      id: input.id,
      text: input.text,
      file: input.file,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
      bytes,
      revision: (previous?.revision ?? 0) + 1,
    };

    if (previous?.file && previous.file.pathname !== input.file?.pathname) {
      blobCleanup.add(previous.file.pathname);
    }

    const previousBytes = previous?.bytes ?? 0;
    await redis.set(slotKey(input.id), slot);
    await redis.zadd(ORDER_KEY, { score: now, member: String(input.id) });

    const usageBefore = (await redis.get<number>(USAGE_KEY)) ?? 0;
    let usage = Math.max(0, usageBefore - previousBytes + bytes);
    await redis.set(USAGE_KEY, usage);

    const evictedIds: number[] = [];

    while (usage > limit) {
      const candidates = await redis.zrange<string>(ORDER_KEY, 0, 1);
      const member = candidates.find((candidate: string) => Number(candidate) !== input.id);
      if (member === undefined) {
        throw new Error("저장공간 한도를 만족하도록 슬롯을 정리할 수 없습니다.");
      }

      const victimId = Number(member);
      if (!Number.isInteger(victimId)) {
        await redis.zrem(ORDER_KEY, member);
        continue;
      }

      const victim = await redis.get<PBSlot>(slotKey(victimId));
      await redis.del(slotKey(victimId));
      await redis.zrem(ORDER_KEY, member);

      if (!victim) continue;
      usage = Math.max(0, usage - victim.bytes);
      evictedIds.push(victimId);
      if (victim.file) blobCleanup.add(victim.file.pathname);
    }

    await redis.set(USAGE_KEY, usage);
    result = { slot, evictedIds };
  } finally {
    await releaseWriteLock(token);
  }

  await cleanupBlobs(blobCleanup);
  if (!result) throw new Error("저장 결과를 만들지 못했습니다.");
  return result;
}

export async function clearSlot(id: number): Promise<boolean> {
  const token = await acquireWriteLock();
  let blobPath: string | null = null;
  let cleared = false;

  try {
    const redis = getRedis();
    const previous = await redis.get<PBSlot>(slotKey(id));
    if (!previous) {
      await redis.zrem(ORDER_KEY, String(id));
      return false;
    }

    await redis.del(slotKey(id));
    await redis.zrem(ORDER_KEY, String(id));
    const usageBefore = (await redis.get<number>(USAGE_KEY)) ?? 0;
    await redis.set(USAGE_KEY, Math.max(0, usageBefore - previous.bytes));
    blobPath = previous.file?.pathname ?? null;
    cleared = true;
  } finally {
    await releaseWriteLock(token);
  }

  if (blobPath) await cleanupBlobs(new Set([blobPath]));
  return cleared;
}

export async function cleanupOrphanBlob(pathname: string, slotId: number): Promise<void> {
  const current = await readSlot(slotId);
  if (current?.file?.pathname === pathname) return;
  await cleanupBlobs(new Set([pathname]));
}

export function payloadBytes(text: string, file: PBFileMeta | null): number {
  return Buffer.byteLength(text, "utf8") + (file?.size ?? 0);
}

async function acquireWriteLock(): Promise<string> {
  const redis = getRedis();
  const token = crypto.randomUUID();

  for (let attempt = 0; attempt < LOCK_ATTEMPTS; attempt += 1) {
    const result = await redis.set(WRITE_LOCK_KEY, token, {
      nx: true,
      px: LOCK_TTL_MS,
    });
    if (result === "OK") return token;
    await new Promise((resolve) => setTimeout(resolve, 25 + attempt * 12));
  }

  throw new Error("저장 요청이 몰렸습니다. 잠시 후 다시 시도해 주세요.");
}

async function releaseWriteLock(token: string): Promise<void> {
  const redis = getRedis();
  const owner = await redis.get<string>(WRITE_LOCK_KEY);
  if (owner === token) await redis.del(WRITE_LOCK_KEY);
}

async function cleanupBlobs(paths: Set<string>): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN || paths.size === 0) return;
  await Promise.allSettled([...paths].map((pathname) => deleteBlob(pathname)));
}
