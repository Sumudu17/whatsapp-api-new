# WhatsApp HTTP API (external integrations)

This document describes these endpoints:

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/whatsapp/status` | Check if the WhatsApp client is ready (API key) |
| `POST` | `/api/whatsapp/send` | Send a text or media message (**API key** — `userId` + `apiKey` + XOR `phoneNumber` / `groupId`) |
| `POST` | `/api/whatsapp/messages` | Fetch latest messages from a direct or group chat (API key) |

- **Base URL:** e.g. `https://your-domain.example` or `http://localhost:4000`
- **Headers:** `Content-Type: application/json`
- **API key calls:** send `userId` and `apiKey` in the JSON body (see below).

If `API_AUTH_REQUIRED=true` in `.env`, session-less access to `/api/*` is restricted except for API-key routes (including these three); see `src/app.ts` for the allowlist.

This document shows **API key** request/response examples only. (The app also supports session-based send from the browser for the web UI; that is not documented here.)

---

## `POST /api/whatsapp/status`

Checks the in-memory WhatsApp client state for the given user after validating the API key.

### Request body

```json
{
  "userId": 1,
  "apiKey": "RAW_API_KEY_VALUE"
}
```

### Success response (HTTP 200)

```json
{
  "success": true,
  "statusCode": 200,
  "clientStatus": "READY",
  "message": "Client is ready"
}
```

`clientStatus` may be: `READY`, `NOT_INITIALIZED`, `INITIALIZING`, `QR_REQUIRED`, `AUTHENTICATED`, `DISCONNECTED`.

### Invalid API key (HTTP 401)

```json
{
  "success": false,
  "statusCode": 401,
  "clientStatus": "INVALID_API_KEY",
  "message": "API key is not valid"
}
```

### cURL

```bash
curl -X POST "https://your-domain.example/api/whatsapp/status" \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"apiKey":"RAW_API_KEY_VALUE"}'
```

### Deprecated alias

`POST /api/whatsapp/status-api-key` — same body and behavior as `POST /api/whatsapp/status`.

---

## `POST /api/whatsapp/send`

Sends a WhatsApp text or media message using **API key** authentication.

**Rules:**

- Exactly one of `phoneNumber` (E.164) or `groupId` (ends with `@g.us`).
- Always required: `userId`, `apiKey`.
- Text-only: `message` is required when `mediaUrl` is not provided.
- Media: `mediaUrl` must be `http/https`; optional `caption`; optional `sendMediaAsDocument` (default `false`).
- Caption resolution for media: `finalCaption = caption || message || ""`.

**Request — direct**

```json
{
  "userId": 1,
  "apiKey": "RAW_API_KEY_VALUE",
  "phoneNumber": "+94717177326",
  "message": "Hello from API (direct number)"
}
```

**Request — group**

```json
{
  "userId": 1,
  "apiKey": "RAW_API_KEY_VALUE",
  "groupId": "1234567890-123456789@g.us",
  "message": "Hello from API (group message)"
}
```

**Request — direct media (image)**

```json
{
  "userId": 1,
  "apiKey": "RAW_API_KEY_VALUE",
  "phoneNumber": "+94717177326",
  "mediaUrl": "https://example.com/image.jpg",
  "caption": "This is my image caption",
  "sendMediaAsDocument": false
}
```

**Request — group media (image)**

```json
{
  "userId": 1,
  "apiKey": "RAW_API_KEY_VALUE",
  "groupId": "1234567890-123456789@g.us",
  "mediaUrl": "https://example.com/image.jpg",
  "caption": "This is group image caption",
  "sendMediaAsDocument": false
}
```

**Request — direct document (PDF)**

```json
{
  "userId": 1,
  "apiKey": "RAW_API_KEY_VALUE",
  "phoneNumber": "+94717177326",
  "mediaUrl": "https://example.com/report.pdf",
  "caption": "Please check this document",
  "sendMediaAsDocument": true
}
```

**Request — group file (ZIP)**

```json
{
  "userId": 1,
  "apiKey": "RAW_API_KEY_VALUE",
  "groupId": "1234567890-123456789@g.us",
  "mediaUrl": "https://example.com/files.zip",
  "caption": "Please check this ZIP file",
  "sendMediaAsDocument": true
}
```

**Success response — text**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Message sent successfully",
  "data": {
    "chatType": "group",
    "chatId": "1234567890-123456789@g.us",
    "messageType": "text",
    "message": "Hello from API (group message)",
    "messageId": "true_..._..."
  },
  "messageId": "true_..._...",
  "raw": {
    "...": "whatsapp-web.js message object"
  },
  "clientStatus": "READY"
}
```

**Success response — media**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Media message sent successfully",
  "data": {
    "chatType": "direct",
    "chatId": "94717177326@c.us",
    "messageType": "media",
    "mediaUrl": "https://example.com/image.jpg",
    "caption": "This is my image caption",
    "sendMediaAsDocument": false,
    "messageId": "true_..._..."
  },
  "messageId": "true_..._...",
  "raw": {
    "...": "whatsapp-web.js message object"
  },
  "clientStatus": "READY"
}
```

