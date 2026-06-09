# Project PB v2

Project PB v2 is a temporary transfer app. Users open one of the numbers from 0 to 99, save text and an optional small file, then open the same number from another device within 10 minutes.

PB is intentionally small. It is not a login product, cloud drive, chat app, or secure vault.

## Features
- 0-99 slot based transfer.
- Text payload up to 10,000 characters.
- Optional file upload up to 5MB.
- 10 minute Redis TTL.
- Countdown and expired UI.
- Explicit clear action.
- Dangerous file extensions blocked.
- Sanitized Blob paths.

## Tech Stack
- Next.js App Router
- TypeScript
- Tailwind CSS
- Upstash Redis
- Vercel Blob
- Zod
- nanoid
- ESLint
- Vitest

## Local Setup
Install dependencies:

```bash
npm install
```

Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

Fill these values:

```env
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
BLOB_READ_WRITE_TOKEN=
NEXT_PUBLIC_APP_NAME=PB
```

Run locally:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Scripts
```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

`lint` uses `eslint .` because current Next.js releases no longer rely on the older `next lint` command as the primary lint entrypoint.

## Vercel Deployment
1. Import `jengjunseo/project-pbv2` into Vercel.
2. Connect an Upstash Redis database.
3. Connect a Vercel Blob store.
4. Add the environment variables from `.env.example` to the Vercel project.
5. Deploy.

Recommended Vercel settings:
- Framework Preset: `Next.js`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: leave the Vercel default

After changing environment variables in Vercel, redeploy the latest deployment so serverless functions receive the new values.

## Environment Variables
Set these in Vercel Project Settings -> Environment Variables for Production, Preview, and Development as needed:

| Name | Required | Source |
| --- | --- | --- |
| `UPSTASH_REDIS_REST_URL` | Yes for Redis, preferred | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Yes for Redis, preferred | Upstash Redis REST token |
| `KV_REST_API_URL` | Redis fallback | Vercel KV REST URL |
| `KV_REST_API_TOKEN` | Redis fallback | Vercel KV write token |
| `BLOB_READ_WRITE_TOKEN` | Yes for file upload | Vercel Blob store token |
| `NEXT_PUBLIC_APP_NAME` | No | Optional display name |

Do not expose `UPSTASH_REDIS_REST_TOKEN`, `KV_REST_API_TOKEN`, or `BLOB_READ_WRITE_TOKEN` in client-side code. Only `NEXT_PUBLIC_*` variables are safe for browser exposure. Do not use `KV_REST_API_READ_ONLY_TOKEN` for PB because saving and clearing slots require write access.

## Upstash Redis
Create an Upstash Redis database and copy:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

When using Vercel KV/Redis integration, the app also accepts:
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

The app prefers the `UPSTASH_*` names when both naming schemes exist.

The app stores each slot at:

```txt
pb:slot:{id}
```

Every save uses a 600 second TTL.

## Vercel Blob
Create a Blob store and set:

```env
BLOB_READ_WRITE_TOKEN=
```

Browser uploads use `/api/upload` and Vercel Blob client upload tokens. Blob paths use:

```txt
pb/slot-{id}/{random}-{sanitized-original-name}
```

## Expiration Policy
Redis TTL is the source of truth. When Redis expires, users see an empty slot. Blob cleanup is attempted when the user clears a slot, but the product does not require background cron cleanup.

## Deployment Troubleshooting
- `Redis environment variables are not configured.`: add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, or use the Vercel KV names `KV_REST_API_URL` and `KV_REST_API_TOKEN`, then redeploy.
- Blob upload returns `BLOB_ERROR`: confirm `BLOB_READ_WRITE_TOKEN` is set for the active Vercel environment and the Blob store is connected to the project. `BLOB_WEBHOOK_PUBLIC_KEY` and `BLOB_STORE_ID` are not enough for client uploads.
- Save succeeds but a file link is missing: check that the browser upload completed before `/api/slot` save and that file metadata is present in the POST body.
- Slot is empty sooner than expected: Redis TTL is 600 seconds from the last successful save; saving again resets the 10 minute window.
- Build fails on Vercel but works locally: compare the Node/npm versions and run `npm run typecheck`, `npm run test`, and `npm run build` locally before redeploying.

## File Limits
Maximum file size is 5MB.

Allowed MIME types:
- `image/png`
- `image/jpeg`
- `image/webp`
- `application/pdf`
- `text/plain`
- `text/markdown`
- `application/json`
- `application/zip`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- `application/vnd.openxmlformats-officedocument.presentationml.presentation`
- `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

`.ipynb` is allowed by extension.

Blocked extensions:
- `exe`
- `bat`
- `cmd`
- `sh`
- `ps1`
- `apk`
- `dmg`
- `msi`
- `jar`
- `js`
- `vbs`
- `scr`

## Security Boundaries
PB prioritizes fast temporary transfer, not strong secrecy. Users should not upload sensitive personal data, credentials, private documents, or dangerous files.

Implemented safeguards:
- No accounts or user profiles.
- Slot id validation.
- 10 minute Redis TTL.
- File size limit.
- MIME allowlist.
- Blocked executable/script extensions.
- Sanitized Blob paths.

## QA
Manual QA lives in `.ai/QA_CHECKLIST.md`.
