<div align="center">
    <br />
    <p>
        <a href="https://wwebjs.dev"><img src="https://github.com/wwebjs/assets/blob/main/Collection/GitHub/wwebjs.png?raw=true" title="whatsapp-web.js" alt="WWebJS Website" width="500" /></a>
    </p>
    <br />
    <p>
		<a href="https://www.npmjs.com/package/whatsapp-web.js"><img src="https://img.shields.io/npm/v/whatsapp-web.js.svg" alt="npm" /></a>
        <a href="https://depfu.com/github/pedroslopez/whatsapp-web.js?project_id=9765"><img src="https://badges.depfu.com/badges/4a65a0de96ece65fdf39e294e0c8dcba/overview.svg" alt="Depfu" /></a>
        <img src="https://img.shields.io/badge/WhatsApp_Web-2.3000.1017054665-brightgreen.svg" alt="WhatsApp_Web 2.2346.52" />
        <a href="https://discord.gg/H7DqQs4"><img src="https://img.shields.io/discord/698610475432411196.svg?logo=discord" alt="Discord server" /></a>
	</p>
    <br />
</div>

## WhatsApp Web Automation App
This workspace includes a full WhatsApp Web application using **whatsapp-web.js**, with a Node.js backend, WebSocket updates, and a simple frontend UI.

### Prerequisites
- Node.js 18+
- **Linux/EC2**: Install Chrome dependencies (see below)

### Linux/EC2 Setup (Required for Puppeteer)
On Ubuntu/Debian EC2 instances, install Chrome dependencies:

**For Ubuntu 24.04+ (with t64 packages):**
```bash
sudo apt-get update
sudo apt-get install -y libcups2t64 libasound2t64 libnss3 libxss1 libxrandr2 libxcomposite1 libxdamage1 libxfixes3 libgbm1 libdrm2 libxkbcommon0 libpangocairo-1.0-0 libpango-1.0-0 libgtk-3-0t64 fonts-liberation xdg-utils ca-certificates
```

**For older Ubuntu versions:**
```bash
sudo apt-get update
sudo apt-get install -y ca-certificates fonts-liberation libappindicator3-1 libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils
```

### Setup
1. Install dependencies:
   - `npm install`
2. Create your `.env`:
   - `copy .env.example .env` (Windows PowerShell)
3. Set credentials and config in `.env`:
   - `SESSION_SECRET` (optional; defaults to `dev_session_secret`)
   - `WWEBJS_AUTH_PATH` (optional; default `.wwebjs_auth` under project root)
   - `AUTO_INIT` (optional, defaults to `true`)
   - `API_AUTH_REQUIRED` (optional, defaults to `false`)
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
   - `SMTP_FROM` (optional, defaults to `SMTP_USER`)
   - `ALERT_EMAIL_TO` (required for alerts; comma-separated for multiple recipients)
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (legacy `MYSQL_*` still supported if `DB_*` is unset)
   - `ADMIN_EMAIL` and optional comma-separated `ADMIN_EMAILS` (disconnect alerts + access to `/admin` and `GET /api/admin/accounts`)

   - `OTP_PEPPER` (recommended), `OTP_EXPIRES_MINUTES`, `OTP_RESEND_MIN_SECONDS`, `OTP_MAX_INVALID_ATTEMPTS`

### Database migrations (Flyway)

Schema changes are applied with **Flyway** (Docker), not by the Node app on startup.

- See **`docs/FLYWAY_SETUP.md`**
- Plan / notes: **`FLYWAY_MIGRATION_CONVERSION_PLAN.md`**
- Local: `./run-flyway.sh migrate` (Linux/macOS) or `run-flyway.bat migrate` (Windows)

### Run
- Dev server: `npm run dev`
- Production build: `npm run build`
- Start: `npm start`

### Web UI
- Visit `http://localhost:4000/login`
- Register at `http://localhost:4000/register`
- Verify your email OTP at `http://localhost:4000/verify-email?email=...`
- Forgot password: `http://localhost:4000/forgot-password` → then `http://localhost:4000/reset-password?email=...`
- After login, open:
  - `http://localhost:4000/` (dashboard — send messages, send polls, and message-count stats)
  - `http://localhost:4000/connection` (QR + connection status)
  - `http://localhost:4000/api` (API key management)
  - `http://localhost:4000/profile` (name/email/password)
  - `http://localhost:4000/admin` (all accounts + WhatsApp status; only if your email is listed in `ADMIN_EMAIL` or `ADMIN_EMAILS` in `.env`)

### API Endpoints
- `GET /api/health`
- `GET /api/version`
- `POST /api/auth/register`
- `POST /api/auth/verify-email-otp`
- `POST /api/auth/resend-email-otp`
- `POST /api/auth/login` (session cookie)
- `POST /api/auth/forgot-password` (public; sends reset code if email matches an active account)
- `POST /api/auth/reset-password` (public; code + new password)
- `POST /api/auth/logout`
- `GET /api/auth/me` (session; includes `user.isAdmin` when email matches `ADMIN_EMAIL` / `ADMIN_EMAILS`)
- `GET /api/admin/accounts` (session; **admin only** — lists users and DB + live WhatsApp status)
- `DELETE /api/admin/users/:id` (session; **admin only** — deletes user and cleans WhatsApp session files on disk)
- `POST /api/auth/change-name` (session)
- `POST /api/auth/change-email/request-otp` (session)
- `POST /api/auth/change-email/verify-otp` (session)
- `POST /api/auth/change-password` (session)

- `GET /api/api-keys` (session)
- `POST /api/api-keys` (session; returns raw key once)
- `DELETE /api/api-keys/:id` (session)

- `POST /api/whatsapp/initialize` (session; triggers QR via WebSocket)
- `POST /api/whatsapp/logout` (session)
- `GET /api/whatsapp/connection` (session; state + last disconnect metadata from MySQL)
- `GET /api/whatsapp/dashboard-status` (session; dashboard UI — connection-style payload)
- `GET /api/whatsapp/groups` (session; only when state is `READY`)
- `POST /api/whatsapp/status` (**API key** — `userId` + `apiKey`; external client status)
- `POST /api/whatsapp/messages` (**API key** — `userId` + `apiKey` + XOR `phoneNumber` / `groupId` + optional `limit`; fetch latest messages)
- `POST /api/whatsapp/send` (session auth or API-key auth; routes through the correct WhatsApp session)
- `POST /api/whatsapp/send-poll` (session auth or API-key auth; single- or multiple-answer poll to an individual or group)
- `POST /api/whatsapp/send-api-key` (deprecated alias for API-key send)
- `POST /api/whatsapp/status-api-key` (deprecated alias for API-key status)
- `GET /api/whatsapp/message-stats` (session; counts of successfully sent text + poll messages for the logged-in user — "today" and "total")

### External WhatsApp HTTP API

Request/response examples (JSON bodies, status, send, messages, cURL) are documented in **`docs/WHATSAPP_API.md`**.

### Auth + OTP Payloads

#### Register
`POST /api/auth/register`

Request:

```
{
  "name": "Example User 1",
  "email": "example.user1@example.com",
  "password": "YourPassword123"
}
```

Response: `{ "success": true }`

#### Verify OTP
`POST /api/auth/verify-email-otp`

```
{
  "email": "example.user1@example.com",
  "otp": "123456"
}
```

#### Resend OTP
`POST /api/auth/resend-email-otp`

```
{
  "email": "example.user1@example.com"
}
```

#### Login
`POST /api/auth/login`

```
{
  "email": "example.user1@example.com",
  "password": "YourPassword123"
}
```

Response: `{ "success": true }` (session cookie set by server)

#### Forgot password (request code)
`POST /api/auth/forgot-password`

```
{
  "email": "example.user1@example.com"
}
```

Response (always the same message to avoid email enumeration):

```
{
  "success": true,
  "message": "If an account exists for that email, a reset code will be sent shortly."
}
```

#### Reset password (code + new password)
`POST /api/auth/reset-password`

```
{
  "email": "example.user1@example.com",
  "otp": "123456",
  "newPassword": "NewSecurePassword1",
  "confirmPassword": "NewSecurePassword1"
}
```

Response: `{ "success": true }` — then log in at `/login`.

### API Keys Payloads

#### List keys
`GET /api/api-keys`

Response:

```
{
  "success": true,
  "apiKeys": [
    { "id": 1, "name": "My App", "key_prefix": "abc123...", "status": "ACTIVE", "created_at": "..." }
  ]
}
```

#### Create key (raw key returned once)
`POST /api/api-keys`

Request:

```
{ "name": "My App" }
```

Response:

```
{
  "success": true,
  "apiKey": {
    "id": 1,
    "name": "My App",
    "key_prefix": "abc123...",
    "rawKey": "RAW_API_KEY_VALUE"
  }
}
```

#### Delete key
`DELETE /api/api-keys/:id`

Response: `{ "success": true }`

### Poll Payloads

`POST /api/whatsapp/send-poll` — same auth pattern as `/send`: session cookie by default, or pass `apiKey` + `userId` in the body to authenticate with an API key instead. Requires exactly one of `to`/`phoneNumber` (E.164) or `groupId` (`...@g.us`), a `question`, and 2-12 unique non-empty `options`. `allowMultipleAnswers` is optional (default `false`, i.e. single-answer poll).

#### Session auth (dashboard)

Request:

```
{
  "to": "+94717177326",
  "question": "What time works for the meeting?",
  "options": ["9 AM", "1 PM", "5 PM"],
  "allowMultipleAnswers": false
}
```

Response:

```
{
  "success": true,
  "messageId": "true_94717177326@c.us_3EB0EXAMPLEHASH",
  "chatId": "94717177326@c.us",
  "poll": {
    "question": "What time works for the meeting?",
    "options": ["9 AM", "1 PM", "5 PM"],
    "allowMultipleAnswers": false
  }
}
```

#### API key auth (external clients)

Request:

```
{
  "userId": 3,
  "apiKey": "YOUR_API_KEY",
  "groupId": "1234567890-123456789@g.us",
  "question": "Which topics should we cover?",
  "options": ["Budget", "Roadmap", "Hiring"],
  "allowMultipleAnswers": true
}
```

Response:

```
{
  "success": true,
  "statusCode": 200,
  "message": "Poll sent successfully",
  "data": {
    "chatType": "group",
    "chatId": "1234567890-123456789@g.us",
    "question": "Which topics should we cover?",
    "options": ["Budget", "Roadmap", "Hiring"],
    "allowMultipleAnswers": true,
    "messageId": "true_1234567890-123456789@g.us_3EB0EXAMPLEHASH"
  },
  "messageId": "true_1234567890-123456789@g.us_3EB0EXAMPLEHASH",
  "clientStatus": "READY"
}
```

Validation errors (empty question, fewer than 2 options, duplicate options, both/neither `to`/`groupId`, etc.) return `400` with the same Zod-error `details` shape used by `/send`. An unready client returns `503`; an invalid API key returns `401`.

### WebSocket Events
- `qr`
- `ready`
- `authenticated`
- `disconnected`
- `state_change`

### Email Alerts
- **Disconnect / auth failure:** emails go to the **account owner** and to every address from `ADMIN_EMAIL`, `ADMIN_EMAILS`, and comma-separated `ALERT_EMAIL_TO` (deduplicated). Admin emails include **account name**, **user id**, **email**, and **client ID** (from `whatsapp_sessions`).
- **Not ready:** if status stays not `READY` for **more than 5 minutes**, the same recipients get a **not connected** alert (admin body includes **name**, **user id**, **email**, **client ID**, and current status).
- Check delivery status with: `GET /api/alerts/status`
- Trigger a test email with: `POST /api/alerts/test`

### Curl examples
```
curl http://localhost:4000/api/health
```
```
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"example.user1@example.com\",\"password\":\"TestPass1234!\"}"
```

WhatsApp HTTP API examples (`/api/whatsapp/status`, `/send`, `/messages`): see **`docs/WHATSAPP_API.md`**.

```
curl -X POST http://localhost:4000/api/whatsapp/send-poll \
  -H "Content-Type: application/json" \
  -d "{\"userId\":3,\"apiKey\":\"YOUR_API_KEY\",\"phoneNumber\":\"+94717177326\",\"question\":\"Lunch?\",\"options\":[\"Pizza\",\"Burger\"],\"allowMultipleAnswers\":false}"
```

```
curl -X POST http://localhost:4000/api/alerts/test \
  -H "Content-Type: application/json" \
  -d "{\"subject\":\"Test alert\",\"text\":\"Email check\"}"
```
```
curl http://localhost:4000/api/alerts/status
```

### Notes & limitations
- WhatsApp Web automation can lead to bans; use carefully.
- QR must be scanned from the web UI to authenticate.

## About
**A WhatsApp API client that operates via the WhatsApp Web browser.**

The library launches the WhatsApp Web browser app via Puppeteer, accessing its internal functions and creating a managed instance to reduce the risk of being blocked. This gives the API client nearly all WhatsApp Web features for dynamic use in a Node.js application.

> [!IMPORTANT]
> **It is not guaranteed you will not be blocked by using this method. WhatsApp does not allow bots or unofficial clients on their platform, so this shouldn't be considered totally safe.**

## Links

* [GitHub][gitHub]
* [Guide][guide] ([source][guide-source])
* [Documentation][documentation] ([source][documentation-source])
* [Discord Server][discord]
* [npm][npm]

## Installation

The module is available on [npm][npm] via `npm i whatsapp-web.js`!

> [!NOTE]
> **Node ``v18`` or higher, is required.**  
> See the [Guide][guide] for quick upgrade instructions.

## Example usage

```js
const { Client } = require('whatsapp-web.js');

const client = new Client();

client.on('qr', (qr) => {
    // Generate and scan this code with your phone
    console.log('QR RECEIVED', qr);
});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('message', msg => {
    if (msg.body == '!ping') {
        msg.reply('pong');
    }
});

client.initialize();
```

Take a look at [example.js][examples] for another examples with additional use cases.  
For further details on saving and restoring sessions, explore the provided [Authentication Strategies][auth-strategies].


## Supported features

| Feature  | Status |
| ------------- | ------------- |
| Multi Device  | ✅  |
| Send messages  | ✅  |
| Receive messages  | ✅  |
| Send media (images/audio/documents)  | ✅  |
| Send media (video)  | ✅ [(requires Google Chrome)][google-chrome]  |
| Send stickers | ✅ |
| Receive media (images/audio/video/documents)  | ✅  |
| Send contact cards | ✅ |
| Send location | ✅ |
| Send buttons | ❌  [(DEPRECATED)][deprecated-video] |
| Send lists | ❌  [(DEPRECATED)][deprecated-video] |
| Receive location | ✅ | 
| Message replies | ✅ |
| Join groups by invite  | ✅ |
| Get invite for group  | ✅ |
| Modify group info (subject, description)  | ✅  |
| Modify group settings (send messages, edit info)  | ✅  |
| Add group participants  | ✅  |
| Kick group participants  | ✅  |
| Promote/demote group participants | ✅ |
| Mention users | ✅ |
| Mention groups | ✅ |
| Mute/unmute chats | ✅ |
| Block/unblock contacts | ✅ |
| Get contact info | ✅ |
| Get profile pictures | ✅ |
| Set user status message | ✅ |
| React to messages | ✅ |
| Create polls | ✅ |
| Channels | ✅ |
| Vote in polls | 🔜 |
| Communities | 🔜 |

Something missing? Make an issue and let us know!

## Contributing

Feel free to open pull requests; we welcome contributions! However, for significant changes, it's best to open an issue beforehand. Make sure to review our [contribution guidelines][contributing] before creating a pull request. Before creating your own issue or pull request, always check to see if one already exists!

## Supporting the project

You can support the maintainer of this project through the links below

- [Support via GitHub Sponsors][gitHub-sponsors]
- [Support via PayPal][support-payPal]
- [Sign up for DigitalOcean][digitalocean] and get $200 in credit when you sign up (Referral)

## Disclaimer

This project is not affiliated, associated, authorized, endorsed by, or in any way officially connected with WhatsApp or any of its subsidiaries or its affiliates. The official WhatsApp website can be found at [whatsapp.com][whatsapp]. "WhatsApp" as well as related names, marks, emblems and images are registered trademarks of their respective owners. Also it is not guaranteed you will not be blocked by using this method. WhatsApp does not allow bots or unofficial clients on their platform, so this shouldn't be considered totally safe.

## License

Copyright 2019 Pedro S Lopez  

Licensed under the Apache License, Version 2.0 (the "License");  
you may not use this project except in compliance with the License.  
You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.  

Unless required by applicable law or agreed to in writing, software  
distributed under the License is distributed on an "AS IS" BASIS,  
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  
See the License for the specific language governing permissions and  
limitations under the License.  


[guide]: https://guide.wwebjs.dev/guide
[guide-source]: https://github.com/wwebjs/wwebjs.dev/tree/main
[documentation]: https://docs.wwebjs.dev/
[documentation-source]: https://github.com/pedroslopez/whatsapp-web.js/tree/main/docs
[discord]: https://discord.gg/H7DqQs4
[gitHub]: https://github.com/pedroslopez/whatsapp-web.js
[npm]: https://npmjs.org/package/whatsapp-web.js
[nodejs]: https://nodejs.org/en/download/
[examples]: https://github.com/pedroslopez/whatsapp-web.js/blob/master/example.js
[auth-strategies]: https://wwebjs.dev/guide/creating-your-bot/authentication.html
[google-chrome]: https://wwebjs.dev/guide/creating-your-bot/handling-attachments.html#caveat-for-sending-videos-and-gifs
[deprecated-video]: https://www.youtube.com/watch?v=hv1R1rLeVVE
[gitHub-sponsors]: https://github.com/sponsors/pedroslopez
[support-payPal]: https://www.paypal.me/psla/
[digitalocean]: https://m.do.co/c/73f906a36ed4
[contributing]: https://github.com/pedroslopez/whatsapp-web.js/blob/main/CODE_OF_CONDUCT.md
[whatsapp]: https://whatsapp.com
