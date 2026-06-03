/* ============================================================
   Adaptador de datos: SQLite (para desarrollo local / pruebas).
   Guarda todo en data/quiniela.db. No requiere ninguna nube.
   Implementa la misma interfaz async que store-postgres.js.
   ============================================================ */
const path = require("path");
const fs = require("fs");

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

const { MATCHES, DEADLINE } = require("../public/shared-data.js");

// better-sqlite3 solo se carga aquí (dependencia opcional).
const Database = require("better-sqlite3");
const db = new Database(path.join(DATA_DIR, "quiniela.db"));
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    name       TEXT PRIMARY KEY,
    fav        TEXT,
    receipt    TEXT,
    pin_hash   TEXT,
    created_at INTEGER
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
const cols = db.prepare("PRAGMA table_info(matches)").all().map((c) => c.name);
if (!cols.includes("slot")) db.exec("ALTER TABLE matches ADD COLUMN slot INTEGER");
if (!cols.includes("winner")) db.exec("ALTER TABLE matches ADD COLUMN winner TEXT");

// Siembra los partidos de la fase de grupos la primera vez.
const matchCount = db.prepare("SELECT COUNT(*) AS n FROM matches").get().n;
if (matchCount === 0) {
  const ins = db.prepare(
    "INSERT INTO matches (id, round, grp, home, away, deadline, ord, slot, winner) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)"
  );
  db.transaction(() => {
    MATCHES.forEach((m, i) => ins.run(m.id, "Grupos", m.group, m.home, m.away, DEADLINE, i));
  })();
}

module.exports = {
  kind: "sqlite",
  ready: Promise.resolve(),

  async allPlayers() {
    return db.prepare("SELECT * FROM players ORDER BY created_at ASC").all();
  },
  async getPlayer(name) {
    return db.prepare("SELECT * FROM players WHERE name = ?").get(name);
  },
  async savePlayer(p) {
    db.prepare(`
      INSERT INTO players (name, fav, receipt, pin_hash, created_at)
      VALUES (@name, @fav, @receipt, @pin_hash, @created_at)
      ON CONFLICT(name) DO UPDATE SET fav=@fav, receipt=@receipt, pin_hash=@pin_hash
    `).run(p);
  },

  async allMatches() {
    return db.prepare("SELECT * FROM matches ORDER BY ord ASC").all();
  },
  async insertMatch(m) {
    db.prepare(
      "INSERT INTO matches (id, round, grp, home, away, deadline, ord, slot, winner) VALUES (@id, @round, @grp, @home, @away, @deadline, @ord, @slot, @winner)"
    ).run({ slot: null, winner: null, grp: null, deadline: null, ...m });
  },
  async updateMatchTeams(id, home, away) {
    db.prepare("UPDATE matches SET home=?, away=?, winner=NULL WHERE id=?").run(home, away, id);
  },
  async setMatchWinner(id, winner) {
    db.prepare("UPDATE matches SET winner=? WHERE id=?").run(winner, id);
  },
  async setMatchDeadline(id, deadline) {
    db.prepare("UPDATE matches SET deadline=? WHERE id=?").run(deadline, id);
  },
  async deleteMatch(id) {
    db.transaction(() => {
      db.prepare("DELETE FROM matches WHERE id = ?").run(id);
      db.prepare("DELETE FROM predictions WHERE match_id = ?").run(id);
      db.prepare("DELETE FROM results WHERE match_id = ?").run(id);
    })();
  },

  async allPredictions() {
    return db.prepare("SELECT * FROM predictions").all();
  },
  async upsertPrediction(name, matchId, h, a) {
    db.prepare(`
      INSERT INTO predictions (player_name, match_id, h, a) VALUES (?, ?, ?, ?)
      ON CONFLICT(player_name, match_id) DO UPDATE SET h=excluded.h, a=excluded.a
    `).run(name, matchId, h, a);
  },
  async deletePrediction(name, matchId) {
    db.prepare("DELETE FROM predictions WHERE player_name = ? AND match_id = ?").run(name, matchId);
  },

  async allResults() {
    return db.prepare("SELECT * FROM results").all();
  },
  async upsertResult(matchId, h, a) {
    db.prepare(`
      INSERT INTO results (match_id, h, a) VALUES (?, ?, ?)
      ON CONFLICT(match_id) DO UPDATE SET h=excluded.h, a=excluded.a
    `).run(matchId, h, a);
  },
  async deleteResult(matchId) {
    db.prepare("DELETE FROM results WHERE match_id = ?").run(matchId);
  },

  async reset() {
    // Borra jugadores, pronósticos y resultados. Conserva el fixture (matches).
    db.exec("DELETE FROM predictions; DELETE FROM results; DELETE FROM players;");
  },
};
