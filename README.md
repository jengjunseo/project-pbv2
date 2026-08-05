# Project PB v3

PBV3 is a tiny, login-free transfer pocket. Open a number from **0 to 99**, put text and optionally one small file into it, then open the same number on another device.

The product is deliberately narrow: **no accounts, no timers, no chat, no history, no cloud-drive complexity.**

## What changed from PBV2

PBV2 treated every slot as a 10-minute temporary item. PBV3 removes the TTL entirely.

- Slots persist indefinitely by default.
- Saving a slot makes it the newest slot.
- When the configured soft storage limit is exceeded, PBV3 evicts the **oldest-updated slots first**.
- Reading a slot never updates timestamps. This keeps the hot read path to one Redis `GET`.
- Files upload directly from the browser to Vercel Blob.
- The slot page is server-rendered from Redis for a fast first paint, then becomes an interactive editor in the browser.

## Performance model

**Read path**
1. Request `/slot/17`.
2. Next.js reads `pb:v3:slot:17` from Upstash Redis once.
3. The page renders with that data.
4. File downloads go directly through Vercel Blob CDN.

There is no TTL check, no cleanup pass, no list scan, and no read-side write.

**Write path**
1. Optional file uploads browser -> Blob.
2. Slot metadata/text is saved to Redis.
3. Usage + recency metadata is updated.
4. If the soft cap is exceeded, oldest-updated slots are removed until usage is under the cap.
5. Replaced/evicted Blob objects are deleted best-effort after the Redis commit.

Writes are allowed to do more work so reads stay extremely cheap.

## Storage model

Redis keys:

```text
pb:v3:slot:{0..99}    slot JSON
pb:v3:order           sorted set; score = updatedAt
pb:v3:usage           logical bytes currently stored
pb:v3:write-lock      short write-side consistency lock
```

Blob paths:

```text
pb-v3/slot-{id}/{random}-{sanitized-name}
```

`PB_STORAGE_LIMIT_BYTES` is a **soft logical cap**, not the provider's hard quota. Set it below your real Blob/Redis plan limit (for example 70-80%) so direct uploads still have headroom before eviction runs.

## Defaults

- Slot range: `0-99`
- Text: up to `30,000` characters
- File: up to `10 MiB` by default
- Storage soft cap: `512 MiB` by default
- Retention: no TTL
- Eviction: oldest `updatedAt` first

Both file and storage limits can be changed with environment variables.

## Environment

```env
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
BLOB_READ_WRITE_TOKEN=
NEXT_PUBLIC_APP_NAME=PB
PB_STORAGE_LIMIT_BYTES=536870912
PB_MAX_FILE_BYTES=10485760
```

The app also accepts the older Vercel KV variable names as a Redis fallback:

```env
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

## Local development

```bash
npm install
npm run dev
```

Quality gates:

```bash
npm run typecheck
npm run test
npm run lint
npm run build
```

## Security boundary

PB slots are public-by-number and are **not a secure vault**. Anyone who knows or guesses a slot number can read, overwrite, or clear it. Do not use PB for passwords, credentials, private identity documents, or other sensitive material.

Executable and active-content file types are blocked. File size and path metadata are revalidated on the server before Blob upload tokens are issued.
