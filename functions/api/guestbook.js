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
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
}[char]));

async function prepareDatabase(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS guestbook_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      message TEXT NOT NULL,
      visitor_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

async function visitorHash(request, salt) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const bytes = new TextEncoder().encode(`${salt || "danontheroad"}|${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function onRequestGet(context) {
  if (!context.env.DB) return json({ error: "Guestbook non ancora collegato al database." }, 503);
  await prepareDatabase(context.env.DB);
  const result = await context.env.DB.prepare(
    "SELECT id, name, message, created_at FROM guestbook_messages ORDER BY id DESC LIMIT 50"
  ).all();
  return json({ entries: result.results || [] });
}

export async function onRequestPost(context) {
  if (!context.env.DB) return json({ error: "Guestbook non ancora collegato al database." }, 503);

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Dati non validi." }, 400);
  }

  if (clean(body.website, 200)) return json({ ok: true });

  const name = clean(body.name, 50);
  const message = clean(body.message, 600);
  if (name.length < 2 || message.length < 3) {
    return json({ error: "Inserisci il tuo nome e un messaggio." }, 400);
  }
  if (/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|it|net|org|info)\b/i.test(message)) {
    return json({ error: "Nel guestbook non sono consentiti collegamenti." }, 400);
  }

  await prepareDatabase(context.env.DB);
  const hash = await visitorHash(context.request, context.env.GUESTBOOK_SALT);
  const recent = await context.env.DB.prepare(
    "SELECT id FROM guestbook_messages WHERE visitor_hash = ?1 AND created_at > datetime('now', '-5 minutes') LIMIT 1"
  ).bind(hash).first();
  if (recent) return json({ error: "Hai appena lasciato un messaggio. Attendi qualche minuto." }, 429);

  const inserted = await context.env.DB.prepare(
    "INSERT INTO guestbook_messages (name, message, visitor_hash) VALUES (?1, ?2, ?3) RETURNING id, name, message, created_at"
  ).bind(name, message, hash).first();

  if (context.env.RESEND_API_KEY) {
    context.waitUntil(fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${context.env.RESEND_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        from: "Dan on the Road <contatti@danontheroad.com>",
        to: ["duaneberry@libero.it"],
        subject: `[Dan on the Road] Nuovo messaggio nel Guestbook — ${name}`,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>Nuovo messaggio nel Guestbook</h2><p><strong>Nome:</strong> ${escapeHtml(name)}</p><div style="padding:16px;background:#f4f5f6;border-left:4px solid #e32636;white-space:pre-wrap">${escapeHtml(message)}</div></div>`
      })
    }).catch((error) => console.error("Guestbook notification error:", error)));
  }

  return json({ ok: true, entry: inserted }, 201);
}
