export const config = { runtime: “edge” };

export default async function handler(req) {
// CORS preflight
if (req.method === “OPTIONS”) {
return new Response(null, {
headers: {
“Access-Control-Allow-Origin”:  “*”,
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
JSON.stringify({ error: “NVIDIA_API_KEY não configurada no Vercel.” }),
{ status: 500, headers: { “Content-Type”: “application/json” } }
);
}

try {
const body = await req.json();

```
// Montar mensagens no formato OpenAI
const openaiMessages = [];
if (body.system) {
  openaiMessages.push({ role: "system", content: body.system });
}
(body.messages || []).forEach(m => openaiMessages.push(m));

// Chamada NVIDIA NIM com streaming ativado
const upstream = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type":  "application/json",
    "Authorization": `Bearer ${NVIDIA_KEY}`,
  },
  body: JSON.stringify({
    model:       "meta/llama-3.1-70b-instruct",
    messages:    openaiMessages,
    max_tokens:  body.max_tokens || 1000,
    temperature: 0.75,
    stream:      true,
  }),
});

if (!upstream.ok || !upstream.body) {
  const err = await upstream.text();
  return new Response(
    JSON.stringify({ error: "Erro NVIDIA: " + err }),
    { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
  );
}

// Transformar stream SSE da NVIDIA → stream de texto simples para o frontend
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const stream = new ReadableStream({
  async start(controller) {
    const reader = upstream.body.getReader();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // guarda linha incompleta

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;
        if (!trimmed.startsWith("data: ")) continue;

        try {
          const json  = JSON.parse(trimmed.slice(6));
          const token = json?.choices?.[0]?.delta?.content;
          if (token) {
            // Envia cada token como chunk de texto simples
            controller.enqueue(encoder.encode(token));
          }
        } catch {}
      }
    }
    controller.close();
  }
});

return new Response(stream, {
  status: 200,
  headers: {
    "Content-Type":                "text/plain; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "X-Content-Type-Options":      "nosniff",
    "Cache-Control":               "no-cache",
  },
});
```

} catch (err) {
return new Response(
JSON.stringify({ error: “Erro interno: “ + err.message }),
{ status: 500, headers: { “Content-Type”: “application/json”, “Access-Control-Allow-Origin”: “*” } }
);
}
}