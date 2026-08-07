export class PlayerCard extends HTMLElement {
  set data(player) {
    this.player = player;
    this.buildDOM();
  }

  get data() {
    return this.player;
  }

  buildDOM() {
    this.innerHTML = '';
    const d = this.player || {};

    this.className = 'card player-card';
    if (d.teamColor) {
      this.style.borderLeftColor = d.teamColor;
    }

    const imgContainer = document.createElement('div');
    imgContainer.className = 'card-img-container';

    if (d.foto) {
      const img = document.createElement('img');
      img.src = d.foto;
      img.alt = d.name || 'Jugador';
      img.className = 'player-foto';
      imgContainer.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'player-placeholder';
      const initials = (d.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      placeholder.textContent = initials;
      if (d.teamColor) {
        placeholder.style.background = d.teamColor;
      }
      imgContainer.appendChild(placeholder);
    }

    const info = document.createElement('div');
    info.className = 'player-info';

    const name = document.createElement('h3');
    name.className = 'player-name';
    name.textContent = d.name || 'Nombre desconocido';

    const meta = document.createElement('div');
    meta.className = 'player-meta';

    const number = document.createElement('span');
    number.className = 'player-number';
    number.textContent = `#${d.number || '?'}`;

    const position = document.createElement('span');
    position.className = 'player-position';
    position.textContent = d.position || '';

    meta.appendChild(number);
    if (d.position) meta.appendChild(position);

    info.appendChild(name);
    info.appendChild(meta);

    if (d.teamName) {
      const teamRow = document.createElement('div');
      teamRow.className = 'player-team';

      if (d.teamEscudo) {
        const teamImg = document.createElement('img');
        teamImg.src = d.teamEscudo;
        teamImg.alt = d.teamName;
        teamImg.className = 'player-team-escudo';
        teamRow.appendChild(teamImg);
      } else {
        const teamBadge = document.createElement('span');
        teamBadge.className = 'player-team-badge';
        const initials = d.teamName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
        teamBadge.textContent = initials;
        if (d.teamColorSecundario) {
          teamBadge.style.background = d.teamColorSecundario;
        }
        teamRow.appendChild(teamBadge);
      }

      const teamLabel = document.createElement('span');
      teamLabel.className = 'player-team-label';
      teamLabel.textContent = d.teamName;
      teamRow.appendChild(teamLabel);

      info.appendChild(teamRow);
    }

    this.appendChild(imgContainer);
    this.appendChild(info);
  }
}
customElements.define('player-card', PlayerCard);