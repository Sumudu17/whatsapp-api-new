# Multi-User WhatsApp Upgrade Plan (Multi-Client + Accounts)

Date: 2026-03-20

This document captures a careful review of the current application and proposes a practical, incremental architecture to convert the single WhatsApp client into a multi-user WhatsApp platform with:
- user accounts (name, email, password)
- email verification via OTP
- one WhatsApp session per user
- API key management
- message sending routed through the correct user’s WhatsApp client
- disconnection email notifications (user + admin)
- UI pages aligned with the existing design (static HTML + CSS + plain JS + Socket.IO for live status)

## 1) Current System Review

### Runtime entrypoints & routing
- `src/server.ts`
  - Loads `.env`
  - Creates `express-session` middleware with a server-side session secret (`SESSION_SECRET` or default)
  - Creates the Express app via `createApp(sessionMiddleware)`
  - Starts the HTTP server and initializes Socket.IO via `initSockets(server, sessionMiddleware)`
  - Starts WhatsApp initialization automatically on server boot if `AUTO_INIT=true`:
    - `initializeWhatsApp(false)` is called (no force, no session clearing)
  - Starts the readiness monitor via `startWhatsAppMonitor()`
- `src/app.ts`
  - Middleware:
    - `express.json({ limit: "1mb" })`
    - No-store caching for `req.path.startsWith("/api/")`
    - Session middleware applied to all requests
  - Frontend static hosting:
    - Serves `/frontend/*` static assets
    - Explicitly serves:
      - `GET /login` -> `frontend/login.html`
      - `GET /` and `GET /index.html` -> `frontend/index.html` (protected by session)
  - Route protection:
    - If `req.path` is not exempted and `API_AUTH_REQUIRED` is enabled for API routes, it checks `(req as any).session.user`
    - For non-API routes, any request other than `/login` is redirected to `/login` unless `(req as any).session.user` exists
  - Registers API routers:
    - `/api/auth` -> `src/routes/auth.routes.ts`
    - `/api/alerts` -> `src/routes/alerts.routes.ts`
    - `/api/whatsapp` -> `src/routes/whatsapp.routes.ts`

### Current “single-client” WhatsApp lifecycle
The app currently supports exactly one WhatsApp client/session for the whole backend process.

- Client initialization
  - `src/whatsapp/client.ts`
    - Global variables:
      - `let clientInstance: any | null = null;`
      - `let initializing: Promise<any> | null = null;`
    - Session directory selection:
      - `clientId = process.env.WWEBJS_CLIENT_ID || "api"`
      - Base auth path:
        - `process.env.WWEBJS_AUTH_PATH` OR `path.join(process.cwd(), ".wwebjs_auth")`
      - Session directory:
        - `<basePath>/session-${clientId}`
    - Builds wwebjs client:
      - `new wwebjs.Client({ authStrategy: new wwebjs.LocalAuth({ clientId, dataPath }), puppeteer: { headless: true } })`
    - Initialization entry:
      - `initializeClient(force=false, clearSession=false)`
        - If a client is already running and `force=true`, it destroys the current client
        - If `clearSession=true`, it deletes the session directory
        - Updates in-memory status (`setStatus("INITIALIZING")`)
        - Creates the client and calls `clientInstance.initialize()`
    - Shutdown:
      - `destroyClient(logout=false)`
        - If `logout=true`, calls `instance.logout()` then clears the session directory
        - Always calls `instance.destroy()`
        - Sets `setStatus("DISCONNECTED")`
- Client state storage
  - `src/whatsapp/state.ts`
    - In-memory singleton state:
      - `status: NOT_INITIALIZED | INITIALIZING | QR_REQUIRED | AUTHENTICATED | READY | DISCONNECTED`
      - `qrDataUrl: string | null`
      - optional `lastError`
    - `setQrDataUrl()` sets `status="QR_REQUIRED"` and stores the QR data URL
    - `setStatus()` resets `qrDataUrl` when not in `QR_REQUIRED`
- QR generation and reconnect/disconnect handling
  - `src/whatsapp/events.ts`
    - Attaches client event listeners via `attachClientEvents(client)`
    - On `qr`:
      - Converts QR string to image `dataUrl` using `qrcode`
      - Updates in-memory state (`setQrDataUrl(dataUrl)`)
      - Emits over Socket.IO:
        - `"qr"` -> `{ qr: dataUrl }`
        - `"state_change"` -> `getState()`
    - On `authenticated`, `ready`:
      - Updates in-memory status and emits state
    - On `auth_failure` and `disconnected`:
      - Updates `lastError`
      - Sets status to `DISCONNECTED`
      - Emits:
        - `"disconnected"` -> `{ reason }`
        - `"state_change"` -> `getState()`
  - There is no automatic reinitialize endpoint in code (README mentions `/api/whatsapp/reinitialize`, but `src/routes/whatsapp.routes.ts` does not implement it).
