// /api/submit — receives a scorecard submission, stores it, adds the
// contact to Resend, and sends the matching result email.
//
// Environment variables required in Vercel (Project > Settings > Environment Variables):
//   RESEND_API_KEY   (secret — the Resend API key)
// Optional overrides (sensible defaults baked in):
//   FROM_EMAIL       default "Callum on Rings <ring@callumhardingham.com>"
//   SUPABASE_URL     default the wildmanfit project URL
//   SUPABASE_KEY     default the insert-only publishable key
//   SCORECARD_URL    default the deployment's own URL

const FROM_EMAIL = process.env.FROM_EMAIL || "Callum on Rings <ring@callumhardingham.com>";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://wzeiwntvhqvhdurowgux.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "sb_publishable_kMdFesGsSqX0flb1fErnOw_1jCuNk0T";
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// -------- result copy, keyed by primary_focus --------
const RESULTS = {
  "entry-gate": {
    label: "Build the base first",
    subject: "Your result: build the base first",
    lines: [
      "You are before the muscle up pathway. That is not a failure. It just means muscle up drills would waste your time right now.",
      "Your fastest route to a muscle up is boring and simple. Build the base.",
      "The standard to hit: 10 clean strict pull ups on rings, 5 clean dips on rings, no wrist, elbow or shoulder pain.",
      "When you hit the standard, retake the scorecard and the 7 requirements will be waiting."
    ]
  },
  "r1": {
    label: "False Grip Lean Back Rows",
    subject: "Your main block: false grip lean back rows",
    lines: [
      "Your main block is the false grip lean back row. This movement teaches the exact pulling line your muscle up will follow. Rings close. Leaning back. Pulling to the lower chest.",
      "Most people pull like a normal row. That builds strength in the wrong line and the transition never arrives.",
      "Your focus: false grip lean back rows. Minimum 5 clean reps, good 8, ideal 10.",
      "Move on when you can complete your reps without losing false grip, pulling wide or losing the lean back."
    ]
  },
  "r2": {
    label: "False Grip Hang Tolerance",
    subject: "Your main block: false grip hang tolerance",
    lines: [
      "Your main block is false grip hang tolerance. Your wrists cannot yet carry your full bodyweight in false grip, and everything else in the muscle up sits on top of that grip.",
      "Remember the standard. This is a dead hang. Arms straight, feet completely off the floor. If your feet touch the floor, the time does not count.",
      "Your focus: false grip hangs. Minimum 5 seconds, good 10, ideal 15.",
      "Move on when you can hold a full hang without the wrist slipping underneath the ring."
    ]
  },
  "r3": {
    label: "False Grip Lean Back Pull Ups",
    subject: "Your main block: false grip lean back pull ups",
    lines: [
      "Your main block is the false grip lean back pull up. You have the grip. Now you need to pull in the muscle up line. Leaning back, rings close, towards the lower chest. No kipping.",
      "A vertical pull with the rings drifting wide feels strong but it arrives in the wrong place. The lean back creates the space the transition needs.",
      "Your focus: false grip lean back pull ups. Minimum 3 clean reps, good 5, ideal 8 to 10.",
      "Move on when you can pull with the rings close, without kipping or pulling wide."
    ]
  },
  "r4": {
    label: "Top Pull Isometric Hold",
    subject: "Your main block: the top pull hold",
    lines: [
      "Your main block is the top pull isometric hold. This is the position just before the transition. Pulled high, leaning back, rings close to the chest. If you cannot hold it, you cannot transition from it.",
      "Most people pull to chin height and call it high enough. It is not. Own the top of the pull, do not just visit it.",
      "Your focus: top pull isometric holds. Minimum 2 seconds, good 3, ideal 5 plus.",
      "Move on when you can hold the rings close to your chest without losing position."
    ]
  },
  "r5": {
    label: "Deep Ring Dip Capacity",
    subject: "Your main block: deep ring dip capacity",
    lines: [
      "Your main block is deep ring dip capacity. The transition drops you into the bottom of a dip, and if you cannot receive that position, the muscle up dies right there.",
      "The standard is clear. Upper arm parallel is not deep enough. The shoulder finishes near the base of the ring at the bottom of the dip.",
      "Your focus: deep ring dips. Minimum 1 deep rep, good 2 to 3, ideal 5.",
      "This one takes patience. Shoulders adapt slowly, so train it consistently."
    ]
  },
  "r6": {
    label: "Assisted Transition Mechanics",
    subject: "Your main block: the transition",
    lines: [
      "Your main block is transition mechanics. You can pull and you can dip. Now you need to own the pathway between them, because a jump through the middle builds nothing.",
      "The ladder runs feet on floor, feet elevated, thick band, lighter band, small band full range. A small band is the thinnest in your set, light help only. If the band is doing the work, it is not a small band.",
      "Your focus: assisted transitions. Minimum 3 controlled feet assisted reps, good 3 to 5 with feet elevated or a lighter band, ideal 3 to 5 small band full range reps.",
      "Move on when you can transition smoothly without the rings drifting wide or relying on a jump."
    ]
  },
  "r7": {
    label: "Controlled Reverse Rep",
    subject: "Your main block: the controlled reverse rep",
    lines: [
      "Your main block is the controlled reverse rep. You are closer than almost everyone who takes this scorecard. This is the last requirement before the real thing.",
      "Start at the top. Lower through the dip, through the transition, and catch high with the rings close to your chest. If you drop through the middle or catch low, the eccentric control is not there yet.",
      "Your focus: controlled reverse muscle ups. Minimum 1 clean rep, good 2, ideal 3.",
      "Move on when you can lower slowly and catch the rings high without collapsing."
    ]
  },
  "ready": {
    label: "Ready to attempt",
    subject: "You are ready. Attempt it.",
    lines: [
      "Every requirement is at Minimum or above. You have earned the right to attempt a clean, full ring muscle up. No kipping. Rings close. Controlled catch.",
      "Warm up thoroughly, set your false grip properly, pull high with the rings close, and commit to the transition you have already trained. Hesitation in the middle is what kills first attempts, and you have done the work, so commit.",
      "When you get it, reply to this email and tell me. I read every one."
    ]
  }
};

