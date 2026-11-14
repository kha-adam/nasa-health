// Creates (or updates) the "Blue" voice agent on Fish Audio, then publishes it.
// Usage: npm run setup
import { agentConfig } from "./agent-config.mjs"
import { loadEnv, saveEnvValue } from "./env.mjs"

const env = loadEnv()
const KEY = env.FISH_API_KEY
if (!KEY) { console.error("FISH_API_KEY missing in .env"); process.exit(1) }
const voiceId = env.FISH_VOICE_ID || "933563129e564b19a115bedd57b7406a"
const api = async (method, path, body) => {
  const res = await fetch(`https://api.fish.audio${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 600)}`)
  return text ? JSON.parse(text) : {}
}

let agentId = env.FISH_AGENT_ID
if (!agentId) {
  const list = await api("GET", "/v1/agent/agents")
  agentId = list.agents?.find((a) => a.name === "Blue")?.agent_id
}
if (agentId) {
  await api("PATCH", `/v1/agent/agents/${agentId}/config`, agentConfig(voiceId))
  console.log(`Updated agent ${agentId}`)
} else {
  const created = await api("POST", "/v1/agent/agents", { name: "Blue", config: agentConfig(voiceId) })
  agentId = created.agent_id ?? created.id
  console.log(`Created agent ${agentId}`)
}
const pub = await api("POST", `/v1/agent/agents/${agentId}/publish`)
console.log(`Published version ${pub.version_number ?? "?"}`)
saveEnvValue("FISH_AGENT_ID", agentId)
