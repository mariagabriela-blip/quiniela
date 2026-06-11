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
  updateConnBanner();
  renderActivePanel();
}
function updateConnBanner() {
  const el = $("#connBanner");
  if (!el) return;
  if (stateError) {
    el.className = "connbar show";
    el.innerHTML = `🔌 <b>No hay conexión con la base de datos.</b> Lo que cargues NO se guardará. ` +
      `<span class="small">Avísale al administrador: falta configurar <code>DATABASE_URL</code> en Vercel.</span>`;
  } else {
    el.className = "connbar";
    el.innerHTML = "";
  }
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
  if (activeTab === "extras") renderExtras();
  if (activeTab === "tabla") renderLeaderboard();
  if (activeTab === "bymatch") renderByMatch();
  if (activeTab === "admin") renderAdmin();
}

/* ============================================================
   POR PARTIDO — cada juego y lo que puso cada jugador
   ============================================================ */
function renderByMatch() {
  const box = $("#byMatchBody");
  const matches = getMatches();
  if (!matches.length) { box.innerHTML = '<p class="empty">Aún no hay partidos.</p>'; return; }
  const players = lastState.players || [];

  box.innerHTML = matchesByRound().map((r) => {
    const header = `<div class="round-head">${roundLabel(r.round)}</div>`;
    const cards = r.items.map((m) => {
      const rr = lastState.results[m.id];
      const real = rr ? `${rr.h} - ${rr.a}` : "vs";
      const sub = m.group ? `Grupo ${m.group}` : `${r.round}${m.slot ? " #" + m.slot : ""}`;
      // jugadores que pronosticaron este partido, los aciertos arriba
      const preds = players
        .filter((p) => p.predictions[m.id])
        .map((p) => ({ name: p.name, pr: p.predictions[m.id], pts: p.perMatch[m.id] || 0, joker: p.joker === m.id }))
        .sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name));
      const rows = preds.length
        ? preds.map((x) => {
            const ptsTxt = rr ? `<span class="bm-pts">+${x.pts}</span>` : "";
            return `<div class="bm-row">
              <span class="bm-name">${x.joker ? "✨ " : ""}${x.name}</span>
              <span class="bm-guess">${x.pr.h}-${x.pr.a}</span>
              ${ptsTxt}
            </div>`;
          }).join("")
        : '<div class="muted small" style="padding:6px 2px">Nadie pronosticó este partido.</div>';
      return `<div class="bm-card">
        <div class="bm-head">
          <span class="bm-sub">${sub}</span>
          <span class="bm-teams">${teamFlag(m.home)} ${TEAMS[m.home]?.name || m.home} <b class="bm-real">${real}</b> ${TEAMS[m.away]?.name || m.away} ${teamFlag(m.away)}</span>
        </div>
        ${rows}
      </div>`;
    }).join("");
    return header + cards;
  }).join("");
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

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("#loginName").value.trim();
  const pin = $("#loginPin").value.trim();
  if (!name || !pin) return toast("Pon tu nombre y tu PIN 🔑");
  try {
    await api("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, pin }),
    });
    saveMe({ name, pin });
    $("#loginName").value = ""; $("#loginPin").value = "";
    toast(`¡Hola de nuevo, ${name}! ⚽`);
    await refreshState();
    document.querySelector('.tab[data-tab="quiniela"]').click();
  } catch (err) { toast("⚠️ " + err.message); }
});

