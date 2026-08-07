import db from "../db.js";
import "../components/chart-container.js";
import "../components/standings-table.js";
import "../components/ranking-table.js";
import "../components/bracket-view.js";
import { getSportTerms } from "../sports-terms.js";
import { roundLabel } from "../utils/helpers.js";

const PALETTE = ["#6c5ce7", "#22c55e", "#60a5fa", "#f97316", "#eab308", "#ef4444", "#ec4899", "#14b8a6"];

export class StatsView {
  constructor({ router }) {
    this.router = router;
    this.container = null;
  }

  mount(container) {
    this.container = container;
    container.innerHTML = `<loading-state message="Cargando estadísticas..."></loading-state>`;
    this.render();
  }

  #isFinalized(match) {
    return (
      match.status === "Finalizado" ||
      match.status === "finalized" ||
      match.status === "finished"
    );
  }

  #pointsIn(match, teamId) {
    if (!this.#isFinalized(match) || match.homeScore == null || match.awayScore == null) return 0;
    if (match.homeTeamId !== teamId && match.awayTeamId !== teamId) return 0;
    const isHome = match.homeTeamId === teamId;
    const own = isHome ? match.homeScore : match.awayScore;
    const rival = isHome ? match.awayScore : match.homeScore;
    if (own > rival) return 3;
    if (own === rival) return 1;
    return 0;
  }

  async render() {
    const container = this.container;
    if (!container) return;

    const leagueId = db.getActiveLeagueId();
    if (!leagueId) {
      container.innerHTML = `<div class="empty-state"><p>No hay una liga activa.</p></div>`;
      return;
    }

    const league = await db.getById("leagues", Number(leagueId));
    if (!league) {
      container.innerHTML = `<div class="empty-state"><p>La liga activa no existe.</p></div>`;
      return;
    }

    const terms = getSportTerms(league.sport);
    const teams = await db.getByIndex("teams", "leagueId", Number(leagueId));
    const matches = await db.getByIndex("matches", "leagueId", Number(leagueId));

    const allPlayers = await db.getAll("players").catch(() => []);
    const teamIds = new Set(teams.map((t) => t.id));
    const players = allPlayers.filter((p) => teamIds.has(p.teamId));

    const allEvents = await db.getAll("events").catch(() => []);
    const matchIds = new Set(matches.map((m) => m.id));
    const events = allEvents.filter((e) => matchIds.has(e.matchId));

    const teamById = {};
    teams.forEach((t) => (teamById[t.id] = t));

    const loader = container.querySelector("loading-state");
    if (loader) loader.remove();

    const section = document.createElement("section");
    section.className = "stats-view";

    const heading = document.createElement("div");
    heading.className = "page-header";
    heading.innerHTML = `<div><h1>${terms.icon} Estadísticas</h1><span class="dashboard-subtitle">${league.name} — ${league.temporada}</span></div>`;
    section.appendChild(heading);

    section.appendChild(this.#buildRankingBlock(terms, players, teamById, events));

    if (league.modalidad === "tournament") {
      section.appendChild(this.#buildTournamentBlock(matches, teams));
    } else {
      section.appendChild(this.#buildStandingsBlock(teams, matches, terms));
    }

    section.appendChild(this.#buildCharts(terms, teams, players, teamById, matches, events, league.modalidad === "tournament"));

    container.appendChild(section);
  }

  #buildStandingsBlock(teams, matches, terms) {
    const sec = document.createElement("section");
    sec.className = "detail-section";
    const h2 = document.createElement("h2");
    h2.textContent = "Tabla de posiciones";
    const panel = document.createElement("div");
    panel.className = "detail-panel";
    const table = document.createElement("standings-table");
    table.data = { teams, matches, terms };
    panel.appendChild(table);
    sec.appendChild(h2);
    sec.appendChild(panel);
    return sec;
  }

  #buildTournamentBlock(matches, teams) {
    const sec = document.createElement("section");
    sec.className = "detail-section";
    const h2 = document.createElement("h2");
    h2.textContent = "Bracket";
    const panel = document.createElement("div");
    panel.className = "detail-panel";
    const bracket = document.createElement("bracket-view");
    bracket.data = { matches, teams };
    panel.appendChild(bracket);
    sec.appendChild(h2);
    sec.appendChild(panel);
    return sec;
  }

  #buildRankingBlock(terms, players, teamById, events) {
    const sec = document.createElement("section");
    sec.className = "detail-section";
    const h2 = document.createElement("h2");
    h2.textContent = `Top ${terms.scorers || "anotadores"}`;
    const panel = document.createElement("div");
    panel.className = "detail-panel";
    const ranking = document.createElement("ranking-table");
    ranking.data = { players, events, teams: Object.values(teamById), terms };
    panel.appendChild(ranking);
    sec.appendChild(h2);
    sec.appendChild(panel);
    return sec;
  }

  #buildChartCard(title, config, empty) {
    const card = document.createElement("div");
    card.className = "stats-chart";

    const head = document.createElement("div");
    head.className = "stats-chart-head";
    const h3 = document.createElement("h3");
    h3.textContent = title;
    head.appendChild(h3);
    card.appendChild(head);

    const panel = document.createElement("div");
    panel.className = "chart-panel";

    if (empty) {
      const e = document.createElement("div");
      e.className = "empty-state";
      const p = document.createElement("p");
      p.textContent = empty;
      e.appendChild(p);
      panel.appendChild(e);
    } else {
      const wrapper = document.createElement("div");
      wrapper.className = "chart-wrapper";
      const chartEl = document.createElement("chart-container");
      wrapper.appendChild(chartEl);
      panel.appendChild(wrapper);
      chartEl.render(config);
    }

    card.appendChild(panel);
    return card;
  }

  // En liga se compara la evolución de puntos; en eliminación directa el
  // requisito 4.9.3 pide anotaciones por ronda.
  #buildCharts(terms, teams, players, teamById, matches, events, isTournament) {
    const sec = document.createElement("section");
    sec.className = "detail-section";
    const h2 = document.createElement("h2");
    h2.textContent = "Gráficos";
    sec.appendChild(h2);

    const grid = document.createElement("div");
    grid.className = "charts-grid";

    grid.appendChild(this.#scorersChart(terms, players, teamById, events));
    if (isTournament) {
      grid.appendChild(this.#roundsChart(terms, matches, teams.length, events));
    } else {
      grid.appendChild(this.#pointsChart(teams, matches));
    }
    grid.appendChild(this.#goalsByTeamChart(teams, players, teamById, events));

    sec.appendChild(grid);
    return sec;
  }

  #scorersChart(terms, players, teamById, events) {
    const goals = {};
    events.forEach((e) => {
      if (e.playerId == null) return;
      goals[e.playerId] = (goals[e.playerId] || 0) + 1;
    });

    const scorers = players
      .filter((p) => (goals[p.id] || 0) > 0)
      .map((p) => ({
        player: p,
        team: teamById[p.teamId] || null,
        goals: goals[p.id],
      }))
      .sort((a, b) => b.goals - a.goals)
      .slice(0, 10);

    const title = `Top 10 ${terms.scorers || "anotadores"}`;
    if (scorers.length === 0) {
      return this.#buildChartCard(title, null, "Aún no hay anotaciones registradas.");
    }

    return this.#buildChartCard(title, {
      type: "bar",
      data: {
        labels: scorers.map((s) => s.player.name),
        datasets: [
          {
            label: terms.eventNamePlural || "Anotaciones",
            data: scorers.map((s) => s.goals),
            backgroundColor: scorers.map((s) => s.team?.colorPrincipal || PALETTE[0]),
            borderRadius: 6,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    }, null);
  }

  #pointsChart(teams, matches) {
    const played = matches
      .filter((m) => this.#isFinalized(m) && m.homeScore != null && m.awayScore != null)
      .sort((a, b) => (a.date || "").localeCompare(b.date || "") || a.id - b.id);

    if (played.length === 0) {
      return this.#buildChartCard("Evolución de puntos", null, "No hay partidos finalizados.");
    }

    const labels = played.map((m, i) => (m.date ? new Date(m.date).toLocaleDateString("es-ES") : `P${i + 1}`));

    const teamIds = new Set();
    played.forEach((m) => {
      teamIds.add(m.homeTeamId);
      teamIds.add(m.awayTeamId);
    });

    const teamById = {};
    teams.forEach((t) => (teamById[t.id] = t));

    const series = Array.from(teamIds)
      .map((teamId) => {
        let cum = 0;
        const values = played.map((m) => {
          cum += this.#pointsIn(m, teamId);
          return cum;
        });
        return { teamId, values };
      })
      .sort((a, b) => b.values[b.values.length - 1] - a.values[a.values.length - 1])
      .slice(0, 6);

    const datasets = series.map((s, i) => {
      const team = teamById[s.teamId];
      const color = team?.colorPrincipal || PALETTE[i % PALETTE.length];
      return {
        label: team?.name || `Equipo ${i + 1}`,
        data: s.values,
        borderColor: color,
        backgroundColor: color,
        tension: 0.3,
        fill: false,
        pointRadius: 2,
      };
    });

    return this.#buildChartCard("Evolución de puntos", {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true, labels: { color: "#8888aa", boxWidth: 12 } } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    }, null);
  }

  // Anotaciones agrupadas por ronda del bracket (modalidad eliminación
  // directa). Cada evento se asigna a la ronda del partido que lo contiene.
  #roundsChart(terms, matches, totalTeams, events) {
    const byRound = new Map();
    events.forEach((e) => {
      if (e.playerId == null) return;
      const match = matches.find((m) => m.id === e.matchId);
      if (!match) return;
      const r = match.round || 1;
      byRound.set(r, (byRound.get(r) || 0) + 1);
    });

    const title = `${terms.eventNamePlural || "Anotaciones"} por ronda`;
    if (byRound.size === 0) {
      return this.#buildChartCard(title, null, "Aún no hay anotaciones registradas.");
    }

    const rounds = Array.from(byRound.keys()).sort((a, b) => a - b);
    return this.#buildChartCard(title, {
      type: "bar",
      data: {
        labels: rounds.map((r) => roundLabel(r, totalTeams) || `Ronda ${r}`),
        datasets: [
          {
            label: terms.eventNamePlural || "Anotaciones",
            data: rounds.map((r) => byRound.get(r)),
            backgroundColor: rounds.map((_, i) => PALETTE[i % PALETTE.length]),
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    }, null);
  }

  #goalsByTeamChart(teams, players, teamById, events) {
    const goalsByTeam = new Map();
    events.forEach((e) => {
      if (e.playerId == null) return;
      const player = players.find((p) => p.id === e.playerId);
      if (!player) return;
      const team = teamById[player.teamId];
      if (!team) return;
      goalsByTeam.set(team.id, (goalsByTeam.get(team.id) || 0) + 1);
    });

    const title = "Distribución por equipo";
    if (goalsByTeam.size === 0) {
      return this.#buildChartCard(title, null, "Aún no hay anotaciones registradas.");
    }

    const entries = Array.from(goalsByTeam.entries()).sort((a, b) => b[1] - a[1]);
    return this.#buildChartCard(title, {
      type: "doughnut",
      data: {
        labels: entries.map(([id]) => teamById[id].name),
        datasets: [
          {
            data: entries.map(([, v]) => v),
            backgroundColor: entries.map(([id], i) => teamById[id].colorPrincipal || PALETTE[i % PALETTE.length]),
            borderColor: "#0a0a0f",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true, position: "right", labels: { color: "#8888aa", boxWidth: 12 } } },
      },
    }, null);
  }

  unmount() {
    this.container = null;
  }
}