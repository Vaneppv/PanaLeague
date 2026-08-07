# PanaLeague

Gestor de ligas deportivas amateur. Aplicación web de una sola página (SPA) construida con HTML, CSS y **JavaScript vanilla**, sin frameworks, que guarda toda la información **localmente en el navegador** usando **IndexedDB**. Solo requiere abrir `index.html` para funcionar.

Soporta múltiples deportes con terminología e identidad visual adaptada y dos modalidades de torneo: **liga** (todos contra todos) y **eliminación directa** (bracket).

---

## Integrantes y división del trabajo

| Estudiante | Responsabilidades |
| --- | --- |
| **Jonner Paz** | Capa de IndexedDB (`db.js`), router y arquitectura general, vista `#leagues` (crear/editar/activar liga), generación automática de fixture (round-robin) y de bracket, componente `league-form`. |
| **Vanessa Perez** | Vistas `#teams` y `#team/:id`, vistas `#players` y `#player/:id`, vista `#stats` (tabla de posiciones, bracket, rankings y gráficos), vista `#dashboard` (tarjetas, top 5, resumen de bracket y 3 gráficos), identidad visual por deporte, ligas plantilla de ejemplo. |

**Responsabilidades conjuntas:** diseño del esquema de IndexedDB (object stores, índices, relaciones), router de hash, componentes globales (`NavBar`, `LoadingState`, `ConfirmDialog`, `Toast`, `ErrorState`) y estilos globales.

---

## Catálogo de deportes

La aplicación soporta **tres deportes**. Cada liga se asocia a un deporte y toda la interfaz adapta su terminología e identidad visual a partir del mapa centralizado en `js/sports-terms.js`.

| Concepto | ⚽ Fútbol | 🏀 Básquet | 🎾 Tenis |
| --- | --- | --- | --- |
| Evento de anotación | Gol | Canasta | Punto |
| Evento (plural) | Goles | Canastas | Puntos |
| Puntos a favor | GF | PF | PF |
| Puntos en contra | GC | PC | PC |
| Ranking de anotadores | Goleadores | Encestadores | Punteadores |
| Color primario | `#1a5c2a` | `#c8102e` | `#d4f51c` |
| Color secundario | `#ffffff` | `#006bb6` | `#3a3a3a` |

Las posiciones sugeridas en el formulario de jugadores también dependen del deporte (p. ej. Portero/Defensa/Centrocampista/Delantero en fútbol; Base/Escolta/Alero en básquet; Individual/Dobles en tenis). La adaptación es estrictamente cosmética: las reglas de puntuación y la estructura de datos son idénticas para los tres deportes (3 puntos por victoria, 1 por empate, desempate por diferencia y luego por puntos a favor).

---

## Modalidades de torneo

- **Liga (todos contra todos):** se enfrentan todos contra todos a **una vuelta** o **ida y vuelta** (configurable al crear la liga). El botón "Programar partidos" genera el fixture completo con fechas escalonadas.
- **Eliminación directa (bracket):** para 4, 8 o 16 equipos (potencia de 2). El botón "Generar bracket" arma el árbol con la primera ronda sorteada y las posteriores con equipos "Por definir"; al finalizar un partido el ganador avanza automáticamente al slot siguiente. No se admiten empates: la UI pide declarar un ganador.

---

## Cómo ejecutar el proyecto

1. Clonar el repositorio y entrar a `proyectos/LeagueHub/`.
2. Abrir `index.html` directamente en el navegador (no requiere servidor ni build).
3. La primera vez se cargan automáticamente dos **ligas plantilla de ejemplo** (una de fútbol en modalidad liga y una de básquet en modalidad eliminatoria, con equipos, jugadores y partidos) para probar todas las vistas al instante. Pueden borrarse libremente.

> Nota: los gráficos usan **Chart.js** desde CDN, por lo que la primera carga de esa librería requiere conexión a internet. El resto de la aplicación funciona 100% offline.

---

## Componentes implementados

Todos los componentes se implementan como **Custom Elements** (API Web Components).

