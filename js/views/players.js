import db from "../db.js";
import "../components/player-form.js";
import "../components/player-card.js";
import { showToast } from "../components/toast.js";
import { debounce } from "../utils/helpers.js";
import { saveListState, readListState, clearListState } from "../utils/nav-state.js";

export class PlayersView {
  constructor({ router }) {
    this.router = router;
    this.container = null;
  }

  mount(container) {
    this.container = container;

    const layout = document.createElement("div");
    layout.className = "players-layout";

    const filterPanel = document.createElement("aside");
    filterPanel.className = "filter-panel";
    filterPanel.id = "player-filters";
    filterPanel.style.display = "none";

    const filterTitle = document.createElement("h2");
    filterTitle.textContent = "Filtros";
    filterPanel.appendChild(filterTitle);

    const clearBtn = document.createElement("button");
    clearBtn.id = "filter-clear";
    clearBtn.className = "btn btn-secondary btn-sm";
    clearBtn.textContent = "Limpiar filtros";
    clearBtn.addEventListener("click", () => {
      this.container.querySelector("#filter-search").value = "";
      this.container.querySelector("#filter-team").value = "";
      this.container.querySelector("#filter-position").value = "";
      this.render();
    });
    filterPanel.appendChild(clearBtn);

    const searchGroup = document.createElement("div");
    searchGroup.className = "filter-group";
    const searchLabel = document.createElement("label");
    searchLabel.textContent = "Buscar";
    searchGroup.appendChild(searchLabel);
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.id = "filter-search";
    searchInput.className = "filter-input";
    searchInput.placeholder = "Por nombre...";
    searchInput.addEventListener("input", debounce(() => this.render(), 400));
    searchGroup.appendChild(searchInput);
    filterPanel.appendChild(searchGroup);

    const teamGroup = document.createElement("div");
    teamGroup.className = "filter-group";
    const teamLabel = document.createElement("label");
    teamLabel.textContent = "Equipo";
    teamGroup.appendChild(teamLabel);
    const teamSelect = document.createElement("select");
    teamSelect.id = "filter-team";
    teamSelect.className = "filter-select";
    const teamDefault = document.createElement("option");
    teamDefault.value = "";
    teamDefault.textContent = "Todos los equipos";
    teamSelect.appendChild(teamDefault);
    teamSelect.addEventListener("change", () => this.render());
    teamGroup.appendChild(teamSelect);
    filterPanel.appendChild(teamGroup);

    const posGroup = document.createElement("div");
    posGroup.className = "filter-group";
    const posLabel = document.createElement("label");
    posLabel.textContent = "Posición";
    posGroup.appendChild(posLabel);
    const posSelect = document.createElement("select");
    posSelect.id = "filter-position";
    posSelect.className = "filter-select";
    const posDefault = document.createElement("option");
    posDefault.value = "";
    posDefault.textContent = "Todas las posiciones";
    posSelect.appendChild(posDefault);
    posSelect.addEventListener("change", () => this.render());
    posGroup.appendChild(posSelect);
    filterPanel.appendChild(posGroup);

    const resultsSection = document.createElement("section");
    resultsSection.className = "results-section";
    this.resultsSection = resultsSection;

    const header = document.createElement("div");
    header.className = "page-header";

    const title = document.createElement("h1");
    title.textContent = "Jugadores";
    header.appendChild(title);

    const createBtn = document.createElement("button");
    createBtn.className = "btn btn-primary";
    createBtn.id = "create-player";
    createBtn.textContent = "+ Nuevo Jugador";
    createBtn.addEventListener("click", () => {
      const form = document.createElement("player-form");
      form.addEventListener("player-created", () => this.render());
      this.container.appendChild(form);
    });
    header.appendChild(createBtn);

    const loader = document.createElement("loading-state");
    loader.setAttribute("message", "Cargando jugadores...");

    resultsSection.appendChild(header);
    resultsSection.appendChild(loader);
    layout.appendChild(filterPanel);
    layout.appendChild(resultsSection);
    container.appendChild(layout);

    // Restaura filtros y scroll guardados al volver desde #player/:id.
    // El texto de búsqueda se restaura directo; equipo/posición se aplican en
    // render(), cuando ya existen las opciones de los selects.
    const saved = readListState("/players");
    this.pendingFilters = saved?.filters || null;
    if (this.pendingFilters?.search != null) {
      searchInput.value = this.pendingFilters.search;
    }
    this.pendingScroll = saved?.scrollTop ?? null;
    clearListState("/players");

    this.render().then(() => this.#restoreScroll());
  }

  async render() {
    const leagueId = db.getActiveLeagueId();

    if (!leagueId) {
      this.container.textContent = "";
      const msg = document.createElement("div");
      msg.className = "empty-state";
      const p = document.createElement("p");
      p.textContent = "No hay una liga activa.";
      msg.appendChild(p);
      this.container.appendChild(msg);
      return;
    }

    const teams = await db.getByIndex("teams", "leagueId", Number(leagueId));
    const teamMap = {};
    teams.forEach((t) => {
      teamMap[t.id] = t;
    });

    const allPlayers = [];
    for (const team of teams) {
      const players = await db.getByIndex("players", "teamId", team.id);
      allPlayers.push(...players.map((p) => ({ ...p, teamId: team.id })));
    }

    const loader = this.container.querySelector("loading-state");
    if (loader) loader.remove();

    const filters = this.container.querySelector("#player-filters");
    const teamFilter = this.container.querySelector("#filter-team");
    const positionFilter = this.container.querySelector("#filter-position");

    if (filters && teams.length > 0) {
      filters.style.display = "block";

      const pendingTeam = this.pendingFilters?.team;
      const currentTeamValue = pendingTeam != null ? pendingTeam : teamFilter.value;
      teamFilter.textContent = "";
      const teamDefault = document.createElement("option");
      teamDefault.value = "";
      teamDefault.textContent = "Todos los equipos";
      teamFilter.appendChild(teamDefault);
      teams.forEach((t) => {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = t.name;
        if (t.id == currentTeamValue) opt.selected = true;
        teamFilter.appendChild(opt);
      });

      // El filtro de posición lista las posiciones realmente registradas
      // en los jugadores de la liga activa (req 4.5.1), no el catálogo del
      // deporte, para que cada opción filtre resultados reales.
      const pendingPos = this.pendingFilters?.position;
      const currentPosValue = pendingPos != null ? pendingPos : positionFilter.value;
      positionFilter.textContent = "";
      const posDefault = document.createElement("option");
      posDefault.value = "";
      posDefault.textContent = "Todas las posiciones";
      positionFilter.appendChild(posDefault);
      const registered = Array.from(
        new Set(allPlayers.map((p) => p.position).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b, "es"));
      registered.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p;
        opt.textContent = p;
        if (p === currentPosValue) opt.selected = true;
        positionFilter.appendChild(opt);
      });
    }

    // Los filtros pendientes solo se aplican en el primer render tras volver.
    this.pendingFilters = null;

    const searchVal = this.container.querySelector("#filter-search")?.value?.toLowerCase() || "";
    const teamVal = this.container.querySelector("#filter-team")?.value || "";
    const posVal = this.container.querySelector("#filter-position")?.value || "";

    const filtered = this.#filterPlayers(allPlayers, searchVal, teamVal, posVal);

    this.container.querySelectorAll("#player-list, #player-empty").forEach((el) => el.remove());

    if (filtered.length === 0) {
      const msg = document.createElement("div");
      msg.id = "player-empty";
      msg.className = "empty-state";
      const p = document.createElement("p");
      if (allPlayers.length === 0) {
        p.textContent = "No hay jugadores en esta liga.";
      } else {
        p.textContent = "No se encontraron jugadores con los filtros aplicados.";
      }
      msg.appendChild(p);
      this.resultsSection.appendChild(msg);
      return;
    }

    const allEvents = await db.getAll("events");
    const playerHasEvents = {};
    allEvents.forEach((e) => {
      playerHasEvents[e.playerId] = true;
    });

    let list = this.container.querySelector("#player-list");
    if (!list) {
      list = document.createElement("div");
      list.id = "player-list";
    } else {
      while (list.firstChild) list.removeChild(list.firstChild);
    }
    list.className = "card-grid";

    for (const p of filtered) {
      const team = teamMap[p.teamId] || {};
      const card = document.createElement("player-card");
      card.data = {
        ...p,
        teamName: team.name,
        teamEscudo: team.escudo,
        teamColor: team.colorPrincipal,
        teamColorSecundario: team.colorSecundario,
      };
      card.addEventListener("click", () => {
        // Guarda filtros y scroll antes de ir al detalle.
        saveListState("/players", {
          filters: {
            search: this.container.querySelector("#filter-search")?.value || "",
            team: this.container.querySelector("#filter-team")?.value || "",
            position: this.container.querySelector("#filter-position")?.value || "",
          },
          scrollTop: window.scrollY,
        });
        this.router.navigateTo(`/player/${p.id}`);
      });
      list.appendChild(card);

      const actions = document.createElement("div");
      actions.style.cssText = "display:flex;gap:0.25rem;margin-top:0.5rem;justify-content:center";

      const editBtn = document.createElement("button");
      editBtn.className = "btn btn-sm btn-secondary";
      editBtn.textContent = "Editar";
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const form = document.createElement("player-form");
        form.setAttribute("edit-id", p.id);
        form.addEventListener("player-updated", () => this.render());
        this.container.appendChild(form);
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn btn-sm btn-danger";
      deleteBtn.textContent = "Eliminar";
      deleteBtn.addEventListener("click", (e) => this.#deletePlayer(e, p.id, playerHasEvents));

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
      card.appendChild(actions);
    }

    this.resultsSection.appendChild(list);
  }

  #filterPlayers(players, search, teamId, position) {
    return players.filter((p) => {
      if (search && !p.name?.toLowerCase().includes(search)) return false;
      if (teamId && p.teamId != teamId) return false;
      if (position && p.position !== position) return false;
      return true;
    });
  }

  async #deletePlayer(e, playerId, playerHasEvents) {
    e.stopPropagation();

    if (playerHasEvents[playerId]) {
      showToast(
        "No se puede eliminar un jugador que tiene eventos registrados en partidos",
        "error",
      );
      return;
    }

    const { ConfirmDialog } = await import("../components/confirm-dialog.js");
    const confirmed = await ConfirmDialog.show(
      "Eliminar jugador",
      "¿Estás seguro de eliminar este jugador?",
    );
    if (!confirmed) return;

    await db.remove("players", playerId);
    showToast("Jugador eliminado", "success");
    this.render();
  }

  unmount() {
    this.container = null;
  }

  // Restaura el scroll guardado tras terminar de renderizar.
  #restoreScroll() {
    if (this.pendingScroll != null) {
      window.scrollTo(0, this.pendingScroll);
      this.pendingScroll = null;
    }
  }
}
