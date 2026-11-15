'use strict';
/* =====================================================================
   ChitBook – single-admin chit fund manager (vanilla JS, localStorage)
   Data model (saved under one localStorage key):
   db = { chits:[ { id, name, amount, startDate, status:'active'|'completed',
                    members:[{id,name,phone}],          // locked after creation
                    credits:[{id,month,memberId,amount,date,note}],
                    draws:[{month,memberId,date,payout}] } ],  // draw history
          log:[{ts,chitId,text}] }                       // audit trail
   Cycle month = draws.length + 1  (credits are recorded BEFORE that month's draw)
   ===================================================================== */

const KEY = 'chitbook.v1';
const $ = (s) => document.querySelector(s);
const app = $('#app');

/* ---------- Storage ---------- */
let db = load();
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.chits)) { d.log = d.log || []; return d; }
  } catch (e) { /* corrupted or blocked storage */ }
  return { chits: [], log: [] };
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); return true; }
  catch (e) { toast('Could not save! Storage is full or blocked (private mode?).'); return false; }
}
// Ask the browser not to evict our data when storage is low (mobile browsers can)
if (navigator.storage && navigator.storage.persist) navigator.storage.persist();

/* ---------- Helpers ---------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
// Escape anything typed by the user before putting it into innerHTML (prevents HTML injection)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const fmtDate = (iso) => iso ? new Date(iso + (iso.length === 10 ? 'T00:00' : '')).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const fmtTime = (ts) => new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const chitById = (id) => db.chits.find((c) => c.id === id);
const memberName = (c, id) => (c.members.find((m) => m.id === id) || { name: '?' }).name;
const curMonth = (c) => c.draws.length + 1;
const monthCredits = (c, m) => c.credits.filter((x) => x.month === m);
const paidSet = (c, m) => new Set(monthCredits(c, m).map((x) => x.memberId));
const sum = (arr) => arr.reduce((t, x) => t + x.amount, 0);
function audit(chitId, text) { db.log.unshift({ ts: Date.now(), chitId, text }); }
let toastTimer;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 2800); }
// Unbiased random integer using the browser's crypto generator (fair draw)
function randInt(n) { const a = new Uint32Array(1), lim = Math.floor(4294967296 / n) * n; do { crypto.getRandomValues(a); } while (a[0] >= lim); return a[0] % n; }

/* ---------- Router (hash based, so the phone's Back button works) ----------
   #/            home       #/new          create chit
   #/chit/ID/tab   tab = overview | credits | draw | history                */
window.addEventListener('hashchange', render);
function render() {
  const [, page, id, tab] = location.hash.split('/');
  const c = page === 'chit' ? chitById(id) : null;
  $('#backBtn').hidden = !page;
  if (page === 'new') { setTitle('New chit'); app.innerHTML = newChitView(); }
  else if (c) { setTitle(c.name); app.innerHTML = chitView(c, ['overview', 'credits', 'draw', 'history'].includes(tab) ? tab : 'overview'); }
  else { setTitle('ChitBook'); app.innerHTML = homeView(); if (page) location.hash = '#/'; }
}
const setTitle = (t) => { $('#pageTitle').textContent = t; document.title = t + ' – ChitBook'; };
$('#backBtn').onclick = () => { location.hash = location.hash.startsWith('#/chit/') ? '#/' : '#/'; };

/* ---------- Views ---------- */
function homeView() {
  const chits = [...db.chits].sort((a, b) => (a.status === b.status ? 0 : a.status === 'active' ? -1 : 1));
  const list = chits.map((c) => {
    const pct = Math.round((c.draws.length / c.members.length) * 100);
    return `<a class="card tap" href="#/chit/${c.id}/overview">
      <div class="row"><strong>${esc(c.name)}</strong><span class="pill ${c.status === 'active' ? 'ok' : ''}">${c.status}</span></div>
      <div class="muted">${inr(c.amount)}/month · ${c.members.length} members · pot ${inr(c.amount * c.members.length)}</div>
      <div class="progress"><i style="width:${pct}%"></i></div>
      <div class="muted" style="margin-top:6px">${c.draws.length} of ${c.members.length} draws done</div></a>`;
  }).join('');
  return `<a class="btn block" href="#/new">+ Create new chit</a>
    <h2>Your chits</h2>
    ${list || '<div class="empty">No chits yet.<br>Create your first chit to start tracking.</div>'}
    <h2>Backup</h2>
    <div class="card"><p class="muted" style="margin-top:0">Browser data can be lost if you clear site data. Download a backup regularly and keep it safe.</p>
      <div class="grid2"><button class="btn ghost" data-act="export">Download backup</button><button class="btn ghost" data-act="import">Restore backup</button></div></div>`;
}

