/* ============================================================
   Datos + lógica compartida (Node y navegador)
   - TEAMS:   equipos con su bandera (emoji)
   - MATCHES: partidos a pronosticar
   - JOKES:   chistes que rotan en el encabezado
   - scoreMatch / sign: puntuación oficial
   Edita libremente la lista de partidos según el fixture real.
   ============================================================ */
(function (root, factory) {
  const data = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = data; // Node (servidor)
  } else {
    // Navegador: expone como globales
    root.TEAMS = data.TEAMS;
    root.MATCHES = data.MATCHES;
    root.JOKES = data.JOKES;
    root.scoreMatch = data.scoreMatch;
    root.DEADLINE = data.DEADLINE;
  }
})(typeof self !== "undefined" ? self : this, function () {

  /* ---------- Cierre de la quiniela ----------
     Se puede EDITAR la quiniela hasta esta fecha/hora. Después se bloquea.
     El Mundial 2026 arranca el 11 de junio de 2026, así que dejamos editar
     hasta el día antes (se cierra el 11 a las 00:00, hora de Venezuela, UTC-4).
     👉 Cambia esta fecha si quieres otro cierre. Formato ISO con zona horaria.
     (En el servidor también puedes sobrescribirla con la variable QUINIELA_DEADLINE.) */
  const DEADLINE = "2026-06-11T00:00:00-04:00";

  const TEAMS = {
    ARG: { name: "Argentina",      flag: "🇦🇷" },
    BRA: { name: "Brasil",         flag: "🇧🇷" },
    FRA: { name: "Francia",        flag: "🇫🇷" },
    ESP: { name: "España",         flag: "🇪🇸" },
    ENG: { name: "Inglaterra",     flag: "🏴" },
    GER: { name: "Alemania",       flag: "🇩🇪" },
    POR: { name: "Portugal",       flag: "🇵🇹" },
    NED: { name: "Países Bajos",   flag: "🇳🇱" },
    URU: { name: "Uruguay",        flag: "🇺🇾" },
    COL: { name: "Colombia",       flag: "🇨🇴" },
    USA: { name: "Estados Unidos", flag: "🇺🇸" },
    MEX: { name: "México",         flag: "🇲🇽" },
    CAN: { name: "Canadá",         flag: "🇨🇦" },
    BEL: { name: "Bélgica",        flag: "🇧🇪" },
    CRO: { name: "Croacia",        flag: "🇭🇷" },
    MAR: { name: "Marruecos",      flag: "🇲🇦" },
    JPN: { name: "Japón",          flag: "🇯🇵" },
    SEN: { name: "Senegal",        flag: "🇸🇳" },
    ECU: { name: "Ecuador",        flag: "🇪🇨" },
    VEN: { name: "Venezuela",      flag: "🇻🇪" },
    CHI: { name: "Chile",          flag: "🇨🇱" },
    PER: { name: "Perú",           flag: "🇵🇪" },
    KOR: { name: "Corea del Sur",  flag: "🇰🇷" },
    AUS: { name: "Australia",      flag: "🇦🇺" },
  };

  /* Partidos a pronosticar. id único. home/away son claves de TEAMS. */
  const MATCHES = [
    { id: "m1",  group: "A", home: "MEX", away: "VEN" },
    { id: "m2",  group: "A", home: "USA", away: "CAN" },
    { id: "m3",  group: "B", home: "ARG", away: "CHI" },
    { id: "m4",  group: "B", home: "BRA", away: "PER" },
    { id: "m5",  group: "C", home: "FRA", away: "SEN" },
    { id: "m6",  group: "C", home: "ESP", away: "MAR" },
    { id: "m7",  group: "D", home: "ENG", away: "USA" },
    { id: "m8",  group: "D", home: "GER", away: "JPN" },
    { id: "m9",  group: "E", home: "POR", away: "URU" },
    { id: "m10", group: "E", home: "NED", away: "ECU" },
    { id: "m11", group: "F", home: "BEL", away: "CRO" },
    { id: "m12", group: "F", home: "COL", away: "KOR" },
    { id: "m13", group: "G", home: "ARG", away: "BRA" },
    { id: "m14", group: "G", home: "FRA", away: "ESP" },
    { id: "m15", group: "H", home: "ENG", away: "GER" },
    { id: "m16", group: "H", home: "POR", away: "NED" },
  ];

  const JOKES = [
    "¿Por qué los pollos no juegan fútbol? Porque hacen fa-CACAREO al arco. 🐔",
    "Mi quiniela va tan mal que hasta el VAR me tiene lástima. 📺",
    "Dicen que el dinero no da la felicidad… pero ganar la quiniela tampoco está mal. 💰",
    "Pronostiqué un empate y hasta el balón se quedó quieto del aburrimiento. ⚽😴",
    "El arquero tan malo que hasta el himno le metió gol. 🥅",
    "Le pregunté a mi corazón qué equipo gana… y me mandó al cardiólogo. ❤️",
    "Voy a pronosticar con la cabeza… y por eso siempre pierdo. 🧠",
    "Si fallar pronósticos diera puntos, yo sería campeón mundial. 🏆",
    "El comprobante de pago: el único gol seguro de esta quiniela. 💸",
    "Mi defensa es como mi internet: se cae en el peor momento. 📶",
    "¿Penal? Yo tiro como cobro: para afuera. 🚀",
    "Dicen que la suerte es ciega… por eso siempre me ve a mí de lejos. 🍀",
  ];

  /* ---------- Puntuación oficial ----------
     5 pts: resultado y goles exactos de ambos
     4 pts: pega el resultado y los goles de UN equipo
     3 pts: pega solo el resultado (ganador/empate)
     1 pt : pega goles de un equipo pero NO el resultado
     0 pts: nada de nada (un coño) */
  function sign(h, a) { return h > a ? 1 : h < a ? -1 : 0; }

  function scoreMatch(pred, real) {
    if (!pred || pred.h == null || pred.a == null) return 0;
    if (!real || real.h == null || real.a == null) return 0;
    if (pred.h === real.h && pred.a === real.a) return 5;
    const sameResult = sign(pred.h, pred.a) === sign(real.h, real.a);
    const oneGoalHit = pred.h === real.h || pred.a === real.a;
    if (sameResult && oneGoalHit) return 4;
    if (sameResult) return 3;
    if (oneGoalHit) return 1;
    return 0;
  }

  return { TEAMS, MATCHES, JOKES, scoreMatch, DEADLINE };
});
