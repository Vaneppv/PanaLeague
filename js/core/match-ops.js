import db from "../db.js";

// Envuelve un request de IndexedDB en una promesa manteniendo la transacción viva.
function q(store, method, ...args) {
  return new Promise((resolve, reject) => {
    const req = store[method](...args);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Consulta un store por índice dentro de una transacción abierta.
function qIndex(store, indexName, value) {
  return new Promise((resolve, reject) => {
    const req = store.index(indexName).getAll(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// En el bracket, el partido (ronda r, posición p) alimenta al partido
// (ronda r+1, posición ⌊p/2⌋): slot local si p es par, visitante si es impar.
async function findNextMatch(store, match) {
  if (match.round == null || match.position == null) return null;
  const nextRound = match.round + 1;
  const nextPosition = Math.floor(match.position / 2);
  const matches = await qIndex(store, "leagueId", match.leagueId);
  return matches.find((m) => m.round === nextRound && m.position === nextPosition) || null;
}

// Suma el resultado de un partido a las estadísticas acumuladas de un equipo.
// `own` y `rival` son los puntos del equipo y de su oponente respectivamente.
// Puntuación: 3 por victoria, 1 por empate, 0 por derrota.
function applyTeamResult(team, own, rival) {
  const t = { ...team };
  t.pj = (t.pj || 0) + 1;
  t.pf = (t.pf || 0) + own;
  t.pc = (t.pc || 0) + rival;
  if (own > rival) {
    t.pg = (t.pg || 0) + 1;
    t.pts = (t.pts || 0) + 3;
  } else if (own < rival) {
    t.pp = (t.pp || 0) + 1;
  } else {
    t.pe = (t.pe || 0) + 1;
    t.pts = (t.pts || 0) + 1;
  }
  t.dif = t.pf - t.pc;
  return t;
}

// Operación inversa a applyTeamResult: resta el resultado del partido de las
// estadísticas acumuladas de un equipo (al deshacer un partido finalizado).
function revertTeamResult(team, own, rival) {
  const t = { ...team };
  t.pj = Math.max(0, (t.pj || 0) - 1);
  t.pf = Math.max(0, (t.pf || 0) - own);
  t.pc = Math.max(0, (t.pc || 0) - rival);
  if (own > rival) {
    t.pg = Math.max(0, (t.pg || 0) - 1);
    t.pts = Math.max(0, (t.pts || 0) - 3);
  } else if (own < rival) {
    t.pp = Math.max(0, (t.pp || 0) - 1);
  } else {
    t.pe = Math.max(0, (t.pe || 0) - 1);
    t.pts = Math.max(0, (t.pts || 0) - 1);
  }
  t.dif = t.pf - t.pc;
  return t;
}

// Cuenta las anotaciones de cada jugador en una lista de eventos.
// Devuelve un mapa `{ playerId: cantidad }`.
function countPlayerGoals(events) {
  const goals = {};
  events.forEach((ev) => {
    if (ev.playerId == null) return;
    goals[ev.playerId] = (goals[ev.playerId] || 0) + 1;
  });
  return goals;
}

/**
 * Operación de integridad: finaliza un partido en una sola transacción de
 * IndexedDB. Calcula el marcador a partir de los eventos registrados,
 * actualiza el partido, acumula las estadísticas de ambos equipos y de los
 * jugadores anotadores y, en modalidad eliminación directa, avanza al
 * ganador al slot correspondiente del partido de la siguiente ronda.
 *
 * @param {number} matchId
 * @param {{ declaredWinnerId?: number }} [opts]
 *   `declaredWinnerId` es obligatorio cuando el marcador empata en torneo.
 * @returns {Promise<object>} El partido finalizado.
 */
export async function finalizeMatch(matchId, { declaredWinnerId } = {}) {
  let finalized;

  await db.runTransaction(["leagues", "matches", "events", "players", "teams"], "readwrite", async (stores) => {
    const match = await q(stores.matches, "get", matchId);
    if (!match) throw new Error("El partido no existe.");
    if (match.status === "Finalizado") throw new Error("El partido ya está finalizado.");

    const league = await q(stores.leagues, "get", match.leagueId);
    const isTournament = league?.modalidad === "tournament";

    const events = await qIndex(stores.events, "matchId", matchId);

    // El marcador se computa contando los eventos de cada equipo.
    let homeScore = 0;
    let awayScore = 0;
    for (const ev of events) {
      const player = await q(stores.players, "get", ev.playerId);
      if (player?.teamId === match.homeTeamId) homeScore += 1;
      else if (player?.teamId === match.awayTeamId) awayScore += 1;
    }

    const updated = { ...match, status: "Finalizado", homeScore, awayScore };

    if (isTournament) {
      if (homeScore === awayScore) {
        if (!declaredWinnerId || (declaredWinnerId !== match.homeTeamId && declaredWinnerId !== match.awayTeamId)) {
          throw new Error("En eliminación directa un empate requiere declarar un ganador.");
        }
        updated.winnerId = declaredWinnerId;
      } else {
        updated.winnerId = homeScore > awayScore ? match.homeTeamId : match.awayTeamId;
      }

      await q(stores.matches, "put", updated);

      // Avance automático del ganador al siguiente partido, en la misma transacción.
      const nextMatch = await findNextMatch(stores.matches, match);
      if (nextMatch) {
        const slot = match.position % 2 === 0 ? "homeTeamId" : "awayTeamId";
        await q(stores.matches, "put", { ...nextMatch, [slot]: updated.winnerId });
      }
    } else {
      delete updated.winnerId;
      await q(stores.matches, "put", updated);
    }

    // 1) Acumular estadísticas de ambos equipos.
    const homeTeam = match.homeTeamId != null ? await q(stores.teams, "get", match.homeTeamId) : null;
    const awayTeam = match.awayTeamId != null ? await q(stores.teams, "get", match.awayTeamId) : null;
    if (homeTeam) await q(stores.teams, "put", applyTeamResult(homeTeam, homeScore, awayScore));
    if (awayTeam) await q(stores.teams, "put", applyTeamResult(awayTeam, awayScore, homeScore));

    // 2) Acumular estadísticas de los jugadores anotadores: +1 partido jugado
    //    y +1 punto por cada anotación del jugador en este partido.
    const playerGoals = countPlayerGoals(events);
    for (const [playerId, goals] of Object.entries(playerGoals)) {
      const player = await q(stores.players, "get", Number(playerId));
      if (!player) continue;
      await q(stores.players, "put", {
        ...player,
        pj: (player.pj || 0) + 1,
        points: (player.points || 0) + goals,
      });
    }

    finalized = updated;
  });

  return finalized;
}

/**
 * Operación de integridad inversa: deshace un partido finalizado en una sola
 * transacción. Revierte el estado, el marcador y las estadísticas acumuladas
 * de equipos y jugadores; conserva los eventos para poder volver a finalizarlo
 * y, en eliminación directa, limpia el slot del partido de la siguiente ronda
 * (vuelve a "Por definir") si aún está programado. Se rechaza si el partido
 * siguiente ya está finalizado.
 *
 * @param {number} matchId
 * @returns {Promise<object>} El partido restablecido a programado.
 */
export async function undoMatch(matchId) {
  let undone;

  await db.runTransaction(["leagues", "matches", "events", "players", "teams"], "readwrite", async (stores) => {
    const match = await q(stores.matches, "get", matchId);
    if (!match) throw new Error("El partido no existe.");
    if (match.status !== "Finalizado") throw new Error("El partido no está finalizado.");

    const league = await q(stores.leagues, "get", match.leagueId);
    const isTournament = league?.modalidad === "tournament";

    const updated = { ...match, status: "Programado", homeScore: null, awayScore: null };
    delete updated.winnerId;

    if (isTournament) {
      const nextMatch = await findNextMatch(stores.matches, match);

      // Restricción: no se puede deshacer si el partido de la siguiente
      // ronda ya fue finalizado (rompería la cadena del bracket).
      if (nextMatch && nextMatch.status === "Finalizado") {
        throw new Error(
          "No se puede deshacer este partido porque el partido de la siguiente ronda ya está finalizado. Deshaz primero ese partido.",
        );
      }

      await q(stores.matches, "put", updated);

      // Limpiar el slot del siguiente partido (volver a "Por definir").
      if (nextMatch) {
        const slot = match.position % 2 === 0 ? "homeTeamId" : "awayTeamId";
        await q(stores.matches, "put", { ...nextMatch, [slot]: null });
      }
    } else {
      await q(stores.matches, "put", updated);
    }

    // 1) Restar las estadísticas acumuladas a ambos equipos.
    const homeScore = match.homeScore ?? 0;
    const awayScore = match.awayScore ?? 0;
    const homeTeam = match.homeTeamId != null ? await q(stores.teams, "get", match.homeTeamId) : null;
    const awayTeam = match.awayTeamId != null ? await q(stores.teams, "get", match.awayTeamId) : null;
    if (homeTeam) await q(stores.teams, "put", revertTeamResult(homeTeam, homeScore, awayScore));
    if (awayTeam) await q(stores.teams, "put", revertTeamResult(awayTeam, awayScore, homeScore));

    // 2) Restar las anotaciones y el partido jugado de cada anotador.
    const events = await qIndex(stores.events, "matchId", matchId);
    const playerGoals = countPlayerGoals(events);
    for (const [playerId, goals] of Object.entries(playerGoals)) {
      const player = await q(stores.players, "get", Number(playerId));
      if (!player) continue;
      await q(stores.players, "put", {
        ...player,
        pj: Math.max(0, (player.pj || 0) - 1),
        points: Math.max(0, (player.points || 0) - goals),
      });
    }

    undone = updated;
  });

  return undone;
}
