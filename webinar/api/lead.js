/* A registration from one of the landing page forms comes here (POST /api/lead)
   and goes on to the Wix automation "הרשמה מדפי הנחיתה", which saves the contact and labels it.
   The automation's address lives in the Vercel setting WIX_LEAD_WEBHOOK, never in this public folder. */

const PAGES = ["webinar-adults", "webinar-parents", "zman", "avchun"];
const clip = (v, n) => String(v == null ? "" : v).trim().slice(0, n);

/* 050-1234567 -> +972501234567, so Wix (and WhatsApp later) read it as an Israeli number */
function phoneIL(raw) {
  const d = raw.replace(/\D/g, "");
  if (/^0\d{8,9}$/.test(d)) return "+972" + d.slice(1);
  if (/^972\d{8,9}$/.test(d)) return "+" + d;
  return raw.trim().startsWith("+") ? "+" + d : d;
}

/* With consent, the email joins the newsletter in Wix: the automation has no step for that.
   It needs the Vercel setting WIX_API_KEY (added 29.10.2026), a Wix key with an email permission;
   without it this step is skipped. Someone who once unsubscribed is left as they are. */
const SITE_ID = "eff09e79-ab2e-4434-a626-9fcbb7e606f2";
const SUBS = "https://www.wixapis.com/email-marketing/v1/email-subscriptions";

async function subscribe(email) {
  const key = process.env.WIX_API_KEY;
  if (!key) return;
  const headers = { "Content-Type": "application/json", Authorization: key, "wix-site-id": SITE_ID };
  const q = await fetch(SUBS + "/query", { method: "POST", headers, body: JSON.stringify({ filter: { email: { $in: [email] } } }) });
  if (!q.ok) throw new Error("query answered " + q.status);
  const now = ((await q.json()).subscriptions || [])[0];
  if (now && (now.subscriptionStatus === "SUBSCRIBED" || now.subscriptionStatus === "UNSUBSCRIBED")) return;
  const u = await fetch(SUBS, { method: "POST", headers, body: JSON.stringify({ subscription: { email, subscriptionStatus: "SUBSCRIBED" } }) });
  if (!u.ok) throw new Error("upsert answered " + u.status);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false });
  }
  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = null; } }
  b = b || {};

  /* the hidden field: people never see it, bots fill it in. Answer "ok" and drop it. */
  if (b.website) return res.status(200).json({ ok: true });

  const page = PAGES.includes(b.page) ? b.page : "";
  const name = clip(b.name, 80).replace(/\s+/g, " ");
  const email = clip(b.email, 120).toLowerCase();
  const phone = phoneIL(clip(b.phone, 30));
  if (!page || !name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.replace(/\D/g, "").length < 9) {
    return res.status(400).json({ ok: false });
  }

  const hook = process.env.WIX_LEAD_WEBHOOK;
  if (!hook) return res.status(503).json({ ok: false });

  const sp = name.indexOf(" ");
  const lead = {
    firstName: sp > 0 ? name.slice(0, sp) : name,
    lastName: sp > 0 ? name.slice(sp + 1) : "",
    fullName: name,
    email,
    phone,
    page,
    marketingConsent: b.consent === true,
    utmSource: clip(b.utmSource, 100),
    utmMedium: clip(b.utmMedium, 100),
    utmCampaign: clip(b.utmCampaign, 150),
    utmContent: clip(b.utmContent, 150),
    utmTerm: clip(b.utmTerm, 100),
    pageUrl: clip(b.pageUrl, 300),
  };

  try {
    const r = await fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lead),
    });
    if (!r.ok) {
      console.error("wix webhook answered", r.status, page);
      return res.status(502).json({ ok: false });
    }
    /* the registration is saved; the newsletter never holds it up for more than 2.5 seconds or fails it */
    if (lead.marketingConsent) {
      const sub = subscribe(email).catch((e) => console.error("newsletter failed", e && e.message, page));
      await Promise.race([sub, new Promise((done) => setTimeout(done, 2500))]);
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("wix webhook failed", e && e.message, page);
    return res.status(502).json({ ok: false });
  }
};
