/* ============================================================
   Adaptador de datos: SQLite (para desarrollo local / pruebas).
   Guarda todo en data/quiniela.db. No requiere ninguna nube.
   Implementa la misma interfaz async que store-postgres.js.
   ============================================================ */
const path = require("path");
const fs = require("fs");

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

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
  async allPredictions() {
    return db.prepare("SELECT * FROM predictions").all();
  },
  async replacePredictions(name, entries) {
    const del = db.prepare("DELETE FROM predictions WHERE player_name = ?");
    const ins = db.prepare("INSERT INTO predictions (player_name, match_id, h, a) VALUES (?, ?, ?, ?)");
    db.transaction(() => {
      del.run(name);
      for (const e of entries) ins.run(name, e.match_id, e.h, e.a);
    })();
  },
  async allResults() {
    return db.prepare("SELECT * FROM results").all();
  },
  async replaceResults(entries) {
    const del = db.prepare("DELETE FROM results");
    const ins = db.prepare("INSERT INTO results (match_id, h, a) VALUES (?, ?, ?)");
    db.transaction(() => {
      del.run();
      for (const e of entries) ins.run(e.match_id, e.h, e.a);
    })();
  },
  async reset() {
    db.exec("DELETE FROM predictions; DELETE FROM results; DELETE FROM players;");
  },
};