function newChitView() {
  return `<form id="newForm" class="card" autocomplete="off">
    <label for="n_name">Chit name</label><input id="n_name" required maxlength="60" placeholder="e.g. Family Chit 2026">
    <label for="n_amt">Monthly contribution per member (₹)</label><input id="n_amt" type="number" inputmode="numeric" min="1" required>
    <label for="n_date">Start date</label><input id="n_date" type="date" required value="${todayISO()}">
    <label for="n_mem">Members (one per line, optional phone after a comma)</label>
    <textarea id="n_mem" required placeholder="Ravi, 98xxxxxx01&#10;Lakshmi&#10;Suresh"></textarea>
    <p class="muted">Duration = number of members (one draw per month). <b>Members cannot be changed after creating the chit.</b></p>
    <p class="err" id="n_err" hidden></p>
    <button class="btn block" type="submit">Create chit</button></form>`;
}

function chitView(c, tab) {
  const tabs = ['overview', 'credits', 'draw', 'history'].map((t) =>
    `<a href="#/chit/${c.id}/${t}" ${t === tab ? 'aria-current="page"' : ''}>${t[0].toUpperCase() + t.slice(1)}</a>`).join('');
  return `<nav class="tabs">${tabs}</nav>` + { overview: overviewTab, credits: creditsTab, draw: drawTab, history: historyTab }[tab](c);
}

function overviewTab(c) {
  const m = curMonth(c), n = c.members.length, done = c.draws.length >= n, active = c.status === 'active';
  const paid = paidSet(c, m), won = new Map(c.draws.map((d) => [d.memberId, d.month]));
  const rows = c.members.map((x) => {
    const badge = won.has(x.id) ? `<span class="pill ok">Won month ${won.get(x.id)}</span>` :
      (!done && active ? (paid.has(x.id) ? '<span class="pill ok">Paid</span>' : '<span class="pill warn">Due</span>') : '');
    return `<li><span>${esc(x.name)}${x.phone ? `<span class="sub">${esc(x.phone)}</span>` : ''}</span>${badge}</li>`;
  }).join('');
  return `<div class="grid2">
      <div class="stat"><span class="muted">Month</span><b>${done ? n + ' / ' + n : m + ' / ' + n}</b></div>
      <div class="stat"><span class="muted">Status</span><b>${c.status === 'active' ? 'Active' : 'Completed'}</b></div>
      <div class="stat"><span class="muted">Monthly pot</span><b>${inr(c.amount * n)}</b></div>
      <div class="stat"><span class="muted">${done ? 'Started' : 'Collected this month'}</span><b>${done ? fmtDate(c.startDate) : inr(sum(monthCredits(c, m)))}</b></div></div>
    <h2>Members (${n})</h2><div class="card"><ul class="list">${rows}</ul></div>
    ${active ? `<button class="btn danger block" data-act="complete" data-id="${c.id}">Mark chit as completed</button>` :
      '<p class="muted">This chit is completed and read-only.</p>'}
    <button class="btn ghost block" style="margin-top:10px;color:var(--danger)" data-act="delete" data-id="${c.id}">Delete this chit</button>`;
}

function creditsTab(c) {
  const m = curMonth(c), n = c.members.length, active = c.status === 'active' && c.draws.length < n;
  const paid = paidSet(c, m);
  const form = active ? `<form id="creditForm" class="card" data-id="${c.id}">
      <strong>Record credit for month ${m}</strong>
      <label for="c_mem">Member</label><select id="c_mem" required>
        ${c.members.map((x) => `<option value="${x.id}">${esc(x.name)}${paid.has(x.id) ? ' (paid)' : ''}</option>`).join('')}</select>
      <label for="c_amt">Amount (₹)</label><input id="c_amt" type="number" inputmode="numeric" min="1" required value="${c.amount}">
      <label for="c_date">Date received</label><input id="c_date" type="date" required value="${todayISO()}">
      <label for="c_note">Note (optional)</label><input id="c_note" maxlength="80" placeholder="Cash / UPI ref">
      <p class="err" id="c_err" hidden></p><button class="btn block" style="margin-top:14px">Save credit</button></form>`
    : '<div class="notice">Credits can only be added while the chit is active and draws remain.</div>';
  // Group credits by month, newest month first
  const groups = [];
  for (let k = Math.max(m, ...c.credits.map((x) => x.month)); k >= 1; k--) {
    const items = monthCredits(c, k); if (!items.length) continue;
    groups.push(`<h2>Month ${k} · ${inr(sum(items))}</h2><div class="card"><ul class="list">${items.map((x) =>
      `<li><span>${esc(memberName(c, x.memberId))}<span class="sub">${fmtDate(x.date)}${x.note ? ' · ' + esc(x.note) : ''}</span></span>
       <span class="amt">${inr(x.amount)}${k === m && active ? ` <button class="btn sm danger" data-act="delcredit" data-id="${c.id}" data-cid="${x.id}" aria-label="Delete credit">✕</button>` : ''}</span></li>`).join('')}</ul></div>`);
  }
  return form + (groups.join('') || '<div class="empty">No credits recorded yet.</div>');
}

