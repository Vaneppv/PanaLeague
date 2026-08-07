import db from "../db.js";
import "../components/chart-container.js";
import { getSportTerms } from "../sports-terms.js";
import { formatDate } from "../utils/helpers.js";

export class PlayerDetailView {
  constructor({ router, id }) {
    this.router = router;
    this.id = id;
    this.container = null;
  }

  mount(container) {
    this.container = container;
    container.innerHTML = `
      <button class="btn btn-secondary back-link" id="back-btn">← Volver</button>
      <loading-state message="Cargando jugador..."></loading-state>
    `;
    container
      .querySelector("#back-btn")
      .addEventListener("click", () => this.router.navigateTo("/players"));
    this.render();
  }

  async render() {
    const container = this.container;
    if (!container) return;

    const player = await db.getById("players", Number(this.id));
    if (!player) {
      container.innerHTML = `<div class="empty-state"><p>Jugador no encontrado.</p></div>`;
      return;
    }

    const team = player.teamId ? await db.getById("teams", Number(player.teamId)) : null;
    const leagueId = team?.leagueId || db.getActiveLeagueId();
    const league = leagueId ? await db.getById("leagues", Number(leagueId)) : null;
    const terms = getSportTerms(league?.sport);
    this.player = player;
    this.terms = terms;

    const events = await db.getByIndex("events", "playerId", player.id);
    const goalsByMatch = {};
    events.forEach((e) => {
      goalsByMatch[e.matchId] = (goalsByMatch[e.matchId] || 0) + 1;
    });
    const matchIds = Object.keys(goalsByMatch).map(Number);

    const played = matchIds.length;
    const totalGoals = events.length;
    const average = played > 0 ? (totalGoals / played).toFixed(1) : "0.0";

    const history = [];
    for (const matchId of matchIds) {
      const match = await db.getById("matches", matchId);
      if (!match) continue;
      const rivalId =
        match.homeTeamId === player.teamId ? match.awayTeamId : match.homeTeamId;
      const rival = rivalId ? await db.getById("teams", rivalId) : null;
      history.push({ match, rival, goals: goalsByMatch[matchId] });
    }
    history.sort((a, b) => {
      const da = a.match.date || "";
      const dbDate = b.match.date || "";
      if (da && dbDate) return da < dbDate ? 1 : da > dbDate ? -1 : 0;
      if (da) return -1;
      if (dbDate) return 1;
      return b.match.id - a.match.id;
    });

    const section = document.createElement("section");
    section.className = "player-detail";

    section.appendChild(this.#buildHeader(player, team));
    section.appendChild(this.#buildStats(played, totalGoals, average, terms));
    section.appendChild(this.#buildHistory(history, terms));
    section.appendChild(this.#buildChart(history, team, terms));

    const loader = container.querySelector("loading-state");
    if (loader) loader.remove();
    container.appendChild(section);
  }

  #buildHeader(player, team) {
    const header = document.createElement("div");
    header.className = "detail-header";

    const avatar = document.createElement("div");
    avatar.className = "detail-avatar";
    avatar.appendChild(this.#renderAvatar(player, team));

    const info = document.createElement("div");
    info.className = "detail-header-info";

    const h1 = document.createElement("h1");
    h1.textContent = player.name;

    const meta = document.createElement("div");
    meta.className = "detail-meta";

    const number = document.createElement("span");
    number.className = "detail-number";
    number.textContent = `#${player.number ?? "?"}`;
    meta.appendChild(number);

    if (player.position) {
      const position = document.createElement("span");
      position.textContent = player.position;
      meta.appendChild(position);
    }

    info.appendChild(h1);
    info.appendChild(meta);

    if (team) {
      info.appendChild(this.#renderTeamLink(team));
    }

    header.appendChild(avatar);
    header.appendChild(info);
    return header;
  }

  #buildStats(played, totalGoals, average, terms) {
    const grid = document.createElement("div");
    grid.className = "stat-grid";

    const items = [
      ["Partidos jugados", played],
      [terms.eventNamePlural, totalGoals],
      ["Promedio por partido", average],
    ];

    items.forEach(([label, value]) => {
      const card = document.createElement("div");
      card.className = "stat-card";
      const val = document.createElement("div");
      val.className = "stat-value";
      val.textContent = value;
      const lab = document.createElement("div");
      lab.className = "stat-label";
      lab.textContent = label;
      card.appendChild(val);
      card.appendChild(lab);
      grid.appendChild(card);
    });

    return grid;
  }

  #renderAvatar(player, team) {
    if (player.photo) {
      const img = document.createElement("img");
      img.src = player.photo;
      img.alt = player.name || "Jugador";
      return img;
    }
    const placeholder = document.createElement("div");
    placeholder.className = "avatar-placeholder";
    placeholder.textContent = (player.name || "?")
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    if (team?.colorPrincipal) {
      placeholder.style.background = team.colorPrincipal;
    }
    return placeholder;
  }

  #renderTeamLink(team) {
    const link = document.createElement("a");
    link.className = "detail-team";
    link.href = `#/team/${team.id}`;
    link.addEventListener("click", (e) => {
      e.preventDefault();
      this.router.navigateTo(`/team/${team.id}`);
    });

    const badge = document.createElement("span");
    badge.className = "team-badge";
    if (team.colorSecundario) {
      badge.style.background = team.colorSecundario;
    }
    if (team.escudo) {
      const img = document.createElement("img");
      img.src = team.escudo;
      img.alt = team.name || "Equipo";
      badge.appendChild(img);
    } else {
      badge.textContent = (team.name || "?")
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
    }

    const name = document.createElement("span");
    name.textContent = team.name;

    link.appendChild(badge);
    link.appendChild(name);
    return link;
  }

  #buildHistory(history, terms) {
    const section = document.createElement("section");
    section.className = "detail-section";

    const h2 = document.createElement("h2");
    h2.textContent = `${terms.scorers} — historial`;

    const panel = document.createElement("div");
    panel.className = "detail-panel";

    if (history.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      const p = document.createElement("p");
      p.textContent = "Este jugador aún no ha anotado en ningún partido.";
      empty.appendChild(p);
      panel.appendChild(empty);
      section.appendChild(h2);
      section.appendChild(panel);
      return section;
    }

    const list = document.createElement("ul");
    list.className = "history-list";

    history.forEach(({ match, rival, goals }) => {
      list.appendChild(this.#historyRow(match, rival, goals));
    });

    panel.appendChild(list);
    section.appendChild(h2);
    section.appendChild(panel);
    return section;
  }

  #historyRow(match, rival, goals) {
    const result = this.#resultOf(match);
    const isFinalized = result !== null;

    const li = document.createElement("li");
    li.className = "history-row";
    li.addEventListener("click", () => this.router.navigateTo(`/match/${match.id}`));

    const rivalName = document.createElement("span");
    rivalName.className = "history-rival";
    rivalName.textContent = rival?.name || "Por definir";

    const goalsSpan = document.createElement("span");
    goalsSpan.className = "history-goals";
    goalsSpan.textContent = `${goals} ${goals === 1 ? this.terms.eventName : this.terms.eventNamePlural}`;

    const date = document.createElement("span");
    date.className = "history-date";
    date.textContent = match.date ? formatDate(match.date) : "Sin fecha";

    li.appendChild(rivalName);
    li.appendChild(goalsSpan);
    li.appendChild(date);

    if (isFinalized) {
      const score = document.createElement("span");
      score.className = "history-score";
      score.textContent = `${match.homeScore} - ${match.awayScore}`;
      li.appendChild(score);

      const badge = document.createElement("span");
      badge.className = `result result-${result.key.toLowerCase()}`;
      badge.textContent = result.label;
      li.appendChild(badge);
    } else {
      const score = document.createElement("span");
      score.className = "history-score";
      score.textContent = "Programado";
      li.appendChild(score);
    }

    return li;
  }

  #buildChart(history, team, terms) {
    const section = document.createElement("section");
    section.className = "detail-section";

    const h2 = document.createElement("h2");
    h2.textContent = `${terms.eventNamePlural} por partido`;

    const panel = document.createElement("div");
    panel.className = "detail-panel";
    const wrapper = document.createElement("div");
    wrapper.className = "chart-wrapper";

    if (history.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      const p = document.createElement("p");
      p.textContent = "No hay datos suficientes.";
      empty.appendChild(p);
      wrapper.appendChild(empty);
      panel.appendChild(wrapper);
      section.appendChild(h2);
      section.appendChild(panel);
      return section;
    }

    const chartEl = document.createElement("chart-container");
    wrapper.appendChild(chartEl);
    panel.appendChild(wrapper);

    const labels = history.map(({ match, rival }) =>
      match.date
        ? new Date(match.date).toLocaleDateString("es-ES")
        : rival?.name || `Partido #${match.id}`,
    );
    const data = history.map((h) => h.goals);

    chartEl.render({
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: terms.eventNamePlural,
            data,
            backgroundColor: team?.colorPrincipal || "#6c5ce7",
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
        },
      },
    });

    section.appendChild(h2);
    section.appendChild(panel);
    return section;
  }

  #resultOf(match) {
    const finalized =
      match.status === "Finalizado" ||
      match.status === "finalized" ||
      match.status === "finished";
    if (!finalized || match.homeScore == null || match.awayScore == null) return null;

    const playerScore =
      match.homeTeamId === this.player?.teamId ? match.homeScore : match.awayScore;
    const rivalScore =
      match.homeTeamId === this.player?.teamId ? match.awayScore : match.homeScore;

    if (playerScore > rivalScore) return { key: "V", label: "Victoria" };
    if (playerScore < rivalScore) return { key: "D", label: "Derrota" };
    return { key: "E", label: "Empate" };
  }

  unmount() {
    this.container = null;
  }
}
