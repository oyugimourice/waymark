// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // Server-only secrets — never exposed to the client bundle (nothing here
  // is under `public`). Defaults are read from `process.env` right here,
  // which Nitro evaluates at BUILD time, then baked into the server
  // bundle. That's deliberate: on Amplify's Lambda-backed SSR compute,
  // console-configured env vars aren't reliably present in the Lambda's
  // runtime environment, but they are present during `nuxt build`. Reading
  // `process.env` directly in a route handler (evaluated per-request, at
  // runtime) is what was failing; reading it here bakes the value in once,
  // at a point where it's actually available. (Nitro will still let a
  // matching `NUXT_*`-prefixed env var override a given key at runtime,
  // per Nuxt's usual convention — see https://nuxt.com/docs/guide/going-further/runtime-config
  // — but nothing here depends on that.)
  runtimeConfig: {
    publicUrl: process.env.PUBLIC_URL ?? '',
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    twilioWhatsappFrom: process.env.TWILIO_WHATSAPP_FROM ?? '',
    triggerSecretKey: process.env.TRIGGER_SECRET_KEY ?? '',
    internalApiSecret: process.env.INTERNAL_API_SECRET ?? ''
  },

  // Allow the Vite dev server to accept requests coming through an ngrok
  // tunnel (used to expose the Twilio webhook while developing locally).
  // Dev-only — the production build doesn't run the Vite dev server.
  vite: {
    server: {
      allowedHosts: ['.ngrok-free.app', '.ngrok.io', '.ngrok.app']
    }
  }
})
