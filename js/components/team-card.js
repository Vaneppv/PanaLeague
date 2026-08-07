export class TeamCard extends HTMLElement {
  set data(team) {
    this.team = team;
    this.buildDOM();
  }

  get data() {
    return this.team;
  }

  buildDOM() {
    this.innerHTML = '';
    const d = this.team || {};

    this.className = 'card team-card';
    if (d.colorPrincipal) {
      this.style.borderLeftColor = d.colorPrincipal;
    }

    const imgContainer = document.createElement('div');
    imgContainer.className = 'card-img-container';

    if (d.escudo) {
      const img = document.createElement('img');
      img.src = d.escudo;
      img.alt = d.name || 'Equipo';
      img.className = 'team-escudo';
      imgContainer.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'team-placeholder';
      const initials = (d.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      placeholder.textContent = initials;
      if (d.colorPrincipal) {
        placeholder.style.background = d.colorPrincipal;
      }
      if (d.colorSecundario) {
        placeholder.style.color = d.colorSecundario;
      }
      imgContainer.appendChild(placeholder);
    }

    const info = document.createElement('div');
    info.className = 'team-info';

    const name = document.createElement('h3');
    name.className = 'team-name';
    name.textContent = d.name || 'Nombre desconocido';

    const meta = document.createElement('div');
    meta.className = 'team-meta';

    if (d.playerCount !== undefined) {
      const players = document.createElement('span');
      players.className = 'team-players';
      players.textContent = `${d.playerCount} jugadores`;
      meta.appendChild(players);
    }

    if (d.position !== undefined) {
      const pos = document.createElement('span');
      pos.className = 'team-position';
      pos.textContent = `#${d.position}`;
      if (d.colorSecundario) {
        pos.style.background = d.colorSecundario;
      }
      meta.appendChild(pos);
    }

    info.appendChild(name);
    info.appendChild(meta);
    this.appendChild(imgContainer);
    this.appendChild(info);
  }
}
customElements.define('team-card', TeamCard);