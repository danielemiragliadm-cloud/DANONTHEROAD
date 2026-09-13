const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  }
});

const clean = (value, max) => String(value ?? "").trim().slice(0, max);

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

  return json({ ok: true });
}

export function onRequestGet() {
  return json({ ok: true, service: "Dan on the Road contact form" });
}
