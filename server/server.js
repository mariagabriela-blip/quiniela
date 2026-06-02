/* ============================================================
   Servidor local. Arranca con: npm start
   Usa SQLite por defecto (sin configurar nada).
   ============================================================ */
const app = require("./app.js");
const store = require("./store.js");

const PORT = process.env.PORT || 3000;

store.ready
  .then(() => {
    app.listen(PORT, () => {
      console.log(`⚽ Quiniela del Mundial en http://localhost:${PORT}  (base: ${store.kind})`);
    });
  })
  .catch((err) => {
    console.error("No se pudo iniciar la base de datos:", err);
    process.exit(1);
  });
