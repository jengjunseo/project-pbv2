# API

All API errors use:

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_SLOT_ID",
    "message": "Slot id must be an integer between 0 and 99."
  }
}
```

## GET `/api/slot?id=17`
Reads `pb:slot:17` from Redis.

Empty response:

```json
{
  "ok": true,
  "empty": true,
  "slot": null,
  "remainingSeconds": 0
}
```

Stored response includes `slot` and `remainingSeconds`.

## POST `/api/slot`
Saves text and optional file metadata.

Body:

```json
{
  "id": 17,
  "text": "hello",
  "file": null
}
```

Rules:
- id must be 0-99.
- text must be 10,000 characters or fewer.
- request must include text or a file.
- Redis TTL is set to 600 seconds.

## DELETE `/api/slot?id=17`
Deletes Redis data and attempts Blob cleanup when a file exists. Redis deletion succeeds even if Blob cleanup fails.

## POST `/api/upload`
Uses Vercel Blob `handleUpload` for browser-to-Blob uploads. It validates slot id, file type, file size, and path before generating an upload token.
