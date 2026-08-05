export type OrderedSlot = {
  id: number;
  updatedAt: number;
  bytes: number;
};

export function selectEvictionVictims(
  slots: OrderedSlot[],
  usageBytes: number,
  limitBytes: number,
  protectedId: number,
): { victimIds: number[]; remainingBytes: number } {
  let remainingBytes = usageBytes;
  const victimIds: number[] = [];

  const candidates = [...slots]
    .filter((slot) => slot.id !== protectedId)
    .sort((a, b) => a.updatedAt - b.updatedAt || a.id - b.id);

  for (const candidate of candidates) {
    if (remainingBytes <= limitBytes) break;
    remainingBytes = Math.max(0, remainingBytes - candidate.bytes);
    victimIds.push(candidate.id);
  }

  return { victimIds, remainingBytes };
}
