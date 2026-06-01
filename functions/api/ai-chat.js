export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type' },
    });
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }
  const key = env.DEEPSEEK_API_KEY;
  if (!key) {
    return new Response(JSON.stringify({ error: 'DEEPSEEK_API_KEY not set in Cloudflare Pages env' }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
  try {
    const body = await request.text();
    let data;
    try { data = JSON.parse(body); } catch { data = { messages: [] }; }
    const resp = await fetch('https://opencode.ai/zen/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-v4-flash-free',
        messages: data.messages || [{ role: 'user', content: 'Hello' }],
        temperature: data.temperature ?? 0.7,
        max_tokens: data.max_tokens ?? 3000,
      }),
    });
    const text = await resp.text();
    if (!text || !text.trim()) {
      return new Response(JSON.stringify({ error: 'AI returned empty response' }), {
        status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
    let parsed;
    try { parsed = JSON.parse(text); } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON from AI', raw: text.substring(0, 200) }), {
        status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
    if (parsed.error) {
      return new Response(text, { status: resp.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
    if (parsed.choices && parsed.choices[0] && parsed.choices[0].message) {
      const msg = parsed.choices[0].message;
      if (!msg.content) msg.content = msg.reasoning_content || msg.reasoning || '';
      msg.content = msg.content.replace(/^(Thinking\..*?\n)/, '').replace(/^(The user says?:.*?\n)/i, '').replace(/^(First,.*?\n)/i, '').replace(/^(We need to.*?\n)/i, '').trim();
    }
    return new Response(JSON.stringify(parsed), {
      status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
