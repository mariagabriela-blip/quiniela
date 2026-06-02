/* ============================================================
   La Quiniela del Mundial — frontend
   Habla con el backend por una API REST, así TODOS comparten la
   misma quiniela y la misma tabla en vivo.
   Identidad: nombre + PIN personal (se recuerda en este dispositivo).
   ============================================================ */

const ME_KEY = "quiniela_me_v2";
let me = loadMe();                 // { name, pin } o null
let adminPin = null;
let lastState = { players: [], results: {}, totalMatches: MATCHES.length };

function loadMe() { try { return JSON.parse(localStorage.getItem(ME_KEY)); } catch { return null; } }
function saveMe(v) { me = v; localStorage.setItem(ME_KEY, JSON.stringify(v)); }
function clearMe() { me = null; localStorage.removeItem(ME_KEY); }

/* ---------- Utilidades ---------- */
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2900);
}
function teamHTML(code) {
  const t = TEAMS[code] || { name: code, flag: "🏳️" };
  return `<div class="team"><span class="fl">${t.flag}</span><span class="nm">${t.name}</span></div>`;
}
const teamFlag = (c) => (TEAMS[c] ? TEAMS[c].flag : "🏳️");
function clampScore(v) {
  let n = parseInt(v, 10);
  if (isNaN(n) || n < 0) n = 0;
  if (n > 30) n = 30;
  return n;
}
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
async function api(path, opts = {}) {
  const res = await fetch(path, opts);
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error((data && data.error) || "Error de red");
  return data;
}
let stateError = null;
async function refreshState() {
  try { lastState = await api("/api/state"); stateError = null; }
  catch (e) { stateError = e.message; console.warn("Estado:", e.message); }
  renderActivePanel();
}
function myRecord() {
  return me && lastState.players.find((p) => p.name === me.name) || null;
}

/* ============================================================
   PESTAÑAS
   ============================================================ */
let activeTab = "registro";
$$(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    $$(".tab").forEach((t) => t.classList.remove("active"));
    $$(".panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    activeTab = tab.dataset.tab;
    $("#" + activeTab).classList.add("active");
    if (activeTab === "admin" && !adminPin) return promptAdmin();
    renderActivePanel();
  });
});
function renderActivePanel() {
  if (activeTab === "registro") renderCurrentPlayer();
  if (activeTab === "quiniela") renderQuiniela();
  if (activeTab === "tabla") renderLeaderboard();
  if (activeTab === "admin") renderAdmin();
}

/* ============================================================
   BANDERAS + CHISTES
   ============================================================ */
$("#heroFlags").textContent = Object.values(TEAMS).map((t) => t.flag).slice(0, 16).join(" ");
(function jokeRotator() {
  const el = $("#joke");
  let i = Math.floor(Math.random() * JOKES.length);
  const show = () => {
    el.style.opacity = 0;
    setTimeout(() => { el.textContent = JOKES[i % JOKES.length]; el.style.opacity = 1; i++; }, 350);
  };
  show(); setInterval(show, 6000); el.addEventListener("click", show);
})();

/* ============================================================
   Equipo favorito
   ============================================================ */
$("#favTeam").innerHTML =
  '<option value="">— elige tu equipo —</option>' +
  Object.entries(TEAMS).map(([c, t]) => `<option value="${c}">${t.flag} ${t.name}</option>`).join("");

/* ============================================================
   REGISTRO (nombre + PIN + comprobante)
   ============================================================ */
$("#receipt").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) { $("#receiptPreview").innerHTML = ""; return; }
  const url = await readFileAsDataURL(file);
  $("#receiptPreview").innerHTML =
    `<img src="${url}" alt="comprobante" /><p class="small">✅ Listo para subir. ¡A pagar como los grandes!</p>`;
});

