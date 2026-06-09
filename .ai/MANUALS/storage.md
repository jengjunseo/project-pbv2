# Storage

## Redis
- Key format: `pb:slot:{id}`.
- TTL: 600 seconds.
- Value: serialized `PBSlot` JSON.

## Blob
- Path format: `pb/slot-{id}/{random}-{sanitized-original-name}`.
- File names are sanitized before becoming path segments.
- Blob metadata is stored in Redis as `PBFileMeta`.

## Limits
- Maximum file size: 5MB.
- Dangerous extensions are blocked.
- `.ipynb` is allowed by extension.

## Expiration Handling
Redis expiration is the primary access control. Once Redis data is gone, the slot is empty from the user's perspective. Physical Blob deletion is best-effort on explicit clear.