function drawTab(c) {
  const n = c.members.length, m = curMonth(c), won = new Set(c.draws.map((d) => d.memberId));
  const left = c.members.filter((x) => !won.has(x.id));
  let top;
  if (c.status === 'completed') top = '<div class="notice">This chit is completed. No more draws.</div>';
  else if (!left.length) top = '<div class="notice">All members have received the chit. You can mark it as completed from Overview.</div>';
  else top = `<div class="card"><div class="big">Month ${m} draw</div>
      <p class="muted">${left.length} eligible member${left.length > 1 ? 's' : ''} · collected so far ${inr(sum(monthCredits(c, m)))} of ${inr(c.amount * n)}</p>
      <button class="btn gold block" data-act="draw" data-id="${c.id}">Conduct draw</button></div>`;
  return top + `<h2>Eligible for this draw</h2><div class="card"><ul class="list">${left.map((x) => `<li>${esc(x.name)}</li>`).join('') ||
    '<li class="muted">Nobody left</li>'}</ul></div>`;
}

function historyTab(c) {
  const draws = [...c.draws].reverse().map((d) => `<li><span><b>Month ${d.month}</b> · ${esc(memberName(c, d.memberId))}<span class="sub">${fmtDate(d.date)}</span></span><span class="amt">${inr(d.payout)}</span></li>`).join('');
  const logs = db.log.filter((l) => l.chitId === c.id).map((l) => `<li><span>${esc(l.text)}<span class="sub">${fmtTime(l.ts)}</span></span></li>`).join('');
  return `<h2>Allotment history</h2><div class="card"><ul class="list">${draws || '<li class="muted">No draws yet.</li>'}</ul></div>
    <h2>Audit log</h2><div class="card"><ul class="list">${logs || '<li class="muted">Nothing yet.</li>'}</ul></div>`;
}

/* ---------- Actions: clicks are handled by one delegated listener ---------- */
app.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act, c = chitById(b.dataset.id);
  if (act === 'export') exportData();
  else if (act === 'import') $('#importFile').click();
  else if (act === 'complete') completeChit(c);
  else if (act === 'draw') startDraw(c);
  else if (act === 'delete') deleteChit(c);
  else if (act === 'delcredit') {
    const cr = c.credits.find((x) => x.id === b.dataset.cid);
    if (cr && confirm(`Delete ${inr(cr.amount)} credit from ${memberName(c, cr.memberId)}?`)) {
      c.credits = c.credits.filter((x) => x !== cr);
      audit(c.id, `Credit deleted: ${memberName(c, cr.memberId)} ${inr(cr.amount)} (month ${cr.month})`);
      save(); render(); toast('Credit deleted');
    }
  }
});

/* Form submissions (create chit / add credit) */
app.addEventListener('submit', (e) => {
  e.preventDefault();
  if (e.target.id === 'newForm') createChit();
  else if (e.target.id === 'creditForm') addCredit(chitById(e.target.dataset.id));
});

/* Create chit: validates and locks the member list */
function createChit() {
  const err = $('#n_err'), fail = (t) => { err.textContent = t; err.hidden = false; };
  const name = $('#n_name').value.trim(), amount = Number($('#n_amt').value);
  const members = $('#n_mem').value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const [nm, ...ph] = l.split(','); return { id: uid(), name: nm.trim(), phone: ph.join(',').trim() };
  });
  const names = members.map((x) => x.name.toLowerCase());
  if (!name || !(amount > 0)) return fail('Enter a name and a monthly amount.');
  if (members.length < 2) return fail('Add at least 2 members.');
  if (new Set(names).size !== names.length) return fail('Two members have the same name. Make each name unique (e.g. add an initial).');
  if (!confirm(`Create "${name}" with ${members.length} members?\nMembers cannot be added or removed later.`)) return;
  const c = { id: uid(), name, amount, startDate: $('#n_date').value, status: 'active', members, credits: [], draws: [] };
  db.chits.push(c); audit(c.id, `Chit created with ${members.length} members, ${inr(amount)}/month`);
  if (save()) { toast('Chit created'); location.hash = `#/chit/${c.id}/overview`; }
}