$("#registroForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("#playerName").value.trim();
  const pin = $("#playerPin").value.trim();
  const fav = $("#favTeam").value;
  if (!name) return toast("Pon tu nombre, pues 😅");
  if (pin.length < 3) return toast("Tu PIN debe tener al menos 3 caracteres 🔑");

  let receipt = null;
  const file = $("#receipt").files[0];
  if (file) receipt = await readFileAsDataURL(file);

  try {
    const r = await api("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, pin, fav, receipt }),
    });
    saveMe({ name, pin });
    $("#playerPin").value = "";
    $("#receipt").value = "";
    $("#receiptPreview").innerHTML = "";
    fireConfetti();
    toast(r.updated ? "¡Datos actualizados! 🎉" : `¡Bienvenido, ${name}! ⚽`);
    await refreshState();
  } catch (err) { toast("⚠️ " + err.message); }
});

function renderCurrentPlayer() {
  const box = $("#currentPlayerBox");
  const rec = myRecord();
  if (!me || !rec) { box.classList.add("hidden"); return; }
  const fav = rec.fav && TEAMS[rec.fav] ? `${TEAMS[rec.fav].flag} ${TEAMS[rec.fav].name}` : "—";
  const paid = rec.paid ? "✅ Comprobante cargado" : "❌ Falta el comprobante";
  box.classList.remove("hidden");
  box.innerHTML = `
    <h3>👤 Jugando como: ${rec.name}</h3>
    <p>Equipo del corazón: <b>${fav}</b></p>
    <p>Pago: <b>${paid}</b></p>
    <p>Pronósticos cargados: <b>${rec.filled}/${lastState.totalMatches}</b></p>
    <p>Puntos actuales: <b>${rec.points} pts</b> 🏅</p>
    <button class="btn-danger" id="logoutBtn">Cambiar de jugador</button>`;
  $("#logoutBtn").addEventListener("click", () => {
    clearMe();
    $("#playerName").value = ""; $("#playerPin").value = ""; $("#favTeam").value = "";
    $("#receiptPreview").innerHTML = "";
    renderCurrentPlayer(); renderQuiniela();
    toast("Listo, ¿quién juega ahora? 👀");
  });
}

/* ============================================================
   CIERRE DE LA QUINIELA (cuenta regresiva)
   ============================================================ */
function deadlineMs() {
  // El estado manda; si aún no cargó, usa la constante compartida
  const iso = (lastState && lastState.deadline) || (typeof DEADLINE !== "undefined" ? DEADLINE : null);
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(ms) ? ms : null;
}
function isLocked() {
  if (lastState && typeof lastState.locked === "boolean" && lastState.locked) return true;
  const dl = deadlineMs();
  return dl != null && Date.now() >= dl;
}
function countdownText() {
  const dl = deadlineMs();
  if (dl == null) return "";
  let s = Math.max(0, Math.floor((dl - Date.now()) / 1000));
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  return `${d}d ${h}h ${m}m ${s}s`;
}
function renderDeadlineBanner() {
  const el = $("#deadlineBanner");
  if (!el) return;
  const dl = deadlineMs();
  if (dl == null) { el.className = "deadline"; el.innerHTML = ""; return; }
  const fecha = new Date(dl).toLocaleString("es-VE", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  if (isLocked()) {
    el.className = "deadline locked";
    el.innerHTML = `🔒 <b>La quiniela está cerrada.</b> Cerró el ${fecha}. ¡Que ruede el balón! ⚽`;
  } else {
    el.className = "deadline open";
    el.innerHTML = `⏰ Puedes editar tu quiniela hasta el <b>${fecha}</b> · cierra en <b>${countdownText()}</b>`;
  }
}

/* ============================================================
   MI QUINIELA
   ============================================================ */
function renderQuiniela() {
  renderDeadlineBanner();
  const need = $("#needRegister");
  const list = $("#matchesList");
  const saveBtn = $("#saveQuiniela");
  const rec = myRecord();
  if (!me || !rec) {
    need.classList.remove("hidden"); list.innerHTML = ""; saveBtn.classList.add("hidden");
    return;
  }
  need.classList.add("hidden");
  const locked = isLocked();
  saveBtn.classList.toggle("hidden", locked);
  const preds = rec.predictions || {};
  const dis = locked ? "disabled" : "";
  list.innerHTML = MATCHES.map((m) => {
    const p = preds[m.id] || {};
    return `<div class="match">
      <div class="grp">Grupo ${m.group}</div>
      ${teamHTML(m.home)}
      <div class="vs">
        <input class="score-in" type="number" min="0" max="30" data-mid="${m.id}" data-side="h" value="${p.h ?? ""}" ${dis} />
        <span class="x">vs</span>
        <input class="score-in" type="number" min="0" max="30" data-mid="${m.id}" data-side="a" value="${p.a ?? ""}" ${dis} />
      </div>
      ${teamHTML(m.away)}
    </div>`;
  }).join("");
}

$("#saveQuiniela").addEventListener("click", async () => {
  if (!me) return;
  if (isLocked()) { renderQuiniela(); return toast("⏰ La quiniela ya cerró. ¡A ver los partidos!"); }
  const predictions = {};
  $$("#matchesList .score-in").forEach((inp) => {
    const mid = inp.dataset.mid, side = inp.dataset.side;
    (predictions[mid] ||= {})[side] = inp.value === "" ? null : clampScore(inp.value);
  });
  try {
    const r = await api("/api/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: me.name, pin: me.pin, predictions }),
    });
    fireConfetti();
    toast(`¡Quiniela guardada! ${r.count}/${lastState.totalMatches} partidos. 🤞`);
    await refreshState();
  } catch (err) { toast("⚠️ " + err.message); }
});

