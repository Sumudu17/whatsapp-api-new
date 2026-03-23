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
   - `ALERT_EMAIL_TO` (required for alerts)
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (legacy `MYSQL_*` still supported if `DB_*` is unset)
   - `ADMIN_EMAIL` (admin notifications on disconnect)

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
- After login, open:
  - `http://localhost:4000/` (dashboard)
  - `http://localhost:4000/connection` (QR + connection status)
  - `http://localhost:4000/api` (API key management)
  - `http://localhost:4000/profile` (name/email/password)

### API Endpoints
- `GET /api/health`
- `GET /api/version`
- `POST /api/auth/register`
- `POST /api/auth/verify-email-otp`
- `POST /api/auth/resend-email-otp`
- `POST /api/auth/login` (session cookie)
- `POST /api/auth/logout`
- `GET /api/auth/me` (session)
- `POST /api/auth/change-name` (session)
- `POST /api/auth/change-email/request-otp` (session)
- `POST /api/auth/change-email/verify-otp` (session)
- `POST /api/auth/change-password` (session)

- `GET /api/api-keys` (session)
- `POST /api/api-keys` (session; returns raw key once)
- `DELETE /api/api-keys/:id` (session)

- `POST /api/whatsapp/initialize` (session; triggers QR via WebSocket)
- `POST /api/whatsapp/logout` (session)
- `GET /api/whatsapp/status` (session; current in-memory state)
- `GET /api/whatsapp/connection` (session; state + last disconnect metadata from MySQL)
- `GET /api/whatsapp/groups` (session; only when state is `READY`)

- `POST /api/whatsapp/send` (session auth or API-key auth; routes through the correct WhatsApp session)

### WhatsApp Send Payload (session auth)
`POST /api/whatsapp/send`

Rules: provide exactly one of `to` or `groupId`.

```
{
  "to": "+94717177326",
  "message": "Hello World"
}
```

Example (group):

```
{
  "groupId": "12345@g.us",
  "message": "Hello World"
}
```

### WhatsApp Send Payload (API key auth)
`POST /api/whatsapp/send`

Rules: provide exactly one of `phoneNumber` or `groupId`.

#### Direct number request body

```
{
  "userId": 1,
  "apiKey": "RAW_API_KEY_VALUE",
  "phoneNumber": "+94717177326",
  "message": "Hello from API (direct number)"
}
```

#### Group message request body

```
{
  "userId": 1,
  "apiKey": "RAW_API_KEY_VALUE",
  "groupId": "1234567890-123456789@g.us",
  "message": "Hello from API (group message)"
}
```

Response (success):

```
{
  "success": true,
  "messageId": "..."
}
```

### Send WhatsApp Message (API examples)

#### 1) Session auth (cookie) - `POST /api/whatsapp/send`

Login (cookie stored in `cookies.txt`):

```
curl -c cookies.txt -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"example.user1@example.com\",\"password\":\"TestPass1234!\"}"
```

Send to a phone number:

```
curl -b cookies.txt -X POST http://localhost:4000/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -d "{\"to\":\"+94717177326\",\"message\":\"Hello from API (session)\"}"
```

Send to a group:

```
curl -b cookies.txt -X POST http://localhost:4000/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -d "{\"groupId\":\"12345@g.us\",\"message\":\"Hello from API (session, group)\"}"
```

#### 2) API key auth - `POST /api/whatsapp/send`

Send to a phone number:

```
curl -X POST http://localhost:4000/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -d "{\"userId\":1,\"apiKey\":\"RAW_API_KEY_VALUE\",\"phoneNumber\":\"+94717177326\",\"message\":\"Hello from API (apikey)\"}"
```

Send to a group:

```
curl -X POST http://localhost:4000/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -d "{\"userId\":1,\"apiKey\":\"RAW_API_KEY_VALUE\",\"groupId\":\"12345@g.us\",\"message\":\"Hello from API (apikey, group)\"}"
```

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

### WebSocket Events
- `qr`
- `ready`
- `authenticated`
- `disconnected`
- `state_change`

### Email Alerts
- If WhatsApp status is not `READY` for more than 5 minutes, an alert email is sent.
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
```
curl -X POST http://localhost:4000/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -d "{\"to\":\"+94717177326\",\"message\":\"Test message\"}"
```
```
curl -X POST http://localhost:4000/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -d "{\"userId\":1,\"apiKey\":\"RAW_API_KEY_VALUE\",\"phoneNumber\":\"+94717177326\",\"message\":\"Hello external\"}"
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
