# ⚽ La Quiniela del Mundial 🏆

Quiniela (pool de pronósticos) del Mundial de Fútbol con **backend compartido**:
todos los jugadores escriben en la **misma base de datos**, así **todos ven la quiniela
de todos** y la **tabla de posiciones en vivo** (quién va ganando, quién va perdiendo).
Con banderas, animaciones, confeti, chistes y comprobante de pago.

## ✨ Qué hace

- **Registro** con nombre, equipo del corazón ❤️ y **comprobante de pago** (imagen, se sube al servidor).
- **Mi Quiniela**: pronostica los goles de cada partido (con banderas de cada selección).
- **Tabla en vivo**: ranking con medallas 🥇🥈🥉, puntos automáticos y **se actualiza solo cada 8s**.
  Toca cualquier jugador para **ver su quiniela completa** y los puntos partido por partido.
- **Panel de Admin** (PIN) para cargar los **resultados reales** y revisar quién pagó (con link al comprobante).
- **Interactividad**: confeti 🎉, banderas ondeando, chistes que rotan (clic = otro chiste).

## 🏅 Reglas de puntuación

| Aciertas | Puntos |
|---|---|
| Resultado **y** goles exactos de ambos | **5** |
| Resultado y goles de **uno solo** | **4** |
| Solo el resultado (ganador/empate) | **3** |
| Goles de uno pero **no** el resultado | **1** |
| Nada de nada (un coño) | **0** |

## 🚀 Cómo correrlo

Requiere **Node.js 18+**.

```bash
npm install
npm start
# abre http://localhost:3000
```

Variables de entorno opcionales:
- `PORT` — puerto (por defecto `3000`).
- `ADMIN_PIN` — PIN del panel de admin (por defecto `1234`). **Cámbialo** en producción:
  ```bash
  ADMIN_PIN=elquetuquieras PORT=8080 npm start
  ```

Los datos se guardan en `data/quiniela.db` (SQLite) y los comprobantes en `data/uploads/`.
Esa carpeta está en `.gitignore` (no se sube al repo).

## 🌐 Cómo lo usan todos

1. Despliega el servidor en cualquier host (un VPS, Render, Railway, Fly.io, etc.).
2. Comparte la URL por el grupo de WhatsApp.
3. Cada quien entra, se registra, sube su comprobante y carga su quiniela.
4. Todos ven la misma **Tabla** en vivo. El admin carga los resultados reales y los puntos se reparten solos.

## 🧩 Arquitectura

```
public/           Frontend (se sirve estático)
  index.html      Estructura y pestañas
  styles.css      Estilos y animaciones
  app.js          Lógica del cliente (habla con la API)
shared-data.js    Equipos, partidos, chistes y la función de puntuación
                  (la usan el navegador Y el servidor: una sola fuente de verdad)
server/server.js  Backend Express + SQLite + subida de comprobantes
data/             (generado) base de datos y comprobantes — ignorado por git
```

### API REST

| Método | Ruta | Para qué |
|---|---|---|
| `GET`  | `/api/state` | Jugadores con pronósticos + puntos, y resultados. Ordenado por puntos. |
| `POST` | `/api/register` | Registro/actualización (multipart: `name`, `fav`, `receipt`). |
| `POST` | `/api/predictions` | Guarda los pronósticos del jugador (JSON). |
| `POST` | `/api/admin/results` | (Admin) carga resultados reales. Header `x-admin-pin`. |
| `POST` | `/api/admin/reset` | (Admin) borra todo. |

## 🛠️ Personalizar los partidos

Edita **`shared-data.js`**:
- `TEAMS`: selecciones y sus banderas (emoji).
- `MATCHES`: los partidos a pronosticar (`home`/`away` son claves de `TEAMS`).
- `JOKES`: tus propios chistes.

---
Hecho con ⚽, ☕ y mucha fe. ¡Suerte a todos! 🤞
