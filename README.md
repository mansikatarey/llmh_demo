# Voice Rebooking Assistant (demo)
Static site, no build. Host on GitHub Pages (Settings > Pages > main / root). Voice needs https and Chrome, Edge or Safari.

Try: "I need to rebook my flight, it got cancelled. What options do you have leaving from Toronto to Montreal within the same time?"
Then: "option two", "yes". Also: "cheapest", "fastest", "lowest risk", "start over".

## Files
- `data.js` mock itinerary, airports, ground times, flights (replace with APIs in production)
- `app.js` speech in/out, intent rules, ranking, handoff
- `style.css`, `index.html` UI

## Architecture
Mic > SpeechRecognition > intent parser > ranking engine (deterministic) > spoken reply (SpeechSynthesis) + cards > agent handoff > simulated verification.
Production: swap parser for an LLM with tool calls; swap data.js for PNR, inventory, maps and policy APIs; add OTP/SSO identity and a gated rebooking executor.
