import db from "../db.js";
import "../components/league-form.js";
import { getSportTerms } from "../sports-terms.js";

export class HomeView {
  constructor({ router }) {
    this.router = router;
    this.container = null;
  }

  mount(container) {
    this.container = container;
    container.innerHTML = `
      <section class="hero">
        <h1>PanaLeague</h1>
        <p>
          Gestiona tus ligas deportivas amateur en un solo lugar. Crea ligas,
          organiza equipos y jugadores, programa partidos, sigue los resultados
          y visualiza estadísticas y gráficos de tu torneo.
        </p>
      </section>
      <loading-state message="Cargando..."></loading-state>
    `;
    this.render();
  }

  async render() {
    const loader = this.container.querySelector("loading-state");
    if (loader) loader.remove();

    const activeId = db.getActiveLeagueId();
    const leagues = await db.getAll("leagues");
    const activeLeague = activeId
      ? leagues.find((l) => l.id === Number(activeId))
      : null;

    const hero = this.container.querySelector(".hero");

    if (activeLeague) {
      const terms = getSportTerms(activeLeague.sport);
      const leagueCard = document.createElement("div");
      leagueCard.className = "card league-summary";
      leagueCard.innerHTML = `
        <h3>${terms.icon} ${activeLeague.name}</h3>
        <p>${terms.name} — ${activeLeague.temporada}</p>
        <p>${activeLeague.modalidad === "league" ? "Liga" : "Eliminación Directa"}</p>
        <button class="btn btn-primary" id="go-dashboard">Ver Dashboard</button>
      `;
      leagueCard
        .querySelector("#go-dashboard")
        .addEventListener("click", () => this.router.navigateTo("/dashboard"));
      hero.appendChild(leagueCard);
    } else {
      const noLeague = document.createElement("div");
      noLeague.className = "hero-empty";
      noLeague.innerHTML = `
        <p>Crea tu primera liga para comenzar.</p>
        <button class="btn btn-primary" id="create-first">+ Crear Liga</button>
      `;
      noLeague
        .querySelector("#create-first")
        .addEventListener("click", () => this.openCreateLeague());
      hero.appendChild(noLeague);
    }

    const actions = [
      { label: "+ Crear Liga", desc: "Crea una nueva liga", onClick: () => this.openCreateLeague() },
      { label: "Ligas", desc: "Administra tus ligas", href: "/leagues" },
      { label: "Equipos", desc: "Gestiona los equipos", href: "/teams" },
      { label: "Jugadores", desc: "Registra jugadores", href: "/players" },
      { label: "Partidos", desc: "Programa y finaliza partidos", href: "/matches" },
      { label: "Estadísticas", desc: "Tablas y gráficos", href: "/stats" },
    ];

    const grid = document.createElement("div");
    grid.className = "home-actions";
    actions.forEach((a) => {
      const card = document.createElement("button");
      card.className = "card home-action";
      card.innerHTML = `
        <h3>${a.label}</h3>
        <p>${a.desc}</p>
      `;
      card.addEventListener("click", () => {
        if (a.onClick) a.onClick();
        else this.router.navigateTo(a.href);
      });
      grid.appendChild(card);
    });

    this.container.appendChild(grid);
  }

  openCreateLeague() {
    const form = document.createElement("league-form");
    form.addEventListener("league-created", async (e) => {
      await this.#activateLeague(e.detail.league.id);
      this.router.navigateTo("/dashboard");
    });
    this.container.appendChild(form);
  }

  async #activateLeague(id) {
    await db.runTransaction(["leagues"], "readwrite", (stores) => {
      const all = stores.leagues.getAll();
      all.onsuccess = () => {
        all.result.forEach((l) => {
          stores.leagues.put({ ...l, isActive: l.id === Number(id) });
        });
      };
    });
    db.setActiveLeagueId(id);
  }

  unmount() {
    this.container = null;
  }
}
