import { defineConfig } from "vite"
import { loadEnv } from "./scripts/env.mjs"

/** Server-side endpoint: exchanges the secret FISH_API_KEY for a short-lived session token. */
function fishSessionApi() {
  return {
    name: "fish-session-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next()
        const env = loadEnv()
        const send = (status, body) => { res.statusCode = status; res.setHeader("Content-Type", "application/json"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(body)) }
        if (req.url === "/api/status") return send(200, { configured: !!(env.FISH_API_KEY && env.FISH_AGENT_ID) })
        if (req.url === "/api/session" && req.method === "POST") {
          if (!env.FISH_API_KEY || !env.FISH_AGENT_ID) return send(503, { error: "Run `npm run setup` first (FISH_API_KEY / FISH_AGENT_ID missing)." })
          let body = ""
          for await (const chunk of req) body += chunk
          let said = ""
          try { said = String(JSON.parse(body || "{}").said || "").slice(0, 300) } catch { /* ignore */ }
          const payload = { agent_id: env.FISH_AGENT_ID, timezone: "Europe/Paris" }
          // A typed opening message takes the place of the default greeting.
          if (said) payload.overrides = { first_message_prompt: `The user started the conversation with: "${said.replace(/"/g, "'")}". Answer that directly, warmly and briefly, in their language.` }
          try {
            const upstream = await fetch("https://api.fish.audio/v1/agent/sessions", {
              method: "POST",
              headers: { Authorization: `Bearer ${env.FISH_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
            const text = await upstream.text()
            if (!upstream.ok) return send(502, { error: `Fish Audio returned ${upstream.status}`, detail: text.slice(0, 300) })
            return send(200, JSON.parse(text))
          } catch (e) {
            return send(503, { error: "Fish Audio is unreachable (network?)." })
          }
        }
        send(404, { error: "not found" })
      })
    },
  }
}

export default defineConfig({ plugins: [fishSessionApi()] })
