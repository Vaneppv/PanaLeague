# Plan de Desarrollo — PanaLeague

> **Deportes:** Fútbol, Básquet, Tenis
> **Plazo:** 1-2 semanas
> **Modalidad:** Trabajo en pareja

---

## Fase 0 — Fundación (Día 1) — HACER JUNTOS

- [x] Crear estructura de carpetas:
  ```
  LeagueHub/
  ├── index.html
  ├── css/
  │   ├── styles.css
  │   └── components.css
  ├── js/
  │   ├── app.js            (entry point, router)
  │   ├── db.js             (capa IndexedDB)
  │   ├── sports-terms.js   (mapa de terminología)
  │   ├── core/
  │   │   └── Router.js     (hash router)
  │   ├── utils/
  │   │   └── helpers.js    (utilidades)
  │   ├── components/       (Custom Elements)
  │   └── views/            (lógica de cada vista)
  └── assets/
  ```
- [x] `index.html` básico: navbar placeholder, `<main id="app">`, footer
- [x] Implementar **NavBar** (Custom Element) con logo, liga activa, enlaces
- [x] Implementar **Footer** (Custom Element) con créditos y estado IndexedDB (inline en HTML, no Custom Element) — créditos con nombres de los integrantes; sin indicador de estado por decisión de la pareja
- [x] Implementar **Toast**, **ConfirmDialog**, **LoadingState** como Custom Elements
- [x] Implementar **hash router** básico que cargue vistas según `window.location.hash`
- [x] Definir estructura de los 3 deportes en `sports-terms.js`:
  - **Fútbol:** `eventName: "Gol"`, `gf: "GF"`, `gc: "GC"`, `scorers: "Goleadores"`
  - **Básquet:** `eventName: "Canasta"`, `gf: "PF"`, `gc: "PC"`, `scorers: "Encestadores"`
  - **Tenis:** `eventName: "Punto"`, `gf: "PF"`, `gc: "PC"`, `scorers: "Punteadores"`

---

## Fase 1 — Capa de Datos (Día 1-2) — HACER JUNTOS

- [x] Abrir DB `leaguehub-db` con versionado (`onupgradeneeded`)
- [x] Crear 5 object stores con índices:
  - `leagues`: índice por `name` (único), `isActive`
  - `teams`: índices por `leagueId`, `name`
  - `players`: índices por `teamId`, `name`
  - `matches`: índices por `leagueId`, `homeTeamId`, `awayTeamId`, `date`, `status`
  - `events`: índices por `matchId`, `playerId`
- [x] Implementar funciones helper en `db.js`:
  - `db.open()` → instancia única
  - `getAll(storeName)`, `getById(storeName, id)`, `getByIndex(storeName, index, value)`
  - `add(storeName, data)`, `put(storeName, data)`, `remove(storeName, id)`, `clear(storeName)`
  - `runTransaction(stores, mode, callback)` → para operaciones de integridad
  - `getActiveLeagueId()`, `setActiveLeagueId(id)` (con LocalStorage)

---

## Fase 2A — Estudiante A: Ligas, Partidos, Transacciones (Días 2-5)

