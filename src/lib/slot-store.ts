import {
  ORDER_KEY,
  ORDER_SEQUENCE_KEY,
  PENDING_ORDER_KEY,
  USAGE_KEY,
  WRITE_LOCK_KEY,
} from "@/lib/constants";
import { getStorageLimitBytes } from "@/lib/config";
import { getRedis, pendingKey, slotKey } from "@/lib/redis";
import { authorizeFileForSave } from "@/lib/upload-store";
import type { PBFileMeta, PBSlot } from "@/types/pb";

const LOCK_TTL_MS = 15_000;
const LOCK_ATTEMPTS = 20;

export type SaveResult = {
  slot: PBSlot;
  evictedIds: number[];
  cleanupPaths: string[];
};

export type ClearResult = {
  cleared: boolean;
  cleanupPaths: string[];
};

export async function readSlot(id: number): Promise<PBSlot | null> {
  return (await getRedis().get<PBSlot>(slotKey(id))) ?? null;
}

export async function saveSlot(input: {
  id: number;
  text: string;
  file: PBFileMeta | null;
  baseRevision: number | null;
}): Promise<SaveResult> {
  const redis = getRedis();
  const existingBeforeLock = await redis.get<PBSlot>(slotKey(input.id));
  if ((existingBeforeLock?.revision ?? null) !== input.baseRevision) {
    throw new Error("슬롯이 다른 기기에서 변경되었습니다. 새로고침 후 다시 저장해 주세요.");
  }
  const authorized = await authorizeFileForSave(
    input.id,
    input.file,
    existingBeforeLock,
  );
  const token = await acquireWriteLock();
  const cleanupPaths = new Set<string>();

  try {
    const now = Date.now();
    const previous = await redis.get<PBSlot>(slotKey(input.id));
    const currentRevision = previous?.revision ?? null;
    if (currentRevision !== input.baseRevision) {
      throw new Error("슬롯이 다른 기기에서 변경되었습니다. 새로고침 후 다시 저장해 주세요.");
    }

    const file = authorized.file;
    const bytes = payloadBytes(input.text, file);
    const limit = getStorageLimitBytes();

    if (bytes > limit) {
      throw new Error("이 슬롯 하나가 전체 저장공간 한도를 넘습니다.");
    }

    const slot: PBSlot = {
      id: input.id,
      text: input.text,
      file,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
      bytes,
      revision: (previous?.revision ?? 0) + 1,
    };

    if (previous?.file && previous.file.pathname !== file?.pathname) {
      cleanupPaths.add(previous.file.pathname);
    }

    const previousBytes = previous?.bytes ?? 0;
    const usageBefore = (await redis.get<number>(USAGE_KEY)) ?? 0;
    let usage = Math.max(0, usageBefore - previousBytes + bytes);

    const orderScore = await redis.incr(ORDER_SEQUENCE_KEY);
    const writeTransaction = redis.multi();
    writeTransaction.set(slotKey(input.id), slot);
    writeTransaction.zadd(ORDER_KEY, {
      score: orderScore,
      member: String(input.id),
    });
    writeTransaction.set(USAGE_KEY, usage);
    if (authorized.consumePath) {
      writeTransaction.del(pendingKey(authorized.consumePath));
      writeTransaction.zrem(PENDING_ORDER_KEY, authorized.consumePath);
    }
    await writeTransaction.exec();

    const evictedIds: number[] = [];

    while (usage > limit) {
      const oldest = await redis.zrange<string>(ORDER_KEY, 0, 0);
      const member = oldest[0];
      if (member === undefined) break;

      const victimId = Number(member);
      if (!Number.isInteger(victimId)) {
        await redis.zrem(ORDER_KEY, member);
        continue;
      }

      if (victimId === input.id) {
        throw new Error("저장공간 한도를 만족하도록 슬롯을 정리할 수 없습니다.");
      }

      const victim = await redis.get<PBSlot>(slotKey(victimId));
      const removeTransaction = redis.multi();
      removeTransaction.del(slotKey(victimId));
      removeTransaction.zrem(ORDER_KEY, member);
      await removeTransaction.exec();

      if (!victim) continue;
      usage = Math.max(0, usage - victim.bytes);
      evictedIds.push(victimId);
      if (victim.file) cleanupPaths.add(victim.file.pathname);
    }

    await redis.set(USAGE_KEY, usage);

    if (authorized.consumePath) cleanupPaths.delete(authorized.consumePath);

    return {
      slot,
      evictedIds,
      cleanupPaths: [...cleanupPaths],
    };
  } finally {
    await releaseWriteLock(token);
  }
}

export async function clearSlot(id: number): Promise<ClearResult> {
  const token = await acquireWriteLock();
  const cleanupPaths = new Set<string>();

  try {
    const redis = getRedis();
    const previous = await redis.get<PBSlot>(slotKey(id));

    if (!previous) {
      await redis.zrem(ORDER_KEY, String(id));
      return { cleared: false, cleanupPaths: [...cleanupPaths] };
    }

    const usageBefore = (await redis.get<number>(USAGE_KEY)) ?? 0;
    const transaction = redis.multi();
    transaction.del(slotKey(id));
    transaction.zrem(ORDER_KEY, String(id));
    transaction.set(USAGE_KEY, Math.max(0, usageBefore - previous.bytes));
    await transaction.exec();

    if (previous.file) cleanupPaths.add(previous.file.pathname);
    return { cleared: true, cleanupPaths: [...cleanupPaths] };
  } finally {
    await releaseWriteLock(token);
  }
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
    await sleep(30 + attempt * 14 + Math.floor(Math.random() * 20));
  }

  throw new Error("저장 요청이 몰렸습니다. 잠시 후 다시 시도해 주세요.");
}

async function releaseWriteLock(token: string): Promise<void> {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    end
    return 0
  `;

  await getRedis().eval<number>(script, [WRITE_LOCK_KEY], [token]);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
