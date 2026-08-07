import { getSportTerms } from "../sports-terms.js";

export class LeagueCard extends HTMLElement {
  set data(league) {
    this.league = league;
    this.buildDOM();
  }

  buildDOM() {
    const terms = getSportTerms(this.league.sport);
    this.className = 'card';
    this.innerHTML = `
      <h3>${terms.icon} ${this.league.name}</h3>
      <p>${terms.name} — ${this.league.temporada || ''}</p>
    `;
  }
}
customElements.define('league-card', LeagueCard);