/* Record a credit entry for the current (not yet drawn) month */
function addCredit(c) {
  const err = $('#c_err'), memberId = $('#c_mem').value, amount = Number($('#c_amt').value), date = $('#c_date').value;
  if (!(amount > 0) || !date) { err.textContent = 'Enter a valid amount and date.'; err.hidden = false; return; }
  const m = curMonth(c);
  if (paidSet(c, m).has(memberId) && !confirm(`${memberName(c, memberId)} already has a credit for month ${m}. Add another?`)) return;
  c.credits.push({ id: uid(), month: m, memberId, amount, date, note: $('#c_note').value.trim() });
  audit(c.id, `Credit: ${memberName(c, memberId)} paid ${inr(amount)} for month ${m}`);
  if (save()) { render(); toast('Credit saved'); }
}

/* Draw: pick winner first, SAVE it, then animate – so a refresh can't re-roll the result */
function startDraw(c) {
  if (c.status !== 'active') return;
  const m = curMonth(c), won = new Set(c.draws.map((d) => d.memberId));
  const eligible = c.members.filter((x) => !won.has(x.id));
  if (!eligible.length) return toast('Everyone has already received the chit.');
  const unpaid = c.members.filter((x) => !paidSet(c, m).has(x.id));
  const last = c.draws[c.draws.length - 1];
  let warn = '';
  if (unpaid.length) warn += `Credits missing for: ${unpaid.map((x) => x.name).join(', ')}.\n\n`;
  if (last && last.date.slice(0, 7) === todayISO().slice(0, 7)) warn += `A draw was already done this calendar month (${fmtDate(last.date)}).\n\n`;
  if (!confirm(`${warn}Conduct month ${m} draw now? This cannot be undone.`)) return;

  const winner = eligible[randInt(eligible.length)];
  const payout = sum(monthCredits(c, m)) || c.amount * c.members.length; // actual collection, else full pot
  c.draws.push({ month: m, memberId: winner.id, date: todayISO(), payout });
  audit(c.id, `Draw month ${m}: ${winner.name} allotted ${inr(payout)}`);
  if (!save()) { c.draws.pop(); db.log.shift(); return; }

  // Shuffle animation, then reveal
  const ov = $('#drawOverlay'), nm = $('#drawName'), done = $('#drawClose');
  nm.classList.remove('final'); done.hidden = true; ov.hidden = false;
  $('#drawLabel').textContent = `Drawing month ${m}…`;
  const quick = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let i = 0;
  const t = setInterval(() => { nm.textContent = eligible[i++ % eligible.length].name; }, 80);
  setTimeout(() => {
    clearInterval(t); nm.textContent = winner.name; nm.classList.add('final');
    $('#drawLabel').textContent = `Month ${m} winner · ${inr(payout)}`; done.hidden = false; done.focus();
  }, quick ? 100 : 2200);
}
$('#drawClose').onclick = () => { $('#drawOverlay').hidden = true; render(); };

/* Complete a chit (becomes read-only) */
function completeChit(c) {
  const left = c.members.length - c.draws.length;
  const msg = left ? `${left} draw(s) are still pending. Complete this chit anyway?` : 'Mark this chit as completed?';
  if (!confirm(msg + '\nA completed chit becomes read-only.')) return;
  c.status = 'completed'; audit(c.id, left ? `Chit completed early (${left} draws pending)` : 'Chit completed');
  save(); render(); toast('Chit completed');
}

/* Delete a chit permanently (credits, draws and its audit log go with it).
   The admin must type the chit's name, so it can't be deleted by an accidental tap. */
function deleteChit(c) {
  if (!c) return;
  if (!confirm(`Delete "${c.name}" permanently?\n\nAll members, credits, draw history and audit log for this chit will be lost. Tip: download a backup first.`)) return;
  const typed = prompt(`To confirm, type the chit name exactly:\n${c.name}`);
  if (typed === null) return;
  if (typed.trim() !== c.name) return toast('Name did not match. Chit not deleted.');
  db.chits = db.chits.filter((x) => x.id !== c.id);
  db.log = db.log.filter((l) => l.chitId !== c.id);
  if (save()) { toast('Chit deleted'); location.hash = '#/'; }
}

/* ---------- Backup / restore (protects against cleared browser data) ---------- */
function exportData() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' }));
  a.download = `chitbook-backup-${todayISO()}.json`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast('Backup downloaded');
}
$('#backupBtn').onclick = exportData;
$('#importFile').onchange = (e) => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d || !Array.isArray(d.chits)) throw 0;
      if (!confirm(`Restore ${d.chits.length} chit(s)? This REPLACES all current data.`)) return;
      db = { chits: d.chits, log: d.log || [] }; save(); location.hash = '#/'; render(); toast('Backup restored');
    } catch (x) { toast('That file is not a valid ChitBook backup.'); }
  };
  r.readAsText(f); e.target.value = '';
};

render();
