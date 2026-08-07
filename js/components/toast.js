/**
 * Crea y muestra un mensaje toast.
 */
export function showToast(message = 'Congratulations!', type = 'success') {
    const toast = document.createElement('div');
    toast.className = `custom-toast ${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Muestra notificaciones toast para awards recién desbloqueados.
 */
export function showAwardToasts(newAwards) {
  newAwards.forEach(award => {
    showToast(`${award.icon} ${award.name} desbloqueado!`, 'success');
  });
}