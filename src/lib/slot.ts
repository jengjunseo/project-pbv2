import type { PBFileMeta, PBSlot, PBSlotResponse } from "@/types/pb";
import { deleteBlobIfPresent } from "@/lib/blob";
import { getRedis, slotKey } from "@/lib/redis";
import { expiresAtFrom, nowMs, remainingSeconds, SLOT_TTL_SECONDS } from "@/lib/time";

export async function readSlot(id: number): Promise<PBSlotResponse> {
  const redis = getRedis();
  const key = slotKey(id);
  const slot = await redis.get<PBSlot>(key);

  if (!slot) {
    return {
      ok: true,
      empty: true,
      slot: null,
      remainingSeconds: 0,
    };
  }

  const ttl = await redis.ttl(key);
  const fallbackRemaining = remainingSeconds(slot.expiresAt);
  const safeRemaining = ttl > 0 ? ttl : fallbackRemaining;

  if (safeRemaining <= 0) {
    return {
      ok: true,
      empty: true,
      slot: null,
      remainingSeconds: 0,
    };
  }

  return {
    ok: true,
    empty: false,
    slot,
    remainingSeconds: safeRemaining,
  };
}

export async function saveSlot(input: {
  id: number;
  text: string;
  file: PBFileMeta | null;
}): Promise<PBSlot> {
  const redis = getRedis();
  const key = slotKey(input.id);
  const existing = await redis.get<PBSlot>(key);
  const now = nowMs();

  const slot: PBSlot = {
    id: input.id,
    text: input.text,
    file: input.file,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    expiresAt: expiresAtFrom(now),
  };

  await redis.set(key, slot, { ex: SLOT_TTL_SECONDS });
  return slot;
}

export async function clearSlot(id: number): Promise<{
  existed: boolean;
  blobCleanup: { attempted: boolean; ok: boolean; error?: string };
}> {
  const redis = getRedis();
  const key = slotKey(id);
  const existing = await redis.get<PBSlot>(key);
  await redis.del(key);
  const blobCleanup = await deleteBlobIfPresent(existing?.file);

  return {
    existed: Boolean(existing),
    blobCleanup,
  };
}
