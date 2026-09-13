const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  }
});

const clean = (value, max) => String(value ?? "").trim().slice(0, max);
const escapeHtml = (value) => value.replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;"
}[char]));

export async function onRequestPost(context) {
  if (!context.env.DB) {
    return json({ error: "Il modulo non è ancora collegato al database Cloudflare." }, 503);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Dati del modulo non validi." }, 400);
  }

  if (clean(body.website, 200)) {
    return json({ ok: true });
  }

  const name = clean(body.name, 80);
  const email = clean(body.email, 160).toLowerCase();
  const subject = clean(body.subject, 100) || "Messaggio dal sito";
  const message = clean(body.message, 3000);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (name.length < 2 || !emailOk || message.length < 5) {
    return json({ error: "Controlla nome, email e messaggio." }, 400);
  }

  await context.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await context.env.DB.prepare(
    "INSERT INTO contact_messages (name, email, subject, message) VALUES (?1, ?2, ?3, ?4)"
  ).bind(name, email, subject, message).run();

  let emailSent = false;
  if (context.env.RESEND_API_KEY) {
    try {
      const mailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "authorization": `Bearer ${context.env.RESEND_API_KEY}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          from: "Dan on the Road <contatti@danontheroad.com>",
          to: ["duaneberry@libero.it"],
          reply_to: email,
          subject: `[Dan on the Road] ${subject} — ${name}`,
          html: `
            <div style="font-family:Arial,sans-serif;color:#202124;line-height:1.6;max-width:680px">
              <h2 style="margin-bottom:18px">Nuovo messaggio da danontheroad.com</h2>
              <p><strong>Nome:</strong> ${escapeHtml(name)}</p>
              <p><strong>Email:</strong> ${escapeHtml(email)}</p>
              <p><strong>Argomento:</strong> ${escapeHtml(subject)}</p>
              <p><strong>Messaggio:</strong></p>
              <div style="padding:16px;background:#f4f5f6;border-left:4px solid #e32636;white-space:pre-wrap">${escapeHtml(message)}</div>
              <p style="margin-top:20px;color:#666;font-size:13px">Puoi rispondere direttamente a questa email.</p>
            </div>
          `
        })
      });

      if (!mailResponse.ok) {
        const detail = await mailResponse.text();
        console.error("Resend error:", mailResponse.status, detail);
      } else {
        emailSent = true;
      }
    } catch (error) {
      console.error("Email delivery error:", error);
    }
  }

  return json({ ok: true, emailSent });
}

export function onRequestGet() {
  return json({ ok: true, service: "Dan on the Road contact form" });
}
