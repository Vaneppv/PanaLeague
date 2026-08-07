export const SPORTS = {
  football: {
    id: "football",
    name: "Fútbol",
    eventName: "Gol",
    eventNamePlural: "Goles",
    gf: "GF",
    gc: "GC",
    scorers: "Goleadores",
    matchName: "Partido",
    teamName: "Equipo",
    icon: "⚽",
    colors: {
      primary: "#1a5c2a",
      secondary: "#ffffff",
    },
  },
  basketball: {
    id: "basketball",
    name: "Básquet",
    eventName: "Canasta",
    eventNamePlural: "Canastas",
    gf: "PF",
    gc: "PC",
    scorers: "Encestadores",
    matchName: "Partido",
    teamName: "Equipo",
    icon: "🏀",
    colors: {
      primary: "#c8102e",
      secondary: "#006bb6",
    },
  },
  tennis: {
    id: "tennis",
    name: "Tenis",
    eventName: "Punto",
    eventNamePlural: "Puntos",
    gf: "PF",
    gc: "PC",
    scorers: "Punteadores",
    matchName: "Partido",
    teamName: "Equipo",
    icon: "🎾",
    colors: {
      primary: "#d4f51c",
      secondary: "#3a3a3a",
    },
  },
};

const POSITIONS = {
  football: ["Portero", "Defensa", "Centrocampista", "Delantero"],
  basketball: ["Base", "Escolta", "Alero", "Ala-Pívot", "Pívot"],
  tennis: ["Individual", "Dobles"],
};

export function getSportTerms(sportId) {
  return SPORTS[sportId] || SPORTS.football;
}

export function getSportList() {
  return Object.values(SPORTS);
}

export function getPositions(sportId) {
  return POSITIONS[sportId] || [];
}