function buildHtml(result, scorecardUrl){
  const paras = result.lines.map(l => `<p style="margin:0 0 16px;color:#c9c2b0;font-size:16px;line-height:1.6;">${l}</p>`).join("");
  return `<!DOCTYPE html><html><body style="margin:0;background:#171511;padding:32px 0;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr><td style="padding:0 24px;">
          <p style="color:#c89b6d;font-size:12px;letter-spacing:3px;text-transform:uppercase;margin:0 0 8px;">Callum on Rings</p>
          <h1 style="color:#f1ede2;font-size:26px;margin:0 0 20px;text-transform:uppercase;letter-spacing:1px;">Here is your result</h1>
          <div style="width:48px;height:3px;background:#c89b6d;margin:0 0 24px;"></div>
          ${paras}
          <div style="margin:8px 0 20px;padding:18px 20px;background:#1f1c17;border:1px solid #353026;border-left:3px solid #c89b6d;border-radius:10px;">
            <p style="margin:0 0 6px;color:#c89b6d;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;">Your bonus</p>
            <p style="margin:0 0 10px;color:#f1ede2;font-size:15px;font-weight:bold;">The 7 Requirements Cheat Sheet</p>
            <p style="margin:0 0 12px;color:#c9c2b0;font-size:14px;line-height:1.6;">Every standard on one printable page. Tick where you are today, train the first gap, retest in two weeks.</p>
            <a href="${scorecardUrl}/7-requirements-cheat-sheet.pdf" style="display:inline-block;background:#c89b6d;color:#171511;text-decoration:none;font-weight:bold;padding:11px 22px;border-radius:8px;text-transform:uppercase;letter-spacing:1px;font-size:13px;">Download the cheat sheet</a>
          </div>
          <a href="${scorecardUrl}" style="display:inline-block;margin-top:12px;background:transparent;border:1px solid #a87c4f;color:#c89b6d;text-decoration:none;font-weight:bold;padding:12px 25px;border-radius:8px;text-transform:uppercase;letter-spacing:1px;font-size:14px;">Retake the scorecard</a>
          <p style="color:#8d8571;font-size:12px;margin:32px 0 0;">Callum on Rings. Clean reps. Earned standards.</p>
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
  const { email, entry_gate, scores, primary_focus, src } = body || {};

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    res.status(400).json({ error: "Valid email required" });
    return;
  }

  const focusKey = primary_focus || "ready";
  const result = RESULTS[focusKey] || RESULTS["ready"];
  const scorecardUrl = process.env.SCORECARD_URL ||
    ("https://" + (req.headers["x-forwarded-host"] || req.headers.host || "muscleup-scorecard.vercel.app"));

  // 1. Store the lead in Supabase (best effort, never blocks the response)
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
        entry_gate: entry_gate || {},
        scores: scores || {},
        primary_focus: focusKey,
        tag: "muscleup-diagnostic",
        src: (typeof src === "string" ? src.slice(0, 40) : null)
      })
    });
  } catch (e) {
    console.error("Supabase store failed:", e);
  }

  // 2 + 3. Add Resend contact and send the result email
  if (RESEND_API_KEY) {
    const rHeaders = {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + RESEND_API_KEY
    };

    // Add or update the contact in the default audience
    try {
      await fetch("https://api.resend.com/contacts", {
        method: "POST",
        headers: rHeaders,
        body: JSON.stringify({
          email,
          unsubscribed: false,
          data: { source: "muscleup-diagnostic", main_block: focusKey }
        })
      });
    } catch (e) {
      console.error("Resend contact add failed:", e);
    }

    // Fire the signup event so the 30 day nurture automation starts for this contact
    try {
      await fetch("https://api.resend.com/events/send", {
        method: "POST",
        headers: rHeaders,
        body: JSON.stringify({
          event: "scorecard.signup",
          email,
          payload: { main_block: focusKey || "", src: (typeof src === "string" ? src.slice(0, 40) : "") }
        })
      });
    } catch (e) {
      console.error("Resend event send failed:", e);
    }

    // Send the result email
    try {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: rHeaders,
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: email,
          subject: result.subject,
          html: buildHtml(result, scorecardUrl)
        })
      });
      if (!emailRes.ok) {
        const detail = await emailRes.text();
        console.error("Resend send failed:", emailRes.status, detail);
      }
    } catch (e) {
      console.error("Resend send error:", e);
    }

    // Notify Callum of the new lead (never blocks the user's flow)
    try {
      const focusLabel = primary_focus || "unknown";
      const scoreLines = Object.entries(scores || {})
        .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#555;">${k}</td><td style="padding:4px 0;"><b>${v}</b></td></tr>`)
        .join("");
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: rHeaders,
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: "info@callumhardingham.com",
          subject: `New lead: ${email} (${focusLabel})`,
          html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222;">
            <p><b>New muscle up diagnostic lead</b></p>
            <p>Email: <b>${email}</b><br>Result: <b>${focusLabel}</b></p>
            <table style="font-size:13px;">${scoreLines}</table>
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
