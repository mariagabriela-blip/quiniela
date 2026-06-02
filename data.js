/* ============================================================
   Datos de la Quiniela del Mundial
   - TEAMS: equipos con su bandera (emoji)
   - MATCHES: partidos a pronosticar
   - JOKES: chistes que rotan en el encabezado
   Edita libremente esta lista de partidos según el fixture real.
   ============================================================ */

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

/* Partidos a pronosticar. id debe ser único.
   home/away son claves de TEAMS. */
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
