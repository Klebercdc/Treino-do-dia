export const config = { runtime: “edge” };

export default async function handler(req) {
if (req.method === “OPTIONS”) {
return new Response(null, {
headers: {
“Access-Control-Allow-Origin”: “*”,
“Access-Control-Allow-Methods”: “POST, OPTIONS”,
“Access-Control-Allow-Headers”: “Content-Type”,
},
});
}

if (req.method !== “POST”) {
return new Response(“Method not allowed”, { status: 405 });
}

const NVIDIA_KEY = process.env.NVIDIA_API_KEY;
if (!NVIDIA_KEY) {
return new Response(
JSON.stringify({ error: “NVIDIA_API_KEY não configurada.” }),
{ status: 500, headers: { “Content-Type”: “application/json” } }
);
}

try {
const body = await req.json();

```
const messages = [];
if (body.system) messages.push({ role: "system", content: body.system });
(body.messages || []).forEach(m => messages.push(m));

const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${NVIDIA_KEY}`,
  },
  body: JSON.stringify({
    model: "meta/llama-3.1-70b-instruct",
    messages,
    max_tokens: body.max_tokens || 800,
    temperature: 0.75,
    stream: false,
  }),
});

const data = await res.json();
const text = data?.choices?.[0]?.message?.content || "";

return new Response(
  JSON.stringify({ content: [{ type: "text", text }] }),
  { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
);
```

} catch (err) {
return new Response(
JSON.stringify({ error: err.message }),
{ status: 500, headers: { “Content-Type”: “application/json”, “Access-Control-Allow-Origin”: “*” } }
);
}
}