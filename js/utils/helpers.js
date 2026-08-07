export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Nombre de la ronda según el número de equipos del torneo
// (16 → Octavos/Cuartos/Semifinal/Final, 8 → Cuartos/..., 4 → Semifinal/Final).
export function roundLabel(round, totalTeams) {
  if (round == null || !totalTeams) return "";
  const names = ["Octavos", "Cuartos", "Semifinal", "Final"];
  const totalRounds = Math.log2(totalTeams);
  if (!Number.isInteger(totalRounds) || totalRounds > names.length) return `Ronda ${round}`;
  const idx = round - 1 + (names.length - totalRounds);
  return names[idx] || `Ronda ${round}`;
}

export function generateRoundRobin(teams, totalRounds = 1) {
  if (teams.length < 2) return [];

  const ids = teams.map((t) => t.id);
  if (ids.length % 2 !== 0) ids.push(null);

  const n = ids.length;
  const roundsPerLeg = n - 1;
  const matches = [];

  for (let leg = 0; leg < totalRounds; leg++) {
    for (let r = 0; r < roundsPerLeg; r++) {
      for (let i = 0; i < n / 2; i++) {
        const home = ids[i];
        const away = ids[n - 1 - i];
        if (home !== null && away !== null) {
          matches.push({
            round: r + 1 + leg * roundsPerLeg,
            home: leg % 2 === 0 ? home : away,
            away: leg % 2 === 0 ? away : home,
          });
        }
      }
      const last = ids.pop();
      ids.splice(1, 0, last);
    }
  }

  return matches;
}

export function generateBracket(teams) {
  if (teams.length < 2) return [];

  const teamIds = teams.map((t) => t.id);
  const n = teamIds.length;

  // El bracket requiere un número de equipos potencia de 2 (4, 8 o 16).
  if (!Number.isInteger(Math.log2(n)) || n < 4) {
    throw new Error("El número de equipos debe ser potencia de 2 (4, 8 o 16).");
  }

  const totalSlots = n;
  const numRounds = Math.log2(totalSlots);
  const byes = 0;

  const matches = [];

  const round1Teams = teamIds.slice(byes);
  for (let i = 0; i < round1Teams.length / 2; i++) {
    matches.push({
      round: 1,
      position: i,
      homeTeamId: round1Teams[i],
      awayTeamId: round1Teams[round1Teams.length - 1 - i],
      status: "Programado",
      homeScore: null,
      awayScore: null,
    });
  }

  for (let r = 1; r < numRounds; r++) {
    const matchesInRound = totalSlots / Math.pow(2, r + 1);
    for (let p = 0; p < matchesInRound; p++) {
      let home = null;
      let away = null;
      if (r === 1) {
        const slotIdx = p * 2;
        if (slotIdx < byes) home = teamIds[slotIdx];
        if (slotIdx + 1 < byes) away = teamIds[slotIdx + 1];
      }
      matches.push({
        round: r + 1,
        position: p,
        homeTeamId: home,
        awayTeamId: away,
        status: "Programado",
        homeScore: null,
        awayScore: null,
      });
    }
  }

  return matches;
}
