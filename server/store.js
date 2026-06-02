/* ============================================================
   Selector de base de datos.
   - Si hay DATABASE_URL / POSTGRES_URL  -> Postgres (Neon / Vercel).
   - Si no                               -> SQLite local (para probar).
   Así el MISMO código corre en la nube y en tu compu sin cambios.
   ============================================================ */
const usePostgres = !!(
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL
);

module.exports = usePostgres
  ? require("./store-postgres")
  : require("./store-sqlite");
