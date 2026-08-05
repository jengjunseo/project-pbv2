import { getRedis } from "@/lib/redis";

export type RateLimitKind = "write" | "upload";

export async function checkRateLimit(
  request: Request,
  kind: RateLimitKind,
  limit: number,
): Promise<boolean> {
  const ip = getClientIp(request);
  const minute = Math.floor(Date.now() / 60_000);
  const key = `pb:v3:rate:${kind}:${ip}:${minute}`;
  const redis = getRedis();

  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 75);
  return count <= limit;
}

function getClientIp(request: Request): string {
  const candidates = [
    request.headers.get("x-vercel-forwarded-for"),
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-real-ip"),
  ];

  for (const candidate of candidates) {
    const ip = candidate?.split(",")[0]?.trim();
    if (ip) return ip.slice(0, 96);
  }

  return "unknown";
}
