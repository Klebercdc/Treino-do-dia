module.exports = async function handler(req, res) {
res.setHeader(“Access-Control-Allow-Origin”, “*”);
res.setHeader(“Access-Control-Allow-Methods”, “POST, OPTIONS”);
res.setHeader(“Access-Control-Allow-Headers”, “Content-Type”);

if (req.method === “OPTIONS”) return res.status(200).end();
if (req.method !== “POST”) return res.status(405).json({ error: “Method not allowed” });

const NVIDIA_KEY = process.env.NVIDIA_API_KEY;
if (!NVIDIA_KEY) return res.status(500).json({ error: “NVIDIA_API_KEY não configurada.” });

try {
// Parse body — Vercel às vezes entrega como string
let body = req.body;
if (typeof body === “string”) {
try { body = JSON.parse(body); } catch { body = {}; }
}
if (!body || typeof body !== “object”) body = {};

```
const system     = body.system    || "";
const messages   = Array.isArray(body.messages) ? body.messages : [];
const max_tokens = Number(body.max_tokens) || 800;

const msgs = [];
if (system) msgs.push({ role: "system", content: system });
messages.forEach(function(m) { msgs.push(m); });

if (msgs.length === 0) {
  return res.status(400).json({ error: "Nenhuma mensagem recebida." });
}

const upstream = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + NVIDIA_KEY,
  },
  body: JSON.stringify({
    model: "meta/llama-3.1-70b-instruct",
    messages: msgs,
    max_tokens: max_tokens,
    temperature: 0.75,
    stream: false,
  }),
});

const raw = await upstream.text();
let data;
try { data = JSON.parse(raw); } catch {
  return res.status(500).json({ error: "Resposta inválida da NVIDIA: " + raw.slice(0, 300) });
}

if (!upstream.ok || data.error) {
  return res.status(upstream.status || 500).json({
    error: data?.error?.message || data?.error || "Erro NVIDIA status " + upstream.status
  });
}

const text = data?.choices?.[0]?.message?.content || "";
return res.status(200).json({ content: [{ type: "text", text }] });
```

} catch (err) {
console.error(“chat.js crash:”, err);
return res.status(500).json({ error: err.message });
}
};