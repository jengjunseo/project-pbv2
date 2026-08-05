# Project PB v3

PBV3 is a tiny, login-free transfer pocket. Open a number from **0 to 99**, put text and optionally one small file into it, then open the same number on another device.

The product stays deliberately narrow: **no accounts, no timer, no chat, no history, no cloud-drive complexity.**

## PBV3 product contract

- Slots persist indefinitely by default.
- Saving a slot makes it the newest slot.
- When the configured soft storage cap is exceeded, PBV3 removes the **oldest-updated slots first**.
- Reading a slot never updates metadata. The hot path is one Redis `GET`.
- Files upload directly from the browser to Vercel Blob.
- The slot page is server-rendered from Redis for a fast first paint, then becomes an interactive editor.

## Performance model

### Read path

1. Request `/slot/17`.
2. Next.js reads `pb:v3:slot:17` from Upstash Redis once.
3. The server renders the slot immediately.
4. File downloads go directly through Vercel Blob.

No TTL check, cleanup pass, recency write, or list scan occurs on reads.

### Write path

1. An optional file uploads browser -> Vercel Blob using a short-lived server-issued token.
2. PBV3 verifies that the upload belongs to the selected slot.
3. Slot text and file metadata are saved to Redis.
4. Logical usage and recency metadata are updated.
5. If the soft cap is exceeded, oldest-updated slots are evicted until usage is below the cap.
6. Replaced, evicted, or abandoned Blob objects are deleted after the response when possible.

Writes intentionally do more work so reads stay extremely cheap.

## Redis model

```text
pb:v3:slot:{0..99}       slot JSON
pb:v3:order              sorted set; score = monotonic write sequence
pb:v3:order-sequence     monotonic write counter
pb:v3:usage              logical bytes currently stored
pb:v3:write-lock         short consistency lock
pb:v3:pending:{pathname} short-lived upload authorization
pb:v3:pending-order      sorted set for abandoned-upload cleanup
pb:v3:rate:*             short-lived write rate limits
```

Blob paths:

```text
pb-v3/slot-{id}/{random}-{sanitized-name}
```

`PB_STORAGE_LIMIT_BYTES` is a **soft logical cap**, not the provider's hard quota. Keep it below the provider limit so a direct upload can finish before write-side eviction runs.

## Defaults

- Slot range: `0-99`
- Text: up to `30,000` characters
- File: up to `10 MiB`
- Storage soft cap: `512 MiB`
- Retention: no TTL
- Eviction: oldest `updatedAt` first
- Save/clear rate: 30 requests per minute per IP
- Upload-token rate: 12 requests per minute per IP

## Environment

```env
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
BLOB_READ_WRITE_TOKEN=
NEXT_PUBLIC_APP_NAME=PB
PB_STORAGE_LIMIT_BYTES=536870912
PB_MAX_FILE_BYTES=10485760
PB_WRITE_RATE_LIMIT_PER_MINUTE=30
PB_UPLOAD_RATE_LIMIT_PER_MINUTE=12
```

The app accepts older Vercel KV variable names as a Redis fallback:

```env
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

Deploy the Vercel Function and Upstash Redis database in Seoul for the intended latency profile. `vercel.json` pins Functions to `icn1`.

## Local development

```bash
npm install
npm run dev
```

Vercel Blob's upload-completion callback cannot reach plain localhost. Use a public tunnel and set `VERCEL_BLOB_CALLBACK_URL`, or verify the complete file lifecycle in a Preview deployment.

Quality gates:

```bash
npm run typecheck
npm run test
npm run lint
npm run build
```

## Security boundary

PB slots are public-by-number and are **not a secure vault**. Anyone who knows or guesses a slot number can read, overwrite, or clear it. Do not use PB for passwords, credentials, identity documents, or sensitive personal material.

Executable and active-content file types are blocked. File metadata, path ownership, maximum size, and upload authorization are revalidated on the server.
