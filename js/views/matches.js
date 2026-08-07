import db from "../db.js";
import "../components/match-card.js";
import "../components/confirm-dialog.js";
import { ConfirmDialog } from "../components/confirm-dialog.js";
import { getSportTerms } from "../sports-terms.js";
import { roundLabel } from "../utils/helpers.js";
import { saveListState, readListState, clearListState } from "../utils/nav-state.js";
import { showToast } from "../components/toast.js";

/**
 * MatchesView: listado de partidos de la liga activa con filtros
 * (estado, equipo, rango de fecha y ronda en torneo) y CRUD en
 * modalidad liga (crear/editar/eliminar solo partidos programados).
 */
export class MatchesView {
  constructor({ router }) {
    this.router = router;
    this.container = null;
    this.filters = { status: "all", teamId: "all", round: "all", from: "", to: "" };
  }

  mount(container) {
    this.container = container;

    // Restaura filtros y scroll guardados al volver desde #match/:id (req 2.3).
    const saved = readListState("/matches");
    if (saved?.filters) this.filters = { ...this.filters, ...saved.filters };
    this.pendingScroll = saved?.scrollTop ?? null;
    clearListState("/matches");

    container.innerHTML = `<loading-state message="Cargando partidos..."></loading-state>`;
    this.render().then(() => this.#restoreScroll());
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
    const isTournament = league.modalidad === "tournament";

    const [teams, matches] = await Promise.all([
      db.getByIndex("teams", "leagueId", Number(leagueId)),
      db.getByIndex("matches", "leagueId", Number(leagueId)),
    ]);

    this.league = league;
    this.teams = teams;
    this.matches = matches;
    this.isTournament = isTournament;

    this.teamById = {};
    teams.forEach((t) => (this.teamById[t.id] = t));

    const loader = container.querySelector("loading-state");
    if (loader) loader.remove();

    const section = document.createElement("section");

    const header = document.createElement("div");
    header.className = "page-header";
    header.innerHTML = `<div><h1>${terms.icon} Partidos</h1><span class="dashboard-subtitle">${league.name} — ${league.temporada}</span></div>`;
    if (!isTournament) {
      const createBtn = document.createElement("button");
      createBtn.className = "btn btn-primary";
      createBtn.textContent = "+ Nuevo Partido";
      createBtn.addEventListener("click", () => this.#openForm(null));
      header.appendChild(createBtn);
    }
    section.appendChild(header);

    const layout = document.createElement("div");
    layout.className = "matches-layout";
    layout.appendChild(this.#buildFilters());
    layout.appendChild(this.#buildResults());
    section.appendChild(layout);

    container.appendChild(section);
  }

  // Filtros: estado, equipo, fecha (desde/hasta) y ronda en torneo.
  #buildFilters() {
    const panel = document.createElement("aside");
    panel.className = "filter-panel";

    const h2 = document.createElement("h2");
    h2.textContent = "Filtros";
    panel.appendChild(h2);

    const clear = document.createElement("button");
    clear.className = "btn btn-sm btn-secondary";
    clear.textContent = "Limpiar filtros";
    clear.addEventListener("click", () => {
      this.filters = { status: "all", teamId: "all", round: "all", from: "", to: "" };
      this.#refreshResults();
    });
    panel.appendChild(clear);

    const statusGroup = this.#filterSelect("Estado", "status", [
      ["all", "Todos"],
      ["Programado", "Programados"],
      ["Finalizado", "Finalizados"],
    ]);
    panel.appendChild(statusGroup);

    const teamOptions = [
      ["all", "Todos los equipos"],
      ...this.teams.map((t) => [String(t.id), t.name]),
    ];
    panel.appendChild(this.#filterSelect("Equipo", "teamId", teamOptions));

    panel.appendChild(
      this.#filterDate("Desde", "from"),
    );
    panel.appendChild(
      this.#filterDate("Hasta", "to"),
    );

    if (this.isTournament) {
      const totalRounds = Math.log2(this.teams.length) || 1;
      const roundOptions = [
        ["all", "Todas las rondas"],
        ...Array.from({ length: totalRounds }, (_, i) => [
          String(i + 1),
          roundLabel(i + 1, this.teams.length),
        ]),
      ];
      panel.appendChild(this.#filterSelect("Ronda", "round", roundOptions));
    }

    return panel;
  }

  // Grupo de filtro genérico: label + select con opciones.
  #filterSelect(label, name, options) {
    const group = document.createElement("div");
    group.className = "filter-group";

    const lbl = document.createElement("label");
    lbl.textContent = label;

    const sel = document.createElement("select");
    sel.className = "filter-select";
    sel.value = this.filters[name];
    options.forEach(([value, text]) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = text;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", () => {
      this.filters[name] = sel.value;
      this.#refreshResults();
    });

    group.appendChild(lbl);
    group.appendChild(sel);
    return group;
  }

  // Grupo de filtro de fecha (rango).
  #filterDate(label, name) {
    const group = document.createElement("div");
    group.className = "filter-group";

    const lbl = document.createElement("label");
    lbl.textContent = label;

    const input = document.createElement("input");
    input.type = "date";
    input.className = "filter-input";
    input.value = this.filters[name];
    input.addEventListener("change", () => {
      this.filters[name] = input.value;
      this.#refreshResults();
    });

    group.appendChild(lbl);
    group.appendChild(input);
    return group;
  }

