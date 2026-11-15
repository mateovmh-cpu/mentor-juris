// Suppression définitive du compte connecté. Les données de user_kv partent avec (on delete cascade).
const SB_URL = process.env.SUPABASE_URL || "https://quszlzddqwhmnrjihded.supabase.co";
const SB_PUBLIC = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_WdcG0rZi3lTWrmjq3dyS2A_bf7R0y2c";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "auth" });
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return res.status(500).json({ error: "server" });

  try {
    const u = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_PUBLIC, Authorization: "Bearer " + token } });
    if (!u.ok) return res.status(401).json({ error: "auth" });
    const user = await u.json();
    if (!user || !user.id) return res.status(401).json({ error: "auth" });

    const d = await fetch(SB_URL + "/auth/v1/admin/users/" + encodeURIComponent(user.id), {
      method: "DELETE",
      headers: { apikey: key }
    });
    if (!d.ok) {
      console.error("Delete", d.status, (await d.text()).slice(0, 300));
      return res.status(502).json({ error: "upstream" });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Server", e && e.message);
    return res.status(500).json({ error: "server" });
  }
};
