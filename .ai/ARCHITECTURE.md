# PBV3 Architecture

## Purpose

PBV3 is a public 100-slot transfer pocket. Persistence is indefinite. Capacity pressure is handled by write-side eviction instead of TTL.

## Hot read path

`/slot/[id]` is a dynamic Server Component and calls `readSlot(id)` directly. `readSlot` performs exactly one Redis `GET`.

Never add these to a read:

- last-viewed writes
- TTL refresh
- quota calculation
- pending-upload cleanup
- sorted-set mutation
- analytics mutation

## Write consistency

There are only 100 slots, so a short coarse Redis lock is intentionally simpler than a distributed transaction protocol. It protects logical usage accounting and ordered eviction. Lock release uses compare-and-delete Lua so an expired lock cannot delete a newer owner's lock.

Saving increments a monotonic sequence and performs `ZADD(score=sequence)`; wall-clock timestamps remain display metadata only. If logical usage exceeds the soft cap, the lowest-scored slot is removed until usage is below the cap.

## Why updated-at instead of last-read

Last-read eviction would turn every read into a write and directly damage the primary performance goal. PBV3 evicts the least recently **saved**, not the least recently viewed.

## Upload lifecycle

1. `/api/upload` validates slot, file name, type, size, and path.
2. The route records a short-lived pending authorization and issues a Blob client-upload token.
3. Browser uploads directly to Blob.
4. Blob's completion callback records the actual URL/path metadata.
5. Slot save consumes that pending record. If the callback is still racing, save briefly retries and can verify the Blob with `head()`.
6. Pending entries older than the grace period are swept during writes and their paths are deleted best-effort after the response.

No cron is required. Normal write traffic amortizes cleanup.

## Blob cleanup

Redis is authoritative for what is visible. Replaced, cleared, evicted, and abandoned Blob paths are returned as cleanup work and scheduled with Next.js `after()`, so the user-facing response does not wait for deletion.
