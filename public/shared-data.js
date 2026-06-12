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
    root.CUOTA = data.CUOTA;
    root.MONEDA = data.MONEDA;
    root.BONUS = data.BONUS;
    root.GOLEADORES = data.GOLEADORES;
    root.OVERRIDE = data.OVERRIDE;
  }
})(typeof self !== "undefined" ? self : this, function () {

  /* ---------- Cierre de la quiniela ----------
     Se puede EDITAR la quiniela hasta esta fecha/hora. Después se bloquea.
     El Mundial 2026 arranca el 11 de junio de 2026, así que dejamos editar
     hasta el día antes (se cierra el 11 a las 00:00, hora de Venezuela, UTC-4).
     👉 Cambia esta fecha si quieres otro cierre. Formato ISO con zona horaria.
     (En el servidor también puedes sobrescribirla con la variable QUINIELA_DEADLINE.) */
  const DEADLINE = "2026-06-11T12:00:00-04:00";

  /* ---------- El Pozo (premio) ----------
     Cuánto paga cada jugador y el símbolo de la moneda. El bote se calcula
     automáticamente: (jugadores que pagaron) x CUOTA. 👉 Cámbialo a tu gusto. */
  const CUOTA = 15;
  const MONEDA = "$";

  /* ---------- Puntos extra (bonus) ----------
     Aciertos del torneo completo (se pronostican antes de que arranque).
     👉 Cambia los valores a tu gusto. */
  const BONUS = { champ: 10, runnerup: 6, scorer: 8, surprise: 5 };

  /* ---------- Acceso especial (desbloqueo temporal) ----------
     Permite que ciertos jugadores SIGAN llenando su quiniela aunque ya cerró,
     pero SOLO en partidos que aún no se han jugado (sin resultado cargado).
     - users: nombres EXACTOS con que se registraron.
     - until: hasta cuándo dura el permiso (fecha/hora ISO con zona horaria).
     Vacío / null = nadie. Ej: { users: ["María"], until: "2026-06-11T20:00:00-04:00" } */
  const OVERRIDE = { users: [], until: null };

  /* ---------- Candidatos a Goleador (Botín de Oro) ----------
     Lista desplegable para que jugador y admin elijan EXACTAMENTE lo mismo
     (así nunca falla por cómo se escriba el nombre).
     👉 Agrega o quita nombres a tu gusto ANTES de que arranque el Mundial. */
  const GOLEADORES = [
    "Kylian Mbappé (Francia)", "Ousmane Dembélé (Francia)",
    "Lionel Messi (Argentina)", "Lautaro Martínez (Argentina)", "Julián Álvarez (Argentina)",
    "Vinícius Jr (Brasil)", "Rodrygo (Brasil)", "Raphinha (Brasil)", "Endrick (Brasil)",
    "Lamine Yamal (España)", "Álvaro Morata (España)", "Pedri (España)", "Dani Olmo (España)",
    "Harry Kane (Inglaterra)", "Jude Bellingham (Inglaterra)", "Phil Foden (Inglaterra)", "Bukayo Saka (Inglaterra)",
    "Cristiano Ronaldo (Portugal)", "Bruno Fernandes (Portugal)", "Rafael Leão (Portugal)",
    "Cody Gakpo (Países Bajos)", "Memphis Depay (Países Bajos)",
    "Florian Wirtz (Alemania)", "Kai Havertz (Alemania)", "Niclas Füllkrug (Alemania)",
    "Romelu Lukaku (Bélgica)", "Loïs Openda (Bélgica)", "Kevin De Bruyne (Bélgica)",
    "Darwin Núñez (Uruguay)",
    "Luis Díaz (Colombia)", "James Rodríguez (Colombia)", "Jhon Durán (Colombia)",
    "Raúl Jiménez (México)", "Santiago Giménez (México)",
    "Christian Pulisic (Estados Unidos)", "Folarin Balogun (Estados Unidos)",
    "Erling Haaland (Noruega)",
    "Viktor Gyökeres (Suecia)", "Alexander Isak (Suecia)",
    "Youssef En-Nesyri (Marruecos)", "Achraf Hakimi (Marruecos)",
    "Takefusa Kubo (Japón)", "Kaoru Mitoma (Japón)",
    "Son Heung-min (Corea del Sur)",
    "Mohamed Salah (Egipto)",
    "Mehdi Taremi (Irán)",
    "Enner Valencia (Ecuador)",
    "Breel Embolo (Suiza)",
    "Sébastien Haller (Costa de Marfil)",
  ];

  /* ---------- Equipos (sorteo final del 5 de diciembre de 2025) ---------- */
  const TEAMS = {
    // Grupo A
    MEX: { name: "México",            flag: "🇲🇽" },
    RSA: { name: "Sudáfrica",         flag: "🇿🇦" },
    KOR: { name: "Corea del Sur",     flag: "🇰🇷" },
    CZE: { name: "Chequia",           flag: "🇨🇿" },
    // Grupo B
    CAN: { name: "Canadá",            flag: "🇨🇦" },
    BIH: { name: "Bosnia y Herzeg.",  flag: "🇧🇦" },
    QAT: { name: "Catar",             flag: "🇶🇦" },
    SUI: { name: "Suiza",             flag: "🇨🇭" },
    // Grupo C
    BRA: { name: "Brasil",            flag: "🇧🇷" },
    MAR: { name: "Marruecos",         flag: "🇲🇦" },
    HAI: { name: "Haití",             flag: "🇭🇹" },
    SCO: { name: "Escocia",           flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
    // Grupo D
    USA: { name: "Estados Unidos",    flag: "🇺🇸" },
    PAR: { name: "Paraguay",          flag: "🇵🇾" },
    AUS: { name: "Australia",         flag: "🇦🇺" },
    TUR: { name: "Turquía",           flag: "🇹🇷" },
    // Grupo E
    GER: { name: "Alemania",          flag: "🇩🇪" },
    CUW: { name: "Curazao",           flag: "🇨🇼" },
    CIV: { name: "Costa de Marfil",   flag: "🇨🇮" },
    ECU: { name: "Ecuador",           flag: "🇪🇨" },
    // Grupo F
    NED: { name: "Países Bajos",      flag: "🇳🇱" },
    JPN: { name: "Japón",             flag: "🇯🇵" },
    SWE: { name: "Suecia",            flag: "🇸🇪" },
    TUN: { name: "Túnez",             flag: "🇹🇳" },
    // Grupo G
    BEL: { name: "Bélgica",           flag: "🇧🇪" },
    EGY: { name: "Egipto",            flag: "🇪🇬" },
    IRN: { name: "Irán",              flag: "🇮🇷" },
    NZL: { name: "Nueva Zelanda",     flag: "🇳🇿" },
    // Grupo H
    ESP: { name: "España",            flag: "🇪🇸" },
    CPV: { name: "Cabo Verde",        flag: "🇨🇻" },
    KSA: { name: "Arabia Saudita",    flag: "🇸🇦" },
    URU: { name: "Uruguay",           flag: "🇺🇾" },
    // Grupo I
    FRA: { name: "Francia",           flag: "🇫🇷" },
    SEN: { name: "Senegal",           flag: "🇸🇳" },
    IRQ: { name: "Irak",              flag: "🇮🇶" },
    NOR: { name: "Noruega",           flag: "🇳🇴" },
    // Grupo J
    ARG: { name: "Argentina",         flag: "🇦🇷" },
    ALG: { name: "Argelia",           flag: "🇩🇿" },
    AUT: { name: "Austria",           flag: "🇦🇹" },
    JOR: { name: "Jordania",          flag: "🇯🇴" },
    // Grupo K
    POR: { name: "Portugal",          flag: "🇵🇹" },
    COD: { name: "RD Congo",          flag: "🇨🇩" },
    UZB: { name: "Uzbekistán",        flag: "🇺🇿" },
    COL: { name: "Colombia",          flag: "🇨🇴" },
    // Grupo L
    ENG: { name: "Inglaterra",        flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
    CRO: { name: "Croacia",           flag: "🇭🇷" },
    GHA: { name: "Ghana",             flag: "🇬🇭" },
    PAN: { name: "Panamá",            flag: "🇵🇦" },
  };

  /* ---------- Grupos del Mundial 2026 (orden de cabezas de serie) ---------- */
  const GROUPS = {
    A: ["MEX", "RSA", "KOR", "CZE"],
    B: ["CAN", "BIH", "QAT", "SUI"],
    C: ["BRA", "MAR", "HAI", "SCO"],
    D: ["USA", "PAR", "AUS", "TUR"],
    E: ["GER", "CUW", "CIV", "ECU"],
    F: ["NED", "JPN", "SWE", "TUN"],
    G: ["BEL", "EGY", "IRN", "NZL"],
    H: ["ESP", "CPV", "KSA", "URU"],
    I: ["FRA", "SEN", "IRQ", "NOR"],
    J: ["ARG", "ALG", "AUT", "JOR"],
    K: ["POR", "COD", "UZB", "COL"],
    L: ["ENG", "CRO", "GHA", "PAN"],
  };

  /* Los 6 partidos de cada grupo (todas las combinaciones). 12 grupos x 6 = 72. */
  const PAIRINGS = [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]];
  const MATCHES = [];
  for (const [g, teams] of Object.entries(GROUPS)) {
    PAIRINGS.forEach(([i, j], n) => {
      MATCHES.push({ id: `${g}${n + 1}`, group: g, home: teams[i], away: teams[j] });
    });
  }

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

  return { TEAMS, MATCHES, JOKES, scoreMatch, DEADLINE, CUOTA, MONEDA, BONUS, GOLEADORES, OVERRIDE };
});
