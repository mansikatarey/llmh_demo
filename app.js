const $ = id => document.getElementById(id);
const S = { rows: [], skipped: [], later: 0, sort: 'time', sel: null, pending: false, auto: false, mute: false };
const t = x => { const h = Math.floor(x / 60), mi = x % 60; return ((h + 11) % 12 + 1) + ':' + String(mi).padStart(2, '0') + (h < 12 ? ' AM' : ' PM'); };
const dur = x => (x >= 60 ? Math.floor(x / 60) + ' hours ' : '') + (x % 60 ? x % 60 + ' minutes' : '');
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;

/* ---------- conversation helpers ---------- */
function add(who, text) { const d = document.createElement('div'); d.className = 'm ' + who; d.textContent = text; $('log').append(d); d.scrollIntoView({ block: 'end' }); }
function status(s, on) { $('status').textContent = s; $('mic').classList.toggle('on', !!on); }
function say(text) {
  add('bot', text);
  if (S.mute || !window.speechSynthesis) { if (S.auto) setTimeout(listen, 400); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = 'en-CA';
  u.onstart = () => status('Speaking…');
  u.onend = () => { if (S.auto) listen(); else status('Tap the mic and speak'); };
  speechSynthesis.speak(u);
}
function listen() {
  if (!SR || rec) return;
  rec = new SR(); rec.lang = 'en-CA'; rec.interimResults = true;
  rec.onstart = () => status('Listening…', true);
  rec.onresult = e => { const r = e.results[e.results.length - 1]; $('txt').value = r[0].transcript; if (r.isFinal) { $('txt').value = ''; handle(r[0].transcript); } };
  rec.onerror = e => { S.auto = false; status(e.error === 'no-speech' ? 'Didn’t catch that. Tap the mic to retry.' : 'Mic problem (' + e.error + '). You can type instead.'); };
  rec.onend = () => { rec = null; $('mic').classList.remove('on'); };
  rec.start();
}

/* ---------- search + ranking (deterministic; no model needed) ---------- */
function search() {
  const c = DEMO.cancelled, lo = c.dep - DEMO.windowMins, hi = c.dep + DEMO.windowMins;
  S.rows = []; S.skipped = []; S.later = 0;
  DEMO.options.forEach(o => {
    const f = DEMO.from[o.from];
    o.leaveBy = o.dep - f.buffer - f.ground;
    o.arr = o.dep + o.dur; o.door = o.arr + DEMO.toDowntown[o.to];
    o.risk = (o.seats <= 3 ? .15 : 0) + (o.change === 'new' ? .25 : 0);
    if (o.dep < lo || o.dep > hi) { S.later++; return; }
    if (o.leaveBy < DEMO.now) { S.skipped.push(o); return; }
    S.rows.push(o);
  });
  sortRows();
}
function sortRows() {
  const k = { time: (a, b) => a.door - b.door, cost: (a, b) => a.cost - b.cost || a.door - b.door, risk: (a, b) => a.risk - b.risk || a.door - b.door };
  S.rows.sort(k[S.sort]);
}
function spoken(o, i) {
  const place = o.rail ? 'from Union Station' : 'from ' + DEMO.from[o.from].name;
  const chg = { free: 'covered at no charge', fare: 'with a $' + o.cost + ' fare difference', new: 'a new $' + o.cost + ' purchase that your agent must approve' }[o.change];
  return `Option ${i + 1}: ${o.carrier} ${place} at ${t(o.dep)}, reaching downtown Montreal around ${t(o.door)}, ${chg}. Leave home by ${t(o.leaveBy)}.`;
}
function readOut(intro) {
  const top = S.rows.slice(0, 3);
  render();
  say(intro + ' ' + top.map(spoken).join(' ') + ' Say option one, two or three to choose, or ask for the cheapest, fastest or lowest risk.');
}

/* ---------- rendering ---------- */
function render() {
  $('cards').innerHTML = (S.skipped.length ? `<div class="skip">Skipped ${S.skipped.map(o => o.no + ' ' + t(o.dep)).join(', ')}: you couldn’t reach the airport in time.</div>` : '') +
    S.rows.slice(0, 3).map((o, i) => `<div class="c ${S.sel === o ? 'sel' : ''}"><div class="r"><span><b>${i + 1}. ${o.carrier} ${o.no}</b><br>${o.rail ? 'Union Station' : DEMO.from[o.from].name} at ${t(o.dep)}</span>
      <span style="text-align:right"><b class="big">${t(o.door)}</b><br><span class="t">downtown Montreal</span></span></div>
      <div class="t">Leave home by ${t(o.leaveBy)}: ${DEMO.from[o.from].ground} min to ${o.rail ? 'station' : 'airport'}, ${DEMO.from[o.from].buffer} min buffer, ${dur(o.dur)} travel, ${DEMO.toDowntown[o.to]} min onward.</div>
      <span class="tag">${{ free: 'Free change', fare: 'Fare diff $' + o.cost, new: 'New purchase $' + o.cost }[o.change]}</span>${o.rail ? '<span class="tag">Train</span>' : '<span class="tag">Direct</span>'}${o.seats <= 3 ? `<span class="tag">${o.seats} seats left</span>` : ''}</div>`).join('');
}
function handoff(done) {
  const o = S.sel;
  $('hand').innerHTML = `<div class="c"><b>Agent desk: ${DEMO.traveler}, booking ${DEMO.ref}</b><ul>
    <li>Identity verified before the call (mocked)</li><li>Checked ${DEMO.options.length} options across Pearson, Billy Bishop, Hamilton and VIA Rail</li>
    <li>Chosen: ${o.carrier} ${o.no}, departs ${t(o.dep)}, arrives downtown ${t(o.door)}</li>
    <li>${o.change === 'free' ? 'Within waiver, no approval needed' : 'Needs approval: ' + (o.change === 'new' ? 'new purchase' : 'fare difference') + ' of $' + o.cost}</li></ul>
    ${done ? `<div class="ok">Verified and rebooked (simulated): ${o.no} at ${t(o.dep)}. Be at ${o.rail ? 'Union Station' : DEMO.from[o.from].name} by ${t(o.dep - DEMO.from[o.from].buffer)}.</div>` : '<span class="t">Waiting for the agent to verify…</span>'}</div>`;
}

/* ---------- intent handling (rules here; an LLM in production) ---------- */
const NUMS = { one: 1, first: 1, 1: 1, two: 2, second: 2, 2: 2, three: 3, third: 3, 3: 3 };
function handle(raw) {
  add('me', raw); const q = raw.toLowerCase();
  if (/start over|reset/.test(q)) return reset();
  if (S.pending) {
    if (/\b(yes|yeah|confirm|go ahead|book it|do it|sure)\b/.test(q)) return send();
    if (/\b(no|wait|back|cancel that)\b/.test(q)) { S.pending = false; return say('No problem. Pick another option, or ask for something different.'); }
  }
  const pick = q.match(/(?:option|number|choose|pick|take|go with)\s*(?:the\s*)?(one|two|three|1|2|3|first|second|third)/) || q.match(/\b(first|second|third)\s+(?:one|option)\b/);
  if (pick && S.rows.length) { const o = S.rows[NUMS[pick[1]] - 1]; if (o) return choose(o); }
  if (S.rows.length) {
    if (/cheap|cost|price|budget|save/.test(q)) { S.sort = 'cost'; return readOut('Sorted by lowest cost.'); }
    if (/fast|earliest|soonest|quick|asap/.test(q)) { S.sort = 'time'; return readOut('Sorted by earliest arrival.'); }
    if (/risk|safe|reliable|sure/.test(q)) { S.sort = 'risk'; return readOut('Sorted by lowest risk.'); }
    if (/repeat|again|options/.test(q)) return readOut('Here they are again.');
  }
  if (/vancouver|calgary|ottawa|new york|halifax|winnipeg|edmonton/.test(q)) return say('This demo only covers Toronto to Montreal. Try asking about that route.');
  if (/toronto|montreal|rebook|cancel|flight/.test(q)) {
    search(); const c = DEMO.cancelled;
    return readOut(`Sorry about that. Your ${t(c.dep)} ${c.carrier} flight ${c.no} is cancelled. I checked Pearson, Billy Bishop, Hamilton and VIA Rail for departures between ${t(c.dep - DEMO.windowMins)} and ${t(c.dep + DEMO.windowMins)}. I skipped ${S.skipped.length} you couldn’t reach in time. Here are your best three.`);
  }
  say('I can rebook your Toronto to Montreal trip. Try: I need to rebook my cancelled flight, what are my options?');
}
function choose(o) { S.sel = o; S.pending = true; render(); say(`${o.carrier} ${o.no} at ${t(o.dep)}. Shall I send this to your agent? Say yes to confirm.`); }
function send() {
  S.pending = false; S.auto = false; handoff(false);
  say('Sent. Your agent already has everything, so you won’t repeat yourself. I’ll confirm once they verify the booking.');
  setTimeout(() => { handoff(true); say(`Verified. You’re rebooked on ${S.sel.carrier} ${S.sel.no} at ${t(S.sel.dep)}. Leave home by ${t(S.sel.leaveBy)}.`); }, 3500);
}
function reset() { S.rows = []; S.sel = null; S.pending = false; $('cards').innerHTML = $('hand').innerHTML = ''; say('Starting over. What happened with your flight?'); }

/* ---------- wiring ---------- */
$('mic').onclick = () => { if (rec) { S.auto = false; rec.stop(); status('Tap the mic and speak'); return; } if (!SR) return status('Voice input needs Chrome, Edge or Safari over https. Type below instead.'); speechSynthesis && speechSynthesis.cancel(); S.auto = true; listen(); };
$('f').onsubmit = e => { e.preventDefault(); const v = $('txt').value.trim(); if (v) { $('txt').value = ''; handle(v); } };
$('ex').onclick = () => handle('I need to rebook my flight, it got cancelled. What options do you have leaving from Toronto to Montreal within the same time?');
$('mute').onclick = () => { S.mute = !S.mute; $('mute').textContent = S.mute ? 'Unmute voice' : 'Mute voice'; speechSynthesis && speechSynthesis.cancel(); };
add('bot', 'Hi, I’m your rebooking assistant. Tap the mic and tell me what happened with your flight.');
