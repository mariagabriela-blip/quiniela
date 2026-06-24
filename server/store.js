/* ============================================================
   Selector de base de datos.
   - Si hay DATABASE_URL / POSTGRES_URL  -> Postgres (Neon / Vercel).
   - Si no, y estamos en Vercel          -> "missing" (error claro, sin crashear).
   - Si no, en local                     -> SQLite (para probar).
   Así el MISMO código corre en la nube y en tu compu sin cambios.
   ============================================================ */
const usePostgres = !!(
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL
);
const onServerless = !!(process.env.VERCEL || process.env.AWS_REGION || process.env.NOW_REGION);

if (usePostgres) {
  module.exports = require("./store-postgres");
} else if (onServerless) {
  // En la nube sin base de datos: NO usar SQLite (el disco es de solo lectura).
  // Devolvemos un store que falla con un mensaje claro, pero la web igual carga.
  const MSG =
    "Falta configurar la base de datos. En Vercel agrega la variable de entorno " +
    "DATABASE_URL con la cadena de conexión de Neon y vuelve a desplegar (Redeploy).";
  const fail = async () => { throw new Error(MSG); };
  const ready = Promise.reject(new Error(MSG));
  ready.catch(() => {}); // evita que el proceso se caiga por un rechazo sin manejar
  module.exports = {
    kind: "missing",
    ready,
    allPlayers: fail, allReceipts: fail, getPlayer: fail, savePlayer: fail,
    allMatches: fail, insertMatch: fail, deleteMatch: fail,
    updateMatchTeams: fail, setMatchWinner: fail, setMatchDeadline: fail,
    allPredictions: fail, upsertPrediction: fail, deletePrediction: fail,
    allResults: fail, upsertResult: fail, deleteResult: fail,
    setBonus: fail, setJoker: fail, getSettings: fail, setSettings: fail, reset: fail,
  };
} else {
  module.exports = require("./store-sqlite");
}
