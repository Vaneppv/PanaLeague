export class BracketView extends HTMLElement {
  set data(value) {
    if (Array.isArray(value)) {
      this.matches = value;
      this.teams = [];
    } else {
      const { matches = [], teams = [] } = value || {};
      this.matches = matches;
      this.teams = teams;
    }
    this.buildDOM();
  }

  get data() {
    return { matches: this.matches, teams: this.teams };
  }

  #initials(name) {
    return (name || "?")
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  #teamById() {
    const map = {};
    (this.teams || []).forEach((t) => {
      map[t.id] = t;
    });
    return map;
  }

  #teamCell(teamId, score, winner) {
    const row = document.createElement("div");
    row.className = "brk-team";
    if (winner) row.classList.add("winner");

    const avatar = document.createElement("span");
    avatar.className = "brk-avatar";
    const team = teamId != null ? this.#teamById()[teamId] : null;

    if (team?.escudo) {
      const img = document.createElement("img");
      img.src = team.escudo;
      img.alt = team.name || "Equipo";
      avatar.appendChild(img);
    } else {
      avatar.textContent = team ? this.#initials(team.name) : "·";
      if (team?.colorPrincipal) avatar.style.background = team.colorPrincipal;
    }

    const name = document.createElement("span");
    name.className = "brk-name";
    name.textContent = team ? team.name : "Por definir";

    row.appendChild(avatar);
    row.appendChild(name);

    if (score != null) {
      const scoreEl = document.createElement("span");
      scoreEl.className = "brk-score";
      scoreEl.textContent = score;
      row.appendChild(scoreEl);
    }

    return row;
  }

  buildDOM() {
    this.innerHTML = "";

    const matches = this.matches || [];
    if (matches.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      const p = document.createElement("p");
      p.textContent = "Aún no hay brackets en esta liga.";
      empty.appendChild(p);
      this.appendChild(empty);
      return;
    }

    const byRound = new Map();
    let maxRound = 0;
    matches.forEach((m) => {
      const r = m.round || 1;
      if (!byRound.has(r)) byRound.set(r, []);
      byRound.get(r).push(m);
      if (r > maxRound) maxRound = r;
    });

    const totalSlots = Math.pow(2, maxRound - 1);
    const gridRows = totalSlots * 2;

    const grid = document.createElement("div");
    grid.className = "bracket-grid";
    grid.style.gridTemplateColumns = `repeat(${maxRound}, minmax(160px, 1fr))`;
    grid.style.gridTemplateRows = `repeat(${gridRows}, 1fr)`;

    for (let r = 1; r <= maxRound; r++) {
      const roundMatches = (byRound.get(r) || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0));
      const count = Math.max(roundMatches.length, 1);
      const leafSpan = Math.floor(totalSlots / count) || 1;

      roundMatches.forEach((m, i) => {
        const startLeaf = i * leafSpan;
        const rowStart = startLeaf * 2 + 1;
        const rowEnd = startLeaf * 2 + leafSpan * 2;

        const cell = document.createElement("div");
        cell.className = "bracket-cell";
        cell.style.gridColumn = String(r);
        cell.style.gridRow = `${rowStart} / ${rowEnd + 1}`;

        const box = document.createElement("div");
        box.className = "bracket-match";

        const homeId = m.homeTeamId != null ? m.homeTeamId : null;
        const awayId = m.awayTeamId != null ? m.awayTeamId : null;
        const homeScore = m.homeScore;
        const awayScore = m.awayScore;
        const played =
          (m.status === "Finalizado" || m.status === "finalized" || m.status === "finished") &&
          homeScore != null &&
          awayScore != null;

        let winnerId = null;
        if (played && homeScore !== awayScore) {
          winnerId = homeScore > awayScore ? homeId : awayId;
        }

        box.appendChild(this.#teamCell(homeId, homeScore, winnerId === homeId));
        box.appendChild(this.#teamCell(awayId, awayScore, winnerId === awayId));

        if (!played) {
          const pending = document.createElement("div");
          pending.className = "brk-pending";
          pending.textContent = "Por definir";
          box.appendChild(pending);
        }

        if (m.id) {
          box.classList.add("clickable");
          box.addEventListener("click", () => {
            window.location.hash = `/match/${m.id}`;
          });
        }

        cell.appendChild(box);
        grid.appendChild(cell);
      });
    }

    this.appendChild(grid);
  }
}
customElements.define("bracket-view", BracketView);
