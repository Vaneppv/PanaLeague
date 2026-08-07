import db from "../db.js";

// Envuelve un request de IndexedDB en una promesa manteniendo la transacción viva.
function q(store, method, ...args) {
  return new Promise((resolve, reject) => {
    const req = store[method](...args);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Nombre de archivo seguro a partir del nombre de la liga.
function safeFilename(name) {
  return (name || "liga").replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase();
}

// Valida la estructura mínima de un archivo exportado.
function validateStructure(json) {
  if (!json || typeof json !== "object") throw new Error("Archivo inválido.");
  if (json.app !== "leaguehub" || !json.league) {
    throw new Error("El archivo no es una liga exportada de PanaLeague.");
  }
  for (const key of ["teams", "players", "matches", "events"]) {
    if (!Array.isArray(json[key])) {
      throw new Error(`El archivo no contiene la estructura esperada (${key}).`);
    }
  }
}

/**
 * Exporta una liga completa (liga, equipos, jugadores, partidos y eventos)
 * a un archivo JSON descargable. La estructura exportada es la misma que
 * espera `importLeague` para restaurarla.
 *
 * @param {number} leagueId
 */
export async function exportLeague(leagueId) {
  const league = await db.getById("leagues", leagueId);
  if (!league) throw new Error("La liga no existe.");

  const [teams, matches] = await Promise.all([
    db.getByIndex("teams", "leagueId", leagueId),
    db.getByIndex("matches", "leagueId", leagueId),
  ]);

  const players = [];
  for (const t of teams) {
    players.push(...(await db.getByIndex("players", "teamId", t.id)));
  }

  const events = [];
  for (const m of matches) {
    events.push(...(await db.getByIndex("events", "matchId", m.id)));
  }

  const payload = {
    app: "leaguehub",
    version: 1,
    exportedAt: new Date().toISOString(),
    league,
    teams,
    players,
    matches,
    events,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `liga-${safeFilename(league.name)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Importa una liga desde un objeto JSON exportado. Valida la estructura,
 * re-mapea los IDs (autoincrementales) y persiste todo en una sola
 * transacción. Si el nombre ya existe, se puede pasar un nombre alternativo
 * en `opts.rename`; sin él, se lanza un error con `code === "NAME_CONFLICT"`.
 *
 * @param {object} json Objeto con la estructura exportada.
 * @param {{ rename?: string }} [opts] Nombre alternativo si ya existe.
 * @returns {Promise<number>} El id de la liga importada.
 */
export async function importLeague(json, { rename } = {}) {
  validateStructure(json);

  const leagueName = (rename || json.league.name).trim();
  if (!leagueName) throw new Error("La liga debe tener un nombre.");

  const existing = await db.getByIndex("leagues", "name", leagueName);
  if (existing.length > 0) {
    const err = new Error("Ya existe una liga con ese nombre.");
    err.code = "NAME_CONFLICT";
    throw err;
  }

  let leagueId = null;

  await db.runTransaction(
    ["leagues", "teams", "players", "matches", "events"],
    "readwrite",
    async (stores) => {
      const { league, teams, players, matches, events } = json;

      // La liga importada nunca llega como liga activa.
      const { id: _leagueId, ...leagueRest } = league;
      leagueId = await q(stores.leagues, "add", {
        ...leagueRest,
        name: leagueName,
        isActive: false,
      });

      // Equipos con ids re-mapeados (los nuevos son autoincrementales).
      const teamIdMap = {};
      for (const t of teams) {
        const { id: _oldId, ...teamRest } = t;
        const newId = await q(stores.teams, "add", { ...teamRest, leagueId });
        teamIdMap[t.id] = newId;
      }

      // Jugadores con teamId re-mapeado.
      const playerIdMap = {};
      for (const p of players) {
        const { id: _oldId, ...playerRest } = p;
        const newId = await q(stores.players, "add", {
          ...playerRest,
          teamId: teamIdMap[p.teamId],
        });
        playerIdMap[p.id] = newId;
      }

      // Partidos con ids de equipos re-mapeados (mantiene bracket/winnerId).
      const matchIdMap = {};
      for (const m of matches) {
        const { id: _oldId, ...matchRest } = m;
        const newId = await q(stores.matches, "add", {
          ...matchRest,
          leagueId,
          homeTeamId: m.homeTeamId != null ? teamIdMap[m.homeTeamId] : null,
          awayTeamId: m.awayTeamId != null ? teamIdMap[m.awayTeamId] : null,
          winnerId: m.winnerId != null ? teamIdMap[m.winnerId] : null,
        });
        matchIdMap[m.id] = newId;
      }

      // Eventos con ids de partido y jugador re-mapeados.
      for (const ev of events) {
        const { id: _oldId, ...eventRest } = ev;
        await q(stores.events, "add", {
          ...eventRest,
          matchId: matchIdMap[ev.matchId],
          playerId: playerIdMap[ev.playerId],
        });
      }
    },
  );

  return leagueId;
}