/* ============================================================
   TABLA EN VIVO — todos ven la quiniela de todos
   ============================================================ */
function renderLeaderboard() {
  const lb = $("#leaderboard");
  const players = lastState.players;
  if (!players.length) {
    lb.innerHTML = '<p class="empty">Aún no hay jugadores. ¡Sé el primero! 🥇</p>';
    return;
  }
  const medals = ["🥇", "🥈", "🥉"];
  const cls = ["gold", "silver", "bronze"];
  const anyResults = Object.keys(lastState.results).length > 0;

  lb.innerHTML = players.map((p, i) => {
    const fav = p.fav ? teamFlag(p.fav) : "🏳️";
    const paid = p.paid ? "" : ' <small>(sin pago 💸)</small>';
    const mine = me && p.name === me.name ? " is-me" : "";
    return `<div class="lb-wrap">
      <div class="lb-row ${cls[i] || ""}${mine}">
        <div class="pos">${medals[i] || (i + 1)}</div>
        <div class="who">${fav} ${p.name}${paid} <span class="tap">👁️ ver quiniela</span></div>
        <div class="pts-badge">${p.points} pts</div>
      </div>
      <div class="lb-detail hidden" id="d-${i}"></div>
    </div>`;
  }).join("");

  $$(".lb-row").forEach((row, i) => {
    row.addEventListener("click", () => {
      const det = $("#d-" + i);
      const open = !det.classList.contains("hidden");
      $$(".lb-detail").forEach((d) => d.classList.add("hidden"));
      if (open) return;
      const p = players[i];
      det.innerHTML = MATCHES.map((m) => {
        const pr = p.predictions[m.id];
        const rr = lastState.results[m.id];
        const guess = pr ? `${pr.h}-${pr.a}` : "—";
        const real = rr ? `${rr.h}-${rr.a}` : "·";
        const pts = anyResults ? `<b>+${p.perMatch[m.id]}</b>` : "";
        return `<div class="det-row">
          <span>${teamFlag(m.home)} vs ${teamFlag(m.away)}</span>
          <span class="g">tú: ${guess}</span>
          <span class="r">real: ${real}</span>
          <span class="pp">${pts}</span>
        </div>`;
      }).join("");
      det.classList.remove("hidden");
    });
  });
}

/* ============================================================
   ADMIN
   ============================================================ */
