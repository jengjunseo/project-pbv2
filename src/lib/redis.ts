import { Redis } from "@upstash/redis";

let redisClient: Redis | null = null;

type RedisEnv = {
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  KV_REST_API_URL?: string;
  KV_REST_API_TOKEN?: string;
} & Record<string, string | undefined>;

export function getRedis(): Redis {
  if (redisClient) {
    return redisClient;
  }

  const { url, token } = resolveRedisConfig(process.env);

  if (!url || !token) {
    throw new Error(
      "Redis environment variables are not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, or set KV_REST_API_URL and KV_REST_API_TOKEN. Do not use KV_REST_API_READ_ONLY_TOKEN because PB needs write access.",
    );
  }

  redisClient = new Redis({ url, token });
  return redisClient;
}

export function resolveRedisConfig(env: RedisEnv): {
  url?: string;
  token?: string;
} {
  return {
    url: env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN,
  };
}

export function slotKey(id: number): string {
  return `pb:slot:${id}`;
}
