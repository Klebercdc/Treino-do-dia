module.exports = async function handler(req, res) {
res.setHeader(“Access-Control-Allow-Origin”, “*”);
res.setHeader(“Access-Control-Allow-Methods”, “POST, OPTIONS”);
res.setHeader(“Access-Control-Allow-Headers”, “Content-Type”);

if (req.method === “OPTIONS”) return res.status(200).end();
if (req.method !== “POST”) return res.status(405).json({ error: “Method not allowed” });

const NVIDIA_KEY = process.env.NVIDIA_API_KEY;
if (!NVIDIA_KEY) return res.status(500).json({ error: “NVIDIA_API_KEY nao configurada.” });

try {
const { system, messages, max_tokens } = req.body;

```
const msgs = [];
if (system) msgs.push({ role: "system", content: system });
(messages || []).forEach(function(m) { msgs.push(m); });

const upstream = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + NVIDIA_KEY
  },
  body: JSON.stringify({
    model: "meta/llama-3.1-70b-instruct",
    messages: msgs,
    max_tokens: max_tokens || 800,
    temperature: 0.75,
    stream: false
  })
});

const data = await upstream.json();
const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";

return res.status(200).json({ content: [{ type: "text", text: text }] });
```

} catch (err) {
return res.status(500).json({ error: err.message });
}
}