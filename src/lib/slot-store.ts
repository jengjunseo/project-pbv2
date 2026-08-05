import { del as deleteBlob } from "@vercel/blob";
import { ORDER_KEY, USAGE_KEY, WRITE_LOCK_KEY } from "@/lib/constants";
import { getStorageLimitBytes } from "@/lib/config";
import { getRedis, slotKey } from "@/lib/redis";
import type { PBFileMeta, PBSlot } from "@/types/pb";

const LOCK_TTL_MS = 4_000;
const LOCK_ATTEMPTS = 12;

export async function readSlot(id: number): Promise<PBSlot | null> {
  return (await getRedis().get<PBSlot>(slotKey(id))) ?? null;
}

export async function saveSlot(input: { id: number; text: string; file: PBFileMeta | null }): Promise<{ slot: PBSlot; evictedIds: number[] }> {
  const token = await acquireWriteLock();
  const blobCleanup = new Set<string>();
  try {
    const redis = getRedis();
    const now = Date.now();
    const previous = await redis.get<PBSlot>(slotKey(input.id));
    const bytes = payloadBytes(input.text, input.file);
    const limit = getStorageLimitBytes();
    if (bytes > limit) throw new Error("이 슬롯 하나가 전체 저장공간 한도를 넘습니다.");

    const slot: PBSlot = {
      id: input.id,
      text: input.text,
      file: input.file,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
      bytes,
      revision: (previous?.revision ?? 0) + 1,
    };

    if (previous?.file && previous.file.pathname !== input.file?.pathname) blobCleanup.add(previous.file.pathname);

    const usageBefore = (await redis.get<number>(USAGE_KEY)) ?? 0;
    let projectedUsage = Math.max(0, usageBefore - (previous?.bytes ?? 0) + bytes);
    const evictedIds: number[] = [];

    if (projectedUsage > limit) {
      const members = await redis.zrange<string>(ORDER_KEY, 0, -1);
      for (const member of members) {
        if (projectedUsage <= limit) break;
        const victimId = Number(member);
        if (!Number.isInteger(victimId) || victimId === input.id) continue;
        const victim = await redis.get<PBSlot>(slotKey(victimId));
        if (!victim) {
          await redis.zrem(ORDER_KEY, member);
          continue;
        }
        await redis.del(slotKey(victimId));
        await redis.zrem(ORDER_KEY, member);
        projectedUsage = Math.max(0, projectedUsage - victim.bytes);
        evictedIds.push(victimId);
        if (victim.file) blobCleanup.add(victim.file.pathname);
      }
    }

    if (projectedUsage > limit) throw new Error("저장공간 한도를 만족하도록 슬롯을 정리할 수 없습니다.");

    await redis.set(slotKey(input.id), slot);
    await redis.zadd(ORDER_KEY, { score: now, member: String(input.id) });
    await redis.set(USAGE_KEY, projectedUsage);
    void cleanupBlobs(blobCleanup);
    return { slot, evictedIds };
  } finally {
    await releaseWriteLock(token);
  }
}

export async function clearSlot(id: number): Promise<boolean> {
  const token = await acquireWriteLock();
  let blobPath: string | null = null;
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
    return true;
  } finally {
    await releaseWriteLock(token);
    if (blobPath) void cleanupBlobs(new Set([blobPath]));
  }
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
    const result = await redis.set(WRITE_LOCK_KEY, token, { nx: true, px: LOCK_TTL_MS });
    if (result === "OK") return token;
    await new Promise((resolve) => setTimeout(resolve, 25 + attempt * 10));
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
