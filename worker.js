export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ✅ CORS preflight handler
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, x-api-key",
        },
      });
    }

    // ✅ Allowed domains
    const DEFAULT_DOMAINS = ['ryuuxiao.biz.id', 'ryuushop.web.id', 'ryuushop.xyz'];
    const MEM_STORE = {};

    // Simple storage (can use KV too)
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

    // ✅ Response helper with CORS
    function jsonResponse(obj, status = 200) {
      return new Response(JSON.stringify(obj), {
        status,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        },
      });
    }

    // ✅ API endpoints
    if (url.pathname === '/api/domains' && request.method === 'GET') {
      return jsonResponse({ domains: DEFAULT_DOMAINS });
    }

    if (url.pathname === '/api/create' && request.method === 'POST') {
      const body = await request.json();
      const name = (body.name || 'user').replace(/\s+/g, '').toLowerCase().slice(0, 64);
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
      // Optional API key
      if (env.API_KEY) {
        const key = request.headers.get('x-api-key');
        if (!key || key !== env.API_KEY) {
          return jsonResponse({ error: 'unauthorized' }, 401);
        }
      }

      const payload = await request.json().catch(() => null);
      if (!payload) return jsonResponse({ error: 'invalid json' }, 400);
      const to = payload.to;
      if (!to) return jsonResponse({ error: "missing 'to' field" }, 400);

      const inboxKey = `inbox:${to}`;
      const inbox = (await kvGet(inboxKey)) || { email: to, messages: [] };
      const msg = {
        id: cryptoRandomId(),
        from: payload.from || 'unknown@external',
        subject: payload.subject || '(no subject)',
        body: payload.body || '',
        date: new Date().toISOString(),
      };
      inbox.messages.unshift(msg);
      if (inbox.messages.length > 200) inbox.messages = inbox.messages.slice(0, 200);
      await kvPut(inboxKey, inbox);
      return jsonResponse({ ok: true, message: msg });
    }

    return new Response('Not found', {
      status: 404,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  },
};

function cryptoRandomId() {
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}
