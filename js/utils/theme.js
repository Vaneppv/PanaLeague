/**
 * Aplica la identidad visual del deporte activo.
 * El selector CSS `body[data-sport]` activa las variables de color y
 * tipografía definidas en css/styles.css para cada deporte.
 * @param {string} sportId id del deporte (football | basketball | tennis | "")
 */
export function applySportTheme(sportId) {
  document.body.dataset.sport = sportId || "";
}
