/* ============================================================
   Adaptador de datos: Postgres (producción: Neon / Vercel).
   Usa la variable de entorno DATABASE_URL (o POSTGRES_URL).
   Implementa la misma interfaz async que store-sqlite.js.
   ============================================================ */
const { Pool } = require("pg");

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL;

// Neon/Vercel requieren SSL. Para un Postgres local sin SSL: PGSSLMODE=disable
const ssl = process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false };

const pool = new Pool({ connectionString, ssl, max: 3 });

const ready = pool.query(`
  CREATE TABLE IF NOT EXISTS players (
    name       TEXT PRIMARY KEY,
    fav        TEXT,
    receipt    TEXT,
    pin_hash   TEXT,
    created_at BIGINT
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

module.exports = {
  kind: "postgres",
  ready,

  async allPlayers() {
    const { rows } = await pool.query("SELECT * FROM players ORDER BY created_at ASC");
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
  async allPredictions() {
    const { rows } = await pool.query("SELECT * FROM predictions");
    return rows;
  },
  async replacePredictions(name, entries) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM predictions WHERE player_name = $1", [name]);
      for (const e of entries) {
        await client.query(
          "INSERT INTO predictions (player_name, match_id, h, a) VALUES ($1, $2, $3, $4)",
          [name, e.match_id, e.h, e.a]
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },
  async allResults() {
    const { rows } = await pool.query("SELECT * FROM results");
    return rows;
  },
  async replaceResults(entries) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM results");
      for (const e of entries) {
        await client.query(
          "INSERT INTO results (match_id, h, a) VALUES ($1, $2, $3)",
          [e.match_id, e.h, e.a]
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },
  async reset() {
    await pool.query("DELETE FROM predictions");
    await pool.query("DELETE FROM results");
    await pool.query("DELETE FROM players");
  },
};
