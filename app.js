/* ============================================================
   La Quiniela del Mundial — lógica principal
   Persistencia: localStorage (sin servidor).
   ============================================================ */

const STORE_KEY = "quiniela_mundial_v1";
const ADMIN_PIN = "1234"; // cámbialo si quieres

/* ---------- Estado ---------- */
function loadStore() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
  catch { return {}; }
}
function saveStore(s) { localStorage.setItem(STORE_KEY, JSON.stringify(s)); }

let store = loadStore();
store.players = store.players || {};   // { name: { name, fav, receipt(dataURL), predictions:{matchId:{h,a}} } }
store.results = store.results || {};   // { matchId: {h,a} }
store.currentPlayer = store.currentPlayer || null;
saveStore(store);

/* ---------- Utilidades ---------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2600);
}

function teamHTML(code) {
  const t = TEAMS[code] || { name: code, flag: "🏳️" };
  return `<div class="team"><span class="fl">${t.flag}</span><span class="nm">${t.name}</span></div>`;
}

/* ============================================================
   PESTAÑAS
   ============================================================ */
$$(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    $$(".tab").forEach((t) => t.classList.remove("active"));
    $$(".panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    $("#" + tab.dataset.tab).classList.add("active");
    if (tab.dataset.tab === "tabla") renderLeaderboard();
    if (tab.dataset.tab === "admin") renderAdmin();
    if (tab.dataset.tab === "quiniela") renderQuiniela();
  });
});

/* ============================================================
   BANDERAS DEL HERO
   ============================================================ */
(function heroFlags() {
  const flags = Object.values(TEAMS).map((t) => t.flag);
  $("#heroFlags").textContent = flags.slice(0, 16).join(" ");
})();

/* ============================================================
   CHISTES ROTATIVOS
   ============================================================ */
(function jokeRotator() {
  const el = $("#joke");
  let i = Math.floor(Math.random() * JOKES.length);
  const show = () => { el.style.opacity = 0; setTimeout(() => { el.textContent = JOKES[i % JOKES.length]; el.style.opacity = 1; i++; }, 350); };
  show();
  setInterval(show, 6000);
  el.addEventListener("click", show); // click = otro chiste
})();

/* ============================================================
   EQUIPO FAVORITO (select)
   ============================================================ */
(function fillFavTeam() {
  const sel = $("#favTeam");
  sel.innerHTML = '<option value="">— elige tu equipo —</option>' +
    Object.entries(TEAMS).map(([c, t]) => `<option value="${c}">${t.flag} ${t.name}</option>`).join("");
})();

/* ============================================================
   REGISTRO
   ============================================================ */
let pendingReceipt = null;

$("#receipt").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) { pendingReceipt = null; $("#receiptPreview").innerHTML = ""; return; }
  const reader = new FileReader();
  reader.onload = () => {
    pendingReceipt = reader.result;
    $("#receiptPreview").innerHTML = `<img src="${pendingReceipt}" alt="comprobante" /><p class="small">✅ Comprobante cargado. ¡Eso, a pagar como los grandes!</p>`;
  };
  reader.readAsDataURL(file);
});

$("#registroForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("#playerName").value.trim();
  const fav = $("#favTeam").value;
  if (!name) { toast("Pon tu nombre, pues 😅"); return; }

  const existing = store.players[name];
  const player = existing || { name, predictions: {} };
  player.fav = fav;
  if (pendingReceipt) player.receipt = pendingReceipt;
  store.players[name] = player;
  store.currentPlayer = name;
  saveStore(store);

  pendingReceipt = null;
  fireConfetti();
  toast(existing ? "¡Datos actualizados! 🎉" : `¡Bienvenido, ${name}! ⚽`);
  renderCurrentPlayer();
  renderQuiniela();
});

function renderCurrentPlayer() {
  const box = $("#currentPlayerBox");
  const name = store.currentPlayer;
  if (!name || !store.players[name]) { box.classList.add("hidden"); return; }
  const p = store.players[name];
  const fav = p.fav && TEAMS[p.fav] ? `${TEAMS[p.fav].flag} ${TEAMS[p.fav].name}` : "—";
  const paid = p.receipt ? "✅ Comprobante cargado" : "❌ Falta el comprobante";
  const filled = Object.keys(p.predictions || {}).length;
  box.classList.remove("hidden");
  box.innerHTML = `
    <h3>👤 Jugando como: ${p.name}</h3>
    <p>Equipo del corazón: <b>${fav}</b></p>
    <p>Pago: <b>${paid}</b></p>
    <p>Pronósticos cargados: <b>${filled}/${MATCHES.length}</b></p>
    <button class="btn-danger" id="logoutBtn">Cambiar de jugador</button>`;
  $("#logoutBtn").addEventListener("click", () => {
    store.currentPlayer = null; saveStore(store);
    $("#playerName").value = ""; $("#favTeam").value = "";
    $("#receiptPreview").innerHTML = "";
    renderCurrentPlayer(); renderQuiniela();
    toast("Listo, ¿quién juega ahora? 👀");
  });
}

/* ============================================================
   QUINIELA (pronósticos del jugador)
   ============================================================ */
function renderQuiniela() {
  const name = store.currentPlayer;
  const need = $("#needRegister");
  const list = $("#matchesList");
  const saveBtn = $("#saveQuiniela");
  if (!name || !store.players[name]) {
    need.classList.remove("hidden");
    list.innerHTML = "";
    saveBtn.classList.add("hidden");
    return;
  }
  need.classList.add("hidden");
  saveBtn.classList.remove("hidden");
  const preds = store.players[name].predictions || {};

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

$("#saveQuiniela").addEventListener("click", () => {
  const name = store.currentPlayer;
  if (!name) return;
  const preds = {};
  let count = 0;
  $$("#matchesList .score-in").forEach((inp) => {
    const mid = inp.dataset.mid, side = inp.dataset.side;
    preds[mid] = preds[mid] || {};
    if (inp.value !== "") { preds[mid][side] = clampScore(inp.value); }
  });
  // limpiar partidos incompletos (solo guardar si tiene los dos)
  Object.keys(preds).forEach((mid) => {
    if (preds[mid].h == null || preds[mid].a == null) delete preds[mid];
    else count++;
  });
  store.players[name].predictions = preds;
  saveStore(store);
  fireConfetti();
  toast(`¡Quiniela guardada! ${count}/${MATCHES.length} partidos. 🤞`);
  renderCurrentPlayer();
});

function clampScore(v) {
  let n = parseInt(v, 10);
  if (isNaN(n) || n < 0) n = 0;
  if (n > 30) n = 30;
  return n;
}

/* ============================================================
   PUNTUACIÓN
   ----------------------------------------------------------
   5 pts: pega resultado y goles exactos (ambos equipos)
   4 pts: pega el resultado (ganador/empate) y los goles de UN equipo
   3 pts: pega solo el resultado (ganador o empate)
   1 pt : pega los goles de un equipo pero NO el resultado
   0 pts: no pega nada
   ============================================================ */
function sign(h, a) { return h > a ? 1 : h < a ? -1 : 0; }

function scoreMatch(pred, real) {
  if (!pred || pred.h == null || pred.a == null) return 0;
  if (!real || real.h == null || real.a == null) return 0;

  const exactBoth = pred.h === real.h && pred.a === real.a;
  if (exactBoth) return 5;

  const sameResult = sign(pred.h, pred.a) === sign(real.h, real.a);
  const oneGoalHit = pred.h === real.h || pred.a === real.a;

  if (sameResult && oneGoalHit) return 4; // resultado + goles de uno
  if (sameResult) return 3;               // solo el resultado
  if (oneGoalHit) return 1;               // goles de uno pero falló el resultado
  return 0;                               // un coño
}

function totalPoints(player) {
  let total = 0;
  for (const m of MATCHES) {
    total += scoreMatch((player.predictions || {})[m.id], store.results[m.id]);
  }
  return total;
}

/* ============================================================
   TABLA DE POSICIONES
   ============================================================ */
function renderLeaderboard() {
  const lb = $("#leaderboard");
  const players = Object.values(store.players);
  if (!players.length) { lb.innerHTML = '<p class="empty">Aún no hay jugadores. ¡Sé el primero! 🥇</p>'; return; }

  const ranked = players
    .map((p) => ({ p, pts: totalPoints(p) }))
    .sort((a, b) => b.pts - a.pts);

  const medals = ["🥇", "🥈", "🥉"];
  const cls = ["gold", "silver", "bronze"];
  lb.innerHTML = ranked.map((r, i) => {
    const fav = r.p.fav && TEAMS[r.p.fav] ? TEAMS[r.p.fav].flag : "🏳️";
    const paid = r.p.receipt ? "" : ' <small>(sin pago 💸)</small>';
    return `<div class="lb-row ${cls[i] || ""}">
      <div class="pos">${medals[i] || (i + 1)}</div>
      <div class="who">${fav} ${r.p.name}${paid}</div>
      <div class="pts-badge">${r.pts} pts</div>
    </div>`;
  }).join("");
}

/* ============================================================
   ADMIN
   ============================================================ */
let adminUnlocked = false;

function renderAdmin() {
  if (!adminUnlocked) {
    const pin = prompt("🔐 PIN de Admin:");
    if (pin !== ADMIN_PIN) { toast("PIN incorrecto 🚫"); $$(".tab")[0].click(); return; }
    adminUnlocked = true;
  }
  const am = $("#adminMatches");
  am.innerHTML = MATCHES.map((m) => {
    const r = store.results[m.id] || {};
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

  // jugadores
  const pa = $("#adminPlayers");
  const players = Object.values(store.players);
  pa.innerHTML = players.length
    ? players.map((p) => {
        const paid = p.receipt
          ? `<span class="pa-paid paid-yes">Pagó ✅</span>`
          : `<span class="pa-paid paid-no">Sin pago ❌</span>`;
        const link = p.receipt ? ` · <a href="${p.receipt}" target="_blank">ver comprobante</a>` : "";
        return `<div class="player-admin">
          <span class="pa-name">${p.name}</span>
          <span>${paid}${link}</span>
        </div>`;
      }).join("")
    : '<p class="empty">No hay jugadores todavía.</p>';
}

$("#saveResults").addEventListener("click", () => {
  if (!adminUnlocked) { toast("Desbloquea el admin primero 🔐"); return; }
  const res = {};
  $$("#adminMatches .score-in").forEach((inp) => {
    const mid = inp.dataset.mid, side = inp.dataset.side;
    res[mid] = res[mid] || {};
    if (inp.value !== "") res[mid][side] = clampScore(inp.value);
  });
  Object.keys(res).forEach((mid) => {
    if (res[mid].h == null || res[mid].a == null) delete res[mid];
  });
  store.results = res;
  saveStore(store);
  fireConfetti();
  toast("Resultados guardados. ¡A repartir puntos! 🏅");
});

$("#resetAll").addEventListener("click", () => {
  if (!confirm("¿Seguro que quieres borrar TODO (jugadores, pronósticos y resultados)? Esto no se puede deshacer.")) return;
  localStorage.removeItem(STORE_KEY);
  store = { players: {}, results: {}, currentPlayer: null };
  saveStore(store);
  toast("Todo borrado. Tabla rasa. 🧹");
  renderAdmin(); renderCurrentPlayer();
});

/* ============================================================
   CONFETTI (canvas, sin librerías)
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
   INIT
   ============================================================ */
(function init() {
  if (store.currentPlayer && store.players[store.currentPlayer]) {
    const p = store.players[store.currentPlayer];
    $("#playerName").value = p.name;
    if (p.fav) $("#favTeam").value = p.fav;
  }
  renderCurrentPlayer();
  renderQuiniela();
})();
