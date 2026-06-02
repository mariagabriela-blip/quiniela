# ⚽ La Quiniela del Mundial 🏆

Una quiniela (pool de pronósticos) del Mundial de Fútbol, **100% web y sin servidor**.
Los jugadores se registran con su nombre, cargan sus pronósticos y suben su comprobante
de pago. Con banderas, animaciones, confeti, chistes y tabla de posiciones automática.

## ✨ Qué hace

- **Registro** con nombre, equipo del corazón ❤️ y **comprobante de pago** (imagen).
- **Mi Quiniela**: pronostica los goles de cada partido (con banderas de cada selección).
- **Reglas** de puntuación tal cual las pactó la directiva.
- **Tabla de posiciones** que calcula los puntos automáticamente cuando el admin carga los resultados reales.
- **Panel de Admin** (PIN) para cargar resultados reales y ver quién pagó.
- **Interactividad**: confeti 🎉, banderas ondeando, chistes que rotan (clic = otro chiste).

## 🏅 Reglas de puntuación

| Aciertas | Puntos |
|---|---|
| Resultado **y** goles exactos de ambos | **5** |
| Resultado y goles de **uno solo** | **4** |
| Solo el resultado (ganador/empate) | **3** |
| Goles de uno pero **no** el resultado | **1** |
| Nada de nada (un coño) | **0** |

## 🚀 Cómo usarla

No necesita instalación. Abre `index.html` en el navegador, o sírvela localmente:

```bash
python3 -m http.server 8000
# luego abre http://localhost:8000
```

Los datos se guardan en el **localStorage** del navegador (en ese mismo dispositivo).

### PIN de Admin
Por defecto es `1234`. Cámbialo en `app.js` (constante `ADMIN_PIN`).

## 🛠️ Personalizar los partidos

Edita `data.js`:
- `TEAMS`: agrega o cambia selecciones y sus banderas (emoji).
- `MATCHES`: define los partidos a pronosticar (`home`/`away` son claves de `TEAMS`).
- `JOKES`: agrega tus propios chistes.

## 📁 Archivos

- `index.html` — estructura y pestañas.
- `styles.css` — estilos y animaciones.
- `data.js` — equipos, partidos y chistes (edítalo a gusto).
- `app.js` — lógica: registro, pronósticos, puntuación, tabla, admin, confeti.

---
Hecho con ⚽, ☕ y mucha fe. ¡Suerte a todos! 🤞
