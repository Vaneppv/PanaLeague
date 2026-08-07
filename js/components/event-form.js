/**
 * EventForm: sub-formulario para registrar una anotación en un partido.
 * Recibe el partido, los equipos y sus jugadores vía la propiedad `data`.
 * Al agregar una anotación emite el evento "event-added" con el jugador,
 * su equipo y el minuto opcional.
 */
export class EventForm extends HTMLElement {
  connectedCallback() {
    this.buildDOM();
  }

  set data(value) {
    this.match = value.match;
    this.homeTeam = value.homeTeam;
    this.awayTeam = value.awayTeam;
    this.homePlayers = value.homePlayers || [];
    this.awayPlayers = value.awayPlayers || [];
    this.terms = value.terms || {};
    this.buildDOM();
  }

  buildDOM() {
    if (!this.match) return;

    const eventName = this.terms.eventName || "Anotación";

    this.innerHTML = `
      <div class="event-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="event-team">Equipo</label>
            <select class="form-select" id="event-team">
              <option value="${this.homeTeam.id}">${this.homeTeam.name} (Local)</option>
              <option value="${this.awayTeam.id}">${this.awayTeam.name} (Visitante)</option>
            </select>
          </div>
          <div class="form-group event-player-group">
            <label class="form-label" for="event-player">Jugador</label>
            <select class="form-select" id="event-player"></select>
          </div>
          <div class="form-group event-minute-group">
            <label class="form-label" for="event-minute">Minuto</label>
            <input class="form-input" id="event-minute" type="number" min="0" placeholder="—" />
          </div>
        </div>
        <button type="button" class="btn btn-primary" id="event-add">+ ${eventName}</button>
      </div>
    `;

    const teamSelect = this.querySelector("#event-team");
    const playerSelect = this.querySelector("#event-player");
    const minuteInput = this.querySelector("#event-minute");
    const addBtn = this.querySelector("#event-add");

    teamSelect.addEventListener("change", () => this.#populatePlayers(playerSelect));
    this.#populatePlayers(playerSelect);

    addBtn.addEventListener("click", () => {
      const playerId = Number(playerSelect.value);
      const teamId = Number(teamSelect.value);
      if (!playerId) return;

      const minuteValue = minuteInput.value;
      const minute = minuteValue === "" ? null : Number(minuteValue);

      this.dispatchEvent(
        new CustomEvent("event-added", {
          detail: { playerId, teamId, minute },
        }),
      );

      // El jugador anotó; se limpia el minuto para la siguiente anotación.
      minuteInput.value = "";
    });
  }

  // Rellena el selector de jugadores según el equipo elegido.
  #populatePlayers(playerSelect) {
    const teamId = Number(this.querySelector("#event-team").value);
    const players = teamId === this.homeTeam.id ? this.homePlayers : this.awayPlayers;

    playerSelect.innerHTML = players.length
      ? players
          .map((p) => `<option value="${p.id}">${p.number ? `#${p.number} ` : ""}${p.name}</option>`)
          .join("")
      : `<option value="">Sin jugadores en este equipo</option>`;

    playerSelect.disabled = players.length === 0;
  }
}
customElements.define("event-form", EventForm);
