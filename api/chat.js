var https = require(`https`);

module.exports = function(req, res) {
  res.setHeader(`Access-Control-Allow-Origin`, `*`);
  res.setHeader(`Access-Control-Allow-Methods`, `POST, OPTIONS`);
  res.setHeader(`Access-Control-Allow-Headers`, `Content-Type`);
  if (req.method === `OPTIONS`) { res.status(200).end(); return; }
  if (req.method !== `POST`) { res.status(405).end(); return; }
  var KEY = process.env.NVIDIA_API_KEY;
  if (!KEY) { res.status(500).json({ error: `KEY missing` }); return; }
  var b = req.body || {};
  var m = [];
  if (b.system) m.push({ role: `system`, content: b.system });
  (b.messages || []).forEach(function(x) { m.push(x); });
  var p = JSON.stringify({ model: `meta/llama-3.1-70b-instruct`, messages: m, max_tokens: 800, temperature: 0.75, stream: false });
  var o = { hostname: `integrate.api.nvidia.com`, path: `/v1/chat/completions`, method: `POST`, headers: { [`Content-Type`]: `application/json`, [`Authorization`]: `Bearer ` + KEY, [`Content-Length`]: Buffer.byteLength(p) } };
  var r = https.request(o, function(s) {
    var d = ``;
    s.on(`data`, function(c) { d += c; });
    s.on(`end`, function() {
      try {
        var j = JSON.parse(d);
        var t = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || ``;
        res.status(200).json({ content: [{ type: `text`, text: t }] });
      } catch(e) {
        res.status(500).json({ error: d.slice(0, 100) });
      }
    });
  });
  r.on(`error`, function(e) { res.status(500).json({ error: e.message }); });
  r.write(p);
  r.end();
};