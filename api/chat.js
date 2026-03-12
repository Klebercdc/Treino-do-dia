const https = require(“https”);

module.exports = function(req, res) {
res.setHeader(“Access-Control-Allow-Origin”, “*”);
res.setHeader(“Access-Control-Allow-Methods”, “POST, OPTIONS”);
res.setHeader(“Access-Control-Allow-Headers”, “Content-Type”);

if (req.method === “OPTIONS”) { res.status(200).end(); return; }
if (req.method !== “POST”) { res.status(405).json({ error: “Method not allowed” }); return; }

var NVIDIA_KEY = process.env.NVIDIA_API_KEY;
if (!NVIDIA_KEY) { res.status(500).json({ error: “NVIDIA_API_KEY nao configurada.” }); return; }

var body = req.body || {};
var msgs = [];
if (body.system) msgs.push({ role: “system”, content: body.system });
(body.messages || []).forEach(function(m) { msgs.push(m); });

var payload = JSON.stringify({
model: “nvidia/llama-3.1-nemotron-70b-instruct”,
messages: msgs,
max_tokens: body.max_tokens || 800,
temperature: 0.75,
stream: false
});

var options = {
hostname: “integrate.api.nvidia.com”,
path: “/v1/chat/completions”,
method: “POST”,
headers: {
“Content-Type”: “application/json”,
“Authorization”: “Bearer “ + NVIDIA_KEY,
“Content-Length”: Buffer.byteLength(payload)
}
};

var req2 = https.request(options, function(res2) {
var data = “”;
res2.on(“data”, function(chunk) { data += chunk; });
res2.on(“end”, function() {
try {
var parsed = JSON.parse(data);
if (parsed.error) {
res.status(500).json({ error: JSON.stringify(parsed.error) });
return;
}
var text = (parsed.choices && parsed.choices[0] && parsed.choices[0].message && parsed.choices[0].message.content) || “”;
res.status(200).json({ content: [{ type: “text”, text: text }] });
} catch(e) {
res.status(500).json({ error: “Resposta NVIDIA: “ + data.slice(0, 200) });
}
});
});

req2.on(“error”, function(e) {
res.status(500).json({ error: e.message });
});

req2.write(payload);
req2.end();
}