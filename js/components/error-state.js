export class ErrorState extends HTMLElement {
  connectedCallback() {
    const message = this.getAttribute('message') || 'Ocurrió un error al cargar los datos.';
    const showRetry = this.hasAttribute('retry');

    const container = document.createElement('div');
    container.className = 'error-container';

    const icon = document.createElement('span');
    icon.className = 'error-icon';
    icon.textContent = '⚠';
    container.appendChild(icon);

    const msg = document.createElement('p');
    msg.className = 'error-message';
    msg.textContent = message;
    container.appendChild(msg);

    if (showRetry) {
      const btn = document.createElement('button');
      btn.className = 'error-retry-btn';
      btn.textContent = 'Reintentar';
      btn.addEventListener('click', () => {
        const event = new CustomEvent('retry');
        this.dispatchEvent(event);
      });
      container.appendChild(btn);
    }

    this.appendChild(container);
  }

  onRetry(callback) {
    this.addEventListener('retry', callback);
  }
}
customElements.define('error-state', ErrorState);
