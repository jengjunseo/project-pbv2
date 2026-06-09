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
2. Add the environment variables from `.env.example`.
3. Connect an Upstash Redis database.
4. Connect a Vercel Blob store.
5. Deploy.

## Upstash Redis
Create an Upstash Redis database and copy:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

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
