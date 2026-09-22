# Make `aurora-app` Yours: Step-by-Step

This guide explains how to create your own version of `sahildavid-dev/aurora-app`, customize it, connect your own services, and deploy it safely.

You have two options:

1. Use GitHub’s Fork button — GitHub will visibly label your repository as a fork.
2. Create an independent repository and add the original as `upstream` — recommended if you do not want the fork label but still want to pull future changes from the original repository.

Because you do not want the repository to display that it was forked, use Option 2.

---

## Part 1: Create an independent GitHub repository

### Step 1: Create a new empty repository

Go to GitHub and create a new repository under your own account.

Recommended name:

```text
waymark
```

Other possible names:

```text
waymark-app
place-memory
luma-places
```

Important:

- Do not click Fork.
- Do not initialize the repository with a README.
- Do not add a `.gitignore` yet.
- Do not add a license yet.

Your new repository should look like this:

```text
https://github.com/YOUR_USERNAME/waymark
```

Replace `YOUR_USERNAME` with your GitHub username.

---

## Part 2: Clone the original repository locally

Clone the original repository into a local directory named `waymark`:

```bash
git clone https://github.com/sahildavid-dev/aurora-app.git waymark
cd waymark
```

Check the current remote:

```bash
git remote -v
```

At this point, the original repository will normally be configured as `origin`.

---

## Part 3: Configure your own repository as `origin`

Remove the original repository from the `origin` remote:

```bash
git remote remove origin
```

Add your new GitHub repository as `origin`:

```bash
git remote add origin https://github.com/YOUR_USERNAME/waymark.git
```

Add the original repository as `upstream`:

```bash
git remote add upstream https://github.com/sahildavid-dev/aurora-app.git
```

Verify the remotes:

```bash
git remote -v
```

You should see:

```text
origin    https://github.com/YOUR_USERNAME/waymark.git (fetch)
origin    https://github.com/YOUR_USERNAME/waymark.git (push)
upstream  https://github.com/sahildavid-dev/aurora-app.git (fetch)
upstream  https://github.com/sahildavid-dev/aurora-app.git (push)
```

Use the remotes this way:

```text
origin    = your repository
upstream  = the original repository
```

For extra safety, disable pushing to `upstream`:

```bash
git remote set-url --push upstream DISABLED
```

Verify again:

```bash
git remote -v
```

You should now see something similar to:

```text
origin    https://github.com/YOUR_USERNAME/waymark.git (fetch)
origin    https://github.com/YOUR_USERNAME/waymark.git (push)
upstream  https://github.com/sahildavid-dev/aurora-app.git (fetch)
upstream  DISABLED (push)
```

This gives you a standalone repository with no GitHub fork label while preserving the ability to fetch changes from the original repository.

---

## Part 4: Push the code to your repository

Make sure the default branch is named `main`:

```bash
git branch -M main
```

Push the project to your repository:

```bash
git push -u origin main
```

Your project should now be available at:

```text
https://github.com/YOUR_USERNAME/waymark
```

Because you created a new repository instead of using GitHub's Fork button, it should not display the normal `forked from` label.

Important history note:
The Git history came from the original repository. Someone inspecting the commit history may still be able to see that the code originally came from `sahildavid-dev/aurora-app`, even though GitHub will not show the repository as a fork.

If you want a completely new history, see Part 17: Optional — create a completely new Git history.

---

## Part 5: Create a development branch

Do not make all changes directly on `main`.

Create a working branch:

```bash
git switch -c customize-waymark
```

If your Git version does not support `git switch`, use:

```bash
git checkout -b customize-waymark
```

Check your current branch:

```bash
git branch
```

You should see:

```text
* customize-waymark
  main
```

---

## Part 6: Install the project

This repository is a Nuxt 4 TypeScript application.

Check your installed versions:

```bash
node --version
npm --version
```

Use a current Node.js LTS release.

Install dependencies:

```bash
npm install
```

For a clean install based on the lockfile, use:

```bash
npm ci
```

Available scripts:

```bash
npm run dev       # Start the development server
npm run build     # Create a production build
npm run generate  # Generate a static build
npm run preview   # Preview a production build
```

Start the development server:

```bash
npm run dev
```

Open the local application:

```text
http://localhost:3000
```

The current browser interface is a minimal Aurora landing page. The main WhatsApp functionality is implemented through server routes.

---

## Part 7: Create your local environment file

The repository contains `.env.example` and ignores real environment files.

On macOS, Linux, or Git Bash:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Open `.env` and fill in your own service values.

Never commit `.env`.

The repository's `.gitignore` is configured to ignore local environment files while keeping `.env.example` tracked.

---

## Part 8: Configure your own services

This project depends on:

