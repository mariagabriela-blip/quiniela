/* ============================================================
   La Quiniela del Mundial — Backend compartido
   Express + SQLite (better-sqlite3). Sin nada en la nube:
   todos los jugadores escriben/leen de la MISMA base de datos,
   así todos ven la quiniela y la tabla de todos en vivo.
   ============================================================ */
const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const Database = require("better-sqlite3");

const { MATCHES, scoreMatch } = require("../shared-data.js");

const PORT = process.env.PORT || 3000;
const ADMIN_PIN = process.env.ADMIN_PIN || "1234";

/* ---------- Rutas de datos ---------- */
const DATA_DIR = path.join(__dirname, "..", "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* ---------- Base de datos ---------- */
const db = new Database(path.join(DATA_DIR, "quiniela.db"));
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    name        TEXT PRIMARY KEY,
    fav         TEXT,
    receipt_url TEXT,
    created_at  INTEGER
  );
  CREATE TABLE IF NOT EXISTS predictions (
    player_name TEXT,
    match_id    TEXT,
    h           INTEGER,
    a           INTEGER,
    PRIMARY KEY (player_name, match_id)
  );
  CREATE TABLE IF NOT EXISTS results (
    match_id TEXT PRIMARY KEY,
    h        INTEGER,
    a        INTEGER
  );
`);

const VALID_MATCH = new Set(MATCHES.map((m) => m.id));
const clampScore = (v) => {
  let n = parseInt(v, 10);
  if (isNaN(n) || n < 0) n = 0;
  if (n > 30) n = 30;
  return n;
};

/* ---------- App ---------- */
const app = express();
app.use(express.json({ limit: "1mb" }));

// Sirve el frontend y los comprobantes subidos
app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/uploads", express.static(UPLOAD_DIR));
// La data compartida (equipos, partidos, chistes, scoring) para el navegador
app.get("/data.js", (_req, res) =>
  res.type("application/javascript").sendFile(path.join(__dirname, "..", "shared-data.js"))
);

/* ---------- Subida de comprobantes ---------- */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || ".png").toLowerCase();
    cb(null, `receipt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 6 * 1024 * 1024 }, // 6 MB
  fileFilter: (_req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});

function requireAdmin(req, res, next) {
  if ((req.get("x-admin-pin") || req.query.pin) === ADMIN_PIN) return next();
  res.status(401).json({ error: "PIN de admin incorrecto" });
}

/* ============================================================
   API
   ============================================================ */

// Estado completo: jugadores (con pronósticos y puntos) + resultados
app.get("/api/state", (_req, res) => {
  const players = db.prepare("SELECT * FROM players ORDER BY created_at ASC").all();
  const predRows = db.prepare("SELECT * FROM predictions").all();
  const resultRows = db.prepare("SELECT * FROM results").all();

  const results = {};
  for (const r of resultRows) results[r.match_id] = { h: r.h, a: r.a };

  const predsByPlayer = {};
  for (const p of predRows) {
    (predsByPlayer[p.player_name] ||= {})[p.match_id] = { h: p.h, a: p.a };
  }

  const out = players.map((pl) => {
    const predictions = predsByPlayer[pl.name] || {};
    let points = 0;
    const perMatch = {};
    for (const m of MATCHES) {
      const pts = scoreMatch(predictions[m.id], results[m.id]);
      perMatch[m.id] = pts;
      points += pts;
    }
    return {
      name: pl.name,
      fav: pl.fav,
      receipt_url: pl.receipt_url,
      paid: !!pl.receipt_url,
      predictions,
      perMatch,
      points,
      filled: Object.keys(predictions).length,
    };
  });

  out.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  res.json({ players: out, results, totalMatches: MATCHES.length });
});

// Registro / actualización de datos + comprobante (multipart)
app.post("/api/register", upload.single("receipt"), (req, res) => {
  const name = (req.body.name || "").trim();
  const fav = (req.body.fav || "").trim() || null;
  if (!name) return res.status(400).json({ error: "Falta el nombre" });
  if (name.length > 40) return res.status(400).json({ error: "Nombre demasiado largo" });

  const existing = db.prepare("SELECT * FROM players WHERE name = ?").get(name);
  const receiptUrl = req.file
    ? "/uploads/" + req.file.filename
    : (existing ? existing.receipt_url : null);

  // Si subió un comprobante nuevo, borra el anterior del disco
  if (req.file && existing && existing.receipt_url) {
    const old = path.join(UPLOAD_DIR, path.basename(existing.receipt_url));
    fs.promises.unlink(old).catch(() => {});
  }

  db.prepare(`
    INSERT INTO players (name, fav, receipt_url, created_at)
    VALUES (@name, @fav, @receipt_url, @created_at)
    ON CONFLICT(name) DO UPDATE SET fav = @fav, receipt_url = @receipt_url
  `).run({
    name, fav, receipt_url: receiptUrl,
    created_at: existing ? existing.created_at : Date.now(),
  });

  res.json({ ok: true, updated: !!existing, name });
});

// Guardar pronósticos del jugador
app.post("/api/predictions", (req, res) => {
  const name = (req.body.name || "").trim();
  const predictions = req.body.predictions || {};
  if (!name) return res.status(400).json({ error: "Falta el nombre" });
  const player = db.prepare("SELECT name FROM players WHERE name = ?").get(name);
  if (!player) return res.status(404).json({ error: "Regístrate primero" });

  const del = db.prepare("DELETE FROM predictions WHERE player_name = ?");
  const ins = db.prepare(
    "INSERT INTO predictions (player_name, match_id, h, a) VALUES (?, ?, ?, ?)"
  );
  const tx = db.transaction(() => {
    del.run(name);
    let count = 0;
    for (const [mid, val] of Object.entries(predictions)) {
      if (!VALID_MATCH.has(mid) || !val) continue;
      if (val.h === "" || val.h == null || val.a === "" || val.a == null) continue;
      ins.run(name, mid, clampScore(val.h), clampScore(val.a));
      count++;
    }
    return count;
  });
  const count = tx();
  res.json({ ok: true, count });
});

// (Admin) cargar resultados reales
app.post("/api/admin/results", requireAdmin, (req, res) => {
  const results = req.body.results || {};
  const del = db.prepare("DELETE FROM results");
  const ins = db.prepare("INSERT INTO results (match_id, h, a) VALUES (?, ?, ?)");
  const tx = db.transaction(() => {
    del.run();
    for (const [mid, val] of Object.entries(results)) {
      if (!VALID_MATCH.has(mid) || !val) continue;
      if (val.h === "" || val.h == null || val.a === "" || val.a == null) continue;
      ins.run(mid, clampScore(val.h), clampScore(val.a));
    }
  });
  tx();
  res.json({ ok: true });
});

// (Admin) verificar PIN
app.post("/api/admin/login", (req, res) => {
  res.json({ ok: (req.body.pin || "") === ADMIN_PIN });
});

// (Admin) borrar todo
app.post("/api/admin/reset", requireAdmin, (_req, res) => {
  db.exec("DELETE FROM predictions; DELETE FROM results; DELETE FROM players;");
  fs.readdirSync(UPLOAD_DIR).forEach((f) =>
    fs.promises.unlink(path.join(UPLOAD_DIR, f)).catch(() => {})
  );
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`⚽ Quiniela del Mundial corriendo en http://localhost:${PORT}`);
});
