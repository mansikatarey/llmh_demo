# Scully: voice rebooking assistant (demo)
Static site. Host on GitHub Pages (Settings > Pages > main / root). Voice needs https and Chrome, Edge or Safari.

Flow: "What's your booking number?" > "How can I help you?" > "Rebook my cancelled flight" > options > "option two" > "yes".
Booking numbers are not validated in the demo (any 5-8 letters/digits work, e.g. AX7K2Q).

## ElevenLabs voice (optional, key stays secret)
1. Pick a voice in ElevenLabs and copy its Voice ID. Create an API key.
2. `npm i -g wrangler`, then in this folder: `wrangler deploy`
3. `wrangler secret put ELEVEN_KEY`, `wrangler secret put VOICE_ID`, `wrangler secret put ALLOWED_ORIGIN` (https://YOUR-USER.github.io)
4. Put the worker URL in `config.js` as TTS_PROXY and push. Without it the browser's built-in voice is used.

## Files
data.js (mock data) · app.js (conversation, ranking, voice) · config.js · worker.js + wrangler.toml (TTS proxy) · index.html, style.css

## Architecture
Mic > SpeechRecognition > step-based intent rules > deterministic ranking > short spoken reply (ElevenLabs via proxy) + option cards on screen > agent handoff > simulated verification.
Production: LLM with tool calls for intent, real PNR/inventory/maps/policy APIs, OTP/SSO identity, gated rebooking executor.
