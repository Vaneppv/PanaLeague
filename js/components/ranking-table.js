export class RankingTable extends HTMLElement {
  set data(value) {
    if (Array.isArray(value)) {
      this.players = value;
      this.events = [];
      this.teams = [];
      this.terms = {};
    } else {
      const { players = [], events = [], teams = [], terms = {} } = value || {};
      this.players = players;
      this.events = events;
      this.teams = teams;
      this.terms = terms;
    }
    this.buildDOM();
  }

  get data() {
    return {
      players: this.players,
      events: this.events,
      teams: this.teams,
      terms: this.terms,
    };
  }

  #initials(name) {
    return (name || "?")
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  #buildPlayerCell(player, team) {
    const cell = document.createElement("td");
    const wrapper = document.createElement("div");
    wrapper.className = "rk-player";

    const avatar = document.createElement("span");
    avatar.className = "rk-avatar";
    if (player.photo) {
      const img = document.createElement("img");
      img.src = player.photo;
      img.alt = player.name || "Jugador";
      avatar.appendChild(img);
    } else {
      avatar.textContent = this.#initials(player.name);
      if (team?.colorPrincipal) avatar.style.background = team.colorPrincipal;
    }

    const name = document.createElement("span");
    name.className = "rk-name";
    name.textContent = player.name || "Sin nombre";

    wrapper.appendChild(avatar);
    wrapper.appendChild(name);
    cell.appendChild(wrapper);
    return cell;
  }

  #numCell(value, extra = "") {
    const td = document.createElement("td");
    td.className = `rk-num ${extra}`.trim();
    td.textContent = value;
    return td;
  }

  buildDOM() {
    this.innerHTML = "";

    const goalsByPlayer = {};
    const matchesByPlayer = {};
    this.events.forEach((e) => {
      if (e.playerId == null) return;
      goalsByPlayer[e.playerId] = (goalsByPlayer[e.playerId] || 0) + 1;
      if (!matchesByPlayer[e.playerId]) matchesByPlayer[e.playerId] = new Set();
      matchesByPlayer[e.playerId].add(e.matchId);
    });

    const teamById = {};
    this.teams.forEach((t) => {
      teamById[t.id] = t;
    });

    const ranked = this.players
      .filter((p) => (goalsByPlayer[p.id] || 0) > 0)
      .map((p) => {
        const goals = goalsByPlayer[p.id] || 0;
        const pj = matchesByPlayer[p.id] ? matchesByPlayer[p.id].size : 0;
        return {
          player: p,
          team: teamById[p.teamId] || null,
          goals,
          pj,
          average: pj > 0 ? (goals / pj).toFixed(1) : "0.0",
        };
      })
      .sort((a, b) => b.goals - a.goals || b.average - a.average)
      .slice(0, 10);

    if (ranked.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      const p = document.createElement("p");
      p.textContent = `Aún no hay ${this.terms.scorers || "anotadores"} registrados.`;
      empty.appendChild(p);
      this.appendChild(empty);
      return;
    }

    const wrap = document.createElement("div");
    wrap.className = "ranking-wrap";

    const table = document.createElement("table");
    table.className = "ranking-table";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    const headers = [
      "#",
      "Jugador",
      "Equipo",
      this.terms.eventNamePlural || "Anotaciones",
      "PJ",
      "Promedio",
    ];
    headers.forEach((label, i) => {
      const th = document.createElement("th");
      th.textContent = label;
      if (i > 2) th.classList.add("rk-num");
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    ranked.forEach(({ player, team, goals, pj, average }, index) => {
      const tr = document.createElement("tr");
      tr.addEventListener("click", () => {
        window.location.hash = `/player/${player.id}`;
      });

      const posTd = document.createElement("td");
      posTd.className = "rk-pos";
      posTd.textContent = index + 1;
      if (index < 3) posTd.classList.add("top");

      tr.appendChild(posTd);
      tr.appendChild(this.#buildPlayerCell(player, team));

      const teamTd = document.createElement("td");
      teamTd.className = "rk-team";
      teamTd.textContent = team?.name || "Sin equipo";

      tr.appendChild(teamTd);
      tr.appendChild(this.#numCell(goals, "rk-goals"));
      tr.appendChild(this.#numCell(pj));
      tr.appendChild(this.#numCell(average));

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    this.appendChild(wrap);
  }
}
customElements.define("ranking-table", RankingTable);