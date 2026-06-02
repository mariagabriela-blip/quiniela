# ⚽ La Quiniela del Mundial 🏆

Quiniela (pool de pronósticos) del Mundial de Fútbol con **backend compartido**:
todos los jugadores escriben en la **misma base de datos**, así **todos ven la quiniela
de todos** y la **tabla de posiciones en vivo** (quién va ganando, quién va perdiendo).
Con banderas, animaciones, confeti, chistes, **PIN personal** y comprobante de pago.

> 📲 **¿Quieres publicarla para que todo el grupo entre por una URL?**
> Sigue la guía paso a paso (gratis, sin tarjeta): **[DEPLOY.md](./DEPLOY.md)** — Vercel + Neon.

## ✨ Qué hace

- **Registro** con nombre, **PIN personal** 🔑, equipo del corazón ❤️ y **comprobante de pago** (imagen).
- Tu **PIN** protege tu quiniela: nadie más puede editarla.
- **Mi Quiniela**: pronostica los goles de cada partido (con banderas de cada selección).
- **Tabla en vivo**: ranking con medallas 🥇🥈🥉, puntos automáticos, **se actualiza solo cada 8s**.
  Toca cualquier jugador para **ver su quiniela completa** y los puntos partido por partido.
- **Panel de Admin** (PIN) para cargar los **resultados reales** y revisar quién pagó (con su comprobante).
- **Interactividad**: confeti 🎉, banderas ondeando, chistes que rotan (clic = otro chiste).

## 🏅 Reglas de puntuación

| Aciertas | Puntos |
|---|---|
| Resultado **y** goles exactos de ambos | **5** |
| Resultado y goles de **uno solo** | **4** |
| Solo el resultado (ganador/empate) | **3** |
| Goles de uno pero **no** el resultado | **1** |
| Nada de nada (un coño) | **0** |

## 🚀 Probarla en tu computadora (opcional)

Requiere **Node.js 18+**. Sin configurar nada usa **SQLite** (un archivo local).

```bash
npm install
npm start
# abre http://localhost:3000
```

Variables de entorno opcionales:
- `PORT` — puerto (por defecto `3000`).
- `ADMIN_PIN` — PIN del panel de admin (por defecto `1234`).
- `DATABASE_URL` — si la defines (Postgres), usa Postgres en vez de SQLite.

## 🌐 Publicarla para el grupo

Sigue **[DEPLOY.md](./DEPLOY.md)**. En resumen: subes el repo a **Vercel** y conectas una
base **Neon (Postgres)** gratis. Te queda una URL para pegar en WhatsApp.

## 🧩 Cómo está hecho

```
public/             Frontend (se sirve estático)
  index.html        Estructura y pestañas
  styles.css        Estilos y animaciones
  app.js            Lógica del cliente (habla con la API)
  shared-data.js    Equipos, partidos, chistes y la fórmula de puntos
                    (la usan el navegador Y el servidor: una sola fuente de verdad)
server/
  app.js            La app Express (API + sirve el frontend)
  server.js         Arranque local (npm start)
  store.js          Elige base de datos según el entorno
  store-sqlite.js   Adaptador SQLite (local, para probar)
  store-postgres.js Adaptador Postgres (Neon / producción)
api/index.js        Punto de entrada para Vercel (usa server/app.js)
vercel.json         Config de despliegue en Vercel
data/               (generado en local) base SQLite — ignorado por git
```

**Base de datos automática:** si existe `DATABASE_URL` (Postgres) la usa; si no, usa SQLite local.
El mismo código corre igual en la nube y en tu compu.

### API REST

| Método | Ruta | Para qué |
|---|---|---|
| `GET`  | `/api/state` | Jugadores con pronósticos + puntos y resultados. Ordenado por puntos. (No expone comprobantes ni PINs.) |
| `POST` | `/api/register` | Registro/actualización: `{ name, pin, fav, receipt }` (receipt = imagen en base64). |
| `POST` | `/api/predictions` | Guarda pronósticos: `{ name, pin, predictions }`. Requiere el PIN del jugador. |
| `POST` | `/api/admin/login` | Verifica el PIN de admin. |
| `GET`  | `/api/admin/players` | (Admin) jugadores con sus comprobantes. Header `x-admin-pin`. |
| `POST` | `/api/admin/results` | (Admin) carga resultados reales. |
| `POST` | `/api/admin/reset` | (Admin) borra todo. |

## 🛠️ Personalizar los partidos

Edita **`public/shared-data.js`**:
- `TEAMS`: selecciones y sus banderas (emoji).
- `MATCHES`: los partidos a pronosticar (`home`/`away` son claves de `TEAMS`).
- `JOKES`: tus propios chistes.

Haz `push` y, si está en Vercel, se actualiza solo.

---
Hecho con ⚽, ☕ y mucha fe. ¡Suerte a todos! 🤞
