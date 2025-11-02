// Cloudflare Worker serving static frontend and API
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // --- Static assets ---
    if (request.method === 'GET') {
      if (url.pathname === '/' || url.pathname === '/index.html') {
        return new Response(INDEX_HTML, { headers: { 'Content-Type':'text/html; charset=utf-8' } });
      }
      if (url.pathname === '/style.css') {
        return new Response(STYLE_CSS, { headers: { 'Content-Type':'text/css; charset=utf-8' } });
      }
      if (url.pathname === '/app.js') {
        return new Response(APP_JS, { headers: { 'Content-Type':'application/javascript; charset=utf-8' } });
      }
    }

    // --- API ---
    const DEFAULT_DOMAINS = ['ryuuxiao.biz.id','ryuushop.xyz','ryuushop.web.id'];
    const MEM_STORE = {};

    async function kvGet(key) {
      if (env.INBOX_KV) {
        const v = await env.INBOX_KV.get(key);
        return v ? JSON.parse(v) : null;
      }
      return MEM_STORE[key] || null;
    }
    async function kvPut(key, value) {
      if (env.INBOX_KV) {
        await env.INBOX_KV.put(key, JSON.stringify(value));
      } else {
        MEM_STORE[key] = value;
      }
    }
    function jsonResponse(obj, status=200){
      return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type':'application/json; charset=utf-8' } });
    }

    if (url.pathname === '/api/domains' && request.method === 'GET') {
      return jsonResponse({ domains: DEFAULT_DOMAINS });
    }

    if (url.pathname === '/api/create' && request.method === 'POST') {
      const body = await request.json();
      const name = (body.name || 'user').replace(/\s+/g,'').toLowerCase().slice(0,64);
      const domain = body.domain || DEFAULT_DOMAINS[0];
      const email = `${name}@${domain}`;
      const inboxKey = `inbox:${email}`;
      let inbox = await kvGet(inboxKey);
      if (!inbox) {
        inbox = { email, messages: [] };
        await kvPut(inboxKey, inbox);
      }
      return jsonResponse({ email });
    }

    if (url.pathname === '/api/messages' && request.method === 'GET') {
      const email = url.searchParams.get('email');
      if (!email) return jsonResponse({ error: 'email required' }, 400);
      const inboxKey = `inbox:${email}`;
      const inbox = await kvGet(inboxKey) || { email, messages: [] };
      return jsonResponse({ email: inbox.email, messages: inbox.messages });
    }

    if (url.pathname === '/api/push' && request.method === 'POST') {
      if (env.API_KEY) {
        const key = request.headers.get('x-api-key');
        if (!key || key !== env.API_KEY) {
          return jsonResponse({ error: 'unauthorized' }, 401);
        }
      }
      const payload = await request.json().catch(()=>null);
      if (!payload) return jsonResponse({ error: 'invalid json' }, 400);
      const to = payload.to;
      if (!to) return jsonResponse({ error: "missing 'to' field" }, 400);
      const inboxKey = `inbox:${to}`;
      const inbox = await kvGet(inboxKey) || { email: to, messages: [] };
      const msg = {
        id: cryptoRandomId(),
        from: payload.from || 'unknown@external',
        subject: payload.subject || '(no subject)',
        body: payload.body || '',
        date: new Date().toISOString()
      };
      inbox.messages.unshift(msg);
      if (inbox.messages.length > 200) inbox.messages = inbox.messages.slice(0,200);
      await kvPut(inboxKey, inbox);
      return jsonResponse({ ok: true, message: msg });
    }

    return new Response('Not found', { status: 404 });
  }
}

function cryptoRandomId(){
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b=>b.toString(16).padStart(2,'0')).join('');
}

