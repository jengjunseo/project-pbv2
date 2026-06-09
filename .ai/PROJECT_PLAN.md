# Project PB v2 Plan

## Goal
Project PB v2 is a tiny temporary transfer app for sharing text and small files through slot numbers 0-99. A slot stays available for 10 minutes, then becomes inaccessible through the app.

## MVP Scope
- Home page with slot number entry.
- Slot page with text editor, optional file upload, countdown, save, refresh, and clear actions.
- App Router API for reading, saving, and deleting slots.
- Vercel Blob client upload token route.
- Upstash Redis storage with a 600 second TTL.
- Validation for slot ids, text length, file size, MIME type, and blocked extensions.

## Phases
1. Documentation system and project context.
2. Base Next.js UI and routing.
3. Redis-backed text slots.
4. 10 minute expiration UX.
5. Vercel Blob file upload and file metadata.
6. QA, README, and final verification.

## Excluded Features
- Login or accounts.
- Long-term storage.
- Encryption or complex access control.
- Chat, boards, history, comments, or notifications.
- Forced background cron cleanup.

## Vercel Deployment
The app is designed for Vercel to avoid cold-start friction from the previous Render deployment. Environment variables are provided through Vercel project settings.

## Redis and Blob Separation
- Redis stores slot JSON and enforces the 600 second TTL.
- Blob stores file objects.
- Redis expiration is the user-facing access boundary. If Redis data expires, the UI treats the slot as empty even if the Blob object still exists.