$("#goLogin")?.addEventListener("click", () => {
  document.querySelector('.tab[data-tab="registro"]').click();
  $("#loginName")?.focus();
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

function setAuthForms(loggedIn) {
  // Cuando ya entraste, oculta los formularios de entrar/registrarse
  ["loginForm", "registroForm"].forEach((id) => $("#" + id)?.classList.toggle("hidden", loggedIn));
  document.querySelector(".or-sep")?.classList.toggle("hidden", loggedIn);
  document.querySelector(".reg-title")?.classList.toggle("hidden", loggedIn);
}

function renderCurrentPlayer() {
  const box = $("#currentPlayerBox");
  const rec = myRecord();
  if (!me || !rec) { box.classList.add("hidden"); setAuthForms(false); return; }
  setAuthForms(true);
  const paid = rec.paid ? "✅ Comprobante cargado" : "❌ Falta el comprobante";
  const opts = '<option value="">— elige tu equipo —</option>' +
    Object.entries(TEAMS).map(([c, t]) =>
      `<option value="${c}" ${c === rec.fav ? "selected" : ""}>${t.flag} ${t.name}</option>`).join("");
  box.classList.remove("hidden");
  box.innerHTML = `
    <h3>👤 Jugando como: ${rec.name}</h3>
    <p>Pronósticos: <b>${rec.filled}/${lastState.totalMatches}</b> · Puntos: <b>${rec.points} pts</b> 🏅</p>
    <p>Pago: <b>${paid}</b></p>
    <label>Equipo del corazón ❤️
      <select id="profFav">${opts}</select>
    </label>
    <label class="upload-label">${rec.paid ? "Reemplazar comprobante 💸" : "Subir comprobante de pago 💸"}
      <span class="muted small">${rec.paid ? "Ya cargaste uno. Sube otro solo si quieres cambiarlo." : "¿No lo subiste al registrarte? Súbelo aquí."}</span>
      <input type="file" id="profReceipt" accept="image/*" />
    </label>
    <div id="profReceiptPreview" class="receipt-preview"></div>
    <button class="btn-primary" id="saveProfileBtn">💾 Guardar cambios</button>
    <button class="btn-danger" id="logoutBtn">Cambiar de jugador</button>`;

  $("#profReceipt").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) { $("#profReceiptPreview").innerHTML = ""; return; }
    const url = await readFileAsDataURL(f);
    $("#profReceiptPreview").innerHTML = `<img src="${url}" alt="comprobante" />`;
  });

  $("#saveProfileBtn").addEventListener("click", async () => {
    const body = { name: me.name, pin: me.pin, fav: $("#profFav").value };
    const f = $("#profReceipt").files[0];
    if (f) body.receipt = await readFileAsDataURL(f);
    try {
      await api("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      fireConfetti();
      toast(f ? "¡Comprobante subido! 💸✅" : "¡Datos actualizados! 🎉");
      await refreshState();
    } catch (err) { toast("⚠️ " + err.message); }
  });

  $("#logoutBtn").addEventListener("click", () => {
    clearMe();
    $("#playerName").value = ""; $("#playerPin").value = ""; $("#favTeam").value = "";
    $("#receiptPreview").innerHTML = "";
    renderCurrentPlayer(); renderQuiniela();
    toast("Listo, ¿quién juega ahora? 👀");
  });
}

/* ============================================================
   PARTIDOS (vienen del estado/servidor; pueden crecer por rondas)
   ============================================================ */
function getMatches() { return (lastState && lastState.matches) || []; }
function matchesByRound() {
  const rounds = []; const idx = {};
  for (const m of getMatches()) {
    if (!(m.round in idx)) { idx[m.round] = rounds.length; rounds.push({ round: m.round, items: [] }); }
    rounds[idx[m.round]].items.push(m);
  }
  return rounds;
}
function openMatches() { return getMatches().filter((m) => !m.locked); }

// Dibuja un partido con el marcador de CADA equipo justo debajo de su bandera.
function matchRow(m, vH, vA, opts = {}) {
  const { dis = "", showLock = false, dim = false } = opts;
  const sub = m.group ? `Grupo ${m.group}` : `${m.round}${m.slot ? " #" + m.slot : ""}`;
  const lock = showLock && m.locked ? ' <span class="lockt">🔒 cerrado</span>' : "";
  const teamCol = (code, side, val) => `
    <div class="team">
      <span class="fl">${teamFlag(code)}</span>
      <span class="nm">${TEAMS[code]?.name || code}</span>
      <input class="score-in" type="number" inputmode="numeric" min="0" max="30"
             data-mid="${m.id}" data-side="${side}" value="${val ?? ""}" ${dis}
             aria-label="Goles de ${TEAMS[code]?.name || code}" />
    </div>`;
  return `<div class="match${dim && m.locked ? " mlocked" : ""}">
    <div class="grp">${sub}${lock}</div>
    ${teamCol(m.home, "h", vH)}
    <div class="vs"><span class="x">vs</span></div>
    ${teamCol(m.away, "a", vA)}
  </div>`;
}
function roundLabel(r) {
  const map = {
    Grupos: "⚽ Fase de Grupos", Dieciseisavos: "🏟️ Dieciseisavos",
    Octavos: "🔥 Octavos de final", Cuartos: "💪 Cuartos de final",
    Semifinal: "😱 Semifinales", "3er puesto": "🥉 Tercer puesto", Final: "🏆 LA FINAL",
  };
  return map[r] || ("🏟️ " + r);
}

/* ============================================================
   CIERRE / CUENTA REGRESIVA (por partido)
   ============================================================ */