| Componente | Descripción |
| --- | --- |
| `NavBar` | Barra de navegación global con logo, liga activa y enlaces a las vistas; resalta la vista activa. |
| `LeagueCard` | Tarjeta de una liga en el listado de `#leagues`. |
| `LeagueForm` | Formulario de crear/editar liga (nombre, deporte, modalidad, vueltas o #equipos, temporada, descripción). |
| `LeagueSwitcher` | Modal para cambiar de liga activa sin salir del dashboard. |
| `TeamCard` | Tarjeta de equipo con escudo, plantilla y posición. |
| `TeamForm` | Formulario de crear/editar equipo (nombre, escudo, colores, ciudad). |
| `PlayerCard` | Tarjeta de jugador con foto, número, posición y equipo. |
| `PlayerForm` | Formulario de crear/editar jugador (nombre, foto, posición, número, equipo). |
| `MatchCard` | Tarjeta de partido con marcador o estado. |
| `EventForm` | Sub-formulario para registrar una anotación en un partido (equipo, jugador, minuto). |
| `StandingsTable` | Tabla de posiciones de modalidad liga, ordenada por puntos, diferencia y puntos a favor. |
| `BracketView` | Árbol visual del bracket en modalidad eliminación directa, con resaltado de ganadores. |
| `RankingTable` | Tabla genérica de rankings de jugadores (top anotadores). |
| `ChartContainer` | Envoltorio que recibe configuración y renderiza un gráfico de Chart.js con manejo de "sin datos". |
| `ConfirmDialog` | Diálogo modal de confirmación reutilizable. |
| `Toast` | Notificaciones flotantes de éxito/error/info. |
| `LoadingState` | Indicador de carga reutilizable. |
| `ErrorState` | Mensaje de error reutilizable. |

---

## Esquema de IndexedDB

Base de datos única `leaguehub-db` (versión 1) con **5 object stores** con `keyPath: "id"` y autoincremento.

| Object store | Índices | Relaciones | Campos clave |
| --- | --- | --- | --- |
| `leagues` | `name` (único), `isActive` | Contiene equipos y partidos | `name`, `sport`, `modalidad` ("league" \| "tournament"), `season`, `description`, `isActive`, `rounds` o `teamCount` según modalidad |
| `teams` | `leagueId`, `name` | Pertenece a una liga; contiene jugadores | `leagueId`, `name`, `logo`, `primaryColor`, `secondaryColor`, `city`, estadísticas (`pj`, `pg`, `pe`, `pp`, `gf`, `gc`, `dif`, `pts`) |
| `players` | `teamId`, `name` | Pertenece a un equipo | `teamId`, `name`, `photo`, `position`, `number`, estadísticas (`pj`, `points`) |
| `matches` | `leagueId`, `homeTeamId`, `awayTeamId`, `date`, `status` | Pertenece a una liga; enfrenta dos equipos | `leagueId`, `homeTeamId`, `awayTeamId`, `date`, `status` ("Programado" \| "Finalizado"), `round`, `nextMatchId` (solo bracket) |
| `events` | `matchId`, `playerId` | Pertenece a un partido; asociado a un jugador | `matchId`, `teamId`, `playerId`, `minute` |

**Persistencia de preferencias:** el ID de la **liga activa** se guarda en `LocalStorage` (`leaguehub-active-league`); los datos relacionales siempre van en IndexedDB.

**Capa de acceso:** todas las operaciones pasan por las funciones de `js/db.js` (`getAll`, `getById`, `getByIndex`, `add`, `put`, `remove`, `clear`, `runTransaction`, `getActiveLeagueId`/`setActiveLeagueId`). Ningún componente abre transacciones ad-hoc.

---

## Capturas de pantalla

Las nueve vistas con al menos dos deportes distintos en funcionamiento:

| Vista | Ruta | Captura |
| --- | --- | --- |
| Dashboard | `#dashboard` | _pendiente_ |
| Ligas | `#leagues` | _pendiente_ |
| Equipos | `#teams` | _pendiente_ |
| Detalle de Equipo | `#team/:id` | _pendiente_ |
| Jugadores | `#players` | _pendiente_ |
| Detalle de Jugador | `#player/:id` | _pendiente_ |
| Partidos | `#matches` | _pendiente_ |
| Detalle de Partido | `#match/:id` | _pendiente_ |
| Estadísticas | `#stats` | _pendiente_ |

---

## Decisiones técnicas relevantes

- **Transacciones de integridad:** las operaciones que afectan a varias entidades (finalizar partido, deshacer partido, activar liga, eliminar liga en cascada) se ejecutan dentro de **una sola transacción `readwrite`** de IndexedDB mediante `db.runTransaction([...stores], "readwrite", cb)`. Si falla, IndexedDB aborta y revierte todo (RNF-03 / sección 6.2).
- **Mapa de terminología:** todas las etiquetas e iconos por deporte viven en `js/sports-terms.js` y se leen a través de `getSportTerms(sportId)`. No hay strings de deporte hardcodeados en el DOM: renombrar un término lo cambia en toda la app (requisito 1.3.2).
- **Cálculo de la tabla de posiciones:** se ordena por `pts` descendente, desempatando por `dif` y luego por `gf` (o `pf`). Los datos se recalculan desde los partidos finalizados y se acumulan en el objeto `team` dentro de la transacción de finalizar partido.
- **Cálculo de estadísticas de jugador:** cada anotación suma `points` y los partidos jugados se cuentan por partido finalizado. Los mini-gráficos de `#team/:id` y `#player/:id` y los 6 gráficos de `#dashboard`/`#stats` (barras, anillos y líneas multi-serie con Chart.js) se reconstruyen al navegar para reflejar siempre los últimos datos.
- **Bracket auto-avance:** en eliminación directa, cada `match` guarda `nextMatchId`; al finalizar, el ganador se escribe en el slot local/visitante del siguiente partido dentro de la misma transacción. La restricción de deshacer (no deshacer si la ronda siguiente está finalizada) se valida antes de abrir la transacción.
- **Router de hash:** `js/core/Router.js` intercambia vistas según `window.location.hash`, lo que hace que los botones atrás/adelante del navegador funcionen sin recargar (RNF-04). Al abrir con liga activa redirige a `#dashboard`; el logo siempre vuelve a la landing.
- **Ligas plantilla:** al abrir la app con la base vacía, `app.js` siembra automáticamente dos ligas de ejemplo (requisito 8.2) para testeo instantáneo; el usuario puede borrarlas y crear las suyas.
- **Identidad visual por deporte:** cada deporte define paleta de colores e icono en el mapa de terminología, aplicados por CSS según la liga activa (tema "dark purple neon").