If the client is not ready, the server may respond with an error (e.g. HTTP 503) and details from the global error handler.

**Error response — media download failed (HTTP 400)**

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Failed to download media from URL",
  "details": {
    "mediaUrl": "https://example.com/image.jpg",
    "message": "Unable to download media"
  }
}
```

### cURL

```bash
curl -X POST "https://your-domain.example/api/whatsapp/send" \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"apiKey":"RAW_API_KEY_VALUE","phoneNumber":"+94717177326","message":"Hello external"}'
```

**Group example:**

```bash
curl -X POST "https://your-domain.example/api/whatsapp/send" \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"apiKey":"RAW_API_KEY_VALUE","groupId":"1234567890-123456789@g.us","message":"Hello group"}'
```

**Media (image) example:**

```bash
curl -X POST "https://your-domain.example/api/whatsapp/send" \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"apiKey":"RAW_API_KEY_VALUE","phoneNumber":"+94717177326","mediaUrl":"https://example.com/image.jpg","caption":"Hello image","sendMediaAsDocument":false}'
```

**Document (PDF) example:**

```bash
curl -X POST "https://your-domain.example/api/whatsapp/send" \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"apiKey":"RAW_API_KEY_VALUE","groupId":"1234567890-123456789@g.us","mediaUrl":"https://example.com/report.pdf","caption":"Please review","sendMediaAsDocument":true}'
```

### Deprecated alias

`POST /api/whatsapp/send-api-key` — same body and behavior as API-key `POST /api/whatsapp/send`.

---

## `POST /api/whatsapp/messages`

Fetches the latest messages for a chat. **API key only.**

**Rules:**

- Exactly one of `phoneNumber` (E.164) or `groupId` (ends with `@g.us`).
- Optional `limit`: integer, default **20**, max **100**.

The server ensures the client is `READY` before loading messages. If not ready, you get HTTP **503** with a JSON body including `success`, `statusCode`, `clientStatus`, and `message`.

### Request — direct chat

```json
{
  "userId": 1,
  "apiKey": "RAW_API_KEY_VALUE",
  "phoneNumber": "+94717177326",
  "limit": 20
}
```

### Request — group chat

```json
{
  "userId": 1,
  "apiKey": "RAW_API_KEY_VALUE",
  "groupId": "1234567890-123456789@g.us",
  "limit": 20
}
```

### Success response (HTTP 200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Messages loaded successfully",
  "chatType": "group",
  "chatId": "1234567890-123456789@g.us",
  "requestedLimit": 20,
  "loadedCount": 1,
  "messages": [
    {
      "recordNo": 1,
      "messageId": "false_1234567890-123456789@g.us_EXAMPLEHASH_111111111111111@lid",
      "chatId": "1234567890-123456789@g.us",
      "body": "Hello from API (example)",
      "type": "chat",
      "timestamp": 1712345678,
      "dateTime": "2026-04-03 10:30:00",
      "fromMe": false,
      "hasMedia": false,
      "ack": 1,
      "deviceType": "android",
      "isForwarded": false,
      "forwardingScore": 0,
      "isStatus": false,
      "sender": {
        "id": "111111111111111@lid",
        "pushname": "Example display name",
        "number": "94700000000"
      }
    }
  ]
}
```

### Message object fields

| Field | Meaning |
|-------|---------|
| `recordNo` | Serial index in this response (1-based) |
| `messageId` | Unique message id from WhatsApp Web (`true_` / `false_` prefix = outgoing / incoming) |
| `chatId` | Chat id this message belongs to |
| `body` | Text (may be empty for some types) |
| `type` | Message type (`chat`, `image`, `revoked`, etc.) |
| `timestamp` | Unix time (seconds) |
| `dateTime` | Formatted local server time string |
| `fromMe` | Sent by the logged-in account |
| `hasMedia` | Has downloadable media |
| `ack` | Delivery / read state |
| `deviceType` | Sender device hint |
| `isForwarded` | Forwarded message |
| `forwardingScore` | Forward chain count |
| `isStatus` | Status-related |
| `sender.id` | Sender JID / LID |
| `sender.pushname` | Display name when available |
| `sender.number` | Phone / user id string when available |

When `hasMedia` is true, optional metadata only (no file download): `mimetype`, `mediaType`, `filename`.

### Invalid API key (HTTP 401)

```json
{
  "success": false,
  "statusCode": 401,
  "clientStatus": "INVALID_API_KEY",
  "message": "API key is not valid"
}
```

### cURL

```bash
curl -X POST "https://your-domain.example/api/whatsapp/messages" \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"apiKey":"RAW_API_KEY_VALUE","groupId":"1234567890-123456789@g.us","limit":10}'
```

---

## UI reference

Create and manage API keys in the web app at **`/api`**. The page mirrors these API-key payloads and example responses.