  // Aplica los filtros a la lista completa de partidos.
  #applyFilters() {
    const f = this.filters;
    return this.matches.filter((m) => {
      if (f.status !== "all" && m.status !== f.status) return false;
      if (
        f.teamId !== "all" &&
        m.homeTeamId !== Number(f.teamId) &&
        m.awayTeamId !== Number(f.teamId)
      )
        return false;
      if (f.round !== "all" && m.round !== Number(f.round)) return false;

      const day = m.date ? m.date.slice(0, 10) : "";
      if (f.from && day && day < f.from) return false;
      if (f.to && day && day > f.to) return false;
      return true;
    });
  }

  // Ordena por fecha descendente; los sin fecha quedan al final.
  #byDateDesc(a, b) {
    const da = a.date || "";
    const db = b.date || "";
    if (da && db) return da < db ? 1 : da > db ? -1 : 0;
    if (da) return -1;
    if (db) return 1;
    return b.id - a.id;
  }

  // Listado de partidos filtrados con tarjetas MatchCard.
  #buildResults() {
    const results = document.createElement("div");
    results.className = "results-section";

    const filtered = this.#applyFilters().sort(this.#byDateDesc);

    if (this.matches.length === 0) {
      results.innerHTML = `<div class="empty-state"><p>No hay partidos en esta liga.</p></div>`;
      return results;
    }
    if (filtered.length === 0) {
      results.innerHTML = `<div class="empty-state"><p>No hay partidos con los filtros aplicados.</p></div>`;
      return results;
    }

    const grid = document.createElement("div");
    grid.className = "card-grid";
    filtered.forEach((m) => grid.appendChild(this.#matchItem(m)));
    results.appendChild(grid);
    return results;
  }

  // Tarjeta de partido + acciones de editar/eliminar (solo liga, programados).
  #matchItem(match) {
    const wrap = document.createElement("div");
    wrap.className = "match-item";

    const card = document.createElement("match-card");
    card.data = {
      match,
      homeTeam: this.teamById[match.homeTeamId] || {},
      awayTeam: this.teamById[match.awayTeamId] || {},
      roundLabel: this.isTournament ? roundLabel(match.round, this.teams.length) : null,
    };
    card.addEventListener("click", () => {
      // Guarda filtros y scroll antes de ir al detalle.
      saveListState("/matches", { filters: { ...this.filters }, scrollTop: window.scrollY });
      this.router.navigateTo(`/match/${match.id}`);
    });
    wrap.appendChild(card);

    if (match.status !== "Finalizado") {
      const actions = document.createElement("div");
      actions.className = "match-item-actions";

      // En modalidad liga se editan equipos y fecha; en eliminación directa
      // solo se puede editar la fecha (req 4.7.3).
      const editBtn = document.createElement("button");
      editBtn.className = "btn btn-sm btn-secondary";
      editBtn.textContent = this.isTournament ? "Editar fecha" : "Editar";
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.#openForm(match, this.isTournament);
      });
      actions.appendChild(editBtn);

      // Eliminar partido solo aplica en modalidad liga (req 4.7.4).
      if (!this.isTournament) {
        const delBtn = document.createElement("button");
        delBtn.className = "btn btn-sm btn-danger";
        delBtn.textContent = "Eliminar";
        delBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const confirmed = await ConfirmDialog.show(
            "Eliminar partido",
            "¿Eliminar este partido programado? Esta acción no se puede deshacer.",
          );
          if (!confirmed) return;
          try {
            await db.remove("matches", match.id);
            showToast("Partido eliminado", "success");
            this.matches = this.matches.filter((m) => m.id !== match.id);
            this.#refreshResults();
          } catch (err) {
            showToast("No se pudo eliminar el partido", "error");
          }
        });
        actions.appendChild(delBtn);
      }

      wrap.appendChild(actions);
    }

    return wrap;
  }

  // Re-renderiza solo la lista de resultados tras un cambio de filtros.
  #refreshResults() {
    const slot = this.container.querySelector(".results-section");
    if (!slot) return;
    slot.replaceChildren(this.#buildResults());
  }

  // Diálogo crear/editar partido (solo modalidad liga) o editar fecha
  // (modalidad eliminación directa, req 4.7.3).
  #openForm(match, onlyDate = false) {
    const overlay = document.createElement("div");
    overlay.className = "dialog-overlay";

    const dialog = document.createElement("div");
    dialog.className = "league-form-dialog";

    const h3 = document.createElement("h3");
    h3.textContent = onlyDate
      ? "Editar Fecha"
      : match
        ? "Editar Partido"
        : "Nuevo Partido";
    dialog.appendChild(h3);

    const form = document.createElement("form");

    // En torneo no se editan los equipos: el bracket ya fijó los slots.
    if (!onlyDate) {
      form.appendChild(this.#selectGroup("Equipo local", "home", match?.homeTeamId));
      form.appendChild(this.#selectGroup("Equipo visitante", "away", match?.awayTeamId));
    }

    const dateGroup = document.createElement("div");
    dateGroup.className = "form-group";
    const dateLabel = document.createElement("label");
    dateLabel.className = "form-label";
    dateLabel.htmlFor = "match-date";
    dateLabel.textContent = "Fecha y hora";
    const dateInput = document.createElement("input");
    dateInput.className = "form-input";
    dateInput.type = "datetime-local";
    dateInput.id = "match-date";
    dateInput.name = "date";
    dateInput.required = true;
    if (match?.date) dateInput.value = match.date.slice(0, 16);
    dateGroup.appendChild(dateLabel);
    dateGroup.appendChild(dateInput);
    form.appendChild(dateGroup);

    const actions = document.createElement("div");
    actions.className = "dialog-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn-secondary";
    cancelBtn.textContent = "Cancelar";
    cancelBtn.addEventListener("click", () => overlay.remove());

    const submitBtn = document.createElement("button");
    submitBtn.type = "submit";
    submitBtn.className = "btn btn-primary";
    submitBtn.textContent = match ? "Guardar" : "Crear";

    actions.appendChild(cancelBtn);
    actions.appendChild(submitBtn);
    form.appendChild(actions);

    form.addEventListener("submit", (e) => this.#handleFormSubmit(e, match, overlay, onlyDate));

    dialog.appendChild(form);
    overlay.appendChild(dialog);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
    this.container.appendChild(overlay);
  }

  #selectGroup(label, name, selectedId) {
    const group = document.createElement("div");
    group.className = "form-group";

    const lbl = document.createElement("label");
    lbl.className = "form-label";
    lbl.htmlFor = `match-${name}`;
    lbl.textContent = label;

    const sel = document.createElement("select");
    sel.className = "form-select";
    sel.id = `match-${name}`;
    sel.name = name;
    sel.required = true;

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "Seleccionar...";
    sel.appendChild(empty);

    this.teams.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.name;
      sel.appendChild(opt);
    });

    if (selectedId) sel.value = selectedId;

    group.appendChild(lbl);
    group.appendChild(sel);
    return group;
  }

  // Validaciones de creación/edición de partidos (modalidad liga) y de
  // edición de fecha en eliminación directa (solo cambia `date`).
  async #handleFormSubmit(e, match, overlay, onlyDate = false) {
    e.preventDefault();
    const form = e.target;

    const dateValue = form.date.value;
    if (!dateValue) {
      showToast("La fecha y hora son obligatorias", "error");
      return;
    }

    const isoDate = new Date(dateValue).toISOString();

    // En torneo solo se actualiza la fecha; los equipos los fija el bracket.
    if (onlyDate) {
      try {
        await db.put("matches", { ...match, date: isoDate });
        showToast("Fecha actualizada", "success");
      } catch (err) {
        showToast("No se pudo actualizar la fecha", "error");
      }
      overlay.remove();
      this.render();
      return;
    }

    const homeId = Number(form.home.value);
    const awayId = Number(form.away.value);

    if (!homeId || !awayId) {
      showToast("Selecciona ambos equipos", "error");
      return;
    }
    if (homeId === awayId) {
      showToast("Un equipo no puede enfrentarse a sí mismo", "error");
      return;
    }

    // No se permiten dos partidos con los mismos equipos en la misma fecha.
    const duplicate = this.matches.find(
      (m) =>
        m.id !== (match?.id ?? -1) &&
        m.homeTeamId === homeId &&
        m.awayTeamId === awayId &&
        m.date === isoDate,
    );
    if (duplicate) {
      showToast("Ya existe un partido con los mismos equipos en esa fecha", "error");
      return;
    }

    try {
      if (match) {
        await db.put("matches", {
          ...match,
          homeTeamId: homeId,
          awayTeamId: awayId,
          date: isoDate,
        });
        showToast("Partido actualizado", "success");
      } else {
        await db.add("matches", {
          leagueId: this.league.id,
          homeTeamId: homeId,
          awayTeamId: awayId,
          date: isoDate,
          status: "Programado",
          homeScore: null,
          awayScore: null,
          round: null,
          position: null,
        });
        showToast("Partido creado", "success");
      }
      overlay.remove();
      this.render();
    } catch (err) {
      showToast("No se pudo guardar el partido", "error");
    }
  }

  // Restaura el scroll guardado tras terminar de renderizar.
  #restoreScroll() {
    if (this.pendingScroll != null) {
      window.scrollTo(0, this.pendingScroll);
      this.pendingScroll = null;
    }
  }
}
