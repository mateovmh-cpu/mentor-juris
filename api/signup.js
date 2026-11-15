// Création de compte sur invitation : vérifie le code, crée l'utilisateur avec la clé secrète (e-mail confirmé d'office).
const SB_URL = process.env.SUPABASE_URL || "https://quszlzddqwhmnrjihded.supabase.co";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const { email, password, code } = req.body || {};
  if (!process.env.ACCESS_CODE || typeof code !== "string" || code.trim() !== process.env.ACCESS_CODE)
    return res.status(401).json({ error: "bad_code" });
  const mail = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail) || mail.length > 200) return res.status(400).json({ error: "invalid_email" });
  if (typeof password !== "string" || password.length < 8 || password.length > 72) return res.status(400).json({ error: "weak_password" });
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return res.status(500).json({ error: "server" });

  try {
    const r = await fetch(SB_URL + "/auth/v1/admin/users", {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ email: mail, password, email_confirm: true })
    });
    if (r.ok) return res.status(200).json({ ok: true });
    const data = await r.json().catch(() => ({}));
    const msg = JSON.stringify(data).toLowerCase();
    if (r.status === 422 && (msg.includes("already") || msg.includes("exists"))) return res.status(409).json({ error: "email_exists" });
    if (msg.includes("weak") || msg.includes("password")) return res.status(400).json({ error: "weak_password" });
    console.error("Signup", r.status, msg.slice(0, 300));
    return res.status(502).json({ error: "upstream" });
  } catch (e) {
    console.error("Server", e && e.message);
    return res.status(500).json({ error: "server" });
  }
};
