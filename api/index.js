/* ============================================================
   Punto de entrada para Vercel (serverless).
   Vercel enruta TODO aquí (ver vercel.json) y la app Express
   sirve tanto el frontend estático como la API.
   En Vercel se usa Postgres (DATABASE_URL de Neon).
   ============================================================ */
module.exports = require("../server/app.js");
