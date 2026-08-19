// /api/sheet — receives a cheat sheet download request, stores the lead,
// adds the contact to Resend, enrols them in the nurture sequence, and
// sends the delivery email with the download link.
//
// Uses the same environment variables as /api/submit.

const FROM_EMAIL = process.env.FROM_EMAIL || "Callum on Rings <ring@callumhardingham.com>";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://wzeiwntvhqvhdurowgux.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "sb_publishable_kMdFesGsSqX0flb1fErnOw_1jCuNk0T";
const RESEND_API_KEY = process.env.RESEND_API_KEY;

function buildHtml(baseUrl){
  const pdfUrl = baseUrl + "/7-requirements-cheat-sheet.pdf";
  const scorecardUrl = baseUrl + "/?src=sheet-email";
  return `<!DOCTYPE html><html><body style="margin:0;background:#171511;padding:32px 0;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr><td style="padding:0 24px;">
          <p style="color:#c89b6d;font-size:12px;letter-spacing:3px;text-transform:uppercase;margin:0 0 8px;">Callum on Rings</p>
          <h1 style="color:#f1ede2;font-size:26px;margin:0 0 20px;text-transform:uppercase;letter-spacing:1px;">Your cheat sheet is here</h1>
          <div style="width:48px;height:3px;background:#c89b6d;margin:0 0 24px;"></div>
          <p style="margin:0 0 16px;color:#c9c2b0;font-size:16px;line-height:1.6;">This is every standard between you and your first ring muscle up, on one page. All 7 requirements, each with the Minimum, Good and Ideal level.</p>
          <p style="margin:0 0 16px;color:#c9c2b0;font-size:16px;line-height:1.6;">How to use it: work down the list in order. The first requirement where you cannot tick Minimum is your main block. Train that one first. Retest every couple of weeks and watch the ticks move.</p>
          <a href="${pdfUrl}" style="display:inline-block;margin-top:8px;background:#c89b6d;color:#171511;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:8px;text-transform:uppercase;letter-spacing:1px;font-size:14px;">Download the cheat sheet</a>
          <div style="margin-top:28px;padding:18px 20px;background:#1f1c17;border:1px solid #353026;border-radius:10px;">
            <p style="margin:0 0 10px;color:#f1ede2;font-size:15px;font-weight:bold;">Not sure which level you are on?</p>
            <p style="margin:0 0 12px;color:#c9c2b0;font-size:14px;line-height:1.6;">Take the free 3 minute diagnostic. It scores you on all 7 requirements and shows you exactly which one is blocking your muscle up.</p>
            <a href="${scorecardUrl}" style="color:#c89b6d;font-weight:bold;text-decoration:none;font-size:14px;">Take the scorecard &rarr;</a>
          </div>
          <p style="color:#8d8571;font-size:12px;margin:32px 0 0;">Callum on Rings</p>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;
}

export default async function handler(req, res){
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const { email, src } = body || {};

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    res.status(400).json({ error: "Valid email required" });
    return;
  }

  const cleanSrc = typeof src === "string" ? src.slice(0, 40) : null;
  const baseUrl = process.env.SCORECARD_URL ||
    ("https://" + (req.headers["x-forwarded-host"] || req.headers.host || "scorecard.callumonrings.com"));

  // 1. Store the lead in Supabase (best effort)
  try {
    await fetch(SUPABASE_URL + "/rest/v1/muscleup_leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": "Bearer " + SUPABASE_KEY,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        email,
        entry_gate: {},
        scores: {},
        primary_focus: "cheatsheet",
        tag: "cheatsheet",
        src: cleanSrc
      })
    });
  } catch (e) {
    console.error("Supabase store failed:", e);
  }

  if (RESEND_API_KEY) {
    const rHeaders = {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + RESEND_API_KEY
    };

    // 2. Add or update the contact in Resend
    try {
      await fetch("https://api.resend.com/contacts", {
        method: "POST",
        headers: rHeaders,
        body: JSON.stringify({
          email,
          unsubscribed: false,
          data: { source: "cheatsheet", main_block: "cheatsheet" }
        })
      });
    } catch (e) {
      console.error("Resend contact add failed:", e);
    }

    // 3. Enrol in the 30 day nurture sequence
    try {
      await fetch("https://api.resend.com/events/send", {
        method: "POST",
        headers: rHeaders,
        body: JSON.stringify({
          event: "scorecard.signup",
          email,
          payload: { main_block: "cheatsheet", src: cleanSrc || "" }
        })
      });
    } catch (e) {
      console.error("Resend event send failed:", e);
    }

    // 4. Send the delivery email
    try {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: rHeaders,
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: email,
          subject: "Your 7 Requirements Cheat Sheet",
          html: buildHtml(baseUrl)
        })
      });
      if (!emailRes.ok) {
        const detail = await emailRes.text();
        console.error("Resend send failed:", emailRes.status, detail);
      }
    } catch (e) {
      console.error("Resend send error:", e);
    }

    // 5. Notify Callum (never blocks the user's flow)
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: rHeaders,
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: "info@callumhardingham.com",
          subject: `New cheat sheet lead: ${email}`,
          html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222;">
            <p><b>New cheat sheet download</b></p>
            <p>Email: <b>${email}</b><br>Source: <b>${cleanSrc || "direct"}</b></p>
          </div>`
        })
      });
    } catch (e) {
      console.error("Lead notification error:", e);
    }
  } else {
    console.warn("RESEND_API_KEY not set — skipping contact add and email send.");
  }

  res.status(200).json({ ok: true });
}
