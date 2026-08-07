import db from "../db.js";
import "../components/team-card.js";
import "../components/team-form.js";
import { saveListState, readListState, clearListState } from "../utils/nav-state.js";
import { showToast } from "../components/toast.js";

export class TeamsView {
  constructor({ router }) {
    this.router = router;
    this.container = null;
  }

  mount(container) {
    this.container = container;

    // Restaura el scroll guardado al volver desde #team/:id.
    const saved = readListState("/teams");
    this.pendingScroll = saved?.scrollTop ?? null;
    clearListState("/teams");

    container.innerHTML = `
      <div class="page-header">
        <h1>Equipos</h1>
        <button class="btn btn-primary" id="create-team">+ Nuevo Equipo</button>
      </div>
      <loading-state message="Cargando equipos..."></loading-state>
    `;
    container.querySelector("#create-team").addEventListener("click", () => {
      const form = document.createElement("team-form");
      form.addEventListener("team-created", () => this.render());
      this.container.appendChild(form);
    });
    this.render().then(() => this.#restoreScroll());
  }

  async render() {
    const leagueId = db.getActiveLeagueId();

    if (!leagueId) {
      this.container.innerHTML = `<div class="empty-state"><p>No hay una liga activa. Selecciona una desde Ligas.</p></div>`;
      return;
    }

    const teams = await db.getByIndex("teams", "leagueId", Number(leagueId));
    const allMatches = await db.getByIndex("matches", "leagueId", Number(leagueId));
    let list = this.container.querySelector("#team-list");
    if (!list) {
      list = document.createElement("div");
      list.id = "team-list";
    } else {
      list.innerHTML = "";
    }
    list.className = "card-grid";

    if (teams.length === 0) {
      list.innerHTML = `<div class="empty-state"><p>No hay equipos en esta liga.</p></div>`;
    } else {
      for (const t of teams) {
        const players = await db.getByIndex("players", "teamId", t.id);
        const card = document.createElement("team-card");
        card.data = { ...t, playerCount: players.length };
        card.addEventListener("click", () => {
          // Guarda el scroll antes de ir al detalle.
          saveListState("/teams", { scrollTop: window.scrollY });
          this.router.navigateTo(`/team/${t.id}`);
        });
        list.appendChild(card);

        const actions = document.createElement("div");
        actions.style.cssText = "display:flex;gap:0.25rem;margin-top:0.5rem;justify-content:center";

        const editBtn = document.createElement("button");
        editBtn.className = "btn btn-sm btn-secondary";
        editBtn.textContent = "Editar";
        editBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const form = document.createElement("team-form");
          form.setAttribute("edit-id", t.id);
          form.addEventListener("team-updated", () => this.render());
          this.container.appendChild(form);
        });

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "btn btn-sm btn-danger";
        deleteBtn.textContent = "Eliminar";
        deleteBtn.addEventListener("click", (e) => this.#deleteTeam(e, t.id, teams, allMatches));

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);
        card.appendChild(actions);
      }
    }

    const loader = this.container.querySelector("loading-state");
    if (loader) loader.remove();
    this.container.appendChild(list);
  }

  async #deleteTeam(e, teamId, teams, allMatches) {
    e.stopPropagation();

    const teamMatches = allMatches.filter(
      (m) => m.homeTeamId === teamId || m.awayTeamId === teamId,
    );

    if (teamMatches.length > 0) {
      showToast(
        "No se puede eliminar un equipo que tiene partidos programados o jugados",
        "error",
      );
      return;
    }

    const { ConfirmDialog } = await import("../components/confirm-dialog.js");
    const players = await db.getByIndex("players", "teamId", teamId);

    if (players.length > 0) {
      const confirmed = await ConfirmDialog.show(
        "Eliminar equipo",
        `Este equipo tiene ${players.length} jugador(es). ¿Eliminar también todos sus jugadores?`,
      );
      if (!confirmed) return;

      await db.runTransaction(["players", "teams"], "readwrite", (stores) => {
        players.forEach((p) => stores.players.delete(p.id));
        stores.teams.delete(teamId);
      });
    } else {
      const confirmed = await ConfirmDialog.show(
        "Eliminar equipo",
        "¿Estás seguro de eliminar este equipo?",
      );
      if (!confirmed) return;
      await db.remove("teams", teamId);
    }

    showToast("Equipo eliminado", "success");
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
