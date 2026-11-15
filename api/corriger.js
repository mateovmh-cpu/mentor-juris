const SB_URL = process.env.SUPABASE_URL || "https://quszlzddqwhmnrjihded.supabase.co";
const SB_PUBLIC = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_WdcG0rZi3lTWrmjq3dyS2A_bf7R0y2c";

// Vérifie le jeton de connexion auprès de Supabase.
async function checkUser(token) {
  if (!token) return null;
  try {
    const r = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_PUBLIC, Authorization: "Bearer " + token } });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? u : null;
  } catch { return null; }
}

function cleanJson(raw) {
  let s = String(raw || "").trim().replace(/^\x60{3}(?:json)?\s*/i, "").replace(/\s*\x60{3}$/, "");
  const a = s.search(/[\[{]/);
  const b = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  if (a < 0 || b <= a) return null;
  s = s.slice(a, b + 1);
  let out = "", inStr = false, esc = false;
  for (const ch of s) {
    if (inStr) {
      if (esc) { out += ch; esc = false; }
      else if (ch === "\\") { out += ch; esc = true; }
      else if (ch === '"') { out += ch; inStr = false; }
      else if (ch === "\n") out += "\\n";
      else if (ch === "\r") out += "";
      else if (ch === "\t") out += "\\t";
      else out += ch;
    } else {
      if (ch === '"') inStr = true;
      out += ch;
    }
  }
  try { return JSON.stringify(JSON.parse(out)); } catch { return null; }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });

  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!(await checkUser(token))) return res.status(401).json({ error: "auth" });
  const { prompt } = req.body || {};
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 20000)
    return res.status(400).json({ error: "prompt_too_large" });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: ["claude-sonnet-5-5", "claude-haiku-5-5"].includes(req.body.model) ? req.body.model : "claude-sonnet-5-5",
        max_tokens: 4000,
        system: "Tu es l'assistant pédagogique d'une application pour étudiants en droit français. Suis exactement le format de réponse demandé. Quand on te demande du JSON : réponds uniquement avec le JSON, sans balises de code ni texte autour ; dans les chaînes, n'utilise jamais le guillemet droit \" (cite avec « ») et n'insère aucun retour à la ligne. Ne cite jamais un arrêt ou un article dont tu n'es pas certain : écris « à vérifier ».",
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await r.json();
    if (!r.ok) {
      console.error("Anthropic", r.status, JSON.stringify(data).slice(0, 300));
      return res.status(r.status === 429 ? 429 : 502).json({ error: "upstream" });
    }
    const text = (data.content || []).map((b) => b.text || "").join("");
    const clean = cleanJson(text);
    if (clean === null) {
      console.error("JSON invalide", data.stop_reason, text.length, "DEBUT:", text.slice(0, 150), "FIN:", text.slice(-150));
    }
    return res.status(200).json({ text: clean !== null ? clean : text });
  } catch (e) {
    console.error("Server", e && e.message);
    return res.status(500).json({ error: "server" });
  }
};
