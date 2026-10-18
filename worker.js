// Cloudflare Worker: keeps your ElevenLabs key secret. Deploy with `npx wrangler deploy`.
// Set secrets: ELEVEN_KEY (API key), VOICE_ID (from your ElevenLabs voice library), ALLOWED_ORIGIN (e.g. https://you.github.io)
export default {
  async fetch(req, env) {
    const cors = { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') return new Response('POST only', { status: 405, headers: cors });
    const { text } = await req.json();
    if (!text || text.length > 600) return new Response('Bad text', { status: 400, headers: cors });
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${env.VOICE_ID}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': env.ELEVEN_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: 'eleven_flash_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.75 } })
    });
    return new Response(r.body, { status: r.status, headers: { ...cors, 'Content-Type': 'audio/mpeg' } });
  }
};
