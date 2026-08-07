import db from "../db.js";
import "../components/league-form.js";
import "../components/league-switcher.js";
import "../components/chart-container.js";
import { getSportTerms } from "../sports-terms.js";
import { formatDate } from "../utils/helpers.js";

const PALETTE = ["#6c5ce7", "#22c55e", "#60a5fa", "#f97316", "#eab308", "#ef4444", "#ec4899", "#14b8a6"];

export class DashboardView {
  constructor({ router }) {
    this.router = router;
    this.container = null;
  }

  mount(container) {
    this.container = container;
    container.innerHTML = `
      <div class="page-header">
        <h1>Dashboard</h1>
      </div>
      <loading-state message="Cargando dashboard..."></loading-state>
    `;
    this.onLeagueChanged = () => {
      if (this.container) this.render();
    };
    document.addEventListener("league:changed", this.onLeagueChanged);
    this.render();
  }

  async render() {
    const container = this.container;
    if (!container) return;

    const leagueId = db.getActiveLeagueId();

    if (!leagueId) {
      container.innerHTML = `
        <div class="empty-state">
          <h2>No hay liga activa</h2>
          <p>Crea o selecciona una liga para comenzar.</p>
          <div class="empty-actions">
            <button class="btn btn-primary" id="create-first">+ Crear Liga</button>
            <button class="btn btn-secondary" id="go-leagues">Ir a Ligas</button>
          </div>
        </div>
      `;
      container
        .querySelector("#go-leagues")
        ?.addEventListener("click", () => this.router.navigateTo("/leagues"));
      container
        .querySelector("#create-first")
        ?.addEventListener("click", () => this.openCreateLeague());
      return;
    }

    const league = await db.getById("leagues", Number(leagueId));
    if (!league) {
      container.innerHTML = `<div class="empty-state"><p>La liga activa no existe.</p></div>`;
      return;
    }

    const navBar = document.querySelector("nav-bar");
    if (navBar) navBar.setActiveLeague(league.name, league.sport);

    const terms = getSportTerms(league.sport);

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>${terms.icon} ${league.name}</h1>
          <span class="dashboard-subtitle">${terms.name} — ${league.temporada}</span>
        </div>
        <div class="dashboard-actions">
          <button class="btn btn-secondary" id="change-league">Cambiar liga</button>
          <button class="btn btn-primary" id="create-league">+ Crear Liga</button>
        </div>
      </div>
      <section id="dashboard-content"></section>
    `;

    container
      .querySelector("#change-league")
      .addEventListener("click", () => this.openLeagueSwitcher());
    container
      .querySelector("#create-league")
      .addEventListener("click", () => this.openCreateLeague());

    const teams = await db.getByIndex("teams", "leagueId", Number(leagueId));
    const matches = await db.getByIndex("matches", "leagueId", Number(leagueId));

    const content = container.querySelector("#dashboard-content");
    if (content) {
      content.appendChild(this.#buildNextLast(matches, this.#teamById(teams), terms));
      content.appendChild(
        league.modalidad === "tournament"
          ? this.#buildBracketSummary(matches, this.#teamById(teams))
          : this.#buildMiniStandings(teams, matches, terms)
      );
      content.appendChild(this.#buildCharts(teams, matches, terms));
    }
  }

  #isFinalized(match) {
    return (
      match.status === "Finalizado" ||
      match.status === "finalized" ||
      match.status === "finished"
    );
  }

  #teamById(teams) {
    const map = {};
    teams.forEach((t) => (map[t.id] = t));
    return map;
  }

  #initials(name) {
    return (name || "?")
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  #byDateAsc(a, b) {
    const da = a.date || "";
    const dbD = b.date || "";
    if (da && dbD) return da < dbD ? -1 : da > dbD ? 1 : 0;
    if (da) return -1;
    if (dbD) return 1;
    return a.id - b.id;
  }

  #byDateDesc(a, b) {
    const da = a.date || "";
    const dbD = b.date || "";
    if (da && dbD) return da < dbD ? 1 : da > dbD ? -1 : 0;
    if (da) return -1;
    if (dbD) return 1;
    return b.id - a.id;
  }

  #emptyMsg(text) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const p = document.createElement("p");
    p.textContent = text;
    empty.appendChild(p);
    return empty;
  }

  #teamChip(team) {
    const chip = document.createElement("div");
    chip.className = "dash-team";

    const avatar = document.createElement("span");
    avatar.className = "dash-team-avatar";
    if (team?.escudo) {
      const img = document.createElement("img");
      img.src = team.escudo;
      img.alt = team.name || "Equipo";
      avatar.appendChild(img);
    } else {
      avatar.textContent = this.#initials(team?.name);
      if (team?.colorPrincipal) avatar.style.background = team.colorPrincipal;
    }

    const name = document.createElement("span");
    name.className = "dash-team-name";
    name.textContent = team?.name || "Por definir";

    chip.appendChild(avatar);
    chip.appendChild(name);
    return chip;
  }

  #buildNextLast(matches, teamById, terms) {
    const section = document.createElement("section");
    section.className = "detail-section";

    const grid = document.createElement("div");
    grid.className = "dash-cards";

    grid.appendChild(this.#nextMatchCard(matches, teamById, terms));
    grid.appendChild(this.#lastResultCard(matches, teamById, terms));

    section.appendChild(grid);
    return section;
  }

  #nextMatchCard(matches, teamById, terms) {
    const card = document.createElement("div");
    card.className = "card dash-card";

    const h3 = document.createElement("h3");
    h3.textContent = "Próximo partido";
    card.appendChild(h3);

    const upcoming = matches.filter((m) => !this.#isFinalized(m)).sort(this.#byDateAsc);

    if (upcoming.length === 0) {
      card.appendChild(this.#emptyMsg("Sin partidos programados."));
      return card;
    }

    const match = upcoming[0];

    const matchup = document.createElement("div");
    matchup.className = "dash-matchup";
    matchup.appendChild(this.#teamChip(teamById[match.homeTeamId]));

    const vs = document.createElement("span");
    vs.className = "dash-vs";
    vs.textContent = "vs";
    matchup.appendChild(vs);

    matchup.appendChild(this.#teamChip(teamById[match.awayTeamId]));
    card.appendChild(matchup);

    const date = document.createElement("div");
    date.className = "dash-date";
    date.textContent = match.date ? formatDate(match.date) : "Sin fecha programada";
    card.appendChild(date);

    card.classList.add("clickable");
    card.addEventListener("click", () => this.router.navigateTo(`/match/${match.id}`));
    return card;
  }

  #lastResultCard(matches, teamById, terms) {
    const card = document.createElement("div");
    card.className = "card dash-card";

    const h3 = document.createElement("h3");
    h3.textContent = "Último resultado";
    card.appendChild(h3);

    const finalized = matches
      .filter((m) => this.#isFinalized(m) && m.homeScore != null && m.awayScore != null)
      .sort(this.#byDateDesc);

    if (finalized.length === 0) {
      card.appendChild(this.#emptyMsg("No hay partidos finalizados."));
      return card;
    }

    const match = finalized[0];

    const matchup = document.createElement("div");
    matchup.className = "dash-matchup";
    matchup.appendChild(this.#teamChip(teamById[match.homeTeamId]));

    const score = document.createElement("span");
    score.className = "dash-score";
    score.textContent = `${match.homeScore} - ${match.awayScore}`;
    matchup.appendChild(score);

    matchup.appendChild(this.#teamChip(teamById[match.awayTeamId]));
    card.appendChild(matchup);

    if (match.date) {
      const date = document.createElement("div");
      date.className = "dash-date";
      date.textContent = formatDate(match.date);
      card.appendChild(date);
    }

    card.classList.add("clickable");
    card.addEventListener("click", () => this.router.navigateTo(`/match/${match.id}`));
    return card;
  }

  #computeStats(matches, teamId) {
    const stats = { pj: 0, pg: 0, pe: 0, pp: 0, pf: 0, pc: 0, dif: 0, pts: 0 };
    matches
      .filter((m) => this.#isFinalized(m) && m.homeScore != null && m.awayScore != null)
      .forEach((m) => {
        const isHome = m.homeTeamId === teamId;
        const own = isHome ? m.homeScore : m.awayScore;
        const rival = isHome ? m.awayScore : m.homeScore;
        stats.pj += 1;
        stats.pf += own;
        stats.pc += rival;
        if (own > rival) {
          stats.pg += 1;
          stats.pts += 3;
        } else if (own < rival) {
          stats.pp += 1;
        } else {
          stats.pe += 1;
          stats.pts += 1;
        }
      });
    stats.dif = stats.pf - stats.pc;
    return stats;
  }

  #sectionTitle(text) {
    const h2 = document.createElement("h2");
    h2.textContent = text;
    return h2;
  }

  #viewAllLink(href, text) {
    const link = document.createElement("a");
    link.className = "btn btn-sm btn-secondary dash-link";
    link.href = `#${href}`;
    link.textContent = text;
    link.addEventListener("click", (e) => {
      e.preventDefault();
      this.router.navigateTo(href);
    });
    return link;
  }