// --- Embedded static assets (keep in sync with files) ---
const INDEX_HTML = `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Trial Email Demo</title>
    <link rel="stylesheet" href="/style.css" />
  </head>
  <body>
    <header class="container">
      <h1>Trial Email (Demo)</h1>
      <p class="muted">Masukkan nama ➜ pilih domain ➜ buat alamat ➜ lihat inbox. Auto-refresh tiap 5 detik.</p>
    </header>

    <main class="container card">
      <form id="create-form" class="grid">
        <div class="field">
          <label for="name">Nama</label>
          <input id="name" name="name" placeholder="contoh: alice" required />
        </div>
        <div class="field">
          <label for="domain">Domain</label>
          <select id="domain" name="domain" required></select>
        </div>
        <div class="actions">
          <button id="create" type="submit">Create</button>
        </div>
      </form>

      <section class="address">
        <h3>Alamat</h3>
        <div id="address" class="pill">Belum ada</div>
      </section>

      <section class="inbox">
        <div class="inbox-head">
          <h3>Inbox</h3>
          <button id="refresh" class="ghost" title="Refresh">↻</button>
        </div>
        <div id="messages" class="list empty">Tidak ada pesan</div>
      </section>
    </main>

    <footer class="container foot muted">
      <small>Demo. Endpoint API: <code>/api/*</code></small>
    </footer>

    <script src="/app.js"></script>
  </body>
</html>
`;
const STYLE_CSS = `:root{
  --bg: #0b0c10;
  --card: #12151a;
  --muted: #8b95a7;
  --text: #e6ebf2;
  --accent: #4da3ff;
  --border: #1f2430;
}
*{box-sizing:border-box}
html,body{height:100%}
body{
  margin:0;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple Color Emoji','Segoe UI Emoji';
  background: radial-gradient(1200px 700px at 20% -20%, #182438 0%, transparent 60%),
              radial-gradient(1000px 500px at 100% 0%, #1a2b44 0%, transparent 60%),
              var(--bg);
  color:var(--text);
}
.container{max-width:960px;margin:0 auto;padding:20px}
header h1{margin:16px 0 6px 0;font-size:28px}
.muted{color:var(--muted)}
.card{
  background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02));
  border:1px solid var(--border);
  border-radius:16px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.25);
}
.card{padding:20px;margin:12px}
.grid{display:grid;grid-template-columns: 1fr 1fr auto; gap:12px; align-items:end}
.field label{display:block;font-size:12px;color:var(--muted);margin-bottom:6px}
input, select{
  width:100%;
  padding:10px 12px;
  background:#0f1218;
  border:1px solid var(--border);
  border-radius:10px;
  color:var(--text);
  outline:none;
}
input:focus, select:focus{border-color:#2b3242; box-shadow: 0 0 0 3px rgba(77,163,255,0.15)}
button{
  appearance:none; cursor:pointer;
  border:none; border-radius:12px; padding:10px 14px;
  background: linear-gradient(180deg, #4da3ff, #2f82f0);
  color:white; font-weight:600; letter-spacing:0.2px;
  box-shadow:0 8px 22px rgba(77,163,255,0.35);
}
button.ghost{
  background:transparent;border:1px solid var(--border);color:var(--text);
  box-shadow:none; padding:8px 12px; border-radius:10px;
}
.address{margin-top:8px}
.pill{
  display:inline-block; padding:8px 12px; border-radius:999px;
  background:#0f1218; border:1px solid var(--border);
  min-width:240px;
}
.inbox{margin-top:12px}
.inbox-head{display:flex; align-items:center; justify-content:space-between}
.list .msg{padding:12px;border-bottom:1px solid var(--border)}
.list .msg:last-child{border-bottom:0}
.msg .meta{font-size:12px;color:var(--muted);margin-top:2px}
.msg .body{margin-top:8px; white-space:pre-wrap; word-break:break-word}
.empty{color:var(--muted);font-style:italic}
.foot{opacity:0.8}
@media (max-width:720px){
  .grid{grid-template-columns: 1fr; align-items:stretch}
  .actions{display:flex;justify-content:flex-start}
}
`;
const APP_JS = `const apiBase = (window.API_BASE || location.origin);

const selDomain = document.getElementById('domain');
const form = document.getElementById('create-form');
const addressEl = document.getElementById('address');
const listEl = document.getElementById('messages');
const btnRefresh = document.getElementById('refresh');

let currentEmail = null;
let pollTimer = null;

function escapeHtml(s){return (s+'').replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}

async function loadDomains(){
  const res = await fetch(apiBase + '/api/domains');
  const data = await res.json();
  selDomain.innerHTML = '';
  data.domains.forEach(d => {
    const o = document.createElement('option');
    o.value = d; o.textContent = d;
    selDomain.appendChild(o);
  });
}

async function createEmail(evt){
  evt.preventDefault();
  const formData = new FormData(form);
  const name = (formData.get('name') || '').trim();
  const domain = formData.get('domain');
  if(!name){ alert('Nama wajib diisi'); return; }

  const res = await fetch(apiBase + '/api/create', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ name, domain })
  });
  const d = await res.json();
  currentEmail = d.email;
  addressEl.textContent = currentEmail;
  await loadMessages();
  startPolling();
}

async function loadMessages(){
  if(!currentEmail){ listEl.classList.add('empty'); listEl.innerHTML = 'Tidak ada pesan'; return; }
  const res = await fetch(apiBase + '/api/messages?email=' + encodeURIComponent(currentEmail));
  const d = await res.json();
  const msgs = d.messages || [];
  if (msgs.length === 0){
    listEl.classList.add('empty');
    listEl.innerHTML = 'Inbox kosong';
    return;
  }
  listEl.classList.remove('empty');
  listEl.innerHTML = '';
  msgs.forEach(m => {
    const el = document.createElement('div');
    el.className = 'msg';
    el.innerHTML = '<strong>'+escapeHtml(m.subject)+'</strong>' +
                   '<div class="meta">from '+escapeHtml(m.from)+' • '+ new Date(m.date).toLocaleString() +'</div>' +
                   '<div class="body">'+escapeHtml(m.body)+'</div>';
    listEl.appendChild(el);
  });
}

function startPolling(){
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(loadMessages, 5000);
}

btnRefresh.addEventListener('click', loadMessages);
form.addEventListener('submit', createEmail);

loadDomains();
`;
