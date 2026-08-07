import db from "../db.js";
import { getPositions } from "../sports-terms.js";

class PlayerForm extends HTMLElement {
  async connectedCallback() {
    this.editId = this.getAttribute("edit-id");
    this.presetTeamId = this.getAttribute("team-id");
    this.buildDOM();
    await this.#loadTeams();
    await this.#loadPositions();
    if (this.editId) await this.#loadPlayer();
  }

  buildDOM() {
    const isEdit = !!this.editId;

    const overlay = document.createElement("div");
    overlay.className = "dialog-overlay";
    overlay.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) this.close();
    });

    const dialog = document.createElement("div");
    dialog.className = "player-form-dialog";

    const title = document.createElement("h3");
    title.textContent = isEdit ? "Editar Jugador" : "Nuevo Jugador";

    const form = document.createElement("form");
    form.id = "player-form";

    const addFormGroup = (labelText, inputCreator) => {
      const group = document.createElement("div");
      group.className = "form-group";
      const label = document.createElement("label");
      label.className = "form-label";
      label.textContent = labelText;
      group.appendChild(label);
      inputCreator(group);
      form.appendChild(group);
    };

    addFormGroup("Nombre", (group) => {
      const input = document.createElement("input");
      input.className = "form-input";
      input.id = "player-name";
      input.name = "name";
      input.required = true;
      group.appendChild(input);
    });

    addFormGroup("Foto (URL)", (group) => {
      const input = document.createElement("input");
      input.className = "form-input";
      input.id = "player-photo";
      input.name = "photo";
      input.placeholder = "https://ejemplo.com/foto.png";
      group.appendChild(input);
    });

    const row = document.createElement("div");
    row.className = "form-row";

    const numberGroup = document.createElement("div");
    numberGroup.className = "form-group";
    const numberLabel = document.createElement("label");
    numberLabel.className = "form-label";
    numberLabel.textContent = "Número";
    const numberInput = document.createElement("input");
    numberInput.className = "form-input";
    numberInput.type = "number";
    numberInput.id = "player-number";
    numberInput.name = "number";
    numberInput.min = 1;
    numberInput.required = true;
    numberGroup.appendChild(numberLabel);
    numberGroup.appendChild(numberInput);

    const posGroup = document.createElement("div");
    posGroup.className = "form-group";
    const posLabel = document.createElement("label");
    posLabel.className = "form-label";
    posLabel.textContent = "Posición";
    const posSelect = document.createElement("select");
    posSelect.className = "form-select";
    posSelect.id = "player-position";
    posSelect.name = "position";
    const posDefault = document.createElement("option");
    posDefault.value = "";
    posDefault.textContent = "Seleccionar...";
    posSelect.appendChild(posDefault);
    posGroup.appendChild(posLabel);
    posGroup.appendChild(posSelect);

    row.appendChild(numberGroup);
    row.appendChild(posGroup);
    form.appendChild(row);

    addFormGroup("Equipo", (group) => {
      const select = document.createElement("select");
      select.className = "form-select";
      select.id = "player-team";
      select.name = "teamId";
      select.required = true;
      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.textContent = "Seleccionar equipo...";
      select.appendChild(defaultOption);
      group.appendChild(select);
    });

    const actions = document.createElement("div");
    actions.className = "dialog-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn-secondary";
    cancelBtn.textContent = "Cancelar";
    cancelBtn.addEventListener("click", () => this.close());

    const submitBtn = document.createElement("button");
    submitBtn.type = "submit";
    submitBtn.className = "btn btn-primary";
    submitBtn.textContent = isEdit ? "Guardar" : "Crear";

    actions.appendChild(cancelBtn);
    actions.appendChild(submitBtn);
    form.appendChild(actions);

    form.addEventListener("submit", (e) => this.#handleSubmit(e));

    dialog.appendChild(title);
    dialog.appendChild(form);
    overlay.appendChild(dialog);
    this.appendChild(overlay);
  }

  async #loadTeams() {
    const leagueId = db.getActiveLeagueId();
    if (!leagueId) return;

    const teams = await db.getByIndex("teams", "leagueId", Number(leagueId));
    const select = this.querySelector("#player-team");
    if (!select) return;

    teams.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.name;
      if (this.presetTeamId && Number(this.presetTeamId) === t.id) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });
  }

  async #loadPositions() {
    const leagueId = db.getActiveLeagueId();
    if (!leagueId) return;
    const league = await db.getById("leagues", Number(leagueId));
    if (!league) return;
    const positions = getPositions(league.sport);
    const select = this.querySelector("#player-position");
    if (!select) return;
    positions.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      select.appendChild(opt);
    });
  }

  async #loadPlayer() {
    const player = await db.getById("players", Number(this.editId));
    if (!player) return;

    const form = this.querySelector("#player-form");
    form.name.value = player.name || "";
    form.photo.value = player.photo || "";
    form.number.value = player.number || "";
    form.position.value = player.position || "";
    form.teamId.value = player.teamId || "";
  }

  async #handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const data = {
      name: form.name.value.trim(),
      photo: form.photo.value.trim(),
      number: Number(form.number.value),
      position: form.position.value.trim(),
      teamId: Number(form.teamId.value),
    };

    if (!data.name || !data.teamId) return;

    try {
      if (this.editId) {
        data.id = Number(this.editId);
        await db.put("players", data);
        this.dispatchEvent(new CustomEvent("player-updated", { detail: { player: data } }));
      } else {
        data.id = await db.add("players", data);
        this.dispatchEvent(new CustomEvent("player-created", { detail: { player: data } }));
      }
      this.close();
    } catch (err) {
      console.error("Error al guardar el jugador:", err);
    }
  }

  close() {
    this.remove();
  }
}

customElements.define("player-form", PlayerForm);