/* ============================================================
   La Quiniela del Mundial — App Express (sin .listen()).
   La usan tanto el servidor local (server.js) como Vercel (api/index.js).
   Datos vía store.js (SQLite local o Postgres en la nube).
   Identidad: nombre + PIN personal de cada jugador.
   Comprobante de pago: imagen en base64 guardada en la base.
   ============================================================ */
const path = require("path");
const crypto = require("crypto");
const express = require("express");

const { MATCHES, scoreMatch, DEADLINE } = require("../public/shared-data.js");
const store = require("./store.js");

const ADMIN_PIN = process.env.ADMIN_PIN || "1234";
// Cierre de la quiniela: variable de entorno o el valor de shared-data.js
const DEADLINE_ISO = process.env.QUINIELA_DEADLINE || DEADLINE;
const DEADLINE_MS = Date.parse(DEADLINE_ISO);
const isLocked = () => Number.isFinite(DEADLINE_MS) && Date.now() >= DEADLINE_MS;
const SALT = process.env.PIN_SALT || "quiniela-mundial-sal-2026";
const MAX_RECEIPT_CHARS = 5_000_000; // ~3.7 MB de imagen

const VALID_MATCH = new Set(MATCHES.map((m) => m.id));
const hashPin = (pin) => crypto.createHash("sha256").update(SALT + ":" + pin).digest("hex");
const clampScore = (v) => {
  let n = parseInt(v, 10);
  if (isNaN(n) || n < 0) n = 0;
  if (n > 30) n = 30;
  return n;
};
function toEntries(obj) {
  const out = [];
  for (const [mid, val] of Object.entries(obj || {})) {
    if (!VALID_MATCH.has(mid) || !val) continue;
    if (val.h === "" || val.h == null || val.a === "" || val.a == null) continue;
    out.push({ match_id: mid, h: clampScore(val.h), a: clampScore(val.a) });
  }
  return out;
}

const app = express();
app.use(express.json({ limit: "8mb" }));

// Frontend estático (index, styles, app.js, shared-data.js)
app.use(express.static(path.join(__dirname, "..", "public")));

// Espera a que las tablas existan antes de atender la API
app.use("/api", async (_req, _res, next) => {
  try { await store.ready; next(); } catch (e) { next(e); }
});

function requireAdmin(req, res, next) {
  if ((req.get("x-admin-pin") || req.query.pin) === ADMIN_PIN) return next();
  res.status(401).json({ error: "PIN de admin incorrecto" });
}

/* ---------- Estado público (sin comprobantes ni PINs) ---------- */
app.get("/api/state", async (_req, res, next) => {
  try {
    const [players, predRows, resultRows] = await Promise.all([
      store.allPlayers(), store.allPredictions(), store.allResults(),
    ]);
    const results = {};
    for (const r of resultRows) results[r.match_id] = { h: r.h, a: r.a };
    const predsByPlayer = {};
    for (const p of predRows) (predsByPlayer[p.player_name] ||= {})[p.match_id] = { h: p.h, a: p.a };

    const out = players.map((pl) => {
      const predictions = predsByPlayer[pl.name] || {};
      const perMatch = {};
      let points = 0;
      for (const m of MATCHES) {
        const pts = scoreMatch(predictions[m.id], results[m.id]);
        perMatch[m.id] = pts;
        points += pts;
      }
      return {
        name: pl.name,
        fav: pl.fav,
        paid: !!pl.receipt,
        predictions, perMatch, points,
        filled: Object.keys(predictions).length,
      };
    });
    out.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
    res.json({
      players: out, results, totalMatches: MATCHES.length,
      deadline: DEADLINE_ISO, locked: isLocked(),
    });
  } catch (e) { next(e); }
});

/* ---------- Registro / actualización (nombre + PIN) ---------- */
app.post("/api/register", async (req, res, next) => {
  try {
    const name = (req.body.name || "").trim();
    const pin = (req.body.pin || "").trim();
    const fav = (req.body.fav || "").trim() || null;
    let receipt = req.body.receipt || null;

    if (!name) return res.status(400).json({ error: "Falta el nombre" });
    if (name.length > 40) return res.status(400).json({ error: "Nombre demasiado largo (máx 40)" });
    if (pin.length < 3) return res.status(400).json({ error: "El PIN debe tener al menos 3 caracteres" });
    if (receipt) {
      if (typeof receipt !== "string" || !receipt.startsWith("data:image/"))
        return res.status(400).json({ error: "El comprobante debe ser una imagen" });
      if (receipt.length > MAX_RECEIPT_CHARS)
        return res.status(413).json({ error: "La imagen del comprobante es muy grande (máx ~3 MB)" });
    }

    const existing = await store.getPlayer(name);
    if (existing && existing.pin_hash && existing.pin_hash !== hashPin(pin))
      return res.status(403).json({ error: "Ese nombre ya está tomado y el PIN no coincide. Usa otro nombre o tu PIN correcto." });

    if (!receipt && existing) receipt = existing.receipt; // conserva comprobante anterior

    await store.savePlayer({
      name, fav, receipt,
      pin_hash: hashPin(pin),
      created_at: existing ? Number(existing.created_at) : Date.now(),
    });
    res.json({ ok: true, updated: !!existing, name });
  } catch (e) { next(e); }
});

/* ---------- Guardar pronósticos (requiere PIN del jugador) ---------- */
app.post("/api/predictions", async (req, res, next) => {
  try {
    const name = (req.body.name || "").trim();
    const pin = (req.body.pin || "").trim();
    if (isLocked())
      return res.status(403).json({ error: "⏰ La quiniela ya cerró. ¡Que empiece el Mundial!" });
    const player = await store.getPlayer(name);
    if (!player) return res.status(404).json({ error: "Regístrate primero" });
    if (player.pin_hash !== hashPin(pin))
      return res.status(403).json({ error: "PIN incorrecto: esa quiniela no es tuya 😏" });

    const entries = toEntries(req.body.predictions);
    await store.replacePredictions(name, entries);
    res.json({ ok: true, count: entries.length });
  } catch (e) { next(e); }
});

/* ---------- Admin ---------- */
app.post("/api/admin/login", (req, res) => {
  res.json({ ok: (req.body.pin || "") === ADMIN_PIN });
});

app.get("/api/admin/players", requireAdmin, async (_req, res, next) => {
  try {
    const players = await store.allPlayers();
    res.json({
      players: players.map((p) => ({
        name: p.name, fav: p.fav, paid: !!p.receipt, receipt: p.receipt || null,
      })),
    });
  } catch (e) { next(e); }
});

app.post("/api/admin/results", requireAdmin, async (req, res, next) => {
  try {
    await store.replaceResults(toEntries(req.body.results));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

app.post("/api/admin/reset", requireAdmin, async (_req, res, next) => {
  try { await store.reset(); res.json({ ok: true }); }
  catch (e) { next(e); }
});

// Manejador de errores
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Error del servidor" });
});

module.exports = app;