function countdownTo(ms) {
  let s = Math.max(0, Math.floor((ms - Date.now()) / 1000));
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  return `${d}d ${h}h ${m}m ${s}s`;
}
function nextDeadlineMs() {
  const ds = openMatches().map((m) => Date.parse(m.deadline)).filter(Number.isFinite);
  return ds.length ? Math.min(...ds) : null;
}
function renderDeadlineBanner() {
  const el = $("#deadlineBanner");
  if (!el) return;
  const matches = getMatches();
  if (!matches.length) { el.className = "deadline"; el.innerHTML = ""; return; }
  const open = openMatches();
  if (!open.length) {
    el.className = "deadline locked";
    el.innerHTML = "🔒 <b>No hay partidos abiertos ahora.</b> Espera a que el admin cargue la siguiente ronda. ⚽";
    return;
  }
  const ms = nextDeadlineMs();
  const fecha = new Date(ms).toLocaleString("es-VE", {
    day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit",
  });
  const rec = myRecord();
  let faltan = "";
  if (rec) {
    const openIds = new Set(open.map((m) => m.id));
    const filledOpen = Object.keys(rec.predictions || {}).filter((id) => openIds.has(id)).length;
    const n = open.length - filledOpen;
    faltan = n > 0 ? ` · <b>te faltan ${n}</b> por llenar ⚠️` : " · ¡llenaste los abiertos! ✅";
  }
  el.className = "deadline open";
  el.innerHTML = `⏰ Próximo cierre: <b>${fecha}</b> · en <b>${countdownTo(ms)}</b>${faltan}`;
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
  saveBtn.classList.toggle("hidden", !openMatches().length);
  const preds = rec.predictions || {};

  list.innerHTML = matchesByRound().map((r) => {
    const header = `<div class="round-head">${roundLabel(r.round)}</div>`;
    const items = r.items.map((m) => {
      const p = preds[m.id] || {};
      return matchRow(m, p.h, p.a, { dis: m.locked ? "disabled" : "", showLock: true, dim: true });
    }).join("");
    return header + items;
  }).join("");
}

