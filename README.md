# Waymark

Waymark is a WhatsApp-powered place memory assistant.

Send Waymark a place name, description, Google Maps link, photo, or a combination of these through WhatsApp. Waymark forwards the message to an asynchronous AI workflow that identifies the place, extracts structured information, and sends a response back to you through WhatsApp.

This repository contains the **Waymark web application and messaging integration layer**. It owns the Twilio WhatsApp webhook, handles incoming media, triggers the AI workflow, and sends replies.

The actual AI reasoning and place-resolution work happens in a separate Trigger.dev project.

---

## What Waymark Does

Waymark is designed to make saving places simple.

A user can send:

- A place name
- A rough place description
- A Google Maps link
- A photo of a storefront, sign, menu, or landmark
- A message with both text and an image

Waymark then:

1. Receives the WhatsApp message through Twilio.
2. Verifies that the request came from Twilio.
3. Extracts the message text and sender information.
4. Downloads the first supported image attachment, if one exists.
5. Sends the message to the asynchronous `capture-agent` task.
6. Waits for the agent to call back after processing.
7. Sends the final response to the user through Twilio WhatsApp.

The product is intended to be a low-friction way to remember places without requiring users to open a complex application or fill out a form.

---

## Architecture

```text
WhatsApp user
      │
      ▼
Twilio WhatsApp
      │
      │ POST /api/webhooks/twilio
      ▼
Waymark
      │
      │ Trigger.dev SDK
      ▼
capture-agent
      │
      │ POST /api/internal/notify
      ▼
Waymark
      │
      │ Twilio REST API
      ▼
WhatsApp user
```

### Why the workflow is asynchronous

The AI task may take significantly longer than the time Twilio allows for a webhook response.

The inbound webhook therefore does not wait for the AI task to complete.

Instead, it:

1. Validates the request.
2. Extracts the input.
3. Triggers the external task.
4. Immediately returns an empty HTTP 200 response.
5. Allows the agent to send the final response later through `/api/internal/notify`.

This is especially important when the app is deployed with AWS Amplify SSR, where server execution may stop shortly after the response is returned.

The webhook must remain:

- Thin
- Stateless
- Fast
- Idempotent
- Free from background timers and polling

---

## Technology Stack