  #teamCell(team) {
    const cell = document.createElement("td");

    const wrapper = document.createElement("div");
    wrapper.className = "st-team";

    const avatar = document.createElement("span");
    avatar.className = "st-avatar";
    if (team.escudo) {
      const img = document.createElement("img");
      img.src = team.escudo;
      img.alt = team.name || "Equipo";
      avatar.appendChild(img);
    } else {
      avatar.textContent = this.#initials(team.name);
      if (team.colorPrincipal) avatar.style.background = team.colorPrincipal;
    }

    const name = document.createElement("span");
    name.className = "st-name";
    name.textContent = team.name || "Sin nombre";

    wrapper.appendChild(avatar);
    wrapper.appendChild(name);
    cell.appendChild(wrapper);
    return cell;
  }

  #buildMiniStandings(teams, matches, terms) {
    const section = document.createElement("section");
    section.className = "detail-section";
    section.appendChild(this.#sectionTitle("Top 5"));

    const panel = document.createElement("div");
    panel.className = "detail-panel";

    if (teams.length === 0) {
      panel.appendChild(this.#emptyMsg("Aún no hay equipos en esta liga."));
      section.appendChild(panel);
      return section;
    }

    const rows = teams
      .map((team) => ({ team, stats: this.#computeStats(matches, team.id) }))
      .sort(
        (a, b) =>
          b.stats.pts - a.stats.pts ||
          b.stats.dif - a.stats.dif ||
          b.stats.pf - a.stats.pf
      )
      .slice(0, 5);

    const wrap = document.createElement("div");
    wrap.className = "standings-wrap";

    const table = document.createElement("table");
    table.className = "standings-table";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["#", "Equipo", "PJ", "Pts"].forEach((label, i) => {
      const th = document.createElement("th");
      th.textContent = label;
      if (i > 1) th.classList.add("st-num");
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    rows.forEach(({ team, stats }, index) => {
      const tr = document.createElement("tr");
      tr.addEventListener("click", () => this.router.navigateTo(`/team/${team.id}`));

      const posTd = document.createElement("td");
      posTd.className = "st-pos";
      posTd.textContent = index + 1;
      if (index < 3) posTd.classList.add("top");
      tr.appendChild(posTd);

      tr.appendChild(this.#teamCell(team));

      const pjTd = document.createElement("td");
      pjTd.className = "st-num";
      pjTd.textContent = stats.pj;
      tr.appendChild(pjTd);

      const ptsTd = document.createElement("td");
      ptsTd.className = "st-num pts";
      ptsTd.textContent = stats.pts;
      tr.appendChild(ptsTd);

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    panel.appendChild(wrap);

    panel.appendChild(this.#viewAllLink("/stats", "Ver tabla completa"));
    section.appendChild(panel);
    return section;
  }

  #buildBracketSummary(matches, teamById) {
    const section = document.createElement("section");
    section.className = "detail-section";
    section.appendChild(this.#sectionTitle("Bracket"));

    const panel = document.createElement("div");
    panel.className = "detail-panel";

    if (matches.length === 0) {
      panel.appendChild(this.#emptyMsg("Aún no hay bracket en esta liga."));
      section.appendChild(panel);
      return section;
    }

    const byRound = new Map();
    matches.forEach((m) => {
      const r = m.round || 1;
      if (!byRound.has(r)) byRound.set(r, []);
      byRound.get(r).push(m);
    });

    const rounds = Array.from(byRound.keys()).sort((a, b) => a - b);

    let lastFinalized = null;
    rounds.forEach((r) => {
      const list = byRound.get(r);
      if (list.length > 0 && list.every((m) => this.#isFinalized(m))) {
        lastFinalized = r;
      }
    });

    if (lastFinalized != null) {
      panel.appendChild(
        this.#roundBlock(`Ronda ${lastFinalized} finalizada`, byRound.get(lastFinalized), teamById)
      );
    }

    const nextRound =
      lastFinalized == null ? rounds[0] : rounds[rounds.indexOf(lastFinalized) + 1];

    if (nextRound != null) {
      const isFirst = nextRound === rounds[0];
      panel.appendChild(
        this.#roundBlock(
          isFirst ? `Ronda ${nextRound} por jugarse` : `Ronda ${nextRound} (próxima)`,
          byRound.get(nextRound),
          teamById
        )
      );
    }

    panel.appendChild(this.#viewAllLink("/stats", "Ver bracket completo"));
    section.appendChild(panel);
    return section;
  }

  #roundBlock(title, roundMatches, teamById) {
    const block = document.createElement("div");
    block.className = "dash-round";

    const h4 = document.createElement("h4");
    h4.textContent = title;
    block.appendChild(h4);

    const list = document.createElement("ul");
    list.className = "dash-round-list";

    roundMatches.forEach((m) => {
      const li = document.createElement("li");
      li.className = "dash-round-item";
      li.addEventListener("click", () => this.router.navigateTo(`/match/${m.id}`));

      const played = this.#isFinalized(m) && m.homeScore != null && m.awayScore != null;

      li.appendChild(this.#teamChip(teamById[m.homeTeamId]));

      if (played) {
        const score = document.createElement("span");
        score.className = "dash-score dash-score-sm";
        score.textContent = `${m.homeScore} - ${m.awayScore}`;
        li.appendChild(score);
      } else {
        const vs = document.createElement("span");
        vs.className = "dash-vs";
        vs.textContent = "vs";
        li.appendChild(vs);
      }

      li.appendChild(this.#teamChip(teamById[m.awayTeamId]));
      list.appendChild(li);
    });

    block.appendChild(list);
    return block;
  }

  #buildCharts(teams, matches, terms) {
    const section = document.createElement("section");
    section.className = "detail-section";
    section.appendChild(this.#sectionTitle("Gráficos"));

    const grid = document.createElement("div");
    grid.className = "charts-grid";

    grid.appendChild(this.#pointsForChart(teams, matches, terms));
    grid.appendChild(this.#resultsChart(matches));
    grid.appendChild(this.#pointsTimelineChart(teams, matches));

    section.appendChild(grid);
    return section;
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

  #pointsForChart(teams, matches, terms) {
    const title = "Puntos a favor por equipo";

    const rows = teams
      .map((team) => ({ team, pf: this.#computeStats(matches, team.id).pf }))
      .filter((r) => r.pf > 0)
      .sort((a, b) => b.pf - a.pf)
      .slice(0, 10);

    if (rows.length === 0) {
      return this.#buildChartCard(title, null, "No hay datos suficientes.");
    }

    return this.#buildChartCard(title, {
      type: "bar",
      data: {
        labels: rows.map((r) => r.team.name),
        datasets: [
          {
            label: terms.gf || "PF",
            data: rows.map((r) => r.pf),
            backgroundColor: rows.map((r) => r.team.colorPrincipal || PALETTE[0]),
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

  #resultsChart(matches) {
    const title = "Distribución de resultados";

    const totals = { wins: 0, draws: 0, losses: 0 };
    matches
      .filter((m) => this.#isFinalized(m) && m.homeScore != null && m.awayScore != null)
      .forEach((m) => {
        if (m.homeScore === m.awayScore) {
          totals.draws += 2;
        } else {
          totals.wins += 1;
          totals.losses += 1;
        }
      });

    const data = [totals.wins, totals.draws, totals.losses];
    if (data.every((v) => v === 0)) {
      return this.#buildChartCard(title, null, "No hay datos suficientes.");
    }

    return this.#buildChartCard(title, {
      type: "doughnut",
      data: {
        labels: ["Victorias", "Empates", "Derrotas"],
        datasets: [
          {
            data,
            backgroundColor: ["#22c55e", "#eab308", "#ef4444"],
            borderColor: "#0a0a0f",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: "right", labels: { color: "#8888aa", boxWidth: 12 } },
        },
      },
    }, null);
  }

  #pointsTimelineChart(teams, matches) {
    const title = "Evolución de puntos a favor";

    const played = matches
      .filter((m) => this.#isFinalized(m) && m.homeScore != null && m.awayScore != null)
      .sort((a, b) => (a.date || "").localeCompare(b.date || "") || a.id - b.id);

    if (played.length === 0) {
      return this.#buildChartCard(title, null, "No hay datos suficientes.");
    }

    const labels = played.map((m, i) =>
      m.date ? new Date(m.date).toLocaleDateString("es-ES") : `P${i + 1}`
    );

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
          if (m.homeTeamId === teamId) {
            cum += m.homeScore;
          } else if (m.awayTeamId === teamId) {
            cum += m.awayScore;
          }
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

    return this.#buildChartCard(title, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, labels: { color: "#8888aa", boxWidth: 12 } },
        },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    }, null);
  }

  openLeagueSwitcher() {
    const switcher = document.createElement("league-switcher");
    this.container.appendChild(switcher);
  }

  openCreateLeague() {
    const form = document.createElement("league-form");
    form.addEventListener("league-created", async (e) => {
      await db.runTransaction(["leagues"], "readwrite", (stores) => {
        const all = stores.leagues.getAll();
        all.onsuccess = () => {
          all.result.forEach((l) => {
            stores.leagues.put({ ...l, isActive: l.id === e.detail.league.id });
          });
        };
      });
      db.setActiveLeagueId(e.detail.league.id);
      document.dispatchEvent(new CustomEvent("league:changed"));
    });
    this.container.appendChild(form);
  }

  unmount() {
    document.removeEventListener("league:changed", this.onLeagueChanged);
    this.container = null;
  }
}
