module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { texte, type, code } = req.body || {};
  if (code !== process.env.ACCESS_CODE) return res.status(401).json({ error: "Code d'accès invalide" });
  if (typeof texte !== "string" || !texte.trim() || texte.length > 8000)
    return res.status(400).json({ error: "Texte manquant ou trop long (8000 caractères max)" });

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
        max_tokens: 1200,
        system: "Tu es Marlowe, correcteur exigeant de droit français. Corrige l'exercice de l'étudiant : points forts, erreurs, note sur 20 justifiée. Ne cite jamais un arrêt ou un article dont tu n'es pas certain : écris « à vérifier ».",
        messages: [{ role: "user", content: "Type d'exercice : " + (type || "non précisé") + "\n\n" + texte }]
      })
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: "Erreur du service de correction" });
    return res.status(200).json({ correction: (data.content && data.content[0] && data.content[0].text) || "" });
  } catch (e) {
    return res.status(500).json({ error: "Erreur serveur" });
  }
};
