# PBV3 Architecture

## Core idea
PBV3 is a public 100-slot transfer pocket. Persistence is indefinite. Capacity pressure is handled by write-side eviction instead of TTL.

## Hot path
`/slot/[id]` is a dynamic Server Component and calls `readSlot(id)` directly. `readSlot` performs exactly one Redis `GET`. Do not add read-side analytics, last-seen updates, TTL refreshes, or cleanup scans.

## Write consistency
Writes use a short coarse Redis lock because there are only 100 slots and write throughput is not the bottleneck. This keeps usage accounting and eviction simple. Saving updates a sorted-set score. Eviction takes the oldest member until logical usage is under the configured soft cap.

## Why updated-at instead of last-read
Updating last-read would turn every read into a write and directly damage the primary performance goal. PBV3 therefore evicts the least recently **saved**, not least recently viewed.

## Blob lifecycle
New files upload directly to Blob. Successful slot replacement schedules deletion of the old Blob pathname. Failed client saves call the upload cleanup endpoint for the newly uploaded orphan. Eviction and clear operations also delete referenced Blob objects best-effort.

Redis remains authoritative for what is visible in the app.

## Region placement
The repository pins Vercel Functions to `hnd1` because Upstash's closest supported AWS Redis region for Korea is Tokyo (`ap-northeast-1`). Keep compute and Redis colocated; changing one without the other damages the latency target.

## Attachment authenticity
Client upload tokens validate slot/path/type/size before upload. The slot save endpoint additionally calls Blob `head()` and compares URL, pathname, and size, preventing fabricated attachment metadata from being committed. This extra operation is write-only and does not affect reads.
