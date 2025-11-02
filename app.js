const apiBase = (window.API_BASE || location.origin);

// Domain list
const DOMAINS = [
  { label: "@ryuuxiao.biz.id", value: "ryuuxiao.biz.id" },
  { label: "@ryuushop.web.id", value: "ryuushop.web.id" },
  { label: "@ryuushop.xyz", value: "ryuushop.xyz" }
];

const selDomain = document.getElementById('domain');
const form = document.getElementById('create-form');
const addressEl = document.getElementById('address');
const listEl = document.getElementById('messages');
const btnRefresh = document.getElementById('refresh');
const endpointIndicator = document.getElementById('endpoint-indicator');

let currentEmail = null;
let pollTimer = null;

function escapeHtml(s){return (s+'').replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}

function initDomains(){
  selDomain.innerHTML='';
  DOMAINS.forEach(d=>{
    const o=document.createElement('option');
    o.value=d.value; o.textContent=d.label;
    selDomain.appendChild(o);
  });
}

async function createEmail(evt){
  evt.preventDefault();
  const name = (document.getElementById('name').value || '').trim().toLowerCase();
  const domain = selDomain.value;
  if(!name){ alert('Nama wajib diisi'); return; }
  currentEmail = name + '@' + domain;
  addressEl.textContent = currentEmail;

  try{
    const res = await fetch(apiBase + '/api/create', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ name, domain })
    });
    await res.json();
    await loadMessages();
    startPolling();
  }catch(e){
    console.error(e);
    alert('Gagal menghubungi API.');
  }
}

async function loadMessages(){
  if(!currentEmail){ listEl.classList.add('empty'); listEl.innerHTML='Tidak ada pesan'; return; }
  try{
    const res = await fetch(apiBase + '/api/messages?email=' + encodeURIComponent(currentEmail));
    const d = await res.json();
    const msgs = d.messages || [];
    if (msgs.length === 0){
      listEl.classList.add('empty'); listEl.innerHTML='Inbox kosong'; return;
    }
    listEl.classList.remove('empty'); listEl.innerHTML='';
    msgs.forEach(m=>{
      const el=document.createElement('div');
      el.className='msg';
      el.innerHTML='<strong>'+escapeHtml(m.subject)+'</strong>' +
                   '<div class="meta">from '+escapeHtml(m.from)+' • '+ new Date(m.date).toLocaleString() +'</div>' +
                   '<div class="body">'+escapeHtml(m.body)+'</div>';
      listEl.appendChild(el);
    });
  }catch(e){
    console.error(e);
    listEl.classList.add('empty'); listEl.innerHTML='Gagal memuat pesan dari API.';
  }
}

function startPolling(){
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(loadMessages, 5000);
}

btnRefresh.addEventListener('click', loadMessages);
form.addEventListener('submit', createEmail);

initDomains();
endpointIndicator.textContent = apiBase;
