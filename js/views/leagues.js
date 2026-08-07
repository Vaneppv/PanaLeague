import db from "../db.js";
import "../components/league-form.js";
import { showToast } from "../components/toast.js";
import { generateRoundRobin, generateBracket } from "../utils/helpers.js";
import { saveListState, readListState, clearListState } from "../utils/nav-state.js";
import { getSportTerms } from "../sports-terms.js";
import { exportLeague, importLeague } from "../core/league-io.js";

export class LeaguesView {
  constructor({ router }) {
    this.router = router;
    this.container = null;
  }

  mount(container) {
    this.container = container;

    // Restaura el scroll guardado al volver desde el dashboard.
    const saved = readListState("/leagues");
    this.pendingScroll = saved?.scrollTop ?? null;
    clearListState("/leagues");

    container.innerHTML = `
      <div class="page-header">
        <h1>Ligas</h1>
        <div class="header-actions">
          <button class="btn btn-secondary" id="import-league">Importar</button>
          <button class="btn btn-primary" id="create-league">+ Nueva Liga</button>
        </div>
      </div>
      <loading-state message="Cargando ligas..."></loading-state>
    `;
    container.querySelector("#create-league").addEventListener("click", () => {
      const form = document.createElement("league-form");
      form.addEventListener("league-created", () => this.render());
      this.container.appendChild(form);
    });
    container.querySelector("#import-league").addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json,.json";
      input.addEventListener("change", async () => {
        const file = input.files[0];
        if (!file) return;
        try {
          const json = JSON.parse(await file.text());
          await this.#handleImport(json);
        } catch (err) {
          showToast(err.message || "El archivo no es un JSON válido", "error");
        }
      });
      input.click();
    });
    this.render().then(() => this.#restoreScroll());
  }

  async render() {
    const leagues = await db.getAll("leagues");
    const activeId = db.getActiveLeagueId();

    const allMatches = await db.getAll("matches");
    const hasMatches = {};
    allMatches.forEach((m) => {
      hasMatches[m.leagueId] = true;
    });

    const allTeams = await db.getAll("teams");
    const teamCountByLeague = {};
    allTeams.forEach((t) => {
      teamCountByLeague[t.leagueId] = (teamCountByLeague[t.leagueId] || 0) + 1;
    });

    const list = this.container.querySelector("#league-list") || document.createElement("div");
    list.id = "league-list";

    if (leagues.length === 0) {
      list.innerHTML = `<div class="empty-state"><p>No hay ligas creadas aún.</p></div>`;
    } else {
      list.className = "card-grid";
      list.innerHTML = leagues
        .map((l) => {
          const t = getSportTerms(l.sport);
          const teamCount = teamCountByLeague[l.id] || 0;
          const requiredTeams = l.tournamentTeams;
          const bracketDisabled =
            l.modalidad === "tournament" &&
            requiredTeams != null &&
            teamCount !== requiredTeams;
          return `
        <div class="card ${Number(activeId) === l.id ? "active" : ""}" data-id="${l.id}">
          <h3>${t.icon} ${l.name}</h3>
          <p>${t.name} — ${l.temporada || ""}</p>
          <p>${l.modalidad === "league" ? "Liga" : "Eliminación Directa"}${l.modalidad === "tournament" && requiredTeams ? ` — ${requiredTeams} equipos` : ""}</p>
          <div style="margin-top:0.5rem;display:flex;gap:0.25rem;flex-wrap:wrap">
            <button class="btn btn-sm btn-primary js-activate" data-id="${l.id}">Activar</button>
            <button class="btn btn-sm btn-secondary js-edit" data-id="${l.id}">Editar</button>
            ${l.modalidad === "league" && !hasMatches[l.id] ? `<button class="btn btn-sm btn-secondary js-schedule" data-id="${l.id}">Programar partidos</button>` : ""}
            ${l.modalidad === "tournament" && !hasMatches[l.id] ? `<button class="btn btn-sm btn-secondary js-bracket" data-id="${l.id}" ${bracketDisabled ? "disabled" : ""} title="${bracketDisabled ? `Se requieren exactamente ${requiredTeams} equipos (hay ${teamCount})` : ""}">Generar bracket</button>` : ""}
            ${bracketDisabled ? `<p class="bracket-hint">Requiere ${requiredTeams} equipos (hay ${teamCount})</p>` : ""}
            <button class="btn btn-sm btn-secondary js-export" data-id="${l.id}">Exportar</button>
            <button class="btn btn-sm btn-danger js-delete" data-id="${l.id}">Eliminar</button>
          </div>
        </div>
      `;
        })
        .join("");

      list.querySelectorAll(".js-activate").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const id = Number(btn.dataset.id);
          await db.runTransaction(["leagues"], "readwrite", (stores) => {
            const all = stores.leagues.getAll();
            all.onsuccess = () => {
              all.result.forEach((l) => {
                stores.leagues.put({ ...l, isActive: l.id === id });
              });
            };
          });
          db.setActiveLeagueId(id);
          // Guarda el scroll antes de ir al dashboard.
          saveListState("/leagues", { scrollTop: window.scrollY });
          this.router.navigateTo("/dashboard");
        });
      });

      list.querySelectorAll(".js-edit").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const form = document.createElement("league-form");
          form.setAttribute("edit-id", btn.dataset.id);
          form.addEventListener("league-updated", () => this.render());
          this.container.appendChild(form);
        });
      });

      list.querySelectorAll(".js-schedule").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const leagueId = Number(btn.dataset.id);
          btn.disabled = true;

          const existing = await db.getByIndex("matches", "leagueId", leagueId);
          if (existing.length > 0) {
            showToast("Esta liga ya tiene partidos programados", "info");
            btn.disabled = false;
            return;
          }

          const league = await db.getById("leagues", leagueId);
          const teams = await db.getByIndex("teams", "leagueId", leagueId);

          if (teams.length < 2) {
            showToast("Se necesitan al menos 2 equipos", "error");
            btn.disabled = false;
            return;
          }

          const matches = generateRoundRobin(teams, league.rounds || 1);

          await db.runTransaction(["matches"], "readwrite", (stores) => {
            matches.forEach((m) => {
              stores.matches.add({
                leagueId,
                homeTeamId: m.home,
                awayTeamId: m.away,
                round: m.round,
                date: null,
                status: "Programado",
                homeScore: null,
                awayScore: null,
              });
            });
          });

          showToast(`Calendario generado con ${matches.length} partidos`, "success");
          this.render();
        });
      });

      list.querySelectorAll(".js-bracket").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const leagueId = Number(btn.dataset.id);
          btn.disabled = true;

          const existing = await db.getByIndex("matches", "leagueId", leagueId);
          if (existing.length > 0) {
            showToast("Esta liga ya tiene un bracket generado", "info");
            btn.disabled = false;
            return;
          }

          const teams = await db.getByIndex("teams", "leagueId", leagueId);
          const league = await db.getById("leagues", leagueId);
          const required = league?.tournamentTeams;
          if (required != null && teams.length !== required) {
            showToast(`Se requieren exactamente ${required} equipos para generar el bracket (hay ${teams.length})`, "error");
            btn.disabled = false;
            return;
          }
          if (teams.length < 4) {
            showToast("Se necesitan al menos 4 equipos", "error");
            btn.disabled = false;
            return;
          }

          let matches;
          try {
            matches = generateBracket(teams);
          } catch (err) {
            showToast(err.message, "error");
            btn.disabled = false;
            return;
          }

          await db.runTransaction(["matches"], "readwrite", (stores) => {
            matches.forEach((m) => {
              stores.matches.add({
                leagueId,
                round: m.round,
                position: m.position,
                homeTeamId: m.homeTeamId,
                awayTeamId: m.awayTeamId,
                date: null,
                status: "Programado",
                homeScore: null,
                awayScore: null,
              });
            });
          });

          showToast(`Bracket generado con ${matches.length} partidos`, "success");
          this.render();
        });
      });

      list.querySelectorAll(".js-export").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          try {
            await exportLeague(Number(btn.dataset.id));
            showToast("Liga exportada", "success");
          } catch (err) {
            showToast(err.message || "No se pudo exportar la liga", "error");
          }
        });
      });

      list.querySelectorAll(".js-delete").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const { ConfirmDialog } = await import("../components/confirm-dialog.js");
          const confirmed = await ConfirmDialog.show(
            "Eliminar liga",
            "¿Eliminar esta liga y todos sus datos? Se borrarán equipos, jugadores, partidos y eventos asociados.",
          );
          if (confirmed) {
            const id = Number(btn.dataset.id);
            try {
              const result = await db.deleteLeagueCascade(id);
              if (result.activeChanged) {
                db.setActiveLeagueId(result.nextActiveId);
                document.dispatchEvent(new CustomEvent("league:changed"));
              }
              showToast("Liga eliminada", "success");
              this.render();
            } catch (err) {
              showToast(err.message || "No se pudo eliminar la liga", "error");
            }
          }
        });
      });
    }

    const loader = this.container.querySelector("loading-state");
    if (loader) loader.remove();
    this.container.appendChild(list);
  }

  unmount() {
    this.container = null;
  }

  // Importa una liga; si el nombre ya existe, pide uno nuevo (o cancela).
  async #handleImport(json) {
    let rename;
    for (;;) {
      try {
        await importLeague(json, rename ? { rename } : {});
        showToast("Liga importada", "success");
        this.render();
        return;
      } catch (err) {
        if (err.code !== "NAME_CONFLICT") {
          showToast(err.message || "No se pudo importar la liga", "error");
          return;
        }
        rename = window.prompt(
          "Ya existe una liga con ese nombre. Ingresa un nombre nuevo para importarla:",
          "",
        );
        if (!rename) return; // el usuario canceló
        rename = rename.trim();
        if (!rename) return;
      }
    }
  }

  // Restaura el scroll guardado tras terminar de renderizar (req 2.3).
  #restoreScroll() {
    if (this.pendingScroll != null) {
      window.scrollTo(0, this.pendingScroll);
      this.pendingScroll = null;
    }
  }
}
