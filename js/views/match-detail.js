import db from "../db.js";
import "../components/event-form.js";
import "../components/confirm-dialog.js";
import { finalizeMatch, undoMatch } from "../core/match-ops.js";
import { getSportTerms } from "../sports-terms.js";
import { formatDate, roundLabel } from "../utils/helpers.js";
import { showToast } from "../components/toast.js";

/**
 * MatchDetailView: cabecera del partido, registro de eventos y las
 * operaciones transaccionales de finalizar / deshacer partido (V-08).
 */
export class MatchDetailView {
  constructor({ router, id }) {
    this.router = router;
    this.id = id;
    this.container = null;
  }

  mount(container) {
    this.container = container;
    container.innerHTML = `
      <button class="btn btn-secondary back-link" id="back-btn">← Volver</button>
      <loading-state message="Cargando partido..."></loading-state>
    `;
    container
      .querySelector("#back-btn")
      .addEventListener("click", () => this.router.navigateTo("/matches"));
    this.render();
  }

  async render() {
    const container = this.container;
    if (!container) return;

    const match = await db.getById("matches", Number(this.id));
    if (!match) {
      container.innerHTML = `<div class="empty-state"><p>Partido no encontrado.</p></div>`;
      return;
    }

    const league = await db.getById("leagues", match.leagueId);
    const terms = getSportTerms(league?.sport);
    const isTournament = league?.modalidad === "tournament";

    const [homeTeam, awayTeam, allTeams] = await Promise.all([
      db.getById("teams", match.homeTeamId),
      db.getById("teams", match.awayTeamId),
      db.getByIndex("teams", "leagueId", match.leagueId),
    ]);

    const [homePlayers, awayPlayers] = await Promise.all([
      homeTeam ? db.getByIndex("players", "teamId", homeTeam.id) : [],
      awayTeam ? db.getByIndex("players", "teamId", awayTeam.id) : [],
    ]);

    const events = await db.getByIndex("events", "matchId", Number(this.id));

    const playerById = {};
    [...homePlayers, ...awayPlayers].forEach((p) => (playerById[p.id] = p));

    const { homeScore, awayScore } = this.#computeScore(
      events,
      playerById,
      homeTeam?.id,
      awayTeam?.id,
    );

    const loader = container.querySelector("loading-state");
    if (loader) loader.remove();

    const section = document.createElement("section");
    section.className = "match-detail";

    section.appendChild(
      this.#buildHeader(match, homeTeam, awayTeam, league, allTeams.length, homeScore, awayScore),
    );

    if (match.status === "Finalizado") {
      section.appendChild(this.#buildUndo(match));
    } else {
      section.appendChild(
        this.#buildEvents(match, homeTeam, awayTeam, homePlayers, awayPlayers, events, playerById, terms, homeScore, awayScore),
      );
      section.appendChild(
        this.#buildActions(match, homeTeam, awayTeam, homeScore, awayScore, isTournament),
      );
    }

    container.appendChild(section);
  }

