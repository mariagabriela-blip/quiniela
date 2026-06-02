/* ============================================================
   La Quiniela del Mundial — frontend
   Habla con el backend (Express + SQLite) por una API REST,
   así TODOS comparten la misma quiniela y la misma tabla en vivo.
   ============================================================ */

const ME_KEY = "quiniela_me";        // solo recuerda "quién soy" en este dispositivo
let me = localStorage.getItem(ME_KEY) || null;
let adminPin = null;                 // se guarda en memoria tras login admin
let lastState = { players: [], results: {}, totalMatches: MATCHES.length };

/* ---------- Utilidades ---------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2800);
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

async function api(path, opts = {}) {
  const res = await fetch(path, opts);
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error((data && data.error) || "Error de red");
  return data;
}

async function refreshState() {
  try {
    lastState = await api("/api/state");
  } catch (e) {
    console.warn("No se pudo cargar el estado:", e.message);
  }
  renderActivePanel();
}

function myRecord() {
  return lastState.players.find((p) => p.name === me) || null;
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
  show();
  setInterval(show, 6000);
  el.addEventListener("click", show);
})();

/* ============================================================
   Equipo favorito
   ============================================================ */
$("#favTeam").innerHTML =
  '<option value="">— elige tu equipo —</option>' +
  Object.entries(TEAMS).map(([c, t]) => `<option value="${c}">${t.flag} ${t.name}</option>`).join("");

/* ============================================================
   REGISTRO
   ============================================================ */
$("#receipt").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) { $("#receiptPreview").innerHTML = ""; return; }
  const reader = new FileReader();
  reader.onload = () => {
    $("#receiptPreview").innerHTML =
      `<img src="${reader.result}" alt="comprobante" /><p class="small">✅ Listo para subir. ¡A pagar como los grandes!</p>`;
  };
  reader.readAsDataURL(file);
});

$("#registroForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("#playerName").value.trim();
  const fav = $("#favTeam").value;
  if (!name) { toast("Pon tu nombre, pues 😅"); return; }

  const fd = new FormData();
  fd.append("name", name);
  fd.append("fav", fav);
  const file = $("#receipt").files[0];
  if (file) fd.append("receipt", file);

  try {
    const r = await api("/api/register", { method: "POST", body: fd });
    me = name;
    localStorage.setItem(ME_KEY, me);
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
    me = null; localStorage.removeItem(ME_KEY);
    $("#playerName").value = ""; $("#favTeam").value = "";
    $("#receiptPreview").innerHTML = "";
    renderCurrentPlayer(); renderQuiniela();
    toast("Listo, ¿quién juega ahora? 👀");
  });
}

/* ============================================================
   MI QUINIELA
   ============================================================ */
function renderQuiniela() {
  const need = $("#needRegister");
  const list = $("#matchesList");
  const saveBtn = $("#saveQuiniela");
  const rec = myRecord();
  if (!me || !rec) {
    need.classList.remove("hidden");
    list.innerHTML = "";
    saveBtn.classList.add("hidden");
    return;
  }
  need.classList.add("hidden");
  saveBtn.classList.remove("hidden");
  const preds = rec.predictions || {};

  list.innerHTML = MATCHES.map((m) => {
    const p = preds[m.id] || {};
    return `<div class="match">
      <div class="grp">Grupo ${m.group}</div>
      ${teamHTML(m.home)}
      <div class="vs">
        <input class="score-in" type="number" min="0" max="30" data-mid="${m.id}" data-side="h" value="${p.h ?? ""}" />
        <span class="x">vs</span>
        <input class="score-in" type="number" min="0" max="30" data-mid="${m.id}" data-side="a" value="${p.a ?? ""}" />
      </div>
      ${teamHTML(m.away)}
    </div>`;
  }).join("");
}

$("#saveQuiniela").addEventListener("click", async () => {
  if (!me) return;
  const predictions = {};
  $$("#matchesList .score-in").forEach((inp) => {
    const mid = inp.dataset.mid, side = inp.dataset.side;
    (predictions[mid] ||= {})[side] = inp.value === "" ? null : clampScore(inp.value);
  });
  try {
    const r = await api("/api/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: me, predictions }),
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
    const mine = p.name === me ? " is-me" : "";
    return `<div class="lb-wrap">
      <div class="lb-row ${cls[i] || ""}${mine}" data-name="${encodeURIComponent(p.name)}">
        <div class="pos">${medals[i] || (i + 1)}</div>
        <div class="who">${fav} ${p.name}${paid} <span class="tap">👁️ ver quiniela</span></div>
        <div class="pts-badge">${p.points} pts</div>
      </div>
      <div class="lb-detail hidden" id="d-${i}"></div>
    </div>`;
  }).join("");

  // Expandir/colapsar la quiniela de cada jugador
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

function renderAdmin() {
  if (!adminPin) return promptAdmin();
  const am = $("#adminMatches");
  am.innerHTML = MATCHES.map((m) => {
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

  const pa = $("#adminPlayers");
  const players = lastState.players;
  pa.innerHTML = players.length
    ? players.map((p) => {
        const paid = p.paid
          ? `<span class="pa-paid paid-yes">Pagó ✅</span>`
          : `<span class="pa-paid paid-no">Sin pago ❌</span>`;
        const link = p.receipt_url ? ` · <a href="${p.receipt_url}" target="_blank">ver comprobante</a>` : "";
        return `<div class="player-admin">
          <span class="pa-name">${p.name}</span>
          <span>${paid}${link}</span>
        </div>`;
      }).join("")
    : '<p class="empty">No hay jugadores todavía.</p>';
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
  if (me) $("#playerName").value = me;
  await refreshState();
  const rec = myRecord();
  if (rec && rec.fav) $("#favTeam").value = rec.fav;
  // Refresca la tabla en vivo cada 8s mientras la estás viendo
  setInterval(() => { if (activeTab === "tabla") refreshState(); }, 8000);
})();