- Readiness monitor email
  - `src/whatsapp/monitor.ts`
    - Every 30 seconds:
      - If status is not `READY` for more than 5 minutes, sends a single alert email via `sendAlertEmail()`
      - It resets the “alert sent” flag when status returns to `READY`
    - This monitor is global/single-client and not keyed per user.

### WhatsApp service/controller/routes
- `src/services/whatsapp.service.ts`
  - `initializeWhatsApp(force=false, clearSession=false)` wraps `initializeClient()`
    - Converts certain errors:
      - `"WHATSAPP_SESSION_IN_USE"` -> HTTP 409 with guidance
      - `"browser is already running"` -> HTTP 409
  - `logoutWhatsApp()` -> `destroyClient(true)`
  - `getWhatsAppStatus()` -> returns global state
  - `getWhatsAppGroups()`:
    - requires `state.status === "READY"` otherwise throws `ApiError(503)`
    - uses `client.getChats()` and filters group chats
  - `sendWhatsAppText(to, groupId, message)`:
    - requires `state.status === "READY"` else 503
    - validates exactly one of `to` or `groupId` is provided
    - calls `client.sendMessage(destination, message)`
- `src/controllers/whatsapp.controller.ts`
  - Exposes initialize/logout/status/groups/send endpoints for the router.
- `src/routes/whatsapp.routes.ts`
  - `router.use(optionalAuth)`
  - Endpoints:
    - `POST /initialize` -> `initialize` controller
    - `POST /logout` -> `logout` controller
    - `GET /status` -> status controller
    - `GET /groups` -> groups controller
    - `POST /send` -> `rateLimitSend` + `validateBody(sendSchema)` + `send`

### Frontend UI (current design + flow)
- `frontend/styles.css`
  - Simple grid layout
  - Cards with light shadows
  - Buttons: primary, secondary, danger, small
- `frontend/login.html`
  - Minimal form
  - On submit, calls `POST /api/auth/login` then redirects to `/`
- `frontend/index.html`
  - Header: “WhatsApp Web Dashboard” and an “App Logout” button
  - Connection card:
    - Initialize / Logout WhatsApp buttons
    - QR area that shows/hides based on QR events
    - Status and “Client State” fields
  - Send Message card:
    - radio toggle: Individual vs Group
    - inputs for `to`, `groupSelect`, and message body
    - Send button calls the backend
- `frontend/app.js`
  - Connects to Socket.IO: `io({ withCredentials: true })`
  - Listens for:
    - `"state_change"` -> updates status and clientState + shows QR if `qrDataUrl` exists
    - `"qr"` -> updates QR image directly
  - Initialize/logout/send:
    - Calls REST endpoints:
      - `POST /api/whatsapp/initialize`
      - `POST /api/whatsapp/logout`
      - `GET /api/whatsapp/groups`
      - `POST /api/whatsapp/send`

### Current authentication system
- `src/controllers/auth.controller.ts`
  - Login uses environment variables:
    - `APP_USERNAME` and `APP_PASSWORD`
  - On success sets:
    - `(req as any).session.user = { username }`
  - Logout:
    - calls `session.destroy(...)`
- `src/routes/auth.routes.ts`
  - `POST /login` -> `loginSchema` validation with `validateBody`
  - `POST /logout` -> logout controller
- `src/middlewares/auth.middleware.ts` + `src/app.ts`
  - `optionalAuth`:
    - If `API_AUTH_REQUIRED=true`, require `(req as any).session.user`
    - Otherwise it allows requests without authentication.

### Current email/SMTP setup (existing)
- `src/services/email.service.ts`
  - Uses `nodemailer` SMTP transport with:
    - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
    - `ALERT_EMAIL_TO` (recipient)
    - `SMTP_FROM` (optional fallback to SMTP_USER)
  - Sends plain text email only
  - Tracks in-memory email status:
    - `lastSentAt`, `lastError`
- `src/controllers/alerts.controller.ts` + `src/routes/alerts.routes.ts`
  - `GET /api/alerts/status` returns in-memory email status
  - `POST /api/alerts/test` triggers a test email

### Session storage for WhatsApp (on disk)
This app uses `wwebjs.LocalAuth`, whose implementation stores browser userData:
- `src/authStrategies/LocalAuth.js`
  - Session dir name:
    - `session-${this.clientId}` (when `clientId` is provided)
    - located at `path.resolve(dataPath || './.wwebjs_auth/')`
  - The `clientId` is passed from `src/whatsapp/client.ts` and currently uses `WWEBJS_CLIENT_ID` or `"api"`.

