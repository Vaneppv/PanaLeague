export class ConfirmDialog extends HTMLElement {
  connectedCallback() {
    const title = this.getAttribute('title') || 'Confirmar';
    const message = this.getAttribute('message') || '¿Estás seguro?';
    const confirmText = this.getAttribute('confirm-text') || 'Aceptar';
    const cancelText = this.getAttribute('cancel-text') || 'Cancelar';

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'confirm-dialog';

    const h3 = document.createElement('h3');
    h3.textContent = title;

    const p = document.createElement('p');
    p.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'dialog-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = cancelText;
    cancelBtn.addEventListener('click', () => this.close(false));

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn btn-primary';
    confirmBtn.textContent = confirmText;
    confirmBtn.addEventListener('click', () => this.close(true));

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    dialog.appendChild(h3);
    dialog.appendChild(p);
    dialog.appendChild(actions);
    overlay.appendChild(dialog);
    this.appendChild(overlay);
  }

  close(result) {
    const event = new CustomEvent('confirm', { detail: { confirmed: result } });
    this.dispatchEvent(event);
    this.remove();
  }

  static show(title, message, confirmText) {
    return new Promise((resolve) => {
      const dialog = document.createElement('confirm-dialog');
      if (title) dialog.setAttribute('title', title);
      if (message) dialog.setAttribute('message', message);
      if (confirmText) dialog.setAttribute('confirm-text', confirmText);
      dialog.addEventListener('confirm', (e) => resolve(e.detail.confirmed));
      document.body.appendChild(dialog);
    });
  }
}
customElements.define('confirm-dialog', ConfirmDialog);
