/* ============================================================
   La Quiniela del Mundial — App Express (sin .listen()).
   La usan tanto el servidor local (server.js) como Vercel (api/index.js).
   Datos vía store.js (SQLite local o Postgres en la nube).
   - Identidad: nombre + PIN personal de cada jugador.
   - Comprobante de pago: imagen en base64 guardada en la base.
   - Partidos en la base: el admin puede agregar rondas (eliminatorias).
   - Cierre POR PARTIDO: cada partido se bloquea en su propia fecha.
   ============================================================ */
const path = require("path");
const crypto = require("crypto");
const express = require("express");

const { TEAMS, scoreMatch, DEADLINE, BONUS, GOLEADORES, OVERRIDE } = require("../public/shared-data.js");
const store = require("./store.js");

const SCORERS = new Set(GOLEADORES);
const OVERRIDE_USERS = new Set(((OVERRIDE && OVERRIDE.users) || []).map((s) => String(s).trim().toLowerCase()));
function overrideActive(name) {
  if (!OVERRIDE_USERS.has(String(name || "").trim().toLowerCase())) return false;
  const ms = Date.parse((OVERRIDE && OVERRIDE.until) || "");
  return Number.isFinite(ms) && Date.now() < ms;
}

const ADMIN_PIN = process.env.ADMIN_PIN || "1234";
const DEADLINE_ISO = process.env.QUINIELA_DEADLINE || DEADLINE; // cierre por defecto (grupos)
const SALT = process.env.PIN_SALT || "quiniela-mundial-sal-2026";
const MAX_RECEIPT_CHARS = 5_000_000; // ~3.7 MB de imagen

const hashPin = (pin) => crypto.createHash("sha256").update(SALT + ":" + pin).digest("hex");
const clampScore = (v) => {
  let n = parseInt(v, 10);
  if (isNaN(n) || n < 0) n = 0;
  if (n > 30) n = 30;
  return n;
};
// Cierre por partido:
//  - Grupos: SIEMPRE el cierre global (DEADLINE_ISO / QUINIELA_DEADLINE), así
//    se puede abrir/cerrar toda la fase de grupos cambiando una sola fecha.
//  - Eliminatorias: si no tienen fecha asignada, están ABIERTAS (el admin la pone luego).
function matchDeadline(m) {
  if (!m) return null;
  if (m.round === "Grupos") return DEADLINE_ISO;
  return m.deadline || null;
}
function matchLocked(m) {
  const dl = matchDeadline(m);
  if (!dl) return false; // sin fecha => abierto
  const ms = Date.parse(dl);
  return Number.isFinite(ms) && Date.now() >= ms;
}
const hasBoth = (v) => v && v.h !== "" && v.h != null && v.a !== "" && v.a != null;

// Rondas de eliminatoria en orden (cada una alimenta a la siguiente).
const KO_ORDER = ["Dieciseisavos", "Octavos", "Cuartos", "Semifinal", "Final"];

// El cierre global (arranque del Mundial) bloquea las predicciones bonus.
function globalLocked() {
  const ms = Date.parse(DEADLINE_ISO);
  return Number.isFinite(ms) && Date.now() >= ms;
}
function bonusPoints(pl, ans) {
  let p = 0;
  const eq = (a, b) => a && b && a === b;
  const eqTxt = (a, b) => a && b && a.trim().toLowerCase() === b.trim().toLowerCase();
  if (eq(pl.champ, ans.champ)) p += BONUS.champ;
  if (eq(pl.runnerup, ans.runnerup)) p += BONUS.runnerup;
  if (eqTxt(pl.scorer, ans.scorer)) p += BONUS.scorer;
  if (eq(pl.surprise, ans.surprise)) p += BONUS.surprise;
  return p;
}

const app = express();
app.use(express.json({ limit: "8mb" }));

// Frontend estático (index, styles, app.js, shared-data.js)
app.use(express.static(path.join(__dirname, "..", "public")));

// Diagnóstico: dice si la base de datos está conectada. Funciona aunque falle.
app.get("/api/health", async (_req, res) => {
  try { await store.ready; res.json({ ok: true, db: store.kind }); }
  catch (e) { res.status(503).json({ ok: false, db: store.kind, error: e.message }); }
});

