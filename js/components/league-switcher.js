import db from "../db.js";
import "../components/league-form.js";
import { getSportTerms } from "../sports-terms.js";

class LeagueSwitcher extends HTMLElement {
  connectedCallback() {
    this.buildDOM();
    this.render();
  }

  buildDOM() {
    this.innerHTML = `
      <div class="dialog-overlay">
        <div class="switcher-dialog">
          <h3>Cambiar liga activa</h3>
          <div class="switcher-list" id="switcher-list"></div>
          <div class="dialog-actions">
            <button type="button" class="btn btn-secondary" id="switcher-new">+ Nueva Liga</button>
            <button type="button" class="btn btn-secondary" id="switcher-close">Cerrar</button>
          </div>
        </div>
      </div>
    `;

    this.querySelector("#switcher-close").addEventListener("click", () => this.close());
    this.querySelector("#switcher-new").addEventListener("click", () => this.#openCreateForm());
    this.querySelector(".dialog-overlay").addEventListener("click", (e) => {
      if (e.target === e.currentTarget) this.close();
    });
  }

  async render() {
    const list = this.querySelector("#switcher-list");
    const leagues = await db.getAll("leagues");
    const activeId = db.getActiveLeagueId();

    if (leagues.length === 0) {
      list.innerHTML = `<div class="empty-state"><p>No hay ligas creadas aún.</p></div>`;
      return;
    }

    list.innerHTML = leagues
      .map((l) => {
        const terms = getSportTerms(l.sport);
        return `
      <div class="switcher-item ${Number(activeId) === l.id ? "active" : ""}" data-id="${l.id}">
        <div class="switcher-item-info">
          <strong>${terms.icon} ${l.name}</strong>
          <span>${terms.name} — ${l.temporada || ""}</span>
        </div>
        ${
          Number(activeId) === l.id
            ? '<span class="switcher-item-badge">Activa</span>'
            : `<button class="btn btn-sm btn-primary js-activate" data-id="${l.id}">Activar</button>`
        }
      </div>
    `;
      })
      .join("");

    list.querySelectorAll(".js-activate").forEach((btn) => {
      btn.addEventListener("click", async () => {
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
        document.dispatchEvent(new CustomEvent("league:changed"));
        this.close();
      });
    });
  }

  #openCreateForm() {
    const form = document.createElement("league-form");
    form.addEventListener("league-created", async (e) => {
      await db.runTransaction(["leagues"], "readwrite", (stores) => {
        const all = stores.leagues.getAll();
        all.onsuccess = () => {
          all.result.forEach((l) => {
            stores.leagues.put({ ...l, isActive: l.id === e.detail.league.id });
          });
        };
      });
      db.setActiveLeagueId(e.detail.league.id);
      document.dispatchEvent(new CustomEvent("league:changed"));
      this.close();
    });
    this.appendChild(form);
  }

  close() {
    this.remove();
  }
}

customElements.define("league-switcher", LeagueSwitcher);