## 2) Gaps in Current System (vs Multi-User Requirements)
Below are practical mismatches that must be addressed.

### Multi-user account system
- No user database exists.
- Current login is a single shared username/password from env vars.
- No password hashing, OTP, email verification, or account activation is implemented.

### OTP + email verification
- Existing SMTP code only supports “alert emails” and “test alert emails”.
- No OTP generation, persistence, expiry tracking, resend logic, or rate limiting exists.

### WhatsApp client mapping
- Global singletons:
  - `clientInstance` (one client for all users)
  - `state` (one in-memory QR/status)
- No user->client mapping or session isolation.

### Session lifecycle / reconnect semantics
- Disconnection handling only updates in-memory state and emits sockets.
- No per-user disconnect/reconnect orchestration exists.
- `/api/whatsapp/initialize` calls `initializeWhatsApp(true, true)` but the “clearSession” logic only clears if a client already exists (so behavior may be inconsistent across first init vs reconnect).

### Disconnection email notifications
- Current code sends email only for “not ready >5 minutes”.
- No email on `disconnected`/`auth_failure` events.
- No admin notification channel separate from user email.

### API key management
- No API key system exists.
- No secure storage/validation of per-user keys exists.

### Message send contract
- Current `/api/whatsapp/send` expects session auth (optional based on env), and input is only `{ to?, groupId?, message }`.
- No requirement for `userid`/`apikey` and no cross-checking between them.

### Security gaps
- `API_AUTH_REQUIRED=false` (default in `.env.example`) allows:
  - unauthenticated Socket.IO access (QR/status stream)
  - unauthenticated WhatsApp REST API calls (depending on routes)
- There is no CSRF protection for session-based endpoints.
- There is no server-side rate limiting for login/registration/OTP (since they don’t exist yet).

### Documentation gaps
- README mentions `/api/whatsapp/reinitialize`, but there is no implementation in routes/controllers.

## 3) Proposed Architecture (Multi-Client + Accounts)

### High-level modules
Introduce a layered structure:
1. `Auth & User Management`
   - register/login/logout
   - OTP generation + verification
   - profile updates (name/email/password)
2. `API Key Management`
   - CRUD of API keys per user
   - secure key hashing + validation middleware
3. `WhatsApp Client Manager` (core multi-client runtime)
   - one wwebjs `Client` instance per active user session
   - per-user in-memory state for QR/status/lastError
   - event wiring that updates per-user state and emits per-user socket events
4. `Notification Service`
   - sends email notifications on disconnect/auth failure
   - deduplicates to avoid email spam
5. `Persistence Layer`
   - MySQL schema for users, OTPs, whatsapp_sessions, api_keys, and notification logs/events
   - migration tooling strategy

### WhatsApp Client Manager design (runtime)
Replace global singletons with keyed structures:
- `clientByUserId: Map<UserId, Client>`
- `stateByUserId: Map<UserId, WhatsAppState>`
- `initializingByUserId: Map<UserId, Promise<void | Client>>` (to prevent duplicate initialization)
- `eventHandlersByUserId` (optional but recommended to support cleanup/unsubscribe)

Core operations:
- `ensureClient(userId, options)`
  - Ensures a client exists and is initialized for that user.
  - Lazy-init:
    - Do not start all clients at boot by default.
    - Start a client when the user navigates to “Connect WhatsApp” or when the API first needs to send a message and the client is not ready.
  - Sets status:
    - NOT_INITIALIZED -> INITIALIZING -> QR_REQUIRED/AUTHENTICATED/READY/ DISCONNECTED
- `connectUser(userId)`
  - Initializes the client and begins QR flow.
  - Does NOT create new DB sessions if one already exists (enforce one whatsapp session row per user).
- `logoutUser(userId)`
  - Logs out the user’s client (calls wwebjs `logout()`)
  - Clears the LocalAuth session directory for that user
  - Updates whatsapp_sessions status in DB
- `destroyUserClient(userId)`
  - Destroys runtime client instance and removes listeners
  - DB row remains (or is set to disconnected)

Event wiring:
- Attach wwebjs events (`qr`, `ready`, `authenticated`, `disconnected`, `auth_failure`) per user client.
- On each event:
  - Update `stateByUserId`
  - Emit socket events to a user-specific socket room, not globally:
    - room name: `user:${userId}`
  - For disconnect/auth failure:
    - trigger email notification via Notification Service (with dedupe rules)

### Boot-time strategy (scaling considerations)
For multi-user systems, launching all puppeteer instances at boot is risky.
Recommend:
- Default: lazy-init on demand
- Optional config for small deployments:
  - `AUTO_INIT_ACTIVE_USERS=true`:
    - On server boot, initialize only users whose DB whatsapp_sessions status is READY/AUTHENTICATED and were previously active.
- Add a maximum active client cap:
  - `MAX_ACTIVE_WHATSAPP_CLIENTS`
  - If cap reached, refuse new connect requests or queue them.

### Socket.IO strategy (UI live updates)
Current implementation emits all state changes globally.
For multi-user:
- Authenticate sockets (based on session for the UI).
- Join the socket connection to `user:${userId}` room.
- Emit:
  - `qr`, `state_change`, `ready`, `authenticated`, `disconnected`
  only to that room.
- For API-key-based external apps:
  - sockets are not required (they can poll `GET /api/whatsapp/status?userId=` if you expose it).

### How to ensure “one user = one WhatsApp account”
Enforce at multiple layers:
- DB constraint:
  - `whatsapp_sessions.user_id` is `UNIQUE`
- API/business logic:
  - If the user already has a whatsapp_session row:
    - reuse its `client_id` (used as LocalAuth `clientId`)
    - do not create a second session row
- Runtime:
  - Client Manager maintains at most one runtime client per userId.

## 4) Database Schema (MySQL, Normalized)

### Core principles
- Store all account data in MySQL (no in-memory-only for persistence-critical fields).
- WhatsApp session auth state is still stored on disk via `LocalAuth`, but DB stores metadata and linkage:
  - `whatsapp_sessions` row references the user and stores the LocalAuth `client_id`.
- Secure secrets:
  - password hashes using bcrypt (or Argon2; bcrypt is already common in Node)
  - store OTP hashes (preferably) + expiry timestamps
  - store API key hashes (never raw key values after creation)

### Proposed tables

#### `users`
Purpose: store registered user accounts.

Columns:
- `id` BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT (internal user id)
- `name` VARCHAR(100) NOT NULL
- `email` VARCHAR(255) NOT NULL UNIQUE
- `password_hash` VARCHAR(255) NOT NULL
- `is_active` BOOLEAN NOT NULL DEFAULT FALSE (becomes active after OTP verification)
- `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
- `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

Indexes:
- UNIQUE(`email`)

#### `email_otps`
Purpose: store OTPs for email verification and email change verification.

Columns:
- `id` BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
- `user_id` BIGINT UNSIGNED NOT NULL
- `email` VARCHAR(255) NOT NULL
- `purpose` ENUM('register_activation','change_email') NOT NULL
- `otp_hash` CHAR(64) NOT NULL (SHA-256 hex hash, e.g. hash code + salt)
- `expires_at` DATETIME NOT NULL
- `used_at` DATETIME NULL
- `failed_attempts` INT NOT NULL DEFAULT 0 (for basic anti-bruteforce)
- `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
- `last_sent_at` DATETIME NOT NULL

Constraints:
- FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE

Indexes:
- INDEX(`user_id`)
- INDEX(`purpose`, `email`)
- INDEX(`expires_at`)

Notes:
- Store only `otp_hash`, not the raw OTP.
- `last_sent_at` supports resend throttling.

#### `whatsapp_sessions`
Purpose: store per-user WhatsApp session metadata and runtime status.

Columns:
- `id` BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
- `user_id` BIGINT UNSIGNED NOT NULL UNIQUE
- `client_id` VARCHAR(64) NOT NULL UNIQUE (the LocalAuth `clientId`)
- `status` ENUM('NOT_INITIALIZED','INITIALIZING','QR_REQUIRED','AUTHENTICATED','READY','DISCONNECTED') NOT NULL DEFAULT 'NOT_INITIALIZED'
- `last_connected_at` DATETIME NULL
- `last_authenticated_at` DATETIME NULL
- `last_disconnected_at` DATETIME NULL
- `last_disconnected_reason` TEXT NULL
- `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
- `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

Constraints:
- UNIQUE(`user_id`)
- FOREIGN KEY(`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE

Indexes:
- INDEX(`status`)
- INDEX(`updated_at`)

Notes:
- DB does not store the raw LocalAuth session files. It only stores the linkage (`client_id`) and human-readable status.

#### `api_keys`
Purpose: manage API keys for external message sending (user-level authorization).

Columns:
- `id` BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
- `user_id` BIGINT UNSIGNED NOT NULL
- `name` VARCHAR(100) NOT NULL (API key / application name)
- `api_key_hash` CHAR(64) NOT NULL (SHA-256 hex of the raw key value)
- `key_prefix` VARCHAR(10) NOT NULL (first 10 chars of raw key for UI display; not secret)
- `status` ENUM('ACTIVE','REVOKED','DELETED') NOT NULL DEFAULT 'ACTIVE'
- `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
- `deleted_at` DATETIME NULL
- `last_used_at` DATETIME NULL

Constraints:
- FOREIGN KEY(`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
- INDEX/unique:
  - Unique on (`user_id`, `key_prefix`) optional (if you want to prevent duplicates of prefix; not strictly required)

