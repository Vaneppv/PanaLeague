import "./components/nav-bar.js";
import "./components/loading-state.js";
import "./components/error-state.js";
import "./components/confirm-dialog.js";
import { initDbStatus } from "./components/db-status.js";

import db from "./db.js";
import { Router } from "./core/Router.js";
import { HomeView } from "./views/home.js";
import { DashboardView } from "./views/dashboard.js";
import { LeaguesView } from "./views/leagues.js";
import { TeamsView } from "./views/teams.js";
import { StatsView } from "./views/stats.js";
import { PlayersView } from "./views/players.js";
import { MatchesView } from "./views/matches.js";
import { TeamDetailView } from "./views/team-detail.js";
import { PlayerDetailView } from "./views/player-detail.js";
import { MatchDetailView } from "./views/match-detail.js";

async function init() {
  initDbStatus();
  try {
    await db.open();
  } catch (err) {
    console.error("Error al abrir IndexedDB:", err);
  }

  // Si la base está vacía, se siembran las ligas de ejemplo para poder
  // probar todas las vistas y estadísticas sin configurar datos a mano.
  await seedSampleDataIfEmpty();

  const app = document.getElementById("app");

  const router = new Router(app, [
    { pattern: "/", handler: () => new HomeView({ router }) },
    { pattern: "/dashboard", handler: () => new DashboardView({ router }) },
    { pattern: "/leagues", handler: () => new LeaguesView({ router }) },
    { pattern: "/teams", handler: () => new TeamsView({ router }) },
    { pattern: "/team/:id", handler: (p) => new TeamDetailView({ router, id: p.id }) },
    { pattern: "/players", handler: () => new PlayersView({ router }) },
    { pattern: "/player/:id", handler: (p) => new PlayerDetailView({ router, id: p.id }) },
    { pattern: "/matches", handler: () => new MatchesView({ router }) },
    { pattern: "/match/:id", handler: (p) => new MatchDetailView({ router, id: p.id }) },
    { pattern: "/stats", handler: () => new StatsView({ router }) },
  ]);

  // Al abrir la app por primera vez (sin hash), si ya hay una liga activa
  // se muestra directamente el dashboard. El logo (enlace a "/") siempre
  // permite volver a la landing.
  const initialHash = window.location.hash;
  if (
    (initialHash === "" || initialHash === "#" || initialHash === "#/") &&
    db.getActiveLeagueId()
  ) {
    window.location.hash = "/dashboard";
  }

  router.start();
}

async function seedSampleDataIfEmpty() {
  try {
    const leagues = await db.getAll("leagues");
    if (leagues.length > 0) return;

    const { loadSampleData } = await import("./sample-data.js");
    const result = await loadSampleData();
    if (!result.loaded || db.getActiveLeagueId()) return;

    const sample = (await db.getAll("leagues")).find((l) => l.name === "Liga Fútbol Ejemplo");
    if (!sample) return;

    await db.runTransaction(["leagues"], "readwrite", (stores) => {
      const all = stores.leagues.getAll();
      all.onsuccess = () => {
        all.result.forEach((l) => {
          stores.leagues.put({ ...l, isActive: l.id === sample.id });
        });
      };
    });
    db.setActiveLeagueId(sample.id);
    document.dispatchEvent(new CustomEvent("league:changed"));
  } catch (err) {
    console.error("Error al sembrar ligas de ejemplo:", err);
  }
}

await init();