$("#saveQuiniela").addEventListener("click", async () => {
  if (!me) return;
  const predictions = {};
  $$("#matchesList .score-in").forEach((inp) => {
    if (inp.disabled) return; // no enviar los partidos ya cerrados
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
    toast(`¡Guardado! Llevas ${r.count}/${lastState.totalMatches} partidos. 🤞`);
    await refreshState();
  } catch (err) { toast("⚠️ " + err.message); }
});

/* ============================================================
   EXTRAS: predicciones bonus + comodín
   ============================================================ */
function teamSelect(id, sel) {
  return `<select id="${id}">` +
    '<option value="">— elige —</option>' +
    Object.entries(TEAMS).map(([c, t]) => `<option value="${c}" ${c === sel ? "selected" : ""}>${t.flag} ${t.name}</option>`).join("") +
    "</select>";
}
function scorerOptions(sel) {
  const list = typeof GOLEADORES !== "undefined" ? GOLEADORES : [];
  return '<option value="">— elige —</option>' +
    list.map((n) => `<option value="${n}" ${n === sel ? "selected" : ""}>${n}</option>`).join("");
}
function renderExtras() {
  const body = $("#extrasBody");
  const rec = myRecord();
  if (!me || !rec) {
    body.innerHTML = `<div class="warn">⚠️ Para tus extras, primero <b>entra con tu nombre y PIN</b>.
      <button class="btn-primary" id="goLogin2">🔓 Ir a Entrar / Registro</button></div>`;
    $("#goLogin2").addEventListener("click", () => { document.querySelector('.tab[data-tab="registro"]').click(); $("#loginName")?.focus(); });
    return;
  }
  const b = rec.bonus || {};
  const bp = lastState.bonusPts || (typeof BONUS !== "undefined" ? BONUS : { champ: 0, runnerup: 0, scorer: 0, surprise: 0 });
  const gLocked = !!lastState.globalLocked;
  const dis = gLocked ? "disabled" : "";

  // Comodín: opciones de partidos (deshabilita los cerrados)
  const jokerOpts = '<option value="">— sin comodín —</option>' +
    matchesByRound().map((r) => r.items.map((m) => {
      const lbl = `${roundLabel(r.round).replace(/^[^ ]+ /, "")}: ${teamFlag(m.home)} ${TEAMS[m.home]?.name || m.home} vs ${teamFlag(m.away)} ${TEAMS[m.away]?.name || m.away}`;
      const d = m.locked && m.id !== rec.joker ? "disabled" : "";
      return `<option value="${m.id}" ${m.id === rec.joker ? "selected" : ""} ${d}>${m.locked ? "🔒 " : ""}${lbl}</option>`;
    }).join("")).join("");

  body.innerHTML = `
    <form id="bonusCard" class="card" onsubmit="return false">
      <h3>🏆 Predicciones del torneo</h3>
      <p class="muted small">${gLocked ? "🔒 Ya cerraron (arrancó el Mundial)." : "Editables hasta que arranque el Mundial."} Puntos: campeón +${bp.champ}, subcampeón +${bp.runnerup}, goleador +${bp.scorer}, sorpresa +${bp.surprise}.</p>
      <label>🏆 Campeón ${teamSelect("xChamp", b.champ)}</label>
      <label>🥈 Subcampeón ${teamSelect("xRunner", b.runnerup)}</label>
      <label>👟 Goleador (Botín de Oro)
        <select id="xScorer">${scorerOptions(b.scorer)}</select>
      </label>
      <label>😮 Sorpresa del Mundial ${teamSelect("xSurprise", b.surprise)}</label>
      <button class="btn-primary" id="saveBonus" type="button" ${dis}>💾 Guardar predicciones</button>
    </form>

    <form id="jokerCard" class="card" onsubmit="return false">
      <h3>✨ Comodín (puntos dobles)</h3>
      <p class="muted small">Elige <b>un partido abierto</b>: sus puntos cuentan <b>doble</b>. Puedes cambiarlo mientras ese partido no haya cerrado.</p>
      <label>Partido con doble puntos
        <select id="xJoker">${jokerOpts}</select>
      </label>
      <button class="btn-primary" id="saveJoker" type="button">✨ Guardar comodín</button>
    </form>`;

  if (!gLocked) {
    $("#saveBonus").addEventListener("click", async () => {
      try {
        await api("/api/bonus", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: me.name, pin: me.pin,
            champ: $("#xChamp").value, runnerup: $("#xRunner").value,
            surprise: $("#xSurprise").value, scorer: $("#xScorer").value,
          }),
        });
        fireConfetti(); toast("¡Predicciones bonus guardadas! 🏆");
        await refreshState();
      } catch (e) { toast("⚠️ " + e.message); }
    });
  }
  $("#saveJoker").addEventListener("click", async () => {
    try {
      await api("/api/joker", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: me.name, pin: me.pin, matchId: $("#xJoker").value }),
      });
      fireConfetti(); toast("¡Comodín guardado! ✨");
      await refreshState();
    } catch (e) { toast("⚠️ " + e.message); }
  });
}

/* ============================================================
   TABLA EN VIVO — todos ven la quiniela de todos
   ============================================================ */
function renderPozo() {
  const el = $("#pozoBanner");
  if (!el) return;
  const players = lastState.players || [];
  const total = players.length;
  const pagaron = players.filter((p) => p.paid).length;
  const cuota = typeof CUOTA === "number" ? CUOTA : 0;
  const mon = typeof MONEDA === "string" ? MONEDA : "$";
  const bote = pagaron * cuota;
  if (!total) { el.className = "pozo"; el.innerHTML = ""; return; }
  el.className = "pozo show";
  el.innerHTML = `💰 <b>El Pozo: ${mon}${bote}</b> · pagaron ${pagaron} de ${total} ` +
    `<span class="small">(cuota ${mon}${cuota} c/u) · ¡se lo lleva el 1er lugar! 🏆</span>`;
}

