import db from "./db.js";

const SAMPLE_LEAGUE_NAMES = ["Liga Fútbol Ejemplo", "Liga Básquet Bracket"];

// Helper que envuelve una operación de object store en una promesa,
// manteniendo la transacción abierta mientras se encadenan requests.
function q(store, method, ...args) {
  return new Promise((resolve, reject) => {
    const req = store[method](...args);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Fecha relativa a hoy en formato ISO (comparable lexicográficamente).
function iso(daysFromNow) {
  return new Date(Date.now() + daysFromNow * 86400000).toISOString();
}

const LEAGUE1 = {
  name: "Liga Fútbol Ejemplo",
  sport: "football",
  modalidad: "league",
  temporada: "2026-I",
  description: "Liga plantilla para probar el modo liga (todos contra todos).",
  rounds: 1,
  isActive: false,
  createdAt: Date.now(),
};

const LEAGUE1_TEAMS = [
  { name: "Los Rojos", escudo: "", colorPrincipal: "#dc2626", colorSecundario: "#7f1d1d", ciudad: "Lima" },
  { name: "Atlético Verde", escudo: "", colorPrincipal: "#16a34a", colorSecundario: "#14532d", ciudad: "Arequipa" },
  { name: "Celeste FC", escudo: "", colorPrincipal: "#0284c7", colorSecundario: "#0c4a6e", ciudad: "Cusco" },
  { name: "Rayos Dorados", escudo: "", colorPrincipal: "#d97706", colorSecundario: "#78350f", ciudad: "Trujillo" },
];

const LEAGUE1_PLAYERS = [
  { teamIdx: 0, name: "Mario Luna", position: "Delantero", number: 9 },
  { teamIdx: 0, name: "Pablo Ríos", position: "Portero", number: 1 },
  { teamIdx: 1, name: "Diego Sotil", position: "Delantero", number: 10 },
  { teamIdx: 1, name: "Luis Campos", position: "Centrocampista", number: 8 },
  { teamIdx: 2, name: "Juan Mita", position: "Delantero", number: 11 },
  { teamIdx: 2, name: "Raúl Quispe", position: "Defensa", number: 4 },
  { teamIdx: 3, name: "Alan Torres", position: "Centrocampista", number: 6 },
  { teamIdx: 3, name: "Iván Ccopa", position: "Portero", number: 1 },
];

const LEAGUE1_MATCHES = [
  { home: 0, away: 1, date: iso(-6), status: "Finalizado", homeScore: 2, awayScore: 1, round: 1, position: 0, events: [{ player: 0, minute: 15 }, { player: 0, minute: 70 }, { player: 2, minute: 55 }] },
  { home: 2, away: 3, date: iso(-5), status: "Finalizado", homeScore: 1, awayScore: 1, round: 1, position: 1, events: [{ player: 4, minute: 30 }, { player: 6, minute: 80 }] },
  { home: 3, away: 0, date: iso(-4), status: "Finalizado", homeScore: 0, awayScore: 2, round: 1, position: 2, events: [{ player: 0, minute: 12 }, { player: 0, minute: 44 }] },
  { home: 1, away: 2, date: iso(-3), status: "Finalizado", homeScore: 2, awayScore: 2, round: 1, position: 3, events: [{ player: 2, minute: 20 }, { player: 3, minute: 80 }, { player: 4, minute: 35 }, { player: 5, minute: 88 }] },
  { home: 0, away: 2, date: iso(2), status: "Programado", homeScore: null, awayScore: null, round: 1, position: 4, events: [] },
  { home: 1, away: 3, date: iso(4), status: "Programado", homeScore: null, awayScore: null, round: 1, position: 5, events: [] },
];

const LEAGUE2 = {
  name: "Liga Básquet Bracket",
  sport: "basketball",
  modalidad: "tournament",
  temporada: "2026-I",
  description: "Liga plantilla para probar el modo eliminación directa.",
  isActive: false,
  createdAt: Date.now(),
};

const LEAGUE2_TEAMS = [
  { name: "Tigres de Lince", escudo: "", colorPrincipal: "#c8102e", colorSecundario: "#006bb6", ciudad: "Lince" },
  { name: "Dragones Rojos", escudo: "", colorPrincipal: "#e11d48", colorSecundario: "#0ea5e9", ciudad: "San Borja" },
  { name: "Lobos del Sur", escudo: "", colorPrincipal: "#7c3aed", colorSecundario: "#1e293b", ciudad: "Surco" },
  { name: "Halcones Negros", escudo: "", colorPrincipal: "#0f172a", colorSecundario: "#facc15", ciudad: "Miraflores" },
];

const LEAGUE2_PLAYERS = [
  { teamIdx: 0, name: "Marco Salas", position: "Base", number: 4 },
  { teamIdx: 0, name: "Bruno Vega", position: "Pívot", number: 15 },
  { teamIdx: 1, name: "César Palacios", position: "Escolta", number: 7 },
  { teamIdx: 1, name: "Renzo Alarcón", position: "Alero", number: 12 },
  { teamIdx: 2, name: "Félix Ñahui", position: "Pívot", number: 20 },
  { teamIdx: 2, name: "Paulo Huerta", position: "Base", number: 5 },
  { teamIdx: 3, name: "Jorge Ríos", position: "Alero", number: 8 },
  { teamIdx: 3, name: "Cristian Soto", position: "Escolta", number: 10 },
];

const LEAGUE2_MATCHES = [
  { home: 0, away: 1, date: iso(-7), status: "Finalizado", homeScore: 62, awayScore: 58, round: 1, position: 0, events: [{ player: 0, minute: 5 }, { player: 0, minute: 22 }, { player: 1, minute: 30 }, { player: 2, minute: 12 }, { player: 3, minute: 40 }] },
  { home: 2, away: 3, date: iso(-6), status: "Finalizado", homeScore: 55, awayScore: 60, round: 1, position: 1, events: [{ player: 4, minute: 8 }, { player: 4, minute: 25 }, { player: 5, minute: 18 }, { player: 6, minute: 33 }, { player: 7, minute: 15 }, { player: 7, minute: 44 }] },
  { home: 0, away: 3, date: iso(-2), status: "Finalizado", homeScore: 61, awayScore: 57, round: 2, position: 0, events: [{ player: 0, minute: 6 }, { player: 0, minute: 28 }, { player: 1, minute: 33 }, { player: 6, minute: 12 }, { player: 6, minute: 41 }, { player: 7, minute: 19 }] },
];

async function insertLeague(stores, league, teams, players, matches) {
  const leagueId = await q(stores.leagues, "add", league);

  const teamIds = [];
  for (const t of teams) {
    teamIds.push(await q(stores.teams, "add", { ...t, leagueId }));
  }

  const playerIds = [];
  for (const p of players) {
    const { teamIdx, ...rest } = p;
    playerIds.push(await q(stores.players, "add", { ...rest, teamId: teamIds[teamIdx] }));
  }

  const matchIds = [];
  for (const m of matches) {
    matchIds.push(
      await q(stores.matches, "add", {
        leagueId,
        homeTeamId: teamIds[m.home],
        awayTeamId: teamIds[m.away],
        date: m.date,
        status: m.status,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        round: m.round,
        position: m.position,
      })
    );
  }

  for (let i = 0; i < matches.length; i++) {
    const events = matches[i].events || [];
    for (const ev of events) {
      await q(stores.events, "add", {
        matchId: matchIds[i],
        playerId: playerIds[ev.player],
        minute: ev.minute,
      });
    }
  }
}

/**
 * Inserta las ligas plantilla de ejemplo en una sola transacción.
 * @returns {Promise<{loaded: boolean}>} `loaded: false` si ya existen.
 */
export async function loadSampleData() {
  const existing = await db.getByIndex("leagues", "name", SAMPLE_LEAGUE_NAMES[0]);
  if (existing.length > 0) {
    return { loaded: false };
  }

  await db.runTransaction(
    ["leagues", "teams", "players", "matches", "events"],
    "readwrite",
    async (stores) => {
      await insertLeague(stores, LEAGUE1, LEAGUE1_TEAMS, LEAGUE1_PLAYERS, LEAGUE1_MATCHES);
      await insertLeague(stores, LEAGUE2, LEAGUE2_TEAMS, LEAGUE2_PLAYERS, LEAGUE2_MATCHES);
    }
  );

  return { loaded: true };
}
