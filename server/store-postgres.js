/* ============================================================
   Adaptador de datos: Postgres (producción: Neon / Vercel).
   Usa la variable de entorno DATABASE_URL (o POSTGRES_URL).
   Implementa la misma interfaz async que store-sqlite.js.
   ============================================================ */
const { Pool } = require("pg");
const { MATCHES, DEADLINE } = require("../public/shared-data.js");

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL;

// Neon/Vercel requieren SSL. Para un Postgres local sin SSL: PGSSLMODE=disable
const ssl = process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false };

// connectionTimeoutMillis alto: el plan gratis de Neon se "duerme" y tarda
// 1-2s en despertar; le damos tiempo para que la 1ª conexión no falle.
const pool = new Pool({
  connectionString, ssl, max: 3,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 10000,
  keepAlive: true,
});
pool.on("error", (e) => console.error("Postgres pool error:", e.message));

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      name       TEXT PRIMARY KEY,
      fav        TEXT,
      receipt    TEXT,
      pin_hash   TEXT,
      created_at BIGINT
    );
    CREATE TABLE IF NOT EXISTS matches (
      id       TEXT PRIMARY KEY,
      round    TEXT,
      grp      TEXT,
      home     TEXT,
      away     TEXT,
      deadline TEXT,
      ord      INTEGER,
      slot     INTEGER,
      winner   TEXT
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
  // Migración: agrega columnas nuevas si la tabla ya existía sin ellas.
  await pool.query("ALTER TABLE matches ADD COLUMN IF NOT EXISTS slot INTEGER");
  await pool.query("ALTER TABLE matches ADD COLUMN IF NOT EXISTS winner TEXT");
  for (const col of ["champ", "runnerup", "scorer", "surprise", "joker"]) {
    await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS ${col} TEXT`);
  }
  await pool.query("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)");

  // Siembra los partidos de la fase de grupos la primera vez.
  const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM matches");
  if (rows[0].n === 0) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (let i = 0; i < MATCHES.length; i++) {
        const m = MATCHES[i];
        await client.query(
          "INSERT INTO matches (id, round, grp, home, away, deadline, ord) VALUES ($1,$2,$3,$4,$5,$6,$7)",
          [m.id, "Grupos", m.group, m.home, m.away, DEADLINE, i]
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK"); throw e;
    } finally {
      client.release();
    }
  }
}

// Inicialización resiliente: si falla (p.ej. Neon despertando), NO se queda
// pegada en error — se reintenta en la siguiente petición.
let initPromise = null;
function ensureReady() {
  if (!initPromise) {
    initPromise = init().catch((e) => {
      console.error("Error inicializando Postgres (se reintentará):", e.message);
      initPromise = null; // permite reintentar
      throw e;
    });
  }
  return initPromise;
}

module.exports = {
  kind: "postgres",
  get ready() { return ensureReady(); },

  async allPlayers() {
    // NO traer el comprobante (imagen pesada): solo si pagó. Evita gastar
    // transferencia de datos en cada actualización de la tabla.
    const { rows } = await pool.query(`
      SELECT name, fav, pin_hash, created_at, champ, runnerup, scorer, surprise, joker,
             (receipt IS NOT NULL) AS paid
      FROM players ORDER BY created_at ASC
    `);
    return rows;
  },
  async allReceipts() {
    const { rows } = await pool.query("SELECT name, receipt FROM players WHERE receipt IS NOT NULL");
    return rows;
  },
  async getPlayer(name) {
    const { rows } = await pool.query("SELECT * FROM players WHERE name = $1", [name]);
    return rows[0];
  },
  async savePlayer(p) {
    await pool.query(
      `INSERT INTO players (name, fav, receipt, pin_hash, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (name) DO UPDATE SET fav = $2, receipt = $3, pin_hash = $4`,
      [p.name, p.fav, p.receipt, p.pin_hash, p.created_at]
    );
  },

  async allMatches() {
    const { rows } = await pool.query("SELECT * FROM matches ORDER BY ord ASC");
    return rows;
  },
  async insertMatch(m) {
    await pool.query(
      "INSERT INTO matches (id, round, grp, home, away, deadline, ord, slot, winner) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [m.id, m.round, m.grp ?? null, m.home, m.away, m.deadline ?? null, m.ord, m.slot ?? null, m.winner ?? null]
    );
  },
  async updateMatchTeams(id, home, away) {
    await pool.query("UPDATE matches SET home=$1, away=$2, winner=NULL WHERE id=$3", [home, away, id]);
  },
  async setMatchWinner(id, winner) {
    await pool.query("UPDATE matches SET winner=$1 WHERE id=$2", [winner, id]);
  },
  async setMatchDeadline(id, deadline) {
    await pool.query("UPDATE matches SET deadline=$1 WHERE id=$2", [deadline, id]);
  },
  async deleteMatch(id) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM matches WHERE id = $1", [id]);
      await client.query("DELETE FROM predictions WHERE match_id = $1", [id]);
      await client.query("DELETE FROM results WHERE match_id = $1", [id]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK"); throw e;
    } finally {
      client.release();
    }
  },

  async allPredictions() {
    const { rows } = await pool.query("SELECT * FROM predictions");
    return rows;
  },
  async upsertPrediction(name, matchId, h, a) {
    await pool.query(
      `INSERT INTO predictions (player_name, match_id, h, a) VALUES ($1,$2,$3,$4)
       ON CONFLICT (player_name, match_id) DO UPDATE SET h = $3, a = $4`,
      [name, matchId, h, a]
    );
  },
  async deletePrediction(name, matchId) {
    await pool.query("DELETE FROM predictions WHERE player_name = $1 AND match_id = $2", [name, matchId]);
  },

  async allResults() {
    const { rows } = await pool.query("SELECT * FROM results");
    return rows;
  },
  async upsertResult(matchId, h, a) {
    await pool.query(
      `INSERT INTO results (match_id, h, a) VALUES ($1,$2,$3)
       ON CONFLICT (match_id) DO UPDATE SET h = $2, a = $3`,
      [matchId, h, a]
    );
  },
  async deleteResult(matchId) {
    await pool.query("DELETE FROM results WHERE match_id = $1", [matchId]);
  },

  async setBonus(name, b) {
    await pool.query(
      "UPDATE players SET champ=$1, runnerup=$2, scorer=$3, surprise=$4 WHERE name=$5",
      [b.champ ?? null, b.runnerup ?? null, b.scorer ?? null, b.surprise ?? null, name]
    );
  },
  async setJoker(name, joker) {
    await pool.query("UPDATE players SET joker=$1 WHERE name=$2", [joker ?? null, name]);
  },
  async getSettings() {
    const { rows } = await pool.query("SELECT * FROM settings");
    const o = {};
    for (const r of rows) o[r.key] = r.value;
    return o;
  },
  async setSettings(obj) {
    for (const [k, v] of Object.entries(obj)) {
      await pool.query(
        "INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2",
        [k, v ?? null]
      );
    }
  },

  async reset() {
    // Borra jugadores, pronósticos y resultados. Conserva el fixture (matches) y los ajustes.
    await pool.query("DELETE FROM predictions");
    await pool.query("DELETE FROM results");
    await pool.query("DELETE FROM players");
  },
};
