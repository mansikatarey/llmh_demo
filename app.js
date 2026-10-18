const $ = id => document.getElementById(id);
const S = { step: 'ref', ref: null, rows: [], skipped: [], sort: 'time', sel: null, live: false, auto: true, gen: 0 };
const t = x => { const h = Math.floor(x / 60), mi = x % 60; return ((h + 11) % 12 + 1) + ':' + String(mi).padStart(2, '0') + (h < 12 ? ' AM' : ' PM'); };
const dur = x => Math.floor(x / 60) + 'h' + (x % 60 ? ' ' + x % 60 + 'm' : '');
const LEAD = ['There’s', 'Then there’s', 'And there’s'];
const line = (o, i) => o.rail
  ? `${LEAD[i]} a VIA Rail train from Union Station, getting you to Montreal around ${t(o.door)}, leaving at ${t(o.dep)}.`
  : `${LEAD[i]} a ${o.carrier} flight from ${place(o)}, getting you to Montreal around ${t(o.door)}, leaving at ${t(o.dep)}.`;
const place = o => o.rail ? 'Union Station' : DEMO.from[o.from].name;
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, audio = null, timer = null;
const store = { get: k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

/* ---------- voice out: ElevenLabs via proxy, falls back to browser voice ---------- */
function stopSpeech() { if (audio) { audio.pause(); audio = null; } window.speechSynthesis && speechSynthesis.cancel(); }
async function speak(text, gen) {
  const key = store.get('el_key'), voice = store.get('el_voice'); let req = null; S.ttsErr = '';
  if (key && voice) req = fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, { method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify({ text, model_id: 'eleven_flash_v2_5' }) });
  else if (CFG.TTS_PROXY) req = fetch(CFG.TTS_PROXY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
  if (req) {
    try {
      const r = await req;
      if (!r.ok) throw new Error('ElevenLabs error ' + r.status);
      if (gen !== S.gen) return;
      audio = new Audio(URL.createObjectURL(await r.blob()));
      return new Promise(res => { audio.onended = audio.onerror = res; audio.play().catch(res); });
    } catch (e) { S.ttsErr = e.message; console.warn('ElevenLabs failed, using browser voice', e); }
  }
  if (window.speechSynthesis && gen === S.gen)
    return new Promise(res => { const u = new SpeechSynthesisUtterance(text); u.lang = 'en-CA'; u.onend = u.onerror = res; speechSynthesis.speak(u); });
}
async function say(text) {
  const gen = ++S.gen; stopListening();
  $('caption').textContent = text; $('heard').textContent = '';
  mstat('Scully is speaking');
  await speak(text, gen);
  if (S.live && gen === S.gen && S.auto) listen(); else if (S.live) mstat('Tap to talk');
}

/* ---------- voice in ---------- */
function mstat(s, on) { $('mstat').textContent = s; $('mic').classList.toggle('on', !!on); }
function stopListening() { if (rec) { const r = rec; rec = null; r.onend = null; r.stop(); } }
function listen() {
  if (!SR || rec || !S.live) return;
  rec = new SR(); rec.lang = 'en-CA'; rec.interimResults = true;
  rec.onstart = () => mstat('Listening', true);
  rec.onresult = e => { const r = e.results[e.results.length - 1]; $('heard').textContent = '“' + r[0].transcript + '”'; if (r.isFinal) { rec = null; handle(r[0].transcript); } };
  rec.onerror = e => { rec = null; S.auto = false; mstat(e.error === 'not-allowed' ? 'Mic blocked. Type below' : 'Tap to talk'); };
  rec.onend = () => { rec = null; if (S.live && S.auto) setTimeout(listen, 300); };
  rec.start();
}

/* ---------- ranking (deterministic code, no model) ---------- */
function search() {
  const c = DEMO.cancelled, lo = c.dep - DEMO.windowMins, hi = c.dep + DEMO.windowMins;
  S.rows = []; S.skipped = [];
  DEMO.options.forEach(o => {
    const f = DEMO.from[o.from];
    o.leaveBy = o.dep - f.buffer - f.ground; o.arr = o.dep + o.dur; o.door = o.arr + DEMO.toDowntown[o.to];
    o.risk = (o.seats <= 3 ? .15 : 0) + (o.change === 'new' ? .25 : 0);
    if (o.dep < lo || o.dep > hi) return;
    (o.leaveBy < DEMO.now ? S.skipped : S.rows).push(o);
  });
  sortRows();
}
function sortRows() {
  const k = { time: (a, b) => a.door - b.door, cost: (a, b) => a.cost - b.cost || a.door - b.door, risk: (a, b) => a.risk - b.risk || a.door - b.door };
  S.rows.sort(k[S.sort]);
}

/* ---------- rendering ---------- */
function chips(list) { $('chips').innerHTML = list.map(x => `<button>${x}</button>`).join(''); [...$('chips').children].forEach(b => b.onclick = () => handle(b.textContent)); }
function render() {
  $('cards').innerHTML = (S.skipped.length ? `<div class="skip">Not shown: ${S.skipped.map(o => o.no + ' at ' + t(o.dep)).join(', ')}. You couldn’t reach the airport in time.</div>` : '') +
    S.rows.slice(0, 3).map((o, i) => `<div class="c ${S.sel === o ? 'sel' : ''}"><div class="r"><div><span class="n">${i + 1}</span><b>${o.carrier} ${o.no}</b><div class="t">${place(o)} · departs ${t(o.dep)}</div></div>
      <div style="text-align:right"><span class="big">${t(o.door)}</span><div class="t">downtown Montreal</div></div></div>
      <div class="t" style="margin-top:6px">Leave home by <b>${t(o.leaveBy)}</b> · ${dur(o.dur)} ${o.rail ? 'by train' : 'flight'}</div>
      <span class="tag">${{ free: 'Free change', fare: 'Fare difference $' + o.cost, new: 'New purchase $' + o.cost }[o.change]}</span><span class="tag">${o.rail ? 'Train' : 'Direct'}</span>${o.seats <= 3 ? `<span class="tag">${o.seats} seats left</span>` : ''}</div>`).join('');
}
function handoff(done) {
  const o = S.sel;
  $('hand').innerHTML = `<div class="c"><b>Sent to your agent · booking ${S.ref}</b><ul>
    <li>Booking verified</li><li>Searched Pearson, Billy Bishop, Hamilton and VIA Rail</li><li>Chosen: ${o.carrier} ${o.no}, ${t(o.dep)}</li>
    <li>${o.change === 'free' ? 'Covered by waiver, no approval needed' : 'Needs agent approval: $' + o.cost}</li></ul>
    ${done ? `<div class="ok">Verified and rebooked (simulated). Be at ${place(o)} by ${t(o.dep - DEMO.from[o.from].buffer)}.</div>` : '<span class="t">Waiting for the agent to verify…</span>'}</div>`;
}

/* ---------- conversation ---------- */
const W = { zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
function parseRef(q) {
  const s = q.toLowerCase().replace(/\b(booking|number|reference|my|is|it's|its|the)\b/g, ' ').split(/[\s,.\-]+/).filter(Boolean).map(w => w in W ? W[w] : w).join('').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s.length >= 5 && s.length <= 8 ? s : null;
}
const NUMS = { one: 1, first: 1, 1: 1, two: 2, second: 2, 2: 2, three: 3, third: 3, 3: 3 };
function handle(raw) {
  stopSpeech(); S.gen++; stopListening(); const q = raw.toLowerCase(); $('heard').textContent = '“' + raw + '”';
  if (S.step === 'ref') {
    const r = parseRef(raw);
    if (!r) return say('Sorry, I didn’t catch that. Could you read me your booking number again, one character at a time?');
    S.ref = r; S.step = 'help'; chips(['Rebook my cancelled flight']);
    return say(`Thank you. I’ve got booking ${r.split('').join(' ')}. How can I help you?`);
  }
  if (S.step === 'confirm') {
    if (/\b(yes|yeah|yep|confirm|go ahead|book it|do it|sure|please)\b/.test(q)) return send();
    if (/\b(no|wait|back|different)\b/.test(q)) { S.step = 'options'; S.sel = null; render(); return say('No problem. Which option would you like instead?'); }
  }
  if (S.step === 'done') {
    if (/\b(no|nope|that’s all|that's all|nothing|bye|thanks|thank you)\b/.test(q)) return say('You’re welcome. Safe travels!').then(endCall);
    return say('Of course. Your agent will pick this up when they join. Is there anything else?');
  }
  if (S.step === 'options') {
    const pick = q.match(/(?:option|number|choose|pick|take|go with)\s*(?:the\s*)?(one|two|three|1|2|3|first|second|third)/) || q.match(/\b(first|second|third)\s+(?:one|option)\b/) || q.match(/^\s*(one|two|three|1|2|3)\s*$/);
    if (pick && S.rows[NUMS[pick[1]] - 1]) {
      S.sel = S.rows[NUMS[pick[1]] - 1]; S.step = 'confirm'; render(); chips(['Yes, send it']);
      return say(`Great choice. ${S.sel.carrier} at ${t(S.sel.dep)}. Shall I send this to your agent so you don’t have to repeat yourself?`);
    }
    const sorts = [[/cheap|cost|price|budget/, 'cost', 'lowest cost'], [/fast|earliest|soonest|quick/, 'time', 'earliest arrival'], [/risk|safe|reliable/, 'risk', 'lowest risk']];
    for (const [re, k, label] of sorts) if (re.test(q)) { S.sort = k; sortRows(); render(); const o = S.rows[0]; return say(`Sorted by ${label}. ${line(o, 0)} Which would you like?`); }
    return say('Which option would you like? You can say option one, two or three.');
  }
  // step === 'help'
  if (/vancouver|calgary|ottawa|new york|halifax|winnipeg|edmonton/.test(q)) return say('This demo only covers Toronto to Montreal. Is that the trip you need help with?');
  if (/rebook|cancel|flight|change|option|book/.test(q)) {
    search(); S.step = 'options'; render(); chips(['Cheapest', 'Lowest risk']);
    const top = S.rows.slice(0, 3);
    return say(`I’m sorry your flight was cancelled. I found ${top.length} options. ${top.map(line).join(' ')} Which one would you like?`);
  }
  say('I can help rebook your flight while you wait. Is that what you need?');
}
function send() {
  S.step = 'done'; S.auto = true; chips([]); handoff(false);
  say('Done. Your agent can already see your choice, so you won’t need to repeat anything. I’ll confirm once they verify it.');
  setTimeout(() => { if (!S.live) return; handoff(true); say(`All verified. You’re rebooked on ${S.sel.carrier} ${S.sel.no} at ${t(S.sel.dep)}. Please leave home by ${t(S.sel.leaveBy)}. Is there anything else?`); }, 4500);
}

/* ---------- call lifecycle ---------- */
function startCall() {
  S.live = true; S.step = 'ref'; S.auto = !!SR; S.sel = null; S.rows = [];
  $('landing').classList.add('hide'); $('call').classList.remove('hide');
  if (!SR) mstat('Voice input unsupported. Type below');
  chips(['Use booking AX7K2Q']);
  let s = 0; timer = setInterval(() => { s++; $('timer').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }, 1000);
  say('Hello, my name is Scully. I can help you while you wait in the queue for an agent. What is your booking number?');
}
function endCall() {
  S.live = false; S.gen++; stopSpeech(); stopListening(); clearInterval(timer);
  ['cards', 'hand', 'chips', 'caption', 'heard'].forEach(i => $(i).innerHTML = '');
  $('call').classList.add('hide'); $('landing').classList.remove('hide');
}
$('start').onclick = startCall;
$('end').onclick = endCall;
$('mic').onclick = () => { if (rec) { S.auto = false; stopListening(); mstat('Tap to talk'); } else { stopSpeech(); S.gen++; S.auto = true; listen(); } };
$('f').onsubmit = e => { e.preventDefault(); const v = $('txt').value.trim(); if (v) { $('txt').value = ''; handle(v); } };

/* ---------- personal voice settings (key stays in this browser only) ---------- */
$('ek').value = store.get('el_key'); $('vid').value = store.get('el_voice');
$('vsave').onclick = async () => {
  store.set('el_key', $('ek').value.trim()); store.set('el_voice', $('vid').value.trim());
  $('vmsg').textContent = 'Testing…';
  await speak('Hi, this is Scully. Your voice is working.', ++S.gen);
  $('vmsg').textContent = S.ttsErr ? 'Failed: ' + S.ttsErr + '. Check key and voice ID.' : 'Saved. Voice works.';
};
