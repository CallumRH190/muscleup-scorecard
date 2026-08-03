// /api/mc-event — receives pings from ManyChat External Request actions
// and stores them in Supabase (manychat_events table), so ManyChat-side
// funnel steps (comment trigger fired, DM flow fired) live in the same
// database as the scorecard's own events.
//
// ManyChat sends: POST, JSON body:
// { "token": "...", "event": "comment-flow", "subscriber_id": "...",
//   "ig_username": "...", "full_name": "...", "flow": "..." }

const SUPABASE_URL = process.env.SUPABASE_URL || "https://wzeiwntvhqvhdurowgux.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "sb_publishable_kMdFesGsSqX0flb1fErnOw_1jCuNk0T";
// Shared token so random internet traffic cannot write junk rows.
// Must match the token value sent in the ManyChat External Request body.
const MC_TOKEN = process.env.MC_EVENT_TOKEN || "cr-rings-mc-2026";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  if (body.token !== MC_TOKEN) {
    res.status(401).json({ error: "bad token" });
    return;
  }

  const clean = (v, n) => (typeof v === "string" ? v.slice(0, n) : null);
  const row = {
    event: clean(body.event, 60) || "unknown",
    subscriber_id: clean(String(body.subscriber_id || ""), 60) || null,
    ig_username: clean(body.ig_username, 120),
    full_name: clean(body.full_name, 120),
    flow: clean(body.flow, 120)
  };

  try {
    const r = await fetch(SUPABASE_URL + "/rest/v1/manychat_events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": "Bearer " + SUPABASE_KEY,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(row)
    });
    if (!r.ok) {
      const t = await r.text();
      res.status(502).json({ error: "supabase insert failed", detail: t.slice(0, 200) });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "server error" });
  }
}
