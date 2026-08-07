export class LoadingState extends HTMLElement {
  connectedCallback() {
    const message = this.getAttribute('message') || 'Cargando…';
    const container = document.createElement('div');
    container.className = 'loading-container';

    const skeleton = document.createElement('div');
    skeleton.className = 'placeholder-card';

    const img = document.createElement('div');
    img.className = 'placeholder-img';
    skeleton.appendChild(img);

    for (let i = 0; i < 3; i++) {
      const text = document.createElement('div');
      text.className = 'placeholder-text';
      skeleton.appendChild(text);
    }

    const msg = document.createElement('p');
    msg.className = 'loading-message';
    msg.textContent = message;

    container.appendChild(skeleton);
    container.appendChild(msg);
    this.appendChild(container);
  }
}
customElements.define('loading-state', LoadingState);
