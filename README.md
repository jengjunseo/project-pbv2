# Project PB v3

PBV3 is a tiny, login-free transfer pocket. Open a number from **0 to 99**, put text and optionally one small file into it, then open the same number on another device.

The product is deliberately narrow: **no accounts, no timers, no chat, no history, no cloud-drive complexity.**

## What changed from PBV2

PBV2 treated every slot as a 10-minute temporary item. PBV3 removes the TTL entirely.

- Slots persist indefinitely by default.
- Saving a slot makes it the newest slot.
- When the configured soft storage limit is exceeded, PBV3 evicts the **oldest-updated slots first**.
- Reading a slot never updates timestamps. The hot read path is one Redis `GET`.
- Files upload directly from the browser to Vercel Blob.
- The slot page is server-rendered from Redis for a fast first paint, then becomes interactive.

## Performance model

### Read path
1. Request `/slot/17`.
2. Next.js 16 reads `pb:v3:slot:17` from Upstash Redis once.
3. The page renders with that data.
4. File downloads go directly through Vercel Blob CDN.

There is no TTL check, cleanup pass, list scan, or read-side write.

### Write path
1. Optional file uploads browser -> Blob.
2. Slot metadata/text is saved to Redis.
3. Usage and recency metadata are updated.
4. If the soft cap is exceeded, oldest-updated slots are removed until usage is under the cap.
5. Replaced/evicted Blob objects are deleted best-effort after Redis commits.

Writes are allowed to do more work so reads stay extremely cheap.

## Latency-first deployment

`vercel.json` pins server functions to Vercel Tokyo (`hnd1`). Create the Upstash Redis primary in AWS Tokyo (`ap-northeast-1`) so the one Redis request on the read path stays close to the function. Static assets are still served through Vercel's nearby CDN points of presence.

If you choose a different Redis region, change `vercel.json` to the matching Vercel compute region. Do not leave the project at Vercel's default function region when the database is in Asia.

## Storage model

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

`PB_STORAGE_LIMIT_BYTES` is a **soft logical cap**, not the provider hard quota. Set it below the real Blob/Redis quota so direct uploads retain headroom before eviction runs.

## Defaults
- Slot range: `0-99`
- Text: up to `30,000` characters
- File: up to `10 MiB`
- Storage soft cap: `512 MiB`
- Retention: no TTL
- Eviction: oldest `updatedAt` first

## Environment

```env
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
BLOB_READ_WRITE_TOKEN=
NEXT_PUBLIC_APP_NAME=PB
PB_STORAGE_LIMIT_BYTES=536870912
PB_MAX_FILE_BYTES=10485760
```

Older Vercel KV names are accepted as Redis fallback:

```env
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

## Runtime

- Next.js `16.2.11` (Active LTS security release)
- React `19.2`
- Node.js `22` in CI

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

PB slots are public-by-number and are **not a secure vault**. Anyone who knows or guesses a slot number can read, overwrite, or clear it. Do not use PB for passwords, credentials, identity documents, or other sensitive material.

Executable and active-content file types are blocked. File size, Blob host, and path metadata are revalidated on the server.