  // Marcador actual computado contando los eventos de cada equipo.
  #computeScore(events, playerById, homeTeamId, awayTeamId) {
    let homeScore = 0;
    let awayScore = 0;
    events.forEach((ev) => {
      const teamId = playerById[ev.playerId]?.teamId;
      if (teamId === homeTeamId) homeScore += 1;
      else if (teamId === awayTeamId) awayScore += 1;
    });
    return { homeScore, awayScore };
  }

  #buildHeader(match, homeTeam, awayTeam, league, totalTeams, homeScore, awayScore) {
    const header = document.createElement("div");
    header.className = "match-header";

    const title = document.createElement("h1");
    title.textContent = `${homeTeam?.name || "Por definir"} vs ${awayTeam?.name || "Por definir"}`;
    header.appendChild(title);

    const meta = document.createElement("p");
    meta.className = "match-meta";
    const parts = [
      match.date ? formatDate(match.date) : "Sin fecha",
      match.status,
      league?.modalidad === "tournament" ? roundLabel(match.round, totalTeams) : "",
    ];
    meta.textContent = parts.filter(Boolean).join(" · ");
    header.appendChild(meta);

    if (match.status === "Finalizado") {
      const hero = document.createElement("div");
      hero.className = "match-hero";
      hero.textContent = `${match.homeScore} - ${match.awayScore}`;
      header.appendChild(hero);

      if (match.winnerId) {
        const winner = document.createElement("p");
        winner.className = "match-winner";
        const winnerName =
          match.winnerId === match.homeTeamId ? homeTeam?.name : awayTeam?.name;
        winner.textContent = `Ganador: ${winnerName}`;
        header.appendChild(winner);
      }
    } else {
      const live = document.createElement("p");
      live.className = "match-live-score";
      live.textContent = `Marcador actual: ${homeScore} - ${awayScore}`;
      header.appendChild(live);
    }

    return header;
  }

  // Registro de eventos en dos columnas (local | visitante) con EventForm.
  #buildEvents(match, homeTeam, awayTeam, homePlayers, awayPlayers, events, playerById, terms, homeScore, awayScore) {
    const wrap = document.createElement("div");
    wrap.className = "events-section";

    const title = document.createElement("h2");
    title.textContent = `Registro de ${terms.eventNamePlural || "anotaciones"}`;
    wrap.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "events-grid";
    grid.appendChild(this.#eventColumn(homeTeam, events, playerById, homeScore));
    grid.appendChild(this.#eventColumn(awayTeam, events, playerById, awayScore));
    wrap.appendChild(grid);

    const form = document.createElement("event-form");
    form.data = { match, homeTeam, awayTeam, homePlayers, awayPlayers, terms };
    form.addEventListener("event-added", async (e) => {
      const { playerId, minute } = e.detail;
      try {
        await db.add("events", { matchId: Number(this.id), playerId, minute });
        showToast(`${terms.eventName} registrado`, "success");
        this.render();
      } catch (err) {
        showToast("No se pudo registrar la anotación", "error");
      }
    });
    wrap.appendChild(form);

    return wrap;
  }

  // Columna de eventos de un equipo con borrado individual.
  #eventColumn(team, events, playerById, score) {
    const col = document.createElement("div");
    col.className = "event-column";

    const head = document.createElement("h3");
    head.textContent = `${team?.name || "Por definir"} — ${score}`;
    col.appendChild(head);

    const list = document.createElement("ul");
    list.className = "event-list";

    const teamEvents = events.filter((ev) => playerById[ev.playerId]?.teamId === team?.id);

    if (teamEvents.length === 0) {
      const li = document.createElement("li");
      li.className = "event-empty";
      li.textContent = "Sin anotaciones";
      list.appendChild(li);
    } else {
      teamEvents.forEach((ev) => {
        const li = document.createElement("li");
        li.className = "event-row";

        const label = document.createElement("span");
        const player = playerById[ev.playerId];
        label.textContent =
          `${player?.name || "Jugador sin datos"}` +
          (ev.minute != null ? ` · ${ev.minute}'` : "");
        li.appendChild(label);

        const del = document.createElement("button");
        del.className = "btn btn-sm btn-danger";
        del.textContent = "✕";
        del.title = "Eliminar anotación";
        del.addEventListener("click", async () => {
          try {
            await db.remove("events", ev.id);
            this.render();
          } catch (err) {
            showToast("No se pudo eliminar la anotación", "error");
          }
        });
        li.appendChild(del);

        list.appendChild(li);
      });
    }

    col.appendChild(list);
    return col;
  }

  // Botón finalizar + selector de ganador si el marcador empata en torneo.
  #buildActions(match, homeTeam, awayTeam, homeScore, awayScore, isTournament) {
    const wrap = document.createElement("div");
    wrap.className = "match-actions";

    const finalizeBtn = document.createElement("button");
    finalizeBtn.className = "btn btn-primary";
    finalizeBtn.textContent = "Finalizar partido";
    wrap.appendChild(finalizeBtn);

    const picker = document.createElement("div");
    picker.className = "winner-picker";
    picker.hidden = true;

    const pickerLabel = document.createElement("p");
    pickerLabel.textContent = "El marcador quedó empatado. Declara al ganador:";
    picker.appendChild(pickerLabel);

    [homeTeam, awayTeam].forEach((team, i) => {
      const label = document.createElement("label");
      label.className = "radio-label";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "winner";
      radio.value = team?.id;
      if (i === 0) radio.checked = true;
      label.appendChild(radio);
      label.appendChild(document.createTextNode(team?.name || "Por definir"));
      picker.appendChild(label);
    });

    const confirmBtn = document.createElement("button");
    confirmBtn.className = "btn btn-primary";
    confirmBtn.textContent = "Confirmar ganador y finalizar";
    confirmBtn.addEventListener("click", async () => {
      const selected = picker.querySelector('input[name="winner"]:checked');
      if (!selected) {
        showToast("Debes declarar un ganador", "error");
        return;
      }
      await this.#runFinalize(match, Number(selected.value));
    });
    picker.appendChild(confirmBtn);

    wrap.appendChild(picker);

    finalizeBtn.addEventListener("click", async () => {
      if (isTournament && homeScore === awayScore) {
        picker.hidden = false;
        return;
      }
      await this.#runFinalize(match, null);
    });

    return wrap;
  }

  // Ejecuta finalizeMatch y refresca la vista; los errores de la
  // transacción se muestran al usuario con la opción de reintentar.
  async #runFinalize(match, declaredWinnerId) {
    try {
      await finalizeMatch(match.id, { declaredWinnerId });
      showToast("Partido finalizado", "success");
      this.render();
    } catch (err) {
      showToast(err.message || "No se pudo finalizar el partido", "error");
      this.render();
    }
  }

  // Botón deshacer con confirmación; el error de la restricción del
  // bracket (siguiente ronda finalizada) viene de undoMatch.
  #buildUndo(match) {
    const wrap = document.createElement("div");
    wrap.className = "match-actions";

    const btn = document.createElement("button");
    btn.className = "btn btn-danger";
    btn.textContent = "Deshacer partido";
    btn.addEventListener("click", async () => {
      const confirmed = await ConfirmDialog.show(
        "Deshacer partido",
        "Se revertirá el marcador y se conservarán los eventos registrados. ¿Continuar?",
      );
      if (!confirmed) return;
      try {
        await undoMatch(match.id);
        showToast("Partido deshecho", "success");
        this.render();
      } catch (err) {
        showToast(err.message || "No se pudo deshacer el partido", "error");
      }
    });

    wrap.appendChild(btn);
    return wrap;
  }
}
