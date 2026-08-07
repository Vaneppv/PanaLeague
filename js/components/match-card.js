import { formatDate } from "../utils/helpers.js";

/**
 * MatchCard: tarjeta de un partido con escudos, marcador (o "vs") y estado.
 * Recibe vía `data` el partido, ambos equipos y, opcionalmente, la etiqueta
 * de ronda (solo en modalidad eliminación directa).
 */
export class MatchCard extends HTMLElement {
  set data(value) {
    this.match = value.match;
    this.homeTeam = value.homeTeam || {};
    this.awayTeam = value.awayTeam || {};
    this.roundLabel = value.roundLabel || null;
    this.buildDOM();
  }

  get data() {
    return this.match;
  }

  // Escudo del equipo o placeholder con iniciales y colores del escudo.
  #shield(team) {
    const wrap = document.createElement("div");
    wrap.className = "match-shield";

    if (team.escudo) {
      const img = document.createElement("img");
      img.src = team.escudo;
      img.alt = team.name || "Equipo";
      img.className = "match-escudo";
      wrap.appendChild(img);
    } else {
      const ph = document.createElement("div");
      ph.className = "match-placeholder";
      ph.textContent = (team.name || "?")
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
      if (team.colorPrincipal) ph.style.background = team.colorPrincipal;
      wrap.appendChild(ph);
    }

    return wrap;
  }

  buildDOM() {
    this.innerHTML = "";
    const m = this.match || {};
    const isFinalized = m.status === "Finalizado";

    this.className = "card match-card";

    const top = document.createElement("div");
    top.className = "match-top";

    const date = document.createElement("span");
    date.className = "match-date";
    date.textContent = m.date ? formatDate(m.date) : "Sin fecha";
    top.appendChild(date);

    const status = document.createElement("span");
    status.className = `match-status ${isFinalized ? "done" : "pending"}`;
    status.textContent = m.status || "Programado";
    top.appendChild(status);

    if (this.roundLabel) {
      const round = document.createElement("span");
      round.className = "match-round";
      round.textContent = this.roundLabel;
      top.appendChild(round);
    }

    const body = document.createElement("div");
    body.className = "match-body";

    const homeCol = document.createElement("div");
    homeCol.className = "match-team";
    homeCol.appendChild(this.#shield(this.homeTeam));
    const homeName = document.createElement("span");
    homeName.className = "match-team-name";
    homeName.textContent = this.homeTeam.name || "Por definir";
    homeCol.appendChild(homeName);

    const score = document.createElement("span");
    score.className = "match-score";
    score.textContent = isFinalized ? `${m.homeScore} - ${m.awayScore}` : "vs";

    const awayCol = document.createElement("div");
    awayCol.className = "match-team";
    awayCol.appendChild(this.#shield(this.awayTeam));
    const awayName = document.createElement("span");
    awayName.className = "match-team-name";
    awayName.textContent = this.awayTeam.name || "Por definir";
    awayCol.appendChild(awayName);

    body.appendChild(homeCol);
    body.appendChild(score);
    body.appendChild(awayCol);

    this.appendChild(top);
    this.appendChild(body);
  }
}
customElements.define("match-card", MatchCard);