function renderLeaderboard() {
  renderPozo();
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
      const bd = p.breakdown || { match: 0, joker: 0, bonus: 0 };
      const jm = p.joker ? getMatches().find((m) => m.id === p.joker) : null;
      const jtxt = jm ? `${teamFlag(jm.home)} vs ${teamFlag(jm.away)}` : "—";
      const head = `<div class="det-sum">⚽ Partidos <b>${bd.match}</b> · ✨ Comodín <b>+${bd.joker}</b> (${jtxt}) · 🏆 Bonus <b>+${bd.bonus}</b></div>`;
      det.innerHTML = head + getMatches().map((m) => {
        const pr = p.predictions[m.id];
        const rr = lastState.results[m.id];
        const guess = pr ? `${pr.h}-${pr.a}` : "—";
        const real = rr ? `${rr.h}-${rr.a}` : "·";
        const pts = anyResults ? `<b>+${p.perMatch[m.id] || 0}</b>` : "";
        const jk = m.id === p.joker ? "✨ " : "";
        return `<div class="det-row">
          <span>${jk}${teamFlag(m.home)} vs ${teamFlag(m.away)}</span>
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
   COMPARTIR POR WHATSAPP
   ============================================================ */
function shareWhatsApp(text) {
  const url = "https://wa.me/?text=" + encodeURIComponent(text);
  window.open(url, "_blank");
}
$("#shareLb")?.addEventListener("click", () => {
  const players = lastState.players || [];
  const medals = ["🥇", "🥈", "🥉"];
  const top = players.slice(0, 5)
    .map((p, i) => `${medals[i] || (i + 1) + "."} ${p.name} — ${p.points} pts`).join("\n");
  const txt = `🏆 *Quiniela del Mundial* 🏆\nTabla de posiciones:\n${top || "¡Aún sin jugadores!"}\n\n¡Entra y juega! ${location.href}`;
  shareWhatsApp(txt);
});

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

  // Resultados reales, agrupados por ronda
  $("#adminMatches").innerHTML = matchesByRound().map((r) => {
    const header = `<div class="round-head">${roundLabel(r.round)}</div>`;
    const items = r.items.map((m) => {
      const rr = lastState.results[m.id] || {};
      const koSel = m.round !== "Grupos"
        ? `<div class="winrow">🏃 Avanzó:
             <select class="winsel" data-mid="${m.id}">
               <option value="">— auto por marcador —</option>
               <option value="${m.home}" ${m.winner === m.home ? "selected" : ""}>${teamFlag(m.home)} ${TEAMS[m.home]?.name || m.home}</option>
               <option value="${m.away}" ${m.winner === m.away ? "selected" : ""}>${teamFlag(m.away)} ${TEAMS[m.away]?.name || m.away}</option>
             </select> <span class="muted small">(elige aquí si hubo penales)</span>
           </div>`
        : "";
      return matchRow(m, rr.h, rr.a, {}) + koSel;
    }).join("");
    return header + items;
  }).join("");

  renderAddMatch();
  renderAdminBonus();

  // jugadores + comprobantes (solo admin)
  const pa = $("#adminPlayers");
  try {
    const { players } = await api("/api/admin/players", { headers: { "x-admin-pin": adminPin } });
    pa.innerHTML = players.length
      ? players.map((p) => {
          const paid = p.paid
            ? `<span class="pa-paid paid-yes">Pagó ✅</span>`
            : `<span class="pa-paid paid-no">Sin pago ❌</span>`;
          const thumb = p.receipt
            ? `<img class="rcpt-thumb" src="${p.receipt}" alt="comprobante de ${p.name}" title="toca para ampliar" />`
            : "";
          return `<div class="player-admin">
            <div class="pa-row"><span class="pa-name">${p.name}</span> ${paid}</div>
            ${thumb}
          </div>`;
        }).join("")
      : '<p class="empty">No hay jugadores todavía.</p>';
    $$(".rcpt-thumb").forEach((t) => t.addEventListener("click", () => openImg(t.src)));
  } catch (e) { pa.innerHTML = `<p class="empty">⚠️ ${e.message}</p>`; }
}

// Visor de imagen dentro de la página (los navegadores bloquean abrir data: URLs)
function openImg(src) {
  $("#imgModalPic").src = src;
  $("#imgModal").classList.remove("hidden");
}
$("#imgModal")?.addEventListener("click", () => $("#imgModal").classList.add("hidden"));

function teamOptions(sel) {
  return '<option value="">— equipo —</option>' +
    Object.entries(TEAMS).map(([c, t]) => `<option value="${c}" ${c === sel ? "selected" : ""}>${t.flag} ${t.name}</option>`).join("");
}
function renderAddMatch() {
  const rounds = ["Dieciseisavos", "Octavos", "Cuartos", "Semifinal", "3er puesto", "Final"];
  $("#amRound").innerHTML = rounds.map((r) => `<option value="${r}">${r}</option>`).join("");
  $("#amHome").innerHTML = teamOptions();
  $("#amAway").innerHTML = teamOptions();

  // Selector de "cierre por ronda"
  const present = [...new Set(getMatches().map((m) => m.round))];
  if ($("#rdRound")) $("#rdRound").innerHTML = present.map((r) => `<option value="${r}">${roundLabel(r)}</option>`).join("");

  const kos = getMatches().filter((m) => m.round !== "Grupos");
  const box = $("#adminKnockouts");
  box.innerHTML = kos.length
    ? kos.map((m) => {
        const cierre = m.deadline ? new Date(m.deadline).toLocaleString("es-VE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
        return `<div class="player-admin">
          <span class="pa-name">${roundLabel(m.round)}: ${teamFlag(m.home)} ${TEAMS[m.home]?.name || m.home} vs ${teamFlag(m.away)} ${TEAMS[m.away]?.name || m.away}<br><span class="muted small">cierra: ${cierre}</span></span>
          <button class="btn-danger btn-mini" data-del="${m.id}">🗑️</button>
        </div>`;
      }).join("")
    : '<p class="muted small">Aún no has agregado partidos de eliminatorias. Hazlo cuando se sepan los equipos de cada ronda.</p>';

  box.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm("¿Borrar este partido y sus pronósticos/resultado?")) return;
      try {
        await api("/api/admin/match/" + b.dataset.del, { method: "DELETE", headers: { "x-admin-pin": adminPin } });
        toast("Partido borrado 🗑️");
        await refreshState();
      } catch (e) { toast("⚠️ " + e.message); }
    })
  );
}

$("#addMatchBtn")?.addEventListener("click", async () => {
  if (!adminPin) return promptAdmin();
  const round = $("#amRound").value;
  const home = $("#amHome").value, away = $("#amAway").value;
  const dlLocal = $("#amDeadline").value;
  if (!home || !away) return toast("Elige los dos equipos");
  if (home === away) return toast("No puede ser el mismo equipo");
  let deadline = null;
  if (dlLocal) { const d = new Date(dlLocal); if (!isNaN(d)) deadline = d.toISOString(); }
  try {
    await api("/api/admin/match", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-pin": adminPin },
      body: JSON.stringify({ round, home, away, deadline }),
    });
    fireConfetti();
    toast("¡Partido agregado! ⚽");
    $("#amHome").value = ""; $("#amAway").value = ""; $("#amDeadline").value = "";
    await refreshState();
  } catch (e) { toast("⚠️ " + e.message); }
});

function renderAdminBonus() {
  const a = lastState.bonusAnswers || {};
  if ($("#abChamp")) $("#abChamp").innerHTML = teamOptions(a.champ);
  if ($("#abRunner")) $("#abRunner").innerHTML = teamOptions(a.runnerup);
  if ($("#abSurprise")) $("#abSurprise").innerHTML = teamOptions(a.surprise);
  if ($("#abScorer")) $("#abScorer").innerHTML = scorerOptions(a.scorer);
}
$("#saveBonusAns")?.addEventListener("click", async () => {
  if (!adminPin) return promptAdmin();
  try {
    await api("/api/admin/bonus", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-pin": adminPin },
      body: JSON.stringify({
        champ: $("#abChamp").value, runnerup: $("#abRunner").value,
        surprise: $("#abSurprise").value, scorer: $("#abScorer").value,
      }),
    });
    fireConfetti();
    toast("Respuestas del bonus guardadas 🏆");
    await refreshState();
  } catch (e) { toast("⚠️ " + e.message); }
});

$("#rdApply")?.addEventListener("click", async () => {
  if (!adminPin) return promptAdmin();
  const round = $("#rdRound").value;
  const dlLocal = $("#rdDeadline").value;
  let deadline = null;
  if (dlLocal) { const d = new Date(dlLocal); if (!isNaN(d)) deadline = d.toISOString(); }
  try {
    const r = await api("/api/admin/round-deadline", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-pin": adminPin },
      body: JSON.stringify({ round, deadline }),
    });
    toast(`Cierre aplicado a ${r.count} partido(s) ⏲️`);
    await refreshState();
  } catch (e) { toast("⚠️ " + e.message); }
});

$("#saveResults").addEventListener("click", async () => {
  if (!adminPin) return promptAdmin();
  const results = {};
  $$("#adminMatches .score-in").forEach((inp) => {
    const mid = inp.dataset.mid, side = inp.dataset.side;
    (results[mid] ||= {})[side] = inp.value === "" ? null : clampScore(inp.value);
  });
  $$("#adminMatches .winsel").forEach((sel) => {
    if (sel.value) (results[sel.dataset.mid] ||= {}).winner = sel.value;
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
  setInterval(() => { if (activeTab === "tabla" || activeTab === "bymatch") refreshState(); }, 8000);
  // Cuenta regresiva en vivo (cada segundo) mientras ves tu quiniela
  setInterval(() => { if (activeTab === "quiniela") renderDeadlineBanner(); }, 1000);
})();
