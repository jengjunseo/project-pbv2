# PBV3 QA Checklist

## Core flow

- [ ] Home accepts `0` and `99`; rejects `100`, negative values, decimals, and letters.
- [ ] Empty slot renders immediately and saves text.
- [ ] Reloading preserves data indefinitely; no TTL is created on a slot key.
- [ ] Another browser/device can open the same slot.
- [ ] Focus refresh does not overwrite unsaved local edits.
- [ ] Ctrl/Cmd+S saves.

## Files

- [ ] File uploads go directly browser -> Blob.
- [ ] File above configured size is rejected before upload and on the server.
- [ ] Blocked active-content extensions are rejected.
- [ ] A new Blob path cannot be attached to another slot.
- [ ] Replacing/removing/clearing a file deletes the old Blob best-effort after response.
- [ ] Abandoned pending uploads are swept on later writes.

## Capacity

- [ ] Saving updates `pb:v3:usage` and `pb:v3:order`.
- [ ] Soft-cap pressure evicts oldest-updated slots first.
- [ ] The just-saved slot is never selected as an eviction victim.
- [ ] A single payload larger than the soft cap is rejected.

## UX

- [ ] Copy text and share-link fallbacks show useful feedback.
- [ ] Desktop side panel and mobile sticky save bar work.
- [ ] Destructive clear asks for confirmation.
- [ ] Public-slot security warning remains visible.

## Gates

- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run lint`
- [ ] `npm run build`
