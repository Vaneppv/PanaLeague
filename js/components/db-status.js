import db from "../db.js";

const LABELS = {
  connecting: "Conectando…",
  connected: "● Conectado",
  error: "● Error en IndexedDB",
};

export function initDbStatus() {
  const el = document.getElementById("db-status");
  if (!el) return;

  const update = (status) => {
    el.classList.toggle("error", status === "error");
    el.textContent = LABELS[status] || LABELS.connecting;
    el.title = "Estado de IndexedDB";
  };

  document.addEventListener("db:status", (e) => update(e.detail.status));
  update(db.getConnectionStatus());
}
