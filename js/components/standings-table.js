export class StandingsTable extends HTMLElement {
  set data(value) {
    if (Array.isArray(value)) {
      this.teams = value;
      this.matches = [];
      this.terms = {};
    } else {
      const { teams = [], matches = [], terms = {} } = value || {};
      this.teams = teams;
      this.matches = matches;
      this.terms = terms;
    }
    this.buildDOM();
  }

  get data() {
    return { teams: this.teams, matches: this.matches, terms: this.terms };
  }

  #isFinalized(match) {
    return (
      match.status === "Finalizado" ||
      match.status === "finalized" ||
      match.status === "finished"
    );
  }

  #computeStats(teamId) {
    const stats = { pj: 0, pg: 0, pe: 0, pp: 0, pf: 0, pc: 0, dif: 0, pts: 0 };
    this.matches
      .filter(
        (m) =>
          this.#isFinalized(m) && m.homeScore != null && m.awayScore != null,
      )
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

  #initials(name) {
    return (name || "?")
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  #buildTeamCell(team) {
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

  #numCell(value, extra = "") {
    const td = document.createElement("td");
    td.className = `st-num ${extra}`.trim();
    td.textContent = value;
    return td;
  }

  buildDOM() {
    this.innerHTML = "";

    if (!this.teams || this.teams.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      const p = document.createElement("p");
      p.textContent = "No hay equipos en esta liga.";
      empty.appendChild(p);
      this.appendChild(empty);
      return;
    }

    const rows = this.teams
      .map((team) => ({ team, stats: this.#computeStats(team.id) }))
      .sort(
        (a, b) =>
          b.stats.pts - a.stats.pts ||
          b.stats.dif - a.stats.dif ||
          b.stats.pf - a.stats.pf,
      );

    const wrap = document.createElement("div");
    wrap.className = "standings-wrap";

    const table = document.createElement("table");
    table.className = "standings-table";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    const headers = [
      "#",
      "Equipo",
      "PJ",
      "PG",
      "PE",
      "PP",
      this.terms.gf || "PF",
      this.terms.gc || "PC",
      "DIF",
      "Pts",
    ];
    headers.forEach((label, i) => {
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
      tr.addEventListener("click", () => {
        window.location.hash = `/team/${team.id}`;
      });

      const posTd = document.createElement("td");
      posTd.className = "st-pos";
      posTd.textContent = index + 1;
      if (index < 3) posTd.classList.add("top");

      tr.appendChild(posTd);
      tr.appendChild(this.#buildTeamCell(team));
      tr.appendChild(this.#numCell(stats.pj));
      tr.appendChild(this.#numCell(stats.pg));
      tr.appendChild(this.#numCell(stats.pe));
      tr.appendChild(this.#numCell(stats.pp));
      tr.appendChild(this.#numCell(stats.pf));
      tr.appendChild(this.#numCell(stats.pc));
      tr.appendChild(this.#numCell(stats.dif));
      tr.appendChild(this.#numCell(stats.pts, "pts"));

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    this.appendChild(wrap);
  }
}
customElements.define("standings-table", StandingsTable);
