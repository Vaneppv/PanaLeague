import db from "../db.js";
import "../components/chart-container.js";
import "../components/player-card.js";
import "../components/player-form.js";
import { getSportTerms } from "../sports-terms.js";
import { formatDate } from "../utils/helpers.js";

export class TeamDetailView {
  constructor({ router, id }) {
    this.router = router;
    this.id = id;
    this.container = null;
  }

  mount(container) {
    this.container = container;
    container.innerHTML = `
      <button class="btn btn-secondary back-link" id="back-btn">← Volver</button>
      <loading-state message="Cargando equipo..."></loading-state>
    `;
    container
      .querySelector("#back-btn")
      .addEventListener("click", () => this.router.navigateTo("/teams"));
    this.render();
  }

  async render() {
    const container = this.container;
    if (!container) return;

    const team = await db.getById("teams", Number(this.id));
    if (!team) {
      container.innerHTML = `<div class="empty-state"><p>Equipo no encontrado.</p></div>`;
      return;
    }

    const leagueId = team.leagueId || db.getActiveLeagueId();
    const league = leagueId ? await db.getById("leagues", Number(leagueId)) : null;
    const terms = getSportTerms(league?.sport);
    this.team = team;
    this.terms = terms;

    const allMatches = await db.getByIndex("matches", "leagueId", Number(leagueId));
    const teamMatches = allMatches.filter(
      (m) => m.homeTeamId === team.id || m.awayTeamId === team.id,
    );
    const teams = await db.getByIndex("teams", "leagueId", Number(leagueId));
    const players = await db.getByIndex("players", "teamId", team.id);

    const stats = this.#computeStats(teamMatches, team.id);
    const position = this.#computePosition(teams, allMatches, team.id);

    this.teamById = {};
    teams.forEach((t) => {
      this.teamById[t.id] = t;
    });

    const upcoming = teamMatches
      .filter((m) => !this.#isFinalized(m))
      .sort(this.#byDate);
    const played = teamMatches
      .filter((m) => this.#isFinalized(m))
      .sort(this.#byDateDesc);

    const section = document.createElement("section");
    section.className = "team-detail";

    section.appendChild(this.#buildHeader(team, position));
    section.appendChild(this.#buildStats(stats, terms));
    section.appendChild(this.#buildRoster(players, team));
    section.appendChild(this.#buildMatches("Próximos partidos", upcoming, true));
    section.appendChild(this.#buildMatches("Partidos jugados", played, false));
    section.appendChild(this.#buildChart(played, team));

    const loader = container.querySelector("loading-state");
    if (loader) loader.remove();
    container.appendChild(section);
  }

  #isFinalized(match) {
    return (
      match.status === "Finalizado" ||
      match.status === "finalized" ||
      match.status === "finished"
    );
  }

  #byDate(a, b) {
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

  #computePosition(teams, matches, teamId) {
    const rows = teams
      .map((t) => {
        const s = this.#computeStats(matches, t.id);
        return { id: t.id, pts: s.pts, dif: s.dif, pf: s.pf };
      })
      .sort((a, b) => b.pts - a.pts || b.dif - a.dif || b.pf - a.pf);
    const idx = rows.findIndex((r) => r.id === teamId);
    return idx === -1 ? null : idx + 1;
  }

  #buildHeader(team, position) {
    const header = document.createElement("div");
    header.className = "detail-header";
    if (team.colorPrincipal) {
      header.style.borderLeftColor = team.colorPrincipal;
    }

    const avatar = document.createElement("div");
    avatar.className = "detail-avatar";
    if (team.escudo) {
      const img = document.createElement("img");
      img.src = team.escudo;
      img.alt = team.name || "Equipo";
      avatar.appendChild(img);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "avatar-placeholder";
      placeholder.textContent = this.#initials(team.name);
      if (team.colorPrincipal) {
        placeholder.style.background = `linear-gradient(135deg, ${team.colorPrincipal}, ${team.colorSecundario || "#4834b0"})`;
      }
      avatar.appendChild(placeholder);
    }

    const info = document.createElement("div");
    info.className = "detail-header-info";

    const h1 = document.createElement("h1");
    h1.textContent = team.name || "Equipo sin nombre";

    const meta = document.createElement("div");
    meta.className = "detail-meta";
    if (position != null) {
      const pos = document.createElement("span");
      pos.className = "detail-number";
      pos.textContent = `#${position} en la tabla`;
      meta.appendChild(pos);
    }
    if (team.ciudad) {
      const city = document.createElement("span");
      city.textContent = team.ciudad;
      meta.appendChild(city);
    }
    if (team.colorPrincipal || team.colorSecundario) {
      const colors = document.createElement("span");
      colors.className = "team-color-dots";
      if (team.colorPrincipal) {
        colors.appendChild(this.#colorDot(team.colorPrincipal, "Color principal"));
      }
      if (team.colorSecundario) {
        colors.appendChild(this.#colorDot(team.colorSecundario, "Color secundario"));
      }
      meta.appendChild(colors);
    }

    info.appendChild(h1);
    info.appendChild(meta);

    header.appendChild(avatar);
    header.appendChild(info);
    return header;
  }

  #colorDot(color, title) {
    const dot = document.createElement("span");
    dot.className = "team-color-dot";
    dot.style.background = color;
    dot.title = title;
    return dot;
  }

  #buildStats(stats, terms) {
    const grid = document.createElement("div");
    grid.className = "stat-grid";

    const items = [
      ["PJ", stats.pj],
      ["PG", stats.pg],
      ["PE", stats.pe],
      ["PP", stats.pp],
      [terms.gf, stats.pf],
      [terms.gc, stats.pc],
      ["DIF", stats.dif],
      ["Pts", stats.pts],
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

  #buildRoster(players, team) {
    const section = document.createElement("section");
    section.className = "detail-section";

    const heading = document.createElement("div");
    heading.className = "detail-section-head";

    const h2 = document.createElement("h2");
    h2.textContent = `Plantilla (${players.length})`;

    const addBtn = document.createElement("button");
    addBtn.className = "btn btn-sm btn-primary";
    addBtn.textContent = "+ Agregar jugador";
    addBtn.addEventListener("click", () => {
      const form = document.createElement("player-form");
      form.setAttribute("team-id", team.id);
      form.addEventListener("player-created", () => this.render());
      this.container.appendChild(form);
    });

    heading.appendChild(h2);
    heading.appendChild(addBtn);

    const panel = document.createElement("div");
    panel.className = "detail-panel";

    if (players.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      const p = document.createElement("p");
      p.textContent = "Este equipo aún no tiene jugadores.";
      empty.appendChild(p);
      panel.appendChild(empty);
    } else {
      const grid = document.createElement("div");
      grid.className = "roster-grid";
      players.forEach((p) => {
        const card = document.createElement("player-card");
        card.data = {
          ...p,
          teamName: team.name,
          teamEscudo: team.escudo,
          teamColor: team.colorPrincipal,
          teamColorSecundario: team.colorSecundario,
        };
        card.addEventListener("click", () => this.router.navigateTo(`/player/${p.id}`));
        grid.appendChild(card);
      });
      panel.appendChild(grid);
    }

    section.appendChild(heading);
    section.appendChild(panel);
    return section;
  }

  #buildMatches(title, matches, isUpcoming) {
    const section = document.createElement("section");
    section.className = "detail-section";

    const h2 = document.createElement("h2");
    h2.textContent = title;

    const panel = document.createElement("div");
    panel.className = "detail-panel";

    if (matches.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      const p = document.createElement("p");
      p.textContent = isUpcoming
        ? "No hay partidos programados."
        : "Este equipo aún no ha jugado partidos.";
      empty.appendChild(p);
      panel.appendChild(empty);
      section.appendChild(h2);
      section.appendChild(panel);
      return section;
    }

    const list = document.createElement("ul");
    list.className = "history-list";

    matches.forEach((m) => this.#appendMatchRow(list, m, isUpcoming));

    panel.appendChild(list);
    section.appendChild(h2);
    section.appendChild(panel);
    return section;
  }

  #appendMatchRow(list, match, isUpcoming) {
    const team = this.team;
    const isHome = match.homeTeamId === team.id;
    const rivalId = isHome ? match.awayTeamId : match.homeTeamId;
    const rivalName = this.teamById?.[rivalId]?.name || "Por definir";

    const li = document.createElement("li");
    li.className = "history-row";
    li.addEventListener("click", () => this.router.navigateTo(`/match/${match.id}`));

    const rival = document.createElement("span");
    rival.className = "history-rival";
    rival.textContent = rivalName;

    li.appendChild(rival);

    if (isUpcoming) {
      const status = document.createElement("span");
      status.className = "history-score";
      status.textContent = "Programado";
      li.appendChild(status);
    } else {
      const score = document.createElement("span");
      score.className = "history-score";
      score.textContent = `${match.homeScore} - ${match.awayScore}`;
      li.appendChild(score);

      const result = this.#resultOf(match);
      if (result) {
        const badge = document.createElement("span");
        badge.className = `result result-${result.key.toLowerCase()}`;
        badge.textContent = result.label;
        li.appendChild(badge);
      }
    }

    const date = document.createElement("span");
    date.className = "history-date";
    date.textContent = match.date ? formatDate(match.date) : "Sin fecha";
    li.appendChild(date);

    list.appendChild(li);
  }

  #resultOf(match) {
    const team = this.team;
    const isHome = match.homeTeamId === team.id;
    const own = isHome ? match.homeScore : match.awayScore;
    const rival = isHome ? match.awayScore : match.homeScore;
    if (own > rival) return { key: "V", label: "Victoria" };
    if (own < rival) return { key: "D", label: "Derrota" };
    return { key: "E", label: "Empate" };
  }

  #buildChart(played, team) {
    const section = document.createElement("section");
    section.className = "detail-section";

    const h2 = document.createElement("h2");
    h2.textContent = "Evolución de puntos";

    const panel = document.createElement("div");
    panel.className = "detail-panel";
    const wrapper = document.createElement("div");
    wrapper.className = "chart-wrapper";

    if (played.length === 0) {
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

    let cumulative = 0;
    const labels = [];
    const data = [];
    played.forEach((m) => {
      const res = this.#resultOf(m);
      cumulative += res.key === "V" ? 3 : res.key === "E" ? 1 : 0;
      labels.push(m.date ? new Date(m.date).toLocaleDateString("es-ES") : `Partido #${m.id}`);
      data.push(cumulative);
    });

    chartEl.render({
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Puntos acumulados",
            data,
            borderColor: team?.colorPrincipal || "#6c5ce7",
            backgroundColor: team?.colorPrincipal || "#6c5ce7",
            tension: 0.3,
            fill: true,
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

  #initials(name) {
    return (name || "?")
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  unmount() {
    this.container = null;
  }
}