- [x] **Vista `#leagues`:**
  - [x] Listado de ligas (tarjetas con nombre, deporte, temporada, #equipos, #partidos)
  - [x] Crear liga (formulario con nombre, deporte, modalidad, vueltas o #equipos, temporada)
  - [x] Editar liga (nombre, temporada, descripción — modalidad bloqueada)
  - [x] Activar liga (transaccional, desactiva la anterior, persiste en LocalStorage)
  - [x] Eliminar liga (con confirmación, borra en cascada todo)
  - [x] Botón "Programar partidos" (liga) → algoritmo round-robin
  - [x] Botón "Generar bracket" (eliminación directa) → bracket con slots
  - [x] Validación del bracket: conteo exacto de equipos declarado + potencia de 2
  - [x] Exportar liga a JSON
  - [x] Importar liga desde JSON (validación + transacción)
- [x] **Vista `#matches`:**
  - [x] Listado con filtros (estado, equipo, fecha, ronda)
  - [x] Crear/editar partido (solo modalidad liga) con validaciones
- [x] **Vista `#match/:id`:**
  - [x] Cabecera con equipos, fecha, estado
  - [x] **EventForm** (Custom Element) — registrar anotaciones por equipo
  - [x] Acumulador visual de eventos (local | visitante)
  - [x] **Operación: Finalizar partido** — transacción que:
    1. Actualiza match a "Finalizado" con marcador
    2. Actualiza estadísticas de ambos equipos (derivadas por la vista)
    3. Actualiza estadísticas de jugadores anotadores (derivadas por la vista)
    4. Persiste eventos
    5. En eliminación directa: avanza ganador al siguiente partido
  - [x] **Operación: Deshacer partido** — transacción inversa
  - [x] Validación: no deshacer si el siguiente partido ya está finalizado
  - [x] Manejo de empate en eliminación directa (selector de ganador)

---

## Fase 2B — Estudiante B: Equipos, Jugadores, Estadísticas (Días 2-5)

- [x] **Vista `#teams`:**
  - [x] Galería de tarjetas de equipos con escudo
  - [x] Crear/editar equipo (nombre, escudo URL, colores, ciudad)
  - [x] Eliminar equipo (bloqueado si tiene partidos; en cascada con jugadores si no)
- [x] **Vista `#team/:id`:**
  - [x] Cabecera con estadísticas (PJ, PG, PE, PP, PF, PC, DIF, Pts)
  - [x] Plantilla de jugadores
  - [x] Próximos partidos y partidos jugados
  - [x] Mini gráfico de líneas (evolución de puntos)
- [x] **Vista `#players`:**
  - [x] Filtros: búsqueda con debounce, por equipo, por posición
  - [x] Galería de tarjetas
  - [x] Crear/editar jugador
  - [x] Eliminar jugador (bloqueado si tiene eventos)
- [x] **Vista `#player/:id`:**
  - [x] Cabecera con foto, nombre, equipo, número
  - [x] Estadísticas: PJ, anotaciones, promedio
  - [x] Historial de partidos donde anotó
  - [x] Mini gráfico de barras (anotaciones por partido)
  - [x] Base compartida de estilos para vistas de detalle (`css/detail.css`)
- [x] **Vista `#stats`:**
  - [x] **StandingsTable** (liga) — ordenado por pts, DIF, PF
  - [x] **BracketView** (eliminación directa) — árbol visual de rondas
  - [x] **RankingTable** — top 10 anotadores
  - [x] 3 gráficos avanzados con Chart.js (barras top 10, líneas multi-equipo, +1 a elección)

---

## Fase 3 — Dashboard (Días 5-6) — ESTUDIANTE B

- [x] **Vista `#dashboard`:**
  - [x] Landing page (`/`) con descripción de la app y acciones rápidas (crear liga, ligas, equipos, jugadores, partidos, estadísticas)
  - [x] Al abrir con liga activa redirige a `#dashboard`; el logo lleva siempre a la landing
  - [x] Cabecera con nombre de liga, deporte, temporada
  - [x] Botón "Cambiar liga" (modal `league-switcher`) y "+ Crear Liga"
  - [x] Mensaje vacío si no hay ligas + botones "Crear Liga" / "Ir a Ligas"
  - [x] Tarjeta de próximo partido y último resultado
  - [x] Mini tabla top 5 (liga) o resumen de bracket (eliminación directa)
  - [x] 3 gráficos Chart.js:
    - [x] Barras/radar: equipos con más puntos a favor
    - [x] Torta/anillo: distribución resultados (V/E/D)
    - [x] Líneas: evolución de puntos por fecha
  - [x] Manejo de "No hay datos suficientes" en gráficos

---

## Fase 4 — Integración y Pruebas (Días 6-7) — AMBOS

- [x] Integrar vistas de ambos estudiantes (router configurado con todas las rutas)
- [x] Verificar que el router de hash funciona con botones atrás/adelante
- [ ] Probar los 12 escenarios de prueba manual (sección 9 del documento)
- [x] Verificar que los cambios de liga activa redirigen al dashboard
- [x] Verificar que la terminología cambia según el deporte de la liga activa
- [x] Verificar persistencia: cerrar/abrir navegador

---

## Fase 5 — Pulido (Días 7-8 si hay tiempo)

- [x] Identidad visual por deporte (paletas de colores, iconos, tipografía)
- [x] Ligas plantilla de ejemplo precargadas para test rápido
- [ ] README.md completo (nombres, división de trabajo, deportes, instrucciones, capturas, esquema DB, decisiones técnicas)
- [ ] Capturas de pantalla de las 9 vistas con 2+ deportes
