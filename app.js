const apiBase = (window.API_BASE || location.origin);

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