// Espera a que las tablas existan antes de atender la API.
app.use("/api", async (_req, res, next) => {
  try { await store.ready; next(); }
  catch (e) {
    console.error("DB no disponible:", e.message);
    res.status(503).json({ error: e.message || "Base de datos no disponible" });
  }
});

function requireAdmin(req, res, next) {
  if ((req.get("x-admin-pin") || req.query.pin) === ADMIN_PIN) return next();
  res.status(401).json({ error: "PIN de admin incorrecto" });
}

/* ---------- Estado público (sin comprobantes ni PINs) ---------- */
app.get("/api/state", async (_req, res, next) => {
  try {
    const [players, predRows, resultRows, matches, settings] = await Promise.all([
      store.allPlayers(), store.allPredictions(), store.allResults(), store.allMatches(), store.getSettings(),
    ]);
    const results = {};
    for (const r of resultRows) results[r.match_id] = { h: r.h, a: r.a };
    const predsByPlayer = {};
    for (const p of predRows) (predsByPlayer[p.player_name] ||= {})[p.match_id] = { h: p.h, a: p.a };

    const ans = {
      champ: settings.champ || null, runnerup: settings.runnerup || null,
      scorer: settings.scorer || null, surprise: settings.surprise || null,
    };

    const out = players.map((pl) => {
      const predictions = predsByPlayer[pl.name] || {};
      const perMatch = {};
      let matchPts = 0;
      for (const m of matches) {
        const pts = scoreMatch(predictions[m.id], results[m.id]);
        perMatch[m.id] = pts;
        matchPts += pts;
      }
      const jokerPts = pl.joker && perMatch[pl.joker] ? perMatch[pl.joker] : 0; // doble = +1 vez
      const bonusPts = bonusPoints(pl, ans);
      return {
        name: pl.name, fav: pl.fav, paid: !!pl.receipt,
        predictions, perMatch,
        bonus: { champ: pl.champ || null, runnerup: pl.runnerup || null, scorer: pl.scorer || null, surprise: pl.surprise || null },
        joker: pl.joker || null,
        breakdown: { match: matchPts, joker: jokerPts, bonus: bonusPts },
        points: matchPts + jokerPts + bonusPts,
        filled: Object.keys(predictions).length,
      };
    });
    out.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

    const matchesOut = matches.map((m) => ({
      id: m.id, round: m.round, group: m.grp, home: m.home, away: m.away,
      deadline: matchDeadline(m), locked: matchLocked(m),
      slot: m.slot ?? null, winner: m.winner ?? null,
    }));

    res.json({
      players: out, results, matches: matchesOut,
      totalMatches: matches.length, deadline: DEADLINE_ISO,
      globalLocked: globalLocked(), bonusAnswers: ans, bonusPts: BONUS,
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

/* ---------- Entrar (login con nombre + PIN, no modifica nada) ---------- */
app.post("/api/login", async (req, res, next) => {
  try {
    const name = (req.body.name || "").trim();
    const pin = (req.body.pin || "").trim();
    const player = await store.getPlayer(name);
    if (!player) return res.status(404).json({ error: "No existe ese jugador. Regístrate primero." });
    if (player.pin_hash !== hashPin(pin)) return res.status(403).json({ error: "PIN incorrecto 🚫" });
    res.json({ ok: true, name });
  } catch (e) { next(e); }
});

/* ---------- Guardar pronósticos (requiere PIN; respeta el cierre por partido) ---------- */
app.post("/api/predictions", async (req, res, next) => {
  try {
    const name = (req.body.name || "").trim();
    const pin = (req.body.pin || "").trim();
    const player = await store.getPlayer(name);
    if (!player) return res.status(404).json({ error: "Regístrate primero" });
    if (player.pin_hash !== hashPin(pin))
      return res.status(403).json({ error: "PIN incorrecto: esa quiniela no es tuya 😏" });

    const matches = await store.allMatches();
    const byId = Object.fromEntries(matches.map((m) => [m.id, m]));
    const played = new Set((await store.allResults()).map((r) => r.match_id)); // ya jugados
    const ov = overrideActive(name); // permiso especial temporal
    const preds = req.body.predictions || {};
    let saved = 0, locked = 0;
    for (const [mid, val] of Object.entries(preds)) {
      const m = byId[mid];
      if (!m) continue;
      // Editable si el partido está abierto, o si el jugador tiene permiso especial
      // y el partido AÚN no se ha jugado (sin resultado).
      const editable = !matchLocked(m) || (ov && !played.has(mid));
      if (!editable) { locked++; continue; }
      if (hasBoth(val)) { await store.upsertPrediction(name, mid, clampScore(val.h), clampScore(val.a)); saved++; }
      else { await store.deletePrediction(name, mid); }
    }
    const total = (await store.allPredictions()).filter((p) => p.player_name === name).length;
    res.json({ ok: true, saved, locked, count: total });
  } catch (e) { next(e); }
});

/* ---------- Predicciones bonus del torneo (campeón, etc.) ---------- */
app.post("/api/bonus", async (req, res, next) => {
  try {
    const name = (req.body.name || "").trim();
    const pin = (req.body.pin || "").trim();
    const player = await store.getPlayer(name);
    if (!player) return res.status(404).json({ error: "Regístrate primero" });
    if (player.pin_hash !== hashPin(pin)) return res.status(403).json({ error: "PIN incorrecto 😏" });
    if (globalLocked()) return res.status(403).json({ error: "⏰ Las predicciones bonus ya cerraron (arrancó el Mundial)." });

    const team = (v) => (v && TEAMS[v] ? v : null);
    const scorer = SCORERS.has(req.body.scorer) ? req.body.scorer : null;
    await store.setBonus(name, {
      champ: team(req.body.champ), runnerup: team(req.body.runnerup),
      surprise: team(req.body.surprise), scorer,
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ---------- Comodín: doblar puntos de un partido (debe estar abierto) ---------- */
app.post("/api/joker", async (req, res, next) => {
  try {
    const name = (req.body.name || "").trim();
    const pin = (req.body.pin || "").trim();
    const matchId = (req.body.matchId || "").trim();
    const player = await store.getPlayer(name);
    if (!player) return res.status(404).json({ error: "Regístrate primero" });
    if (player.pin_hash !== hashPin(pin)) return res.status(403).json({ error: "PIN incorrecto 😏" });

    if (matchId) {
      const m = (await store.allMatches()).find((x) => x.id === matchId);
      if (!m) return res.status(404).json({ error: "Ese partido no existe" });
      if (matchLocked(m)) return res.status(403).json({ error: "Ese partido ya cerró: elige uno que aún esté abierto." });
      await store.setJoker(name, matchId);
    } else {
      await store.setJoker(name, null); // quitar comodín
    }
    res.json({ ok: true });
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
    const matches = await store.allMatches();
    const byId = Object.fromEntries(matches.map((m) => [m.id, m]));
    for (const [mid, val] of Object.entries(req.body.results || {})) {
      const m = byId[mid];
      if (!m) continue;
      if (hasBoth(val)) {
        const h = clampScore(val.h), a = clampScore(val.a);
        await store.upsertResult(mid, h, a);
        if (m.round !== "Grupos") {
          // Quién avanzó: lo que diga el admin (penales), o el ganador por marcador.
          let winner = (val.winner === m.home || val.winner === m.away) ? val.winner : null;
          if (!winner) winner = h > a ? m.home : a > h ? m.away : null;
          await store.setMatchWinner(mid, winner);
        }
      } else {
        await store.deleteResult(mid);
        if (m.round !== "Grupos") await store.setMatchWinner(mid, null);
      }
    }
    await advanceBracket();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Crea automáticamente la siguiente ronda cuando la anterior está decidida.
async function advanceBracket() {
  const results = {};
  for (const r of await store.allResults()) results[r.match_id] = true;
  let matches = await store.allMatches();
  const ofRound = (r) => matches.filter((m) => m.round === r).sort((a, b) => (a.slot || 0) - (b.slot || 0));
  let maxOrd = matches.reduce((mx, m) => Math.max(mx, m.ord || 0), 0);
  const newId = () => "k_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const ensurePair = async (round, slot, home, away) => {
    const exist = matches.find((m) => m.round === round && (m.slot || 0) === slot);
    if (!exist) {
      await store.insertMatch({ id: newId(), round, grp: null, home, away, deadline: null, ord: ++maxOrd, slot, winner: null });
    } else if (!results[exist.id] && (exist.home !== home || exist.away !== away)) {
      await store.updateMatchTeams(exist.id, home, away); // corrige si cambió un ganador
    }
  };

  for (let i = 0; i < KO_ORDER.length - 1; i++) {
    const src = ofRound(KO_ORDER[i]);
    if (!src.length || !src.every((m) => m.winner)) continue;
    const next = KO_ORDER[i + 1];
    for (let k = 0; k < Math.floor(src.length / 2); k++) {
      await ensurePair(next, k + 1, src[2 * k].winner, src[2 * k + 1].winner);
    }
    matches = await store.allMatches(); // refresca para la siguiente vuelta
  }

  // Tercer puesto: los perdedores de las dos semifinales.
  const semis = ofRound("Semifinal");
  if (semis.length === 2 && semis.every((m) => m.winner)) {
    const loser = (m) => (m.home === m.winner ? m.away : m.home);
    await ensurePair("3er puesto", 1, loser(semis[0]), loser(semis[1]));
  }
}

// (Admin) poner un mismo cierre a todos los partidos de una ronda
app.post("/api/admin/round-deadline", requireAdmin, async (req, res, next) => {
  try {
    const round = (req.body.round || "").trim();
    const dl = (req.body.deadline || "").trim() || null;
    if (!round) return res.status(400).json({ error: "Falta la ronda" });
    if (dl && isNaN(Date.parse(dl))) return res.status(400).json({ error: "Fecha inválida" });
    const matches = (await store.allMatches()).filter((m) => m.round === round);
    for (const m of matches) await store.setMatchDeadline(m.id, dl);
    res.json({ ok: true, count: matches.length });
  } catch (e) { next(e); }
});

// Agregar un partido (p.ej. de eliminatorias) con su propio cierre
app.post("/api/admin/match", requireAdmin, async (req, res, next) => {
  try {
    const round = (req.body.round || "").trim();
    const grp = (req.body.grp || "").trim() || null;
    const home = (req.body.home || "").trim();
    const away = (req.body.away || "").trim();
    const deadline = (req.body.deadline || "").trim() || null;
    if (!round) return res.status(400).json({ error: "Falta la ronda" });
    if (!TEAMS[home] || !TEAMS[away]) return res.status(400).json({ error: "Equipos inválidos" });
    if (home === away) return res.status(400).json({ error: "Un equipo no puede jugar contra sí mismo" });
    if (deadline && isNaN(Date.parse(deadline))) return res.status(400).json({ error: "Fecha de cierre inválida" });

    const matches = await store.allMatches();
    const ord = matches.reduce((mx, m) => Math.max(mx, m.ord || 0), 0) + 1;
    const slot = matches.filter((m) => m.round === round).length + 1; // posición en el bracket
    const id = "k_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await store.insertMatch({ id, round, grp, home, away, deadline, ord, slot, winner: null });
    res.json({ ok: true, id, slot });
  } catch (e) { next(e); }
});

// Borrar un partido (solo eliminatorias; los de Grupos quedan protegidos)
app.delete("/api/admin/match/:id", requireAdmin, async (req, res, next) => {
  try {
    const m = (await store.allMatches()).find((x) => x.id === req.params.id);
    if (!m) return res.status(404).json({ error: "No existe ese partido" });
    if (m.round === "Grupos") return res.status(400).json({ error: "No se pueden borrar partidos de la fase de grupos" });
    await store.deleteMatch(req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// (Admin) respuestas oficiales del bonus (campeón, subcampeón, goleador, sorpresa)
app.post("/api/admin/bonus", requireAdmin, async (req, res, next) => {
  try {
    const team = (v) => (v && TEAMS[v] ? v : null);
    await store.setSettings({
      champ: team(req.body.champ), runnerup: team(req.body.runnerup),
      surprise: team(req.body.surprise), scorer: SCORERS.has(req.body.scorer) ? req.body.scorer : null,
    });
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
