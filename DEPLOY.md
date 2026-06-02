# 🚀 Cómo publicar la Quiniela en internet (Vercel + Neon) — paso a paso

Esta guía es **para principiantes**. Al final tendrás una **URL** que puedes pegar
en el grupo de WhatsApp para que todos entren desde su teléfono. **Es gratis** y
**no necesitas tarjeta de crédito**.

Vamos a usar dos servicios, ambos gratis:
- **Vercel** → publica la página web (la app).
- **Neon** → la base de datos (donde se guardan los jugadores, pronósticos y comprobantes).

> 💡 Cada vez que hagamos un cambio en el repo de GitHub, Vercel **actualiza la web solita**. No tienes que volver a hacer nada de esto.

---

## Paso 1 — Crea la base de datos en Neon (≈ 3 min)

1. Entra a **https://neon.tech** y haz clic en **Sign up**.
2. Regístrate con tu cuenta de **GitHub** (el botón "Continue with GitHub"). Es lo más fácil.
3. Te pedirá crear un proyecto. Ponle un nombre, por ejemplo **`quiniela`**, y dale **Create project**.
4. Cuando termine, verás una caja que dice **Connection string** (cadena de conexión).
   Es un texto largo que empieza con `postgresql://...`. 
5. Haz clic en **Copy** para copiarla. **Guárdala** (pégala en una nota); la usarás en el Paso 3.

> Esa cadena es como la "dirección + llave" de tu base de datos. No la compartas públicamente.

---

## Paso 2 — Sube el proyecto a Vercel (≈ 3 min)

1. Entra a **https://vercel.com** y haz clic en **Sign Up**.
2. Regístrate con **GitHub** ("Continue with GitHub").
3. En el panel, haz clic en **Add New…** → **Project**.
4. Verás la lista de tus repositorios de GitHub. Busca **`quiniela`** y haz clic en **Import**.
   - Si no aparece, haz clic en **Adjust GitHub App Permissions** y dale acceso al repo.
5. **No cambies nada** de la configuración (Vercel detecta todo solo gracias al archivo `vercel.json`).

> ⏸️ **Antes de darle Deploy**, haz el Paso 3 (agregar la base de datos). Si ya le diste Deploy, no pasa nada: haces el Paso 3 y luego un "Redeploy".

---

## Paso 3 — Conecta la base de datos (la variable de entorno) (≈ 2 min)

Aquí le decimos a Vercel **dónde está la base de datos** de Neon.

1. En la pantalla de configuración del proyecto (o luego en **Settings → Environment Variables**),
   busca la sección **Environment Variables**.
2. Agrega esta variable:
   - **Name (nombre):** `DATABASE_URL`
   - **Value (valor):** *pega aquí la cadena que copiaste de Neon en el Paso 1*
3. (Recomendado) Agrega también tu PIN de admin para que no sea el `1234` por defecto:
   - **Name:** `ADMIN_PIN`
   - **Value:** el PIN que tú quieras (por ejemplo `mundial2026`)
4. Haz clic en **Save**.

---

## Paso 4 — Deploy 🎉

1. Haz clic en **Deploy** (o, si ya lo habías desplegado: pestaña **Deployments** → los tres puntitos `…` → **Redeploy**).
2. Espera 1–2 minutos. Cuando termine, Vercel te muestra **"Congratulations"** y un botón **Visit**.
3. ¡Esa es tu URL! Algo como `https://quiniela-tunombre.vercel.app`.

**Pega esa URL en el grupo de WhatsApp** y que cada quien se registre, suba su comprobante y cargue su quiniela. 🏆

---

## ¿Cómo cargo yo los resultados reales? (Admin)

1. Abre la URL y entra a la pestaña **🔐 Admin**.
2. Te pedirá el **PIN de admin** (el que pusiste en `ADMIN_PIN`, o `1234` si no lo cambiaste).
3. Escribe los resultados reales de cada partido y dale **Guardar**. Los puntos de todos se calculan solos. ✨

---

## Preguntas frecuentes

**¿Es realmente gratis?**
Sí. El plan gratis de Vercel y de Neon alcanza de sobra para una quiniela de un grupo.

**¿Dónde se guardan los comprobantes de pago?**
Dentro de la base de datos de Neon (como imagen). Solo tú, como admin, los ves.

**Cambié algo en el código, ¿qué hago?**
Nada especial: con cada `push` a GitHub, Vercel publica los cambios automáticamente.

**Quiero cambiar los partidos o los equipos.**
Edita el archivo `public/shared-data.js` y haz `push`. Se actualiza solo.

**Olvidé mi PIN de jugador.**
El admin puede borrar todo (botón rojo) y empezar de cero, o registrarte con otro nombre.

---

¿Dudas? Dime en qué paso te quedaste y te ayudo. 🙌