- [Nuxt 4](https://nuxt.com/)
- [Vue 3](https://vuejs.org/)
- TypeScript
- Nitro server routes
- [Twilio WhatsApp API](https://www.twilio.com/whatsapp)
- [Trigger.dev](https://trigger.dev/)
- [Zod](https://zod.dev/)
- AWS Amplify Hosting
- Node.js
- npm

---

## Repository Structure

```text
.
├── app/
│   └── app.vue
│
├── server/
│   ├── api/
│   │   ├── internal/
│   │   │   └── notify.post.ts
│   │   │
│   │   └── webhooks/
│   │       └── twilio.post.ts
│   │
│   ├── plugins/
│   │   └── trigger.ts
│   │
│   └── utils/
│       └── internalAuth.ts
│
├── public/
│   ├── favicon.ico
│   └── robots.txt
│
├── .env.example
├── .gitignore
├── amplify.yml
├── nuxt.config.ts
├── package.json
├── package-lock.json
└── tsconfig.json
```

### Important files

| File | Responsibility |
|---|---|
| `app/app.vue` | Waymark landing page and page metadata |
| `server/api/webhooks/twilio.post.ts` | Receives and processes inbound Twilio WhatsApp messages |
| `server/api/internal/notify.post.ts` | Sends AI-generated replies through Twilio |
| `server/utils/internalAuth.ts` | Authenticates internal agent requests |
| `server/plugins/trigger.ts` | Configures the Trigger.dev SDK |
| `nuxt.config.ts` | Defines Nuxt runtime configuration and server secrets |
| `amplify.yml` | Defines the AWS Amplify build process |
| `.env.example` | Documents required environment variables |
| `public/favicon.ico` | Browser favicon |
| `public/robots.txt` | Search-engine crawling rules |

---

## How the Request Flow Works

### 1. A user sends a WhatsApp message

The user sends text, an image, or both to the Waymark WhatsApp number.

### 2. Twilio sends a webhook request

Twilio sends the incoming message to:

```text
POST /api/webhooks/twilio
```

The request contains fields such as:

```text
From
MessageSid
Body
NumMedia
MediaUrl0
MediaContentType0
```

### 3. Waymark validates the request

Waymark checks the `X-Twilio-Signature` header using the Twilio Auth Token.

If the signature is invalid, the request is rejected.

### 4. Waymark prepares the input

Waymark:

- Trims the incoming text.
- Identifies the sender.
- Reads the Twilio message SID.
- Searches for supported image attachments.
- Downloads the first supported image.
- Converts the image into base64.
- Enforces a maximum image size.

### 5. Waymark starts the AI task

Waymark triggers the external Trigger.dev task:

```text
capture-agent
```

The Twilio `MessageSid` is used as the idempotency key. If Twilio retries the same message, Trigger.dev can return the existing task run instead of starting another paid AI run.

### 6. Waymark acknowledges Twilio

The webhook returns an empty HTTP 200 response.

The empty response prevents Twilio from automatically sending a second response through TwiML.

### 7. The AI task processes the message

The external agent:

- Interprets the text.
- Interprets the image, if present.
- Resolves the place.
- Creates a response.
- Calls Waymark's internal notification endpoint.

### 8. Waymark sends the response

The agent calls:

```text
POST /api/internal/notify
```

Waymark verifies the internal bearer token and sends the response through the Twilio REST API.

---

## Installation

### Requirements

You need:

- Node.js LTS
- npm
- A Twilio account
- A Twilio WhatsApp sender
- A Trigger.dev project
- A `capture-agent` task or compatible replacement
- A public HTTPS URL for Twilio webhooks
- AWS Amplify if deploying to production

### Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/waymark.git
cd waymark
```

Replace `YOUR_USERNAME` with your GitHub username.

### Install dependencies

```bash
npm install
```

For a clean installation based on the lockfile:

```bash
npm ci
```

### Create the environment file

On macOS, Linux, or Git Bash:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Open `.env` and configure the required values before starting the application.

---

## Environment Variables

The application requires the following environment variables:

```dotenv
PUBLIC_URL=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=
TRIGGER_SECRET_KEY=
INTERNAL_API_SECRET=
```

### `PUBLIC_URL`

The public origin of the Waymark application.

Local example:

```dotenv
PUBLIC_URL=https://your-subdomain.ngrok-free.app
```

Production example:

```dotenv
PUBLIC_URL=https://waymark.example.com
```

Waymark uses this value to reconstruct the public URL used when validating Twilio signatures.

It must match the public URL configured in Twilio.

The Twilio webhook URL should be:

```text
https://YOUR_DOMAIN/api/webhooks/twilio
```

### `TWILIO_ACCOUNT_SID`

Your Twilio Account SID.

Waymark uses this value to:

- Download protected Twilio media.
- Authenticate with the Twilio REST API.
- Send WhatsApp messages.

### `TWILIO_AUTH_TOKEN`

Your Twilio Auth Token.

Waymark uses this value to:

- Validate inbound Twilio webhook signatures.
- Authenticate requests to Twilio media URLs.
- Send outbound WhatsApp messages.

Keep this value secret.

### `TWILIO_WHATSAPP_FROM`

The WhatsApp-enabled sender associated with your Twilio account.

Example:

```dotenv
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

Use the sender assigned to your own Twilio account.

### `TRIGGER_SECRET_KEY`

Your Trigger.dev access token.

Waymark uses this token to trigger the external `capture-agent` task.

### `INTERNAL_API_SECRET`

A shared secret used to authenticate requests from the AI agent back to Waymark.

Generate a secure value with:

```bash
openssl rand -hex 32
```

The same secret must be configured in:

- Waymark
- The external Trigger.dev agent project

Never commit this value to Git.

---

## Run the Application Locally

Start the Nuxt development server:

```bash
npm run dev
```

Open the application:

```text
http://localhost:3000
```

Available scripts:

```bash
npm run dev       # Start the development server
npm run build     # Build the production application
npm run generate  # Generate a static application
npm run preview   # Preview the production build
```

---

## Configure Local Twilio Development

Twilio requires a publicly reachable URL.

Start Waymark:

```bash
npm run dev
```

Expose the local server with ngrok:

```bash
ngrok http 3000
```

ngrok will provide a URL similar to:

```text
https://example.ngrok-free.app
```

Set the URL in `.env`:

```dotenv
PUBLIC_URL=https://example.ngrok-free.app
```

Configure the Twilio WhatsApp webhook as:

```text
https://example.ngrok-free.app/api/webhooks/twilio
```

Use the `POST` method.

Then send a WhatsApp message to your Twilio number.

The expected flow is:

```text
WhatsApp message
    ↓
Twilio
    ↓
POST /api/webhooks/twilio
    ↓
Trigger.dev capture-agent
    ↓
POST /api/internal/notify
    ↓
Twilio REST API
    ↓
WhatsApp reply
```

---

## API Reference

## `POST /api/webhooks/twilio`

Receives inbound WhatsApp messages from Twilio.

### Purpose

This endpoint is responsible for:

- Validating Twilio requests.
- Reading incoming message data.
- Downloading supported media.
- Building the agent payload.
- Triggering `capture-agent`.
- Returning an immediate response to Twilio.

### Authentication

The endpoint requires a valid Twilio signature:

```http
X-Twilio-Signature: <signature>
```

The signature is validated using:

- `TWILIO_AUTH_TOKEN`
- `PUBLIC_URL`
- The request path
- The request query string
- The incoming request body

The endpoint fails closed if `TWILIO_AUTH_TOKEN` or `PUBLIC_URL` is missing.

### Expected input fields

Twilio may send fields such as:

```text
From
MessageSid
Body
NumMedia
MediaUrl0
MediaContentType0
MediaUrl1
MediaContentType1
```

### Supported image types

Waymark supports:

```text
image/jpeg
image/png
image/webp
image/gif
```

Only the first supported image is downloaded.

### Image size limit

The raw image limit is:

```text
5 MB
```

Images larger than this limit are skipped.

This helps keep the Trigger.dev payload below its maximum size because base64 encoding increases the size of binary data.

### Payload sent to `capture-agent`

```typescript
{
  from: string
  messageSid: string
  receivedAt: string
  text: string
  image?: {
    data: string
    mediaType: string
  }
}
```

Example:

```json
{
  "from": "whatsapp:+15551234567",
  "messageSid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "receivedAt": "2026-09-22T12:00:00.000Z",
  "text": "A coffee shop with a garden near the river",
  "image": {
    "data": "base64-encoded-image-data",
    "mediaType": "image/jpeg"
  }
}
```

### Empty or incomplete messages

If the request is missing:

- `From`
- `MessageSid`
- both text and supported media

Waymark logs the request and returns HTTP 200 without triggering the AI task.

This is intentional. A `4xx` response would cause Twilio to retry a message that cannot be processed.

### Response

For a successfully handed-off request:

```text
HTTP 200
```

The response body is empty.

Waymark does not return the AI result from this endpoint because the result is delivered later through the callback flow.

---

## `POST /api/internal/notify`

Allows the external AI agent to send a WhatsApp reply through Waymark.

### Purpose

The AI agent does not need Twilio credentials. Instead, it calls this protected endpoint and Waymark sends the message through Twilio.

### Authentication

The request must include:

```http
Authorization: Bearer YOUR_INTERNAL_API_SECRET
```

The secret is compared using a constant-time comparison.

### Request body

```json
{
  "to": "whatsapp:+15551234567",
  "body": "I found and saved that place."
}
```

### Validation rules

- `to` must be present.
- `to` must begin with `whatsapp:`.
- `body` must be present.
- `body` must not be empty.
- Messages longer than 1,600 characters are truncated.

### Why destinations must begin with `whatsapp:`

The restriction prevents a leaked internal secret from being used to send arbitrary SMS messages through the Twilio account.

### Successful response

```json
{
  "ok": true,
  "sid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

### Example request

```bash
curl -X POST http://localhost:3000/api/internal/notify \
  -H "Authorization: Bearer YOUR_INTERNAL_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "whatsapp:+15551234567",
    "body": "Test message from Waymark."
  }'
```

---

## Trigger.dev Integration

Waymark triggers an external task named:

```text
capture-agent
```

The task is responsible for the AI portion of the workflow.

### Responsibilities of Waymark

Waymark owns:

- Twilio webhook validation
- Message extraction
- Image downloading
- Image encoding
- Trigger.dev task invocation
- Message idempotency
- Internal callback authentication
- Outbound Twilio messaging

### Responsibilities of `capture-agent`

The external task owns:

- Text interpretation
- Image interpretation
- Place identification
- Place resolution
- Structured place data
- AI-generated response text
- Calling `/api/internal/notify`

### Required task payload

```typescript
{
  from: string
  messageSid: string
  receivedAt: string
  text: string
  image?: {
    data: string
    mediaType: string
  }
}
```

### Required callback request

The agent should call:

```http
POST https://YOUR_DOMAIN/api/internal/notify
Authorization: Bearer YOUR_INTERNAL_API_SECRET
Content-Type: application/json
```

Example:

```json
{
  "to": "whatsapp:+15551234567",
  "body": "I found and saved that place."
}
```

### Important task-name requirement

The app currently triggers:

```text
capture-agent
```

If you rename the Trigger.dev task, update the task identifier in:

```text
server/api/webhooks/twilio.post.ts
```

The name in the Waymark app and the name in Trigger.dev must match.

---

## Security

Waymark uses several security layers.

### Twilio signature validation

Every inbound webhook must include a valid Twilio signature.

Requests with invalid signatures are rejected.

The application fails closed when the Twilio Auth Token or public URL is not configured.

### Internal bearer authentication

The `/api/internal/notify` endpoint requires:

```http
Authorization: Bearer YOUR_INTERNAL_API_SECRET
```

The secret is compared using a constant-time comparison rather than a normal string comparison.

### WhatsApp-only destinations

The notification endpoint only accepts destinations that begin with:

```text
whatsapp:
```

This prevents arbitrary SMS usage through the endpoint.

### Server-only secrets

The following values must remain server-only:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TRIGGER_SECRET_KEY`
- `INTERNAL_API_SECRET`

Do not place secrets in:

- `app/app.vue`
- browser JavaScript
- client-side components
- public runtime configuration
- README files
- screenshots
- Git commits
- issue comments
- frontend environment variables

### Environment files

`.env` is ignored by Git.

Only `.env.example` should be committed.

Before pushing code, check:

```bash
git status
git diff
```

If a secret is accidentally committed, rotate it immediately.

---

## Error Handling

### Inbound webhook errors

| Condition | Result |
|---|---|
| Missing Twilio Auth Token | HTTP 500 |
| Missing `PUBLIC_URL` | HTTP 500 |
| Invalid Twilio signature | HTTP 403 |
| Missing sender | HTTP 200 and log |
| Missing message SID | HTTP 200 and log |
| No text or supported image | HTTP 200 and log |
| Media download failure | HTTP 5xx |
| Trigger.dev failure | HTTP 5xx |

### Internal callback errors

| Condition | Result |
|---|---|
| Missing authorization header | HTTP 401 |
| Invalid bearer token | HTTP 401 |
| Missing internal secret | HTTP 500 |
| Invalid request body | HTTP 400 |
| Non-WhatsApp destination | HTTP 400 |
| Missing Twilio configuration | HTTP 500 |
| Twilio send failure | HTTP 502 |

---

## AWS Amplify Deployment

This repository includes an `amplify.yml` file for AWS Amplify Hosting.

The build process runs approximately:

```bash
npm ci
NODE_OPTIONS=--max-old-space-size=4096 npm run build
```

### Deployment steps

1. Create an AWS Amplify application.
2. Connect your GitHub repository.
3. Select the `main` branch.
4. Add the following environment variables in Amplify:

```text
PUBLIC_URL
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_WHATSAPP_FROM
TRIGGER_SECRET_KEY
INTERNAL_API_SECRET
```

5. Deploy the application.
6. Copy the deployed URL.
7. Set that URL as `PUBLIC_URL`.
8. Redeploy if the variable was not available during the initial build.
9. Configure Twilio with:

```text
https://YOUR_AMPLIFY_DOMAIN/api/webhooks/twilio
```

### Important Amplify behavior

The current configuration writes environment variables into `.env` before the Nuxt build.

That means the variables must be configured before the build starts.

Adding a variable after deployment may not affect the already-built server bundle until another deployment is performed.

---

## Custom Domain

After the Amplify deployment works, attach your own domain.

Example:

```text
https://waymark.example.com
```

Set:

```dotenv
PUBLIC_URL=https://waymark.example.com
```

Configure Twilio to use:

```text
https://waymark.example.com/api/webhooks/twilio
```

The public URL must match exactly.

If it does not match, Twilio signature validation may fail even when the request is genuinely coming from Twilio.

---

## Development Workflow

Create a feature branch:

```bash
git switch -c feature/my-change
```

If your Git version does not support `git switch`:

```bash
git checkout -b feature/my-change
```

Check your changes:

```bash
git status
git diff
```

Run the production build:

```bash
npm run build
```

Commit your changes:

```bash
git add .
git commit -m "Describe the change"
```

Push the branch:

```bash
git push -u origin feature/my-change
```

---

## Keeping Upstream Changes

If this repository was created from another repository and the original project is configured as `upstream`, fetch new changes with:

```bash
git fetch upstream
```

Update your local `main` branch:

```bash
git switch main
git merge upstream/main
```

Push the update to your repository:

```bash
git push origin main
```

Update your feature branch:

```bash
git switch feature/my-change
git merge main
```

Recommended workflow:

```bash
git fetch upstream
git switch main
git merge upstream/main
git push origin main
git switch feature/my-change
git merge main
```

If the original repository uses a different default branch, replace `upstream/main` with the correct branch name.

### Handling merge conflicts

Check the repository state:

```bash
git status
```

Open the conflicted files and choose the correct content.

Then mark the files as resolved:

```bash
git add CONFLICTED_FILE
```

Finish the merge:

```bash
git commit
```

To cancel a merge:

```bash
git merge --abort
```

---

## Testing

The current repository does not contain a complete automated test suite.

Before production use, add tests for:

- Twilio signature validation
- Missing configuration
- Invalid webhook requests
- Supported media detection
- Unsupported media handling
- Oversized media handling
- Trigger.dev invocation
- `MessageSid` idempotency
- Internal bearer authentication
- Invalid notification payloads
- WhatsApp destination validation
- Message truncation
- Twilio send failures

Recommended testing tools:

- Vitest
- Nuxt test utilities
- Mocked Twilio requests
- Mocked Trigger.dev requests

Suggested future scripts:

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "typecheck": "nuxt typecheck"
}
```

---

## Current Limitations

Waymark currently acts as an integration and messaging layer.

It does not yet include:

- A database
- Saved-place persistence
- User accounts
- A saved-place dashboard
- A map interface
- Place editing
- Place deletion
- Search and filtering
- Conversation history
- Follow-up conversations
- Automated tests
- A CI pipeline
- Advanced monitoring
- Rate limiting
- Cost tracking
- User data export and deletion tools

The current browser-facing interface is a minimal landing page.

The main implemented feature is the WhatsApp-to-AI-to-WhatsApp integration flow.

---

## Roadmap

### Phase 1: Stabilize the integration

- Add automated tests.
- Add runtime configuration validation.
- Add a health endpoint.
- Add structured logging.
- Add GitHub Actions CI.
- Verify Twilio retry behavior.
- Verify Trigger.dev idempotency.
- Add provider mocks for local development.

### Phase 2: Improve the WhatsApp experience

- Add immediate acknowledgment messages.
- Add clear failure responses.
- Add ambiguous-place handling.
- Add retry behavior for temporary provider failures.
- Improve response formatting.
- Add processing status messages.

### Phase 3: Add persistence

- Add a database.
- Store users by WhatsApp number.
- Store incoming captures.
- Store processing status.
- Store agent run IDs.
- Store resolved place data.
- Prevent duplicate saved places.

### Phase 4: Build the web application

- Add authentication.
- Add a saved places dashboard.
- Add map visualization.
- Add place detail pages.
- Add search and filters.
- Add editing and deletion.
- Add responsive mobile design.

### Phase 5: Add conversation features

- Support follow-up questions.
- Support place corrections.
- Support place retrieval.
- Store bounded conversation context.
- Add user preferences and categories.

### Phase 6: Production hardening

- Add rate limiting.
- Add replay protection.
- Add secret rotation.
- Add cost monitoring.
- Add load testing.
- Add privacy controls.
- Add data deletion tools.
- Add incident response documentation.

---

## Production Checklist

### Repository

- [ ] Repository is under your GitHub account.
- [ ] Repository name and description are correct.
- [ ] Waymark branding has been updated.
- [ ] README describes your version.
- [ ] Original deployment URLs have been removed.
- [ ] Original secrets are not present.
- [ ] The original repository's license has been reviewed.
- [ ] The repository has been reviewed for accidental credentials.

### Local development

- [ ] `npm install` works.
- [ ] `npm ci` works.
- [ ] `npm run dev` works.
- [ ] `npm run build` works.
- [ ] `.env` is ignored.
- [ ] `.env.example` contains no secrets.
- [ ] Local webhook testing works.
- [ ] Internal notification testing works.

### Twilio

- [ ] Your own Twilio account is used.
- [ ] Your own WhatsApp sender is configured.
- [ ] The webhook URL is correct.
- [ ] The webhook method is `POST`.
- [ ] Signature validation succeeds.
- [ ] Media downloads work.
- [ ] Oversized media is handled safely.
- [ ] Outbound messages are delivered.
- [ ] Twilio retries do not create duplicate agent runs.

### Trigger.dev

- [ ] Your own Trigger.dev project is configured.
- [ ] `capture-agent` exists or has been replaced.
- [ ] `TRIGGER_SECRET_KEY` is yours.
- [ ] The agent payload matches this README.
- [ ] The agent callback URL is correct.
- [ ] The agent uses the correct `INTERNAL_API_SECRET`.
- [ ] The `MessageSid` idempotency key is preserved.
- [ ] The agent can handle text-only messages.
- [ ] The agent can handle image messages.

### AWS Amplify

- [ ] Your own AWS Amplify application is used.
- [ ] Production environment variables are configured.
- [ ] Variables are available before the build.
- [ ] The production build succeeds.
- [ ] The production URL is correct.
- [ ] The Twilio webhook was updated after deployment.
- [ ] The production WhatsApp flow was tested.

### Security

- [ ] No `.env` files are committed.
- [ ] No Twilio Auth Token is committed.
- [ ] No Trigger.dev secret is committed.
- [ ] No internal API secret is committed.
- [ ] No secrets are included in frontend code.
- [ ] The internal endpoint requires bearer authentication.
- [ ] The webhook requires Twilio signature validation.
- [ ] Destinations are restricted to `whatsapp:`.
- [ ] Production secrets differ from development secrets.
- [ ] Logs do not contain credentials or raw image data.

---

## Contributing

Contributions are welcome.

Recommended workflow:

1. Create a feature branch.
2. Make a focused change.
3. Add or update tests.
4. Run the production build.
5. Update the documentation.
6. Open a pull request.

Example:

```bash
git switch -c feature/add-place-storage
npm install
npm run build
git add .
git commit -m "Add place storage"
git push -u origin feature/add-place-storage
```

---

## License

Before publishing, redistributing, or commercializing Waymark, review the license of the original repository and the licenses of the dependencies used by the project.

If the original repository does not contain a license, contact the original author before redistributing the code or presenting it as an open-source project.

---

## Project Status

Waymark is currently an integration-focused MVP foundation.

The core messaging architecture includes:

- Twilio WhatsApp webhook handling
- Twilio signature validation
- Optional image downloading
- Trigger.dev task invocation
- Message SID idempotency
- Secure internal callbacks
- Outbound WhatsApp message delivery
- AWS Amplify deployment configuration

The complete place-memory product still requires:

- Persistent storage
- A user-facing application
- Automated tests
- CI/CD
- Observability
- Production hardening
- Saved-place management
- Place retrieval and search
- Follow-up conversation support

---

## Maintainer Notes

Keep the integration contract synchronized with the external AI project.

### Capture payload

```typescript
{
  from: string
  messageSid: string
  receivedAt: string
  text: string
  image?: {
    data: string
    mediaType: string
  }
}
```

If this contract changes, update both:

```text
server/api/webhooks/twilio.post.ts
external capture-agent task
```

### Internal notification contract

```http
POST /api/internal/notify
Authorization: Bearer <INTERNAL_API_SECRET>
Content-Type: application/json
```

```json
{
  "to": "whatsapp:+15551234567",
  "body": "Your message here."
}
```

The app and the external agent must agree on:

- The payload shape
- The task name
- The callback URL
- The internal secret
- The supported media types
- The expected response behavior