```text
Twilio WhatsApp
Trigger.dev
AWS Amplify
```

The AI processing is expected to happen in a separate project through a Trigger.dev task named:

```text
capture-agent
```

Your `.env` should contain:

```dotenv
PUBLIC_URL=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=
TRIGGER_SECRET_KEY=
INTERNAL_API_SECRET=
```

### `PUBLIC_URL`

The public URL where this application can be reached.

For local development with ngrok:

```dotenv
PUBLIC_URL=https://your-ngrok-domain.ngrok-free.app
```

For production:

```dotenv
PUBLIC_URL=https://your-production-domain.com
```

This must match the URL configured in Twilio, including the correct path when configuring the webhook.

### `TWILIO_ACCOUNT_SID`

Your own Twilio Account SID.

Do not reuse credentials belonging to the original project owner.

### `TWILIO_AUTH_TOKEN`

Your own Twilio Auth Token.

Do not commit it or place it in frontend code.

### `TWILIO_WHATSAPP_FROM`

Your Twilio WhatsApp sender.

Example:

```dotenv
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

Use the sender assigned to your own Twilio account.

### `TRIGGER_SECRET_KEY`

Your Trigger.dev secret key. It allows this app to trigger the `capture-agent` task.

### `INTERNAL_API_SECRET`

A private shared secret used between this app and your agent project.

Generate a new secret:

```bash
openssl rand -hex 32
```

Use the same value in:

```text
waymark/.env
your agent project's environment configuration
```

Do not reuse the original owner's secret.

---

## Part 9: Create or connect your own Trigger.dev project

The original app calls the task:

```text
capture-agent
```

You need to decide whether you will:

1. Use the original `aurora-agents` project, if you have permission and access.
2. Create your own copy of the agent project.
3. Build your own replacement Trigger.dev task.

The safest independent setup is to use your own agent project and your own Trigger.dev credentials.

Your task must accept this payload:

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

When the agent finishes, it should call your application:

```http
POST https://YOUR_DOMAIN/api/internal/notify
Authorization: Bearer YOUR_INTERNAL_API_SECRET
Content-Type: application/json
```

Example request body:

```json
{
  "to": "whatsapp:+15551234567",
  "body": "I found and saved that place."
}
```

Your application and your agent must use the same `INTERNAL_API_SECRET`.

The task name must remain `capture-agent` unless you also update the task identifier in `server/api/webhooks/twilio.post.ts` and the corresponding Trigger.dev project.

---

## Part 10: Test the application locally

Start the application:

```bash
npm run dev
```

Expose the local server publicly with ngrok:

```bash
ngrok http 3000
```

ngrok will provide a URL similar to:

```text
https://example.ngrok-free.app
```

Set that URL in `.env`:

```dotenv
PUBLIC_URL=https://example.ngrok-free.app
```

Configure your Twilio WhatsApp webhook as:

```text
https://example.ngrok-free.app/api/webhooks/twilio
```

Use the `POST` method.

Then send a WhatsApp message to your Twilio number.

Expected flow:

```text
WhatsApp message
    ↓
Twilio
    ↓
Your app: POST /api/webhooks/twilio
    ↓
Your Trigger.dev capture-agent
    ↓
Your app: POST /api/internal/notify
    ↓
Twilio REST API
    ↓
WhatsApp reply
```

---

## Part 11: Test the internal reply endpoint

Start the application:

```bash
npm run dev
```

Send a test request:

```bash
curl -X POST http://localhost:3000/api/internal/notify \
  -H "Authorization: Bearer YOUR_INTERNAL_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "whatsapp:+15551234567",
    "body": "Test message from my Waymark app."
  }'
```

Replace `YOUR_INTERNAL_API_SECRET` with the value in your `.env` file.

This requires:

- valid Twilio credentials
- a configured WhatsApp sender
- a valid WhatsApp destination

---

## Part 12: Rename the product in the code

If you are renaming Aurora to Waymark, update the visible branding.

The current landing page is in:

```text
app/app.vue
```

Update the page title and description:

```vue
<script setup lang="ts">
useHead({
  title: 'Waymark',
  meta: [
    {
      name: 'description',
      content: 'Waymark — a simple way to remember the places you find.'
    }
  ]
})
</script>
```

Update the visible heading and tagline:

```vue
<template>
  <div class="page">
    <NuxtRouteAnnouncer />
    <main class="hero">
      <h1>waymark</h1>
      <p class="tagline">a simple way to remember the places you find</p>
    </main>
  </div>
