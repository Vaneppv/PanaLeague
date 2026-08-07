import db from "../db.js";
import { getSportList } from "../sports-terms.js";

class LeagueForm extends HTMLElement {
  connectedCallback() {
    this.editId = this.getAttribute("edit-id");
    this.buildDOM();
    if (this.editId) this.#loadLeague();
  }

  buildDOM() {
    const sports = getSportList();
    const isEdit = !!this.editId;

    this.innerHTML = `
      <div class="dialog-overlay">
        <div class="league-form-dialog">
          <h3>${isEdit ? "Editar Liga" : "Nueva Liga"}</h3>
          <form id="league-form">
            <div class="form-group">
              <label class="form-label" for="league-name">Nombre</label>
              <input class="form-input" id="league-name" name="name" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="league-sport">Deporte</label>
              <select class="form-select" id="league-sport" name="sport" required ${isEdit ? "disabled" : ""}>
                <option value="">Seleccionar...</option>
                ${sports.map((s) => `<option value="${s.id}">${s.icon} ${s.name}</option>`).join("")}
              </select>
            </div>
            <fieldset class="form-group">
              <legend class="form-label">Modalidad</legend>
              <label class="radio-label"><input type="radio" name="modalidad" value="league" ${isEdit ? "disabled" : ""} checked /> Liga</label>
              <label class="radio-label"><input type="radio" name="modalidad" value="tournament" ${isEdit ? "disabled" : ""} /> Eliminación Directa</label>
            </fieldset>
            <div class="form-row">
              <div class="form-group" id="rounds-group">
                <label class="form-label" for="league-rounds">Vueltas</label>
                <input class="form-input" id="league-rounds" name="rounds" type="number" min="1" value="1" />
              </div>
              <div class="form-group" id="teams-group">
                <label class="form-label" for="league-teams">Nº de equipos</label>
                <select class="form-select" id="league-teams" name="tournamentTeams">
                  <option value="4">4</option>
                  <option value="8">8</option>
                  <option value="16">16</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="league-season">Temporada</label>
                <input class="form-input" id="league-season" name="temporada" placeholder="2026" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="league-desc">Descripción</label>
              <textarea class="form-textarea" id="league-desc" name="description" rows="3"></textarea>
            </div>
            <div class="dialog-actions">
              <button type="button" class="btn btn-secondary" id="form-cancel">Cancelar</button>
              <button type="submit" class="btn btn-primary">${isEdit ? "Guardar" : "Crear"}</button>
            </div>
          </form>
        </div>
      </div>
    `;

    this.querySelectorAll('input[name="modalidad"]').forEach((r) => {
      r.addEventListener("change", () => this.#toggleModeFields());
    });
    this.#toggleModeFields();

    this.querySelector("#form-cancel").addEventListener("click", () => this.close());
    this.querySelector("#league-form").addEventListener("submit", (e) => this.#handleSubmit(e));
    this.querySelector(".dialog-overlay").addEventListener("click", (e) => {
      if (e.target === e.currentTarget) this.close();
    });
  }

  async #loadLeague() {
    const league = await db.getById("leagues", Number(this.editId));
    if (!league) return;

    const form = this.querySelector("#league-form");
    form.name.value = league.name || "";
    form.sport.value = league.sport || "";
    const modalidad = this.querySelector(`input[name="modalidad"][value="${league.modalidad}"]`);
    if (modalidad) modalidad.checked = true;
    form.rounds.value = league.rounds || 1;
    form.tournamentTeams.value = league.tournamentTeams || 4;
    form.temporada.value = league.temporada || "";
    form.description.value = league.description || "";
    this.#toggleModeFields();
  }

  // Muestra vueltas (modo liga) o número de equipos (eliminación directa).
  #toggleModeFields() {
    const checked = this.querySelector('input[name="modalidad"]:checked');
    const isLeague = checked && checked.value === "league";
    this.querySelector("#rounds-group").style.display = isLeague ? "block" : "none";
    this.querySelector("#teams-group").style.display = isLeague ? "none" : "block";
  }

  async #handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const data = {
      name: form.name.value.trim(),
      sport: form.sport.value,
      modalidad: form.modalidad.value,
      temporada: form.temporada.value.trim() || new Date().getFullYear().toString(),
      description: form.description.value.trim(),
    };

    if (data.modalidad === "league") {
      data.rounds = Number(form.rounds.value) || 1;
    } else {
      data.tournamentTeams = Number(form.tournamentTeams.value) || 4;
    }

    if (!data.name || !data.sport) return;

    try {
      if (this.editId) {
        data.id = Number(this.editId);
        await db.put("leagues", data);
        this.dispatchEvent(new CustomEvent("league-updated", { detail: { league: data } }));
      } else {
        data.isActive = false;
        data.createdAt = Date.now();
        data.id = await db.add("leagues", data);
        this.dispatchEvent(new CustomEvent("league-created", { detail: { league: data } }));
      }
      this.close();
    } catch (err) {
      console.error("Error al guardar la liga:", err);
    }
  }

  close() {
    this.remove();
  }
}

customElements.define("league-form", LeagueForm);
