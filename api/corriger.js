module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });

  const { prompt, code } = req.body || {};
  if (!process.env.ACCESS_CODE || code !== process.env.ACCESS_CODE)
    return res.status(401).json({ error: "bad_code" });
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
        model: "claude-sonnet-5-5",
        max_tokens: 2500,
        system: "Tu es l'assistant pédagogique d'une application pour étudiants en droit français. Suis exactement le format de réponse demandé. Ne cite jamais un arrêt ou un article dont tu n'es pas certain : écris « à vérifier ».",
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await r.json();
    if (!r.ok) {
      console.error("Anthropic", r.status, JSON.stringify(data).slice(0, 300));
      return res.status(r.status === 429 ? 429 : 502).json({ error: "upstream" });
    }
    const text = (data.content || []).map((b) => b.text || "").join("");
    return res.status(200).json({ text });
  } catch (e) {
    console.error("Server", e && e.message);
    return res.status(500).json({ error: "server" });
  }
};