</template>
```

Search the repository for these terms:

```text
Aurora
aurora
```

Review and update references in:

```text
README.md
package.json
app/app.vue
.env.example
amplify.yml
server comments
deployment documentation
integration documentation
```

Do not blindly rename technical identifiers. For example, this task ID may need to remain:

```text
capture-agent
```

That identifier must match the Trigger.dev task name.

---

## Part 13: Rename the npm project

Update the root `package.json`:

```json
{
  "name": "waymark",
  "type": "module",
  "private": true
}
```

Run:

```bash
npm install
```

This updates the root package metadata in `package-lock.json`.

Verify that the root package name in `package-lock.json` is:

```json
"name": "waymark"
```

Do not rename dependency package names inside the lockfile. Only the root project name should change.

---

## Part 14: Update the README

Replace the original README with documentation for your own project.

Update:

- project name
- product description
- setup instructions
- environment variables
- Twilio setup
- Trigger.dev setup
- local development instructions
- deployment instructions
- architecture diagram
- relationship to your agent project
- security warnings

Remove references to credentials, URLs, infrastructure, or deployments belonging to the original project owner.

Example opening:

```markdown
# Waymark

Waymark is a WhatsApp-powered place memory assistant. Send a place name,
description, Google Maps link, or photo, and Waymark uses an asynchronous AI
workflow to identify the place and send a confirmation back through WhatsApp.
```

---

## Part 15: Replace the branding assets

Replace the existing favicon:

```text
public/favicon.ico
```

Use your own brand asset.

Review `public/robots.txt` and decide whether you want search engines to crawl the public landing page.

If the application later contains private user data, do not make private application routes publicly crawlable.

---

## Part 16: Make and commit your first changes

Check the current state:

```bash
git status
```

Review your changes:

```bash
git diff
```

Run the production build:

```bash
npm run build
```

If the build succeeds, commit your changes:

```bash
git add .
git commit -m "Customize project branding and setup"
```

Push your branch:

```bash
git push -u origin customize-waymark
```

Open a pull request from `customize-waymark` into your own `main` branch if you want to review the changes before merging.

---

## Part 17: Optional — create a completely new Git history

If you do not want the original commit history in your repository, create a new root commit.

Make sure your current working tree is clean first:

```bash
git status
```

Create an orphan branch:

```bash
git switch --orphan new-main
```

Remove the old index from the new branch:

```bash
git rm -rf --cached .
```

Re-add the current files:

```bash
git add .
```

Create a new initial commit:

```bash
git commit -m "Initial commit"
```

Rename the branch to `main`:

```bash
git branch -M main
```

Force-push the new history to your repository:

```bash
git push --force origin main
```

Use this only if you understand that the previous history on your repository will be replaced.

This removes the original commit history from your repository, but it does not change the copyright or license status of the code. Review the original repository's license before redistributing the project.

---

## Part 18: Keep your repository synchronized with the original

When the original repository receives changes, fetch them:

```bash
git fetch upstream
```

View remote branches:

```bash
git branch -r
```

Update your local `main` branch by merging the original repository's `main` branch:

```bash
git switch main
git merge upstream/main
```

Push the update to your repository:

```bash
git push origin main
```

If you have customization changes on a feature branch, update `main` first and then merge it into your branch:

```bash
git switch customize-waymark
git merge main
```

Or rebase your branch:

```bash
git switch customize-waymark
git rebase main
```

Use `merge` for the simpler workflow. Use `rebase` only if you are comfortable resolving conflicts and rewriting the feature branch's local history.

Recommended synchronization workflow:

```bash
git fetch upstream
git switch main
git merge upstream/main
git push origin main
git switch customize-waymark
git merge main
```

If conflicts occur:

```bash
git status
```

Open the conflicted files, choose the correct content, then run:

```bash
git add CONFLICTED_FILE
git commit
```

If you are in the middle of a rebase instead:

```bash
git add CONFLICTED_FILE
git rebase --continue
```

To cancel a merge:

```bash
git merge --abort
```

To cancel a rebase:

```bash
git rebase --abort
```

---

## Part 19: Deploy your own copy to AWS Amplify

The repository includes `amplify.yml`.

The Amplify build process runs approximately:

```bash
npm ci
NODE_OPTIONS=--max-old-space-size=4096 npm run build
```

Before deploying:

1. Create or select your own AWS Amplify app.
2. Connect it to your GitHub repository.
3. Select your repository.
4. Select the `main` branch.
5. Add these environment variables in Amplify:

```text
PUBLIC_URL
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_WHATSAPP_FROM
TRIGGER_SECRET_KEY
INTERNAL_API_SECRET
```

6. Deploy the application.
7. Copy the deployed public URL.
8. Set that URL as `PUBLIC_URL`.
9. Redeploy if the value was not available during the first build.
10. Configure Twilio's webhook URL as:

```text
https://YOUR_AMPLIFY_DOMAIN/api/webhooks/twilio
```

The existing `amplify.yml` writes environment values into `.env` before the Nuxt build, so configure them before the build starts.

Do not put secrets in:

- `app/app.vue`
- public runtime configuration
- browser JavaScript
- README files
- Git commits
- screenshots
- issue comments
- client-side source code

---

## Part 20: Add your own domain

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

The URL must match exactly. The application uses `PUBLIC_URL` to reconstruct the URL used for Twilio signature validation.

If the URL does not match the URL configured in Twilio, valid requests may be rejected.

---

## Part 21: Production checklist

### Repository ownership

```text
[ ] Repository is under your GitHub account
[ ] Repository was created independently rather than using Fork
[ ] Repository name is yours
[ ] Repository description is yours
[ ] Original credentials are not present
[ ] Original deployment URLs are removed
[ ] Original secrets are not present
[ ] Original commit history is intentionally retained or removed
[ ] The original repository's license has been reviewed
```

### Local development

```text
[ ] npm install works
[ ] npm ci works
[ ] npm run dev works
[ ] npm run build works
[ ] .env is ignored
[ ] .env.example contains no secrets
[ ] The branding has been updated
[ ] The README describes your project
```

### Twilio

```text
[ ] Your own Twilio account is used
[ ] Your own WhatsApp sender is configured
[ ] Webhook URL points to your domain
[ ] Webhook method is POST
[ ] Signature validation succeeds
[ ] Media download works
[ ] Oversized media is handled safely
[ ] Outbound message sending works
```

### Trigger.dev

```text
[ ] Your own Trigger.dev project is configured
[ ] capture-agent exists or has been replaced
[ ] TRIGGER_SECRET_KEY is yours
[ ] Agent payload matches the app payload
[ ] Agent knows your callback URL
[ ] Agent uses your INTERNAL_API_SECRET
[ ] MessageSid idempotency is preserved
```

### AWS Amplify

```text
[ ] Your own AWS Amplify app is used
[ ] Production environment variables are configured
[ ] Environment variables are available before the build
[ ] Build succeeds
[ ] Public URL is correct
[ ] Twilio webhook is updated after deployment
[ ] Production WhatsApp test succeeds
```

### Security

```text
[ ] No .env files are committed
[ ] No Twilio Auth Token is committed
[ ] No Trigger.dev secret is committed
[ ] No internal API secret is committed
[ ] No secrets are included in frontend code
[ ] Internal endpoint requires bearer authentication
[ ] Webhook requires Twilio signature validation
[ ] Twilio destinations are restricted to whatsapp:
[ ] Secrets are different from the original project owner's secrets
```

---

## Part 22: Recommended order of work

Follow this order:

```text
1. Create a new empty GitHub repository without using Fork
2. Clone the original repository locally
3. Replace the original origin remote with your repository
4. Add the original repository as upstream
5. Disable pushing to upstream
6. Push the code to your repository
7. Create a customization branch
8. Install dependencies
9. Create .env
10. Obtain your own Twilio credentials
11. Obtain your own Trigger.dev credentials
12. Generate your own INTERNAL_API_SECRET
13. Confirm or create your own capture-agent
14. Run the application locally
15. Test the internal notify endpoint
16. Test the Twilio webhook
17. Rename the product in the code
18. Update package.json
19. Update package-lock.json through npm install
20. Update README.md
21. Replace favicon.ico
22. Review robots.txt
23. Review task names and integrations
24. Run npm run build
25. Commit your changes
26. Push your branch
27. Deploy your own Amplify app
28. Configure Amplify environment variables
29. Update PUBLIC_URL
30. Update the Twilio webhook
31. Run a production test
32. Add automated tests and CI before expanding features
33. Periodically fetch and merge changes from upstream
```

---

## Important distinction

Creating an independent repository makes the GitHub repository yours, but it does not automatically make the connected infrastructure yours.

You must replace or recreate:

```text
original GitHub repository relationship
original Twilio account
original Twilio WhatsApp sender
original Trigger.dev project
original Trigger.dev secret
original internal API secret
original AWS Amplify app
original production domain
original deployment environment variables
```

The safest principle is:

> Use the code, but recreate the infrastructure, credentials, and deployment under your own accounts.

After completing this guide, you will have:

- your own standalone GitHub repository
- no normal GitHub fork label
- an `upstream` remote pointing to the original repository
- the ability to pull future changes from the original
- your own branding
- your own Twilio account
- your own Trigger.dev project
- your own internal secret
- your own AWS Amplify deployment
- your own WhatsApp-to-AI pipeline

If you want, I can now turn this into:
- a shorter “do this in 1 hour” version
- a ready-to-paste `README.md`
- a step-by-step Git command sequence for a clean independent repository
- a “brand rename checklist” for turning Aurora into Waymark