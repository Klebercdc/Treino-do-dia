function createSupabaseAdminClient() {
  const baseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!baseUrl || !serviceKey) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórios.');
  }

  async function request(method, path, body) {
    const res = await fetch(`${baseUrl}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!res.ok) throw new Error(`Supabase REST ${res.status}: ${await res.text()}`);
    return res.json();
  }

  return { request };
}

module.exports = { createSupabaseAdminClient };
