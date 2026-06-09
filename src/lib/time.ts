export const SLOT_TTL_SECONDS = 600;
export const SLOT_TTL_MS = SLOT_TTL_SECONDS * 1000;

export function nowMs(): number {
  return Date.now();
}

export function expiresAtFrom(now: number): number {
  return now + SLOT_TTL_MS;
}

export function remainingSeconds(expiresAt: number, now = nowMs()): number {
  return Math.max(0, Math.ceil((expiresAt - now) / 1000));
}

export function formatRemaining(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const rest = safeSeconds % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}
