/*Estado de navegación: al salir de un listado hacia una
vista de detalle se guardan filtros y scroll; al volver se restauran.
Vive en memoria porque el router de hash intercambia vistas sin recargar. */

const store = new Map();

export function saveListState(path, state) {
  store.set(path, state);
}

export function readListState(path) {
  return store.get(path) || null;
}

export function clearListState(path) {
  store.delete(path);
}
