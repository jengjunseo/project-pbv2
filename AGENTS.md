# PBV3 Agent Guide

PBV3 is intentionally narrow. Preserve the product's one-job clarity and keep the read path fast.

## Non-negotiable product invariants

- Slots are public and addressed only by numbers `0-99`.
- Slot data has no TTL. It remains until overwritten, manually cleared, or evicted under storage pressure.
- A slot read is exactly one Redis `GET`. Never add last-read timestamps, TTL refreshes, analytics writes, list scans, or cleanup to reads.
- Eviction runs only after writes and removes the oldest **updated** slot first.
- Files upload browser -> Vercel Blob. Never proxy file bytes through a Next.js Function.
- Redis stores text, file metadata, ordering, logical usage, pending-upload records, and rate limits. Blob stores bytes.
- No account system, chat, history, comments, notifications, or cron unless product scope explicitly changes.

## Quality gates

Run all of these before shipping:

```bash
npm run typecheck
npm run test
npm run lint
npm run build
```

## Change discipline

Prefer explicit code over framework expansion. Do not add an ORM, global state library, component system, or background service unless the existing direct approach cannot satisfy a measured requirement.
