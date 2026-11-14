# Blue — Fish Audio voice agent (simple page)

Talk to **Blue**, a warm voice agent hosted on Fish Audio Agents.

```bash
cd fish-blue
npm install
npm run setup   # creates/updates and publishes the "Blue" agent (reads FISH_API_KEY from .env)
npm run dev     # http://127.0.0.1:5180
```

- Tap the orb to start a voice session, type in the box, and tap **End** to hang up.
  Microphone access starts only after you choose to talk; there is no wake-word listener.
  Blue hangs up when you say goodbye; idle conversations close after 30 s.
- Voice: Fish Audio model **`933563129e564b19a115bedd57b7406a`**, rendered with
  Drama 3 + expressive mode at 0.95× speed. Change `FISH_VOICE_ID` in `.env`, then `npm run setup`.
- The API key stays server-side (Vite middleware `/api/session` mints short-lived session tokens).

Fish Audio documentation:
- Agents overview — https://docs.fish.audio/agents/overview
- Quickstart — https://docs.fish.audio/agents/quickstart
- Web SDK (`@fishaudio/agent-client`) — https://docs.fish.audio/agents/deploy/web-sdk
- Authenticated sessions — https://docs.fish.audio/agents/deploy/authenticated-sessions
- Voice & language — https://docs.fish.audio/agents/build/voice-language
- Full index — https://docs.fish.audio/llms.txt
