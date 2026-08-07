import db from "../db.js";
import { getSportTerms } from "../sports-terms.js";
import { applySportTheme } from "../utils/theme.js";

export class NavBar extends HTMLElement {
  connectedCallback() {
    this.buildDOM();
    this.updateActiveLink();
    window.addEventListener("hashchange", () => this.updateActiveLink());
    window.addEventListener("hashchange", () => this.#closeMenu());
    document.addEventListener("league:changed", () => this.#syncLeague());
    this.#syncLeague();
  }

  /**
   * Refleja la liga activa (nombre, deporte e icono) en el navbar y
   * aplica el tema visual del deporte a todo el documento.
   */
  async #syncLeague() {
    try {
      await db.open();
      const activeId = db.getActiveLeagueId();
      const league = activeId
        ? await db.getById("leagues", Number(activeId))
        : null;
      this.setActiveLeague(league?.name, league?.sport);
    } catch {
      this.setActiveLeague(null, null);
    }
  }

  buildDOM() {
    const nav = document.createElement("nav");
    nav.id = "navbar";

    const logo = document.createElement("div");
    logo.className = "logo";
    const logoLink = document.createElement("a");
    logoLink.href = "#/";
    logoLink.textContent = "PanaLeague";
    logo.appendChild(logoLink);

    const leagueIndicator = document.createElement("div");
    leagueIndicator.className = "league-indicator";
    leagueIndicator.id = "league-indicator";
    leagueIndicator.textContent = "Sin liga activa";
    leagueIndicator.title = "Liga activa";
    logo.appendChild(leagueIndicator);

    const toggle = document.createElement("button");
    toggle.className = "nav-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-label", "Abrir menú de navegación");
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML =
      '<span class="nav-toggle-bar"></span>' +
      '<span class="nav-toggle-bar"></span>' +
      '<span class="nav-toggle-bar"></span>';
    toggle.addEventListener("click", () => this.#toggleMenu());

    const ul = document.createElement("ul");
    ul.className = "nav-links";
    const links = [
      { href: "#dashboard", label: "Dashboard" },
      { href: "#leagues", label: "Ligas" },
      { href: "#teams", label: "Equipos" },
      { href: "#players", label: "Jugadores" },
      { href: "#matches", label: "Partidos" },
      { href: "#stats", label: "Estadísticas" },
    ];
    links.forEach(({ href, label }) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = href;
      a.textContent = label;
      a.addEventListener("click", () => this.#closeMenu());
      li.appendChild(a);
      ul.appendChild(li);
    });

    nav.appendChild(logo);
    nav.appendChild(ul);
    nav.appendChild(toggle);
    this.appendChild(nav);
  }

  #toggleMenu() {
    const nav = this.querySelector("#navbar");
    const isOpen = nav.classList.toggle("open");
    const toggle = this.querySelector(".nav-toggle");
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute(
      "aria-label",
      isOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación",
    );
  }

  #closeMenu() {
    const nav = this.querySelector("#navbar");
    if (!nav) return;
    nav.classList.remove("open");
    const toggle = this.querySelector(".nav-toggle");
    if (toggle) {
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Abrir menú de navegación");
    }
  }

  updateActiveLink() {
    const currentHash = window.location.hash || "#dashboard";
    const links = this.querySelectorAll("nav a");
    links.forEach((link) => {
      const href = link.getAttribute("href");
      if (href === currentHash) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
      } else {
        link.classList.remove("active");
        link.removeAttribute("aria-current");
      }
    });
  }

  setActiveLeague(name, sport) {
    const indicator = this.querySelector("#league-indicator");
    if (name && sport) {
      const terms = getSportTerms(sport);
      indicator.textContent = `${terms.icon} ${name} — ${terms.name}`;
      indicator.title = `${terms.name} (liga activa)`;
    } else {
      indicator.textContent = "Sin liga activa";
      indicator.title = "Liga activa";
    }
    applySportTheme(name && sport ? sport : "");
  }
}

customElements.define("nav-bar", NavBar);
