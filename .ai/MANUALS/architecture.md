# Architecture

Project PB v2 uses Next.js App Router on Vercel, Upstash Redis for temporary slot state, and Vercel Blob for file objects.

## Request Flow
1. User opens `/` and enters a number from 0 to 99.
2. User lands on `/slot/{id}`.
3. The slot page calls `/api/slot?id={id}`.
4. Redis returns the slot JSON or no value.
5. The UI shows text, file metadata, and the remaining time.

## Storage Roles
- Redis owns slot JSON and TTL.
- Blob owns file bytes.
- Redis key format is `pb:slot:{id}`.
- Redis TTL is always 600 seconds after save.

## Expiration
If Redis expires, the slot is shown as empty. The app does not rely on cron cleanup. Blob cleanup is attempted during explicit delete, but user access is controlled by Redis state.
