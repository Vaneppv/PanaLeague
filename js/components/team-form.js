import db from "../db.js";

class TeamForm extends HTMLElement {
  connectedCallback() {
    this.editId = this.getAttribute("edit-id");
    this.buildDOM();
    if (this.editId) this.#loadTeam();
  }

  buildDOM() {
    const isEdit = !!this.editId;

    const overlay = document.createElement("div");
    overlay.className = "dialog-overlay";
    overlay.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) this.close();
    });

    const dialog = document.createElement("div");
    dialog.className = "team-form-dialog";

    const title = document.createElement("h3");
    title.textContent = isEdit ? "Editar Equipo" : "Nuevo Equipo";

    const form = document.createElement("form");
    form.id = "team-form";

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
      input.id = "team-name";
      input.name = "name";
      input.required = true;
      group.appendChild(input);
    });

    addFormGroup("Escudo (URL)", (group) => {
      const input = document.createElement("input");
      input.className = "form-input";
      input.id = "team-escudo";
      input.name = "escudo";
      input.placeholder = "https://ejemplo.com/escudo.png";
      group.appendChild(input);
    });

    const row = document.createElement("div");
    row.className = "form-row";

    const color1Group = document.createElement("div");
    color1Group.className = "form-group";
    const label1 = document.createElement("label");
    label1.className = "form-label";
    label1.textContent = "Color principal";
    const color1 = document.createElement("input");
    color1.className = "form-input";
    color1.type = "color";
    color1.id = "team-color-principal";
    color1.name = "colorPrincipal";
    color1.value = "#2f5bed";
    color1Group.appendChild(label1);
    color1Group.appendChild(color1);

    const color2Group = document.createElement("div");
    color2Group.className = "form-group";
    const label2 = document.createElement("label");
    label2.className = "form-label";
    label2.textContent = "Color secundario";
    const color2 = document.createElement("input");
    color2.className = "form-input";
    color2.type = "color";
    color2.id = "team-color-secundario";
    color2.name = "colorSecundario";
    color2.value = "#f02323";
    color2Group.appendChild(label2);
    color2Group.appendChild(color2);

    row.appendChild(color1Group);
    row.appendChild(color2Group);
    form.appendChild(row);

    addFormGroup("Ciudad / Sede", (group) => {
      const input = document.createElement("input");
      input.className = "form-input";
      input.id = "team-ciudad";
      input.name = "ciudad";
      input.placeholder = "Opcional";
      group.appendChild(input);
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

  async #loadTeam() {
    const team = await db.getById("teams", Number(this.editId));
    if (!team) return;

    const form = this.querySelector("#team-form");
    form.name.value = team.name || "";
    form.escudo.value = team.escudo || "";
    form.colorPrincipal.value = team.colorPrincipal || "#6c5ce7";
    form.colorSecundario.value = team.colorSecundario || "#4834b0";
    form.ciudad.value = team.ciudad || "";
  }

  async #handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const data = {
      name: form.name.value.trim(),
      escudo: form.escudo.value.trim(),
      colorPrincipal: form.colorPrincipal.value,
      colorSecundario: form.colorSecundario.value,
      ciudad: form.ciudad.value.trim(),
    };

    if (!data.name) return;

    try {
      const leagueId = db.getActiveLeagueId();
      data.leagueId = Number(leagueId);

      if (this.editId) {
        data.id = Number(this.editId);
        await db.put("teams", data);
        this.dispatchEvent(new CustomEvent("team-updated", { detail: { team: data } }));
      } else {
        data.id = await db.add("teams", data);
        this.dispatchEvent(new CustomEvent("team-created", { detail: { team: data } }));
      }
      this.close();
    } catch (err) {
      console.error("Error al guardar el equipo:", err);
    }
  }

  close() {
    this.remove();
  }
}

customElements.define("team-form", TeamForm);