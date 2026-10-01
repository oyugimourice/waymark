import { configure } from '@trigger.dev/sdk'

// @trigger.dev/sdk defaults to reading `process.env.TRIGGER_SECRET_KEY`
// itself, but everywhere else in this app now sources secrets from
// runtimeConfig (baked in at build time — see nuxt.config.ts) rather than
// process.env read at request time, so route the SDK through the same
// value for consistency. Registered once per cold start, per the SDK's own
// recommended usage (https://trigger.dev/docs/config/config-file#configure).
export default defineNitroPlugin(() => {
  const { triggerSecretKey } = useRuntimeConfig()
  if (triggerSecretKey) {
    configure({ accessToken: triggerSecretKey })
  } else {
    console.warn('TRIGGER_SECRET_KEY is not set — capture-agent triggers will fail')
  }
})