Indexes:
- INDEX(`user_id`)
- INDEX(`status`)

Security notes:
- Only show the raw key value at creation time once; never store raw keys.

#### `notification_events` (optional but recommended)
Purpose: deduplicate disconnect emails and provide an audit trail.

Columns:
- `id` BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
- `user_id` BIGINT UNSIGNED NULL (nullable if notification is admin-only)
- `event_type` VARCHAR(50) NOT NULL (e.g. `whatsapp_disconnected`)
- `dedup_key` VARCHAR(255) NOT NULL (unique key per “bucket” window)
- `payload_json` JSON NULL
- `sent_at` DATETIME NOT NULL
- `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP

Constraints:
- UNIQUE(`dedup_key`)
- FOREIGN KEY(`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL

This table is the cleanest way to prevent duplicate spam emails.

### ER diagram description (text)
- `users (1) ---- (0..1) whatsapp_sessions` via `whatsapp_sessions.user_id UNIQUE`
- `users (1) ---- (0..*) email_otps` via `email_otps.user_id`
- `users (1) ---- (0..*) api_keys` via `api_keys.user_id`
- `users (0..*) ---- (0..*) notification_events` (via nullable `notification_events.user_id` and unique dedup_key for dedupe)

## 5) API Design (Multi-User + API Keys)

### Authentication (session-based for UI)
Endpoints:
- `POST /api/auth/register`
  - body: `{ name, email, password }`
  - behavior:
    - create user in DB with `is_active=false`
    - generate OTP, store hashed OTP row in `email_otps` with expiry, send OTP email
    - apply resend throttling and rate limits
  - response: `{ success: true }` (do not return OTP)
- `POST /api/auth/verify-email-otp`
  - body: `{ email, otp }` OR `{ userId, otp }`
  - behavior:
    - verify OTP hash + expiry + unused
    - mark user `is_active=true`
  - response: `{ success: true }`
- `POST /api/auth/login`
  - body: `{ email, password }`
  - behavior:
    - verify password hash
    - enforce `is_active=true` before login success
    - set session `(req as any).session.userId = user.id`
  - response: `{ success: true }`
- `POST /api/auth/logout`
  - destroys session
- `POST /api/auth/change-name`
  - requires session auth
  - body: `{ name }`
- `POST /api/auth/change-email/request-otp`
  - requires session auth
  - body: `{ newEmail }`
  - creates a `change_email` OTP row, sends OTP
- `POST /api/auth/change-email/verify-otp`
  - requires session auth (or verify using pending token; simplest ties to session user)
  - body: `{ otp }`
- `POST /api/auth/change-password`
  - requires session auth
  - body: `{ currentPassword, newPassword }`

### API key management (for external apps)
Endpoints (all require session auth):
- `GET /api/api-keys`
  - returns list of keys metadata:
    - `id`, `name`, `key_prefix`, `status`, `created_at`
  - never returns raw key values
- `POST /api/api-keys`
  - body: `{ name }`
  - generates a new raw key value (random bytes)
  - stores only hash in DB
  - returns:
    - `id`, `name`, `key_prefix`, and `rawKey` (only here, once)
- `DELETE /api/api-keys/:id`
  - sets status to `REVOKED`/`DELETED`

Validation middleware for external requests:
- `requireApiKey`
  - reads `apiKey` from:
    - request body OR `Authorization: ApiKey <key>` (choose one and document)
  - hashes the presented raw key and matches against `api_keys.api_key_hash`
  - returns API key metadata and `user_id` on success
  - if key is revoked/deleted -> 401/403

### Message send API (userid + apikey + destination + message)
New contract (recommended):
- `POST /api/whatsapp/send`
  - body:
    - `userId` (numeric)
    - `apiKey` (raw key; for better security, accept via header but requirement says it’s passed as param)
    - `to` (E.164) OR `groupId` (must end with `@g.us`)
    - `message` (string)
  - validation:
    - ensure exactly one of `to` or `groupId`
    - verify userId exists
    - verify API key belongs to that userId (reject mismatch)
    - ensure user is `is_active=true`
    - ensure whatsapp client status is `READY`
  - routing:
    - `WhatsAppClientManager.getClient(userId).sendMessage(...)`
  - response:
    - `{ success: true, messageId, clientStatus }`
  - error mapping:
    - 401/403: API key invalid/revoked or user mismatch
    - 503: client not ready / initializing
    - 400: validation error

Optional:
- `GET /api/whatsapp/status?userId=...`
  - session-based or API-key based (useful for external clients)

### Disconnect status endpoints (optional UI support)
- `GET /api/whatsapp/connection` (for current logged-in user)
  - returns:
    - status, lastConnectedAt, lastDisconnectedAt, and (optionally) whether a QR is currently required
  - QR data URL typically stays in memory and is sent via Socket.IO events.

## 6) UI/UX Proposal (Match Existing Design)

Current UI approach:
- static HTML pages
- shared CSS in `frontend/styles.css`
- JS in `frontend/app.js` for the dashboard and socket listeners

Proposed new pages/components (plain HTML pages)
1. `register.html`
   - Fields: name, email, password
   - “Register” button triggers `POST /api/auth/register`
   - After register success: redirect to OTP verify page
2. `verify-email.html`
   - Field: OTP input
   - Calls `POST /api/auth/verify-email-otp`
   - On success: redirect to login
3. `login.html` (update existing)
   - switch from username/password to email/password
   - optionally show active error “verify email required”
4. `dashboard.html` (replace/extend current `index.html`)
   - Summary cards:
     - Session/client status for the logged-in user
     - “Connect WhatsApp” / “Reconnect” controls
     - QR display area (shown when status is `QR_REQUIRED`)
     - “Send Message” card stays, but now uses the logged-in user’s WhatsApp session
5. `api-keys.html`
   - List existing keys (name, key_prefix, status)
   - Create new key (returns raw key once; UI should instruct user to copy it)
   - Delete/revoke key
6. `profile.html`
   - Update name
   - Change email (request OTP -> verify OTP)
   - Change password
7. `disconnected-alert.html` or inline alert component
   - shows “Disconnected” and displays last reason/timestamp
   - offers “Reconnect” button

Navigation style
- Keep the same header style:
  - title on the left
  - action buttons on the right
- If you want navigation links, add them next to the header title using the existing CSS patterns (no new framework).

Frontend Socket.IO changes (critical)
- Instead of a single global socket consuming a single global QR/state:
  - join server room `user:${userId}` after login (server side)
  - listen for:
    - `qr` (for this user only)
    - `state_change` updates for this user only

## 7) WhatsApp Session Lifecycle Design (Per User)

### States & transitions
DB `whatsapp_sessions.status` and runtime `stateByUserId.status` should align.
Typical transitions:
- NOT_INITIALIZED -> INITIALIZING (when connect request starts)
- INITIALIZING -> QR_REQUIRED (emit QR)
- QR_REQUIRED -> AUTHENTICATED (after scan)
- AUTHENTICATED -> READY (ready event)
- READY -> DISCONNECTED (disconnect/auth failure)

### QR generation
For the logged-in user’s connect page:
1. UI calls `POST /api/whatsapp/connection/start` (session auth)
2. Backend calls `WhatsAppClientManager.connectUser(userId)`
3. During `qr` event:
   - backend converts QR string into dataUrl
   - updates state for that user
   - emits `qr` and `state_change` to `user:${userId}` room
4. UI shows QR image based on `qrDataUrl` and state.

### Reconnect behavior (requirement: reconnect updates same session)
Rules:
- Default reconnect should reuse existing on-disk LocalAuth session.
- Only clear LocalAuth session directory when the user explicitly requests a “Reset session”.

Suggested endpoints:
- `POST /api/whatsapp/connection/start`:
  - initializes runtime client without clearing session dir
- `POST /api/whatsapp/connection/reset`:
  - clears LocalAuth session dir for that user then initializes

### Persistence across server restart
- Since LocalAuth reads from disk based on `clientId`, the DB row + chosen `clientId` must remain stable.
- On server restart:
  - if lazy-init is used:
    - clients will be initialized again only when requested
  - when initialized:
    - wwebjs loads session from `.wwebjs_auth/session-${clientId}`

### Scaling and resource controls
To avoid too many puppeteer instances:
- implement a cap (`MAX_ACTIVE_WHATSAPP_CLIENTS`)
- optionally unload/destroy clients:
  - destroy clients for users that have been idle for a configurable time
  - keep their status in DB for UI display

## 8) Email Notification Design (Disconnect + Admin)

### When to send emails
Trigger events:
- `disconnected` event from wwebjs
- `auth_failure` event from wwebjs

Recipient:
- user email: `users.email`
- admin email:
  - new env var `ADMIN_EMAIL` (or reuse `ALERT_EMAIL_TO` with clear naming)

Email content should include:
- user’s name/email (if desired)
- event type: disconnected/auth_failure
- reason string
- timestamp
- suggested action: “Open your dashboard and reconnect”

### Avoid duplicate spam
Implement dedupe using `notification_events`:
- compute a dedup_key, for example:
  - `whatsapp_disconnected:<userId>:<reasonBucket>:<YYYY-MM-DD>`
  - or throttle window:
    - dedupe per user+event type per N minutes (e.g. 60)
- write a `notification_events` row before sending (or after send but ensure uniqueness)
- if unique constraint fails -> do not send again

### Email service reuse
Reuse `src/services/email.service.ts` for SMTP sending:
- extend it with a second function e.g. `sendUserEmail(to, subject, text)` OR modify to accept recipient parameter
- remove/limit in-memory `lastSentAt` since multi-user requires DB or notification log tracking

## 9) Security Recommendations

### Password hashing
- Use bcrypt:
  - `bcrypt.hash(password, saltRounds)`
  - store only `password_hash`
- Never store plaintext passwords.

### OTP security
- OTP generation:
  - numeric OTP (e.g. 6 digits)
  - OTP expiry (suggest 10 minutes)
- Storage:
  - store only `otp_hash` (e.g. SHA-256 of `(otp + otpSalt)`), not raw OTP
- Verification:
  - compare presented OTP hashed with same method
- Rate limiting:
  - limit OTP resend frequency:
    - e.g. max 3 resends per hour per user/email
  - limit invalid attempts:
    - e.g. lock OTP after 5 invalid attempts within an expiry window

### API key security
- Generate raw key:
  - random 32 bytes base64url
  - return raw key value once at creation
- Store only:
  - `api_key_hash = SHA-256(rawKey)`
  - `key_prefix` for UI
- Validation:
  - hash incoming raw key and compare to stored hash
  - reject revoked keys
- Enforce userid/apikey relationship:
  - if middleware resolves apiKey -> user_id, compare to request `userId`
  - mismatch => 403

### Input validation
- Use Zod (already in project) for all endpoints:
  - register/login/change-password/verify-otp
  - message sending payload
  - groupId and to validation rules

### Session isolation
- Ensure each WhatsApp client instance is tied to exactly one `userId`.
- LocalAuth `clientId` should be deterministic for the user:
  - e.g. `client_id = String(users.id)`

### Avoid exposing session files or secrets
- Never expose session directory paths or LocalAuth files in API responses.
- Ensure `.wwebjs_auth/` remains gitignored (already in `.gitignore`).

### Additional hardening
- Turn on `cookie.secure` and `sameSite` appropriately for production.
- Consider CSRF protection since the UI uses session cookies.
- For scaling:
  - store express-session in Redis instead of memory store (if you deploy multiple instances)

## 10) Step-by-Step Implementation Plan (No Code Yet)

Phase 0: Verification & assumptions
1. Confirm desired internal `userId` type (BIGINT vs UUID).
2. Confirm whether you want:
   - local-only deployment (single server) or multi-instance scaling.

Phase 1: Add MySQL + migrations
1. Add MySQL connection support (e.g. `mysql2`).
2. Add migration strategy:
   - create `schema_migrations` table
   - store versioned SQL files under a `migrations/` folder
   - create an initial migration with tables:
     - `users`, `email_otps`, `whatsapp_sessions`, `api_keys`, `notification_events`
3. Add `.env` vars:
   - `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASS`, `MYSQL_DB`
   - `ADMIN_EMAIL`

Phase 2: Implement user auth + OTP verification
1. Create:
   - `POST /api/auth/register`
   - `POST /api/auth/verify-email-otp`
   - `POST /api/auth/login`
   - `POST /api/auth/logout`
2. Use bcrypt hashing and enforce `is_active=true` before login.
3. Add resend + expiry + invalid attempt handling for OTP.
4. Update session payload to store `userId` instead of `username`.

Phase 3: Implement API key management
1. Create `api_keys` CRUD endpoints.
2. Implement `requireApiKey` middleware:
   - validate key, load user, ensure not revoked.
3. Implement “userid + apikey mismatch” protection.

Phase 4: Implement WhatsAppClientManager (multi-client)
1. Replace singleton in-memory state with keyed maps.
2. Implement `ensureClient(userId)` and per-user state transitions.
3. Update WhatsApp routes:
   - require session auth for UI connect/send endpoints (or accept API key too)
4. Update Socket.IO:
   - add room per user
   - emit `qr` and `state_change` only to that room

Phase 5: Update message sending endpoints
1. Implement message send route accepting:
   - `userId`, `apiKey`, `to`/`groupId`, `message`
2. Validate:
   - user active
   - whatsapp status is READY (or allow queueing while initializing)
3. Route call to correct client instance.

Phase 6: Email notifications on disconnect
1. On `disconnected` / `auth_failure` events:
   - call Notification Service
   - send to user email + admin email
2. Deduplicate using `notification_events`.
3. Remove or adapt the current global “not ready >5 minutes” monitor:
   - for multi-user, it should be per-user and stored in DB or in-memory keyed by userId.

Phase 7: Frontend updates
1. Create/update HTML pages:
   - register, verify-email, dashboard, API keys, profile
2. Update/extend Socket.IO JS:
   - connect after login and listen for per-user events
3. Update send/connect buttons to call new endpoints.

Phase 8: Security hardening & testing
1. Ensure `API_AUTH_REQUIRED` is no longer unsafe by default (multi-user requires auth always).
2. Add rate limiting for:
   - register
   - login
   - OTP verify/resend
   - API key message send (per key and per user)
3. Add test coverage for:
   - OTP verify correctness + expiry
   - api key hashing + validation
   - userId/apikey mismatch protection
   - message routing selects correct client instance
   - notification dedupe logic

Phase 9: Migration readiness / operational steps
1. Provide a “session directory mapping” approach for existing `session-api` (see migration notes below).
2. Validate on staging environment with test accounts.

## 11) Files to be Changed (Likely)

Backend:
- `src/server.ts` (session userId handling, auto-init strategy)
- `src/app.ts` (auth route exclusions for new pages; stricter security defaults)
- `src/controllers/auth.controller.ts` (rewrite login/register/OTP flows)
- `src/routes/auth.routes.ts` (add new endpoints)
- `src/services/whatsapp.service.ts` (refactor to per-user manager)
- `src/whatsapp/client.ts` (refactor to support per-user clients)
- `src/whatsapp/state.ts` (replace singleton with per-user state map)
- `src/whatsapp/events.ts` (event handlers per user)
- `src/whatsapp/monitor.ts` (refactor monitor logic to be per-user)
- `src/controllers/whatsapp.controller.ts` + `src/routes/whatsapp.routes.ts` (new API contract)
- `src/sockets/index.ts` (user rooms + per-user emission)
- `src/services/email.service.ts` (support sending to arbitrary recipients; remove in-memory global status)
- new DB modules:
  - `src/db/connection.ts`
  - `src/db/migrations/*`
  - `src/models/*` or service-layer SQL wrappers
- new security middleware:
  - `src/middlewares/apiKey.middleware.ts`
  - `src/middlewares/sessionAuth.middleware.ts` (require logged-in user)

Frontend:
- `frontend/login.html` (email-based login + updated error messages)
- new pages:
  - `frontend/register.html`
  - `frontend/verify-email.html`
  - `frontend/dashboard.html` (or update `index.html`)
  - `frontend/api-keys.html`
  - `frontend/profile.html`
- `frontend/app.js` likely replaced or split into:
  - dashboard JS (socket room scoped to user)
  - profile/api keys JS

## 12) Database Migration Approach

There is no current migration tool/folder in the repository.
Recommendation: implement a lightweight SQL migration runner:
1. Create `migrations/` folder with numbered SQL files, e.g.:
   - `001_init.sql`
2. Create `schema_migrations` table:
   - `version` INT PRIMARY KEY
   - `applied_at` DATETIME
3. On server startup (or via a CLI script):
   - read migration directory
   - apply any migrations not present in `schema_migrations`
4. Ensure migrations are idempotent:
   - use `CREATE TABLE IF NOT EXISTS` where appropriate, but prefer explicit versioned migrations.

Initial migration SQL (high level):
- create tables:
  - users
  - email_otps
  - whatsapp_sessions
  - api_keys
  - notification_events

Upgrade safety:
- no production data exists yet in MySQL (this is a new schema)
- if you later add columns:
  - create follow-up migrations with additive changes

### Mapping existing wwebjs session (migration note)
Current runtime uses LocalAuth:
- session directory: `.wwebjs_auth/session-${clientId}`
- today `clientId` comes from `WWEBJS_CLIENT_ID` env defaulting to `api`

After migration to per-user clientId:
- if new clients use `client_id = <users.id>`:
  - existing `session-api` won’t automatically map to the newly registered user.

Options:
1. Accept that existing session must be re-authenticated:
   - keep old session directory but don’t use it for new clientIds
2. Migrate on first connection:
   - when the first user requests connect, rename/copy:
     - `.wwebjs_auth/session-api` -> `.wwebjs_auth/session-<newClientId>`
   - ensure only one user claims it.

The safest for correctness is option (1), and then allow users to connect normally via QR.

## 13) Suggestions / Improvements (Post-Upgrade)

1. Replace in-memory “not ready >5 min” email monitor with per-user tracking:
   - use DB timestamps or a per-user in-memory map keyed by userId
2. Add a “connection logs” UI view:
   - show last disconnect reasons from `whatsapp_sessions`
3. Add request IDs and structured logs:
   - helps debug per-user WhatsApp runtime events
4. Add an admin panel (optional):
   - list users, active sessions, last disconnects
5. Security defaults:
   - require auth always (remove `API_AUTH_REQUIRED=false` permissiveness for production)