async function promptAdmin() {
  const pin = prompt("🔐 PIN de Admin:");
  if (pin == null) { $$(".tab")[0].click(); return; }
  try {
    const r = await api("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (!r.ok) { toast("PIN incorrecto 🚫"); $$(".tab")[0].click(); return; }
    adminPin = pin;
    renderAdmin();
  } catch (e) { toast("⚠️ " + e.message); $$(".tab")[0].click(); }
}

async function renderAdmin() {
  if (!adminPin) return promptAdmin();
  $("#adminMatches").innerHTML = MATCHES.map((m) => {
    const r = lastState.results[m.id] || {};
    return `<div class="match">
      <div class="grp">Grupo ${m.group}</div>
      ${teamHTML(m.home)}
      <div class="vs">
        <input class="score-in" type="number" min="0" max="30" data-mid="${m.id}" data-side="h" value="${r.h ?? ""}" />
        <span class="x">vs</span>
        <input class="score-in" type="number" min="0" max="30" data-mid="${m.id}" data-side="a" value="${r.a ?? ""}" />
      </div>
      ${teamHTML(m.away)}
    </div>`;
  }).join("");

  // jugadores + comprobantes (solo admin)
  const pa = $("#adminPlayers");
  try {
    const { players } = await api("/api/admin/players", { headers: { "x-admin-pin": adminPin } });
    pa.innerHTML = players.length
      ? players.map((p) => {
          const paid = p.paid
            ? `<span class="pa-paid paid-yes">Pagó ✅</span>`
            : `<span class="pa-paid paid-no">Sin pago ❌</span>`;
          const link = p.receipt ? ` · <a href="${p.receipt}" target="_blank">ver comprobante</a>` : "";
          return `<div class="player-admin">
            <span class="pa-name">${p.name}</span>
            <span>${paid}${link}</span>
          </div>`;
        }).join("")
      : '<p class="empty">No hay jugadores todavía.</p>';
  } catch (e) { pa.innerHTML = `<p class="empty">⚠️ ${e.message}</p>`; }
}

$("#saveResults").addEventListener("click", async () => {
  if (!adminPin) return promptAdmin();
  const results = {};
  $$("#adminMatches .score-in").forEach((inp) => {
    const mid = inp.dataset.mid, side = inp.dataset.side;
    (results[mid] ||= {})[side] = inp.value === "" ? null : clampScore(inp.value);
  });
  try {
    await api("/api/admin/results", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-pin": adminPin },
      body: JSON.stringify({ results }),
    });
    fireConfetti();
    toast("Resultados guardados. ¡A repartir puntos! 🏅");
    await refreshState();
  } catch (err) { toast("⚠️ " + err.message); }
});

$("#resetAll").addEventListener("click", async () => {
  if (!adminPin) return promptAdmin();
  if (!confirm("¿Seguro que quieres borrar TODO (jugadores, pronósticos y resultados)? No se puede deshacer.")) return;
  try {
    await api("/api/admin/reset", { method: "POST", headers: { "x-admin-pin": adminPin } });
    toast("Todo borrado. Tabla rasa. 🧹");
    await refreshState();
  } catch (err) { toast("⚠️ " + err.message); }
});

/* ============================================================
   CONFETTI
   ============================================================ */
const cv = $("#confetti");
const ctx = cv.getContext("2d");
let confetti = [];
function resize() { cv.width = innerWidth; cv.height = innerHeight; }
resize(); addEventListener("resize", resize);
function fireConfetti() {
  const colors = ["#ffd54a", "#0a7d3c", "#c0223a", "#0c5e8f", "#ffffff"];
  for (let i = 0; i < 140; i++) {
    confetti.push({
      x: innerWidth / 2, y: innerHeight / 3,
      vx: (Math.random() - 0.5) * 12, vy: Math.random() * -14 - 4,
      g: 0.3 + Math.random() * 0.2, size: 6 + Math.random() * 6,
      color: colors[(Math.random() * colors.length) | 0],
      rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3, life: 120,
    });
  }
}
function tick() {
  ctx.clearRect(0, 0, cv.width, cv.height);
  confetti.forEach((p) => {
    p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life--;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
    ctx.restore();
  });
  confetti = confetti.filter((p) => p.life > 0 && p.y < cv.height + 40);
  requestAnimationFrame(tick);
}
tick();

/* ============================================================
   INIT + auto-refresh en vivo
   ============================================================ */
(async function init() {
  if (me) $("#playerName").value = me.name;
  await refreshState();
  if (stateError) toast("⚠️ " + stateError);
  const rec = myRecord();
  if (rec && rec.fav) $("#favTeam").value = rec.fav;
  setInterval(() => { if (activeTab === "tabla") refreshState(); }, 8000);
  // Cuenta regresiva en vivo (cada segundo) mientras ves tu quiniela
  setInterval(() => { if (activeTab === "quiniela") renderDeadlineBanner(); }, 1000);
})();
