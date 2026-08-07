# Documento de Requerimientos de Software

## PanaLeague — Gestor de Liga Deportiva (Edición en Pareja)

---

## 1. Introducción

### 1.1 Propósito

Este documento describe los requerimientos funcionales, las vistas y el flujo de navegación de la aplicación web **PanaLeague**. Está dirigido a la pareja de estudiantes desarrolladores como guía de construcción del sistema.

### 1.2 Alcance

PanaLeague es una aplicación web de página única (SPA) construida con HTML, CSS y JavaScript vanilla que permite gestionar **ligas deportivas amateur**. Toda la información se guarda **localmente en el navegador** usando IndexedDB. La aplicación pone énfasis en el manejo de operaciones con integridad relacional, el dashboard de estadísticas con visualizaciones gráficas, y la coordinación de dos desarrolladores trabajando sobre la misma base de código.

### 1.3 Sistema Multi-Deporte

La aplicación debe soportar **múltiples deportes en la misma instancia**. Cada liga que el usuario crea se asocia a un deporte, y la interfaz adapta la terminología según el deporte de la liga activa. Esto obliga a la pareja a diseñar el sistema pensando en la variabilidad desde el inicio, no como una decoración añadida al final.

Como mínimo, la aplicación debe soportar **tres deportes distintos**. La pareja elige libremente cuáles son y define su propio mapa de terminología para cada uno.

#### 1.3.1 Alcance de la adaptación por deporte (Nivel Cosmético)

La adaptación por deporte es **estrictamente cosmética**: cambian etiquetas visibles y elementos visuales según el deporte, pero **la lógica interna del sistema es idéntica en todos los casos**. En particular:

- **Las reglas de puntuación son las mismas** para todos los deportes soportados: 3 puntos por victoria, 1 por empate, 0 por derrota; el desempate es por diferencia y luego por puntos a favor. Los deportes que en la vida real usan otras reglas (ej. sets en vóley, ELO en ajedrez) se adaptan a este esquema simplificado.
- **La estructura de datos es la misma**: los eventos de anotación siempre tienen los mismos campos (jugador, minuto opcional, equipo). No se agregan campos específicos por deporte (como "número de set" o "número de jugada").
- **Las posiciones de jugador son texto libre** en el formulario; el sistema no valida ni sugiere posiciones específicas por deporte.

Lo que **sí** se adapta por deporte:

| Elemento              | Ejemplo Fútbol | Ejemplo Básquet | Ejemplo Vóley |
| --------------------- | -------------- | --------------- | ------------- |
| Evento de anotación   | "Gol"          | "Canasta"       | "Punto"       |
| Etiquetas de tabla    | GF / GC        | PF / PC         | PF / PC       |
| Ranking de anotadores | "Goleadores"   | "Encestadores"  | "Anotadores"  |

Además de la terminología, se espera que **cada deporte tenga una identidad visual propia**: iconografía, paleta de colores, tipografía de acentos. El diseño de esta identidad es responsabilidad enteramente de la pareja y forma parte de la originalidad del proyecto. Los ejemplos anteriores son solo referenciales para el mapeo textual.

#### 1.3.2 Implementación técnica de la adaptación

La adaptación por deporte debe implementarse mediante un **mapa de terminología** (por ejemplo, un objeto JavaScript declarado en un archivo dedicado como `js/sports-terms.js`) que centralice todas las etiquetas e identificadores visuales por deporte. Los componentes leen del mapa según el deporte de la liga activa, en lugar de tener strings hardcodeados en el DOM.

No se permite hardcodear etiquetas específicas de un deporte dentro del HTML o del código de los componentes. Un cambio del mapa de terminología (por ejemplo, renombrar "Gol" a "Anotación") debe reflejarse en toda la aplicación sin tocar nada más.

### 1.4 Modalidades de Torneo

La aplicación debe soportar **dos modalidades** de torneo. La modalidad se elige al crear una liga y **no puede modificarse después**.

#### Modalidad A — Liga (todos contra todos)

- Cada equipo se enfrenta a cada otro equipo de la liga.
- La pareja debe soportar **una vuelta o ida y vuelta** (configurable al crear la liga).
  - **Una vuelta:** para N equipos se generan N × (N−1) / 2 partidos.
  - **Ida y vuelta:** cada par de equipos se enfrenta dos veces alternando local y visitante; se generan N × (N−1) partidos.
- El sistema debe ofrecer un botón **"Generar fixture"** al crear una liga en esta modalidad, que produzca automáticamente todos los partidos con fechas escalonadas (la pareja decide el algoritmo de escalonamiento).
- La tabla de posiciones aplica normalmente. La liga termina cuando todos los partidos están finalizados.

#### Modalidad B — Eliminación Directa (bracket)

- Los equipos se enfrentan en llaves; el perdedor de cada partido queda eliminado y el ganador avanza a la siguiente ronda.
- El número de equipos debe ser **potencia de 2**: 4, 8 o 16.
- El sistema debe ofrecer un botón **"Generar bracket"** al crear una liga en esta modalidad, que produzca:
  - El sorteo/emparejamiento inicial de la primera ronda (la pareja decide si es aleatorio o por seed).
  - Los partidos de rondas posteriores como plantillas con equipos "Por definir", que se completan automáticamente al finalizar los partidos de la ronda previa.
- **No se permiten empates:** al finalizar un partido de eliminación directa el usuario debe declarar un ganador, incluso si el marcador es idéntico (por ejemplo, decidido "por penales" u otra forma que el usuario reporte manualmente).
- La tabla de posiciones **no aplica** en esta modalidad; se muestra en su lugar la estructura del bracket con el estado de cada partido.
- El torneo termina cuando se finaliza el partido de la ronda final.

#### Comportamiento común a ambas modalidades

- La adaptación de terminología por deporte funciona igual en ambas modalidades.
- Los rankings de anotadores y las estadísticas por jugador funcionan igual.
- La operación de integridad de finalizar partido (sección 4.8.3) aplica en ambas, con la particularidad de que en eliminación directa **el ganador debe avanzarse automáticamente al slot correspondiente del partido de la siguiente ronda**, dentro de la misma transacción.
- La operación de deshacer partido (sección 4.8.4) tiene una restricción adicional en eliminación directa: **no se puede deshacer un partido si su partido de la siguiente ronda ya está finalizado**. Si el usuario intenta hacerlo, el sistema debe mostrar un mensaje claro pidiendo que primero deshaga el partido dependiente.

### 1.5 Definiciones

| Término                 | Definición                                                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| SPA                     | Single Page Application — aplicación de una sola página que cambia su contenido dinámicamente sin recargar el navegador           |
| Vista                   | Sección de la interfaz que se muestra al usuario según su contexto de navegación                                                  |
| Componente              | Sección reutilizable de la interfaz implementada como `Custom Element`                                                            |
| IndexedDB               | Base de datos NoSQL embebida en el navegador, asíncrona y transaccional                                                           |
| Transacción             | Conjunto de operaciones de IndexedDB que se aplican como una unidad: o todas tienen éxito o ninguna se aplica                     |
| Liga activa             | La liga que se está visualizando y editando actualmente. El usuario puede tener varias ligas creadas pero una sola activa por vez |
| Operación de integridad | Operación que afecta a múltiples entidades simultáneamente y debe completarse dentro de una sola transacción                      |
| Evento de partido       | Anotación individual ocurrida en un partido (gol, punto, canasta, etc.) registrada con jugador y minuto opcional                  |

---

## 2. Descripción General del Sistema

PanaLeague funciona como una SPA: existe un único archivo `index.html` que actúa como contenedor. Las vistas se intercambian dinámicamente mediante JavaScript, sin redirigir a otros archivos HTML. La navegación se gestiona internamente a través del fragmento de la URL (`#dashboard`, `#teams`, etc.).

### 2.1 Vistas del sistema

El sistema cuenta con **nueve vistas principales**:

| ID   | Vista              | Ruta          | Descripción                                                               |
| ---- | ------------------ | ------------- | ------------------------------------------------------------------------- |
| V-01 | Dashboard          | `#dashboard`  | Resumen de la liga activa con gráficos y próximos partidos                |
| V-02 | Ligas              | `#leagues`    | CRUD de ligas, incluye selección de liga activa e importación/exportación |
| V-03 | Equipos            | `#teams`      | CRUD de equipos de la liga activa                                         |
| V-04 | Detalle de Equipo  | `#team/:id`   | Plantilla, historial de partidos y estadísticas del equipo                |
| V-05 | Jugadores          | `#players`    | CRUD de jugadores con filtros por equipo y posición                       |
| V-06 | Detalle de Jugador | `#player/:id` | Historial individual y estadísticas acumuladas                            |
| V-07 | Partidos           | `#matches`    | CRUD de partidos (programar y finalizar)                                  |
| V-08 | Detalle de Partido | `#match/:id`  | Registro de eventos y finalización del partido                            |
| V-09 | Estadísticas       | `#stats`      | Tabla de posiciones, rankings y gráficos avanzados                        |

### 2.2 Modelo de datos (entidades)

La aplicación maneja **cinco entidades** relacionadas, todas almacenadas en IndexedDB:

| Entidad      | Relaciones                                    | Campos clave                                                                                      |
| ------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `League`     | Contiene equipos y partidos                   | nombre, deporte¹, modalidad², temporada, activa (booleano), configuración de rondas (si aplica)   |
| `Team`       | Pertenece a una liga, contiene jugadores      | nombre, escudo (URL o color), colores, liga, estadísticas agregadas                               |
| `Player`     | Pertenece a un equipo                         | nombre, foto (URL), posición, número, equipo, estadísticas agregadas                              |
| `Match`      | Pertenece a una liga, enfrenta a dos equipos  | equipo local, equipo visitante, fecha, estado, marcador, ronda³, referencia al siguiente partido³ |
| `MatchEvent` | Pertenece a un partido, asociado a un jugador | partido, jugador, tipo, minuto                                                                    |

¹ El campo **deporte** en `League` es obligatorio y debe corresponder a uno de los deportes soportados por el mapa de terminología (ver sección 1.3).

² El campo **modalidad** en `League` define si es "liga" o "eliminación directa" y no puede modificarse una vez creada la liga (ver sección 1.4).

³ Los campos **ronda** y **referencia al siguiente partido** en `Match` solo son relevantes en modalidad eliminación directa. En modalidad liga pueden quedar vacíos o no aplicar.

### 2.3 Flujo de navegación

```
                          ┌────────────────────┐
                          │     #dashboard     │
                          │ (Liga activa: vista│
                          │   inicial)         │
                          └─────────┬──────────┘
                                    │
        ┌───────────────┬───────────┼───────────┬───────────────┐
        ▼               ▼           ▼           ▼               ▼
   ┌──────────┐   ┌──────────┐ ┌─────────┐ ┌─────────┐   ┌──────────┐
   │ #leagues │   │  #teams  │ │#players │ │#matches │   │  #stats  │
   └────┬─────┘   └────┬─────┘ └────┬────┘ └────┬────┘   └──────────┘
        │              │            │           │
        │              ▼            ▼           ▼
        │       ┌──────────┐ ┌──────────┐ ┌──────────┐
        │       │#team/:id │ │#player/  │ │#match/   │
        │       │          │ │  :id     │ │  :id     │
        │       └──────────┘ └──────────┘ └──────────┘
        │
        ▼
   (cambio de liga activa → recarga del dashboard)
```

**Reglas de navegación:**

- La barra de navegación está siempre visible en todas las vistas.
- El cambio de liga activa desde `#leagues` redirige automáticamente al `#dashboard` actualizado.
- Las vistas de detalle (`#team/:id`, `#player/:id`, `#match/:id`) muestran un botón "← Volver" que regresa al listado correspondiente conservando filtros y scroll.
- La navegación se realiza mediante el fragmento de la URL (hash routing). Los botones "Atrás" y "Adelante" del navegador deben funcionar correctamente.

---

## 3. Componentes Globales

Estos elementos son persistentes y se mantienen visibles en todas las vistas.

### 3.1 Barra de Navegación

**Ubicación:** Parte superior de la pantalla, fija al hacer scroll.

Debe contener:

- Logo o nombre de la aplicación (elegido por la pareja) que actúe como enlace a `#dashboard`.
- Indicador de la **liga activa** con su nombre y su deporte.
- Enlaces hacia `#leagues`, `#teams`, `#players`, `#matches` y `#stats`.
- Indicador visual de la vista activa (el enlace actual debe estar resaltado).

### 3.2 Footer

**Ubicación:** Parte inferior de la página.

Debe contener:

- Texto de créditos: nombres de los dos integrantes y año.
- Indicador del estado de IndexedDB (conectado / error).

---

## 4. Especificación de Vistas

### Requerimientos Funcionales (resumen)

La siguiente lista es un resumen directo y accionable de lo que la aplicación debe permitir al usuario. Sirve como checklist mínimo para la entrega.

- Crear, listar, editar y eliminar **ligas** con persistencia en IndexedDB, eligiendo entre modalidad **liga** o **eliminación directa** al crearlas.
- Mantener una **liga activa** que filtra el resto de la información (equipos, partidos, estadísticas).
- Crear, listar, editar y eliminar **equipos** asociados a la liga activa.
- Crear, listar, editar y eliminar **jugadores** asociados a equipos.
- **Generar automáticamente el fixture** (modalidad liga, una o ida y vuelta) o el **bracket** (modalidad eliminación directa) al pulsar el botón correspondiente cuando la liga tenga todos sus equipos registrados.
- **Programar** partidos manualmente en modalidad liga; en eliminación directa los partidos se generan con el bracket.
- **Finalizar** un partido registrando el marcador y los eventos de anotación, en una única operación transaccional que actualiza las estadísticas de equipos y jugadores. En modalidad eliminación directa, además avanza automáticamente al ganador al partido de la siguiente ronda.
- **Deshacer** un partido finalizado (con restricciones en eliminación directa si la siguiente ronda ya está finalizada).
- Visualizar la **tabla de posiciones** (modalidad liga) o el **bracket** (modalidad eliminación directa) actualizados automáticamente.
- Visualizar **rankings** de jugadores (anotadores) y de equipos.
- **Exportar** una liga completa a un archivo JSON e **importar** una liga desde un archivo JSON.
- Visualizar un **dashboard** con al menos 6 gráficos distintos repartidos entre `#dashboard` y `#stats`.

---

### V-01 — Dashboard (`#dashboard`)

**Propósito:** Ser la puerta de entrada a la aplicación. Muestra un resumen visual de la liga activa.

#### 4.1.1 Sección: Cabecera

- Nombre de la liga activa, deporte y temporada.
- Botón o selector para cambiar de liga activa (si hay varias creadas).
- Mensaje vacío si no hay ninguna liga creada, con botón "Crear primera liga" que navega a `#leagues`.

#### 4.1.2 Sección: Próximo partido y último resultado

- Tarjeta del **próximo partido programado** (más cercano en el futuro): equipos enfrentados con sus escudos, fecha y hora.
- Tarjeta del **último partido finalizado** (más reciente): equipos enfrentados, marcador final y enlace al detalle.
- Si no hay partidos programados o finalizados, mostrar mensaje vacío correspondiente.

#### 4.1.3 Sección: Vista rápida del torneo (adaptativa)

- En modalidad **liga**: mini tabla con el top 5 de equipos ordenados por puntos. Columnas: posición, escudo, nombre, PJ, puntos. Enlace "Ver tabla completa" a `#stats`.
- En modalidad **eliminación directa**: resumen del bracket mostrando el estado de la última ronda finalizada y la próxima ronda. Enlace "Ver bracket completo" a `#stats`.

#### 4.1.4 Sección: Gráficos del dashboard

Mínimo **3 gráficos** en esta vista, implementados con Chart.js:

- Gráfico de barras o radar con los equipos con más puntos a favor.
- Gráfico de torta o anillo con la distribución de resultados (victorias / empates / derrotas) acumulados de la liga.
- Gráfico de líneas con la evolución de puntos a favor por fecha (timeline de la liga).

Si la liga aún no tiene partidos jugados, los gráficos deben mostrar un mensaje "No hay datos suficientes" en lugar de quedar vacíos o rotos.

---

### V-02 — Ligas (`#leagues`)

**Propósito:** Gestionar el ciclo de vida de las ligas y permitir importación/exportación.

#### 4.2.1 Sección: Listado

- Tabla o galería de tarjetas con todas las ligas creadas.
- Cada elemento muestra: nombre, deporte, temporada, número de equipos, número de partidos y un indicador si es la **liga activa**.
- Acciones por liga: editar, eliminar, activar, exportar JSON.

#### 4.2.2 Crear / Editar Liga

Formulario con los siguientes campos:

- **Nombre** (obligatorio, texto, único entre ligas creadas).
- **Deporte** (obligatorio, selector con los deportes soportados por la aplicación según el mapa de terminología). La UI de las vistas relacionadas con esta liga usará la terminología del deporte elegido.
- **Modalidad** (obligatoria, ver sección 1.4):
  - **Liga:** el usuario debe elegir además si es a **una vuelta** o a **ida y vuelta**.
  - **Eliminación directa:** el usuario debe elegir el **número de equipos** entre 4, 8 o 16.
- **Temporada** (obligatorio, texto libre: "2026-I", "Primavera 2026", etc.).
- **Descripción** (opcional, área de texto).

Una vez creada la liga:

- La **modalidad no se puede modificar** en ediciones posteriores; solo pueden editarse nombre, temporada y descripción.
- El botón **"Generar fixture"** (en modalidad liga) o **"Generar bracket"** (en modalidad eliminación directa) aparece cuando la liga tiene todos sus equipos registrados. Al pulsarlo, se generan automáticamente todos los partidos correspondientes dentro de una sola transacción.
- Si en eliminación directa el número de equipos registrados no coincide con lo declarado al crear la liga (por ejemplo, se declararon 8 y solo hay 6), el botón "Generar bracket" permanece deshabilitado con mensaje explicativo.

#### 4.2.3 Activar una liga

- Solo puede haber **una liga activa a la vez**.
- Activar una liga es una operación transaccional que desactiva la anterior (si la hay) y activa la nueva.
- Al activar, la aplicación redirige al `#dashboard` mostrando los datos de la nueva liga activa.
- La liga activa se persiste en LocalStorage para mantener la selección entre sesiones.

#### 4.2.4 Eliminar Liga

- Solicita confirmación al usuario antes de eliminar.
- La eliminación **borra en cascada** todos los equipos, jugadores, partidos y eventos asociados a esa liga, dentro de una sola transacción.
- Si se elimina la liga activa, la siguiente liga disponible pasa a ser la activa (o ninguna, si no quedan).

#### 4.2.5 Exportar / Importar

- **Exportar:** botón por liga que descarga un archivo JSON con la liga completa (incluyendo equipos, jugadores, partidos y eventos relacionados).
- **Importar:** botón general que abre un selector de archivo JSON. Al importar:
  - Se valida la estructura del archivo. Si es inválido, se muestra mensaje de error.
  - Si el nombre de la liga importada ya existe, se solicita renombrar o cancelar.
  - La importación se realiza dentro de una sola transacción.

---

### V-03 — Equipos (`#teams`)

**Propósito:** Gestionar los equipos de la liga activa.

#### 4.3.1 Listado

- Galería de tarjetas con todos los equipos de la liga activa.
- Cada tarjeta muestra: escudo, nombre, número de jugadores en plantilla, posición actual en la tabla.
- Al hacer clic, navega a `#team/:id`.

#### 4.3.2 Crear / Editar Equipo

Formulario con:

- **Nombre** (obligatorio, único dentro de la liga).
- **Escudo** (opcional, URL de imagen). Si no se especifica, se genera un placeholder con las iniciales del nombre y los colores elegidos.
- **Color principal** (selector de color).
- **Color secundario** (selector de color).
- **Ciudad / Sede** (opcional, texto).

#### 4.3.3 Eliminar Equipo

- Si el equipo tiene partidos jugados o programados, se debe **bloquear la eliminación** y mostrar un mensaje explicativo.
- Si el equipo tiene jugadores pero no partidos, se solicita confirmación y al confirmar se eliminan también todos sus jugadores en cascada.

---

### V-04 — Detalle de Equipo (`#team/:id`)

**Propósito:** Vista detallada con toda la información del equipo.

#### 4.4.1 Cabecera del equipo

- Escudo, nombre, colores, ciudad.
- Estadísticas resumidas: PJ, PG, PE, PP, PF (puntos a favor), PC (puntos en contra), DIF, Puntos.
- Posición actual en la tabla.

#### 4.4.2 Plantilla

- Galería de jugadores del equipo.
- Cada jugador muestra foto, nombre, número y posición.
- Botón "Agregar jugador" abre el formulario de creación pre-asignado al equipo actual.

#### 4.4.3 Próximos partidos

- Listado de partidos programados del equipo.
- Cada partido muestra rival, fecha, escudos y estado.

#### 4.4.4 Partidos jugados

- Listado de partidos finalizados, más recientes primero.
- Cada partido muestra rival, fecha, marcador y resultado (V/E/D) con código de color.

#### 4.4.5 Mini gráfico del equipo

- Un gráfico de líneas con la evolución de puntos acumulados por fecha de partido jugado.

---

### V-05 — Jugadores (`#players`)

**Propósito:** Gestionar los jugadores de todos los equipos de la liga activa.

#### 4.5.1 Sección: Filtros y búsqueda

- Campo de búsqueda por nombre con **debounce** (300–500 ms).
- Filtro por equipo (selector).
- Filtro por posición (selector con las posiciones registradas en la liga).
- Botón "Limpiar filtros".

#### 4.5.2 Listado

- Galería de tarjetas con foto, nombre, equipo (con escudo pequeño), número y posición.
- Al hacer clic, navega a `#player/:id`.

#### 4.5.3 Crear / Editar Jugador

Formulario con:

- **Nombre** (obligatorio).
- **Foto** (opcional, URL).
- **Posición** (texto libre — la pareja decide si maneja un catálogo o lo deja abierto).
- **Número** (numérico, único dentro del equipo).
- **Equipo** (selector obligatorio de los equipos de la liga activa).

#### 4.5.4 Eliminar Jugador

- Si el jugador tiene eventos registrados en partidos, se debe **bloquear la eliminación** y mostrar un mensaje explicativo.
- Si no tiene eventos, se elimina con confirmación.

---

### V-06 — Detalle de Jugador (`#player/:id`)

**Propósito:** Vista detallada con la trayectoria del jugador en la liga.

#### 4.6.1 Cabecera

- Foto, nombre, número, posición, equipo actual con escudo.

#### 4.6.2 Estadísticas individuales

- Partidos jugados, anotaciones totales, promedio de anotaciones por partido.

#### 4.6.3 Historial de partidos

- Listado de partidos donde el jugador anotó al menos un punto.
- Cada entrada: partido, rival, anotaciones del jugador en ese partido, resultado final.

#### 4.6.4 Mini gráfico

- Gráfico de barras con anotaciones por partido a lo largo de la liga.

---

### V-07 — Partidos (`#matches`)

**Propósito:** Gestionar todos los partidos de la liga activa.

#### 4.7.1 Sección: Filtros

- Filtro por estado: Todos / Programados / Finalizados.
- Filtro por equipo (selector).
- Filtro por rango de fecha.
- En modalidad **eliminación directa**, filtro adicional por **ronda** (Octavos / Cuartos / Semifinal / Final, según corresponda al número de equipos).

#### 4.7.2 Listado

- Tabla o galería de partidos ordenados por fecha (descendente por defecto).
- Cada partido muestra: equipo local con escudo, marcador (o "vs" si está programado), equipo visitante con escudo, fecha, estado.
- En modalidad eliminación directa se muestra además la **ronda** del partido (Octavos, Cuartos, etc.).
- Al hacer clic, navega a `#match/:id`.

#### 4.7.3 Crear / Editar partido

La creación **manual** de partidos solo aplica en modalidad **liga**. En modalidad **eliminación directa** los partidos se generan automáticamente con el bracket y no se pueden crear ni editar manualmente (solo se puede editar la fecha).

Formulario en modalidad liga:

- **Equipo local** (selector obligatorio).
- **Equipo visitante** (selector obligatorio, distinto al local).
- **Fecha y hora** (obligatorio).
- Validaciones:
  - Los dos equipos deben pertenecer a la misma liga (la activa).
  - Un equipo no puede enfrentarse a sí mismo.
  - No se permite crear dos partidos con los mismos equipos en la misma fecha exacta.

#### 4.7.4 Eliminar partido

- En modalidad **liga**, solo se pueden eliminar partidos **programados** (no finalizados). Los finalizados se pueden "deshacer" (ver V-08).
- En modalidad **eliminación directa**, no se permite eliminar partidos individuales; solo eliminar la liga completa.

---

### V-08 — Detalle de Partido (`#match/:id`)

**Propósito:** Visualizar y operar sobre un partido específico. Esta vista contiene la **operación de integridad** central del proyecto.

#### 4.8.1 Cabecera del partido

- Equipos enfrentados con escudos, fecha, hora, estado (Programado / Finalizado).
- Si está finalizado, mostrar marcador prominente.

#### 4.8.2 Registro de eventos

Esta sección se habilita para partidos en estado **Programado**:

- Botón "Agregar anotación" abre un sub-formulario con:
  - Equipo (local o visitante).
  - Jugador (selector con los jugadores del equipo elegido).
  - Minuto (opcional, numérico).
- Los eventos se acumulan visualmente en dos columnas (local | visitante) con jugador y minuto.
- Los eventos se pueden eliminar individualmente antes de finalizar el partido.

En modalidad **eliminación directa**, si al finalizar el partido el marcador queda **empatado**, la UI debe pedir al usuario que declare un ganador (por ejemplo, mediante un selector de "Ganador por penales / desempate"). No se puede finalizar el partido sin un ganador declarado.

#### 4.8.3 Operación: Finalizar Partido (operación de integridad)

Cuando el usuario pulsa **"Finalizar partido"**, se debe ejecutar **una sola transacción de IndexedDB** que aplique simultáneamente:

1. **Actualizar el partido**: estado a "Finalizado" y marcador calculado a partir de los eventos registrados.
2. **Actualizar estadísticas del equipo local**: incrementar PJ, sumar PG/PE/PP según corresponda, sumar PF y PC, recalcular puntos.
3. **Actualizar estadísticas del equipo visitante**: igual que el local.
4. **Actualizar estadísticas de cada jugador** que anotó: incrementar partidos jugados (si no estaba contabilizado) y sumar sus anotaciones.
5. **Persistir todos los eventos** en la tabla de eventos.
6. **En modalidad eliminación directa únicamente:** localizar el partido de la siguiente ronda que depende de este partido y **actualizarlo con el ganador** en el slot correspondiente (local o visitante según posición en el bracket). Si el partido de siguiente ronda no existe (es la final), este paso se omite.

Si **cualquiera** de estos pasos falla, la transacción debe revertirse por completo y el partido debe quedar en su estado original. La aplicación debe informar el error al usuario y ofrecer reintentar.

#### 4.8.4 Operación: Deshacer Partido (operación de integridad inversa)

Si un partido está finalizado, debe existir la opción "Deshacer partido", que ejecuta una transacción inversa:

1. Restablecer el estado del partido a "Programado", limpiar el marcador.
2. Restar las contribuciones de ese partido a las estadísticas de ambos equipos.
3. Restar las anotaciones de cada jugador.
4. Conservar los eventos para que el usuario pueda volver a finalizarlo si lo desea (no se eliminan).
5. **En modalidad eliminación directa únicamente:** localizar el partido de la siguiente ronda que depende de este partido y **limpiar el slot** correspondiente (volver a "Por definir"), solo si dicho partido siguiente aún está en estado "Programado".

Esta operación debe ejecutarse también dentro de una sola transacción.

**Restricción en modalidad eliminación directa:** no se puede deshacer un partido si el partido de la siguiente ronda ya está finalizado. Si el usuario intenta hacerlo, la operación debe rechazarse con un mensaje claro pidiendo que primero deshaga el partido dependiente.

---

### V-09 — Estadísticas (`#stats`)

**Propósito:** Centralizar la visión de conjunto del torneo, tablas de rankings y gráficos avanzados. La sección principal se adapta según la modalidad.

#### 4.9.1 Sección: Estructura del torneo (adaptativa por modalidad)

**En modalidad Liga — Tabla de posiciones:**

- Tabla completa con todos los equipos de la liga activa.
- Columnas: posición, escudo, nombre, PJ, PG, PE, PP, PF, PC, DIF, Puntos.
- Ordenada por puntos, con desempate por diferencia y luego por puntos a favor.
- Cada fila enlaza al detalle del equipo.

**En modalidad Eliminación Directa — Bracket visual:**

- Representación visual clara del bracket con todas las rondas del torneo (Octavos → Cuartos → Semifinal → Final, según el número de equipos).
- Cada partido se muestra como una tarjeta con los dos equipos enfrentados (o "Por definir" si aún no está resuelto), su marcador si está finalizado, y su estado.
- Los partidos ya finalizados deben resaltar visualmente al equipo ganador.
- El diseño visual del bracket (árbol tradicional, columnas, tarjetas apiladas, etc.) es decisión de la pareja siempre que la estructura sea comprensible.
- Cada tarjeta de partido enlaza al detalle correspondiente.

#### 4.9.2 Tabla de anotadores

- Top 10 jugadores con más anotaciones.
- Columnas: posición, foto, nombre, equipo, anotaciones, PJ, promedio.
- Cada fila enlaza al detalle del jugador.
- Aplica en ambas modalidades.

#### 4.9.3 Gráficos avanzados

Mínimo **3 gráficos adicionales** (sumados a los 3 del dashboard, totalizan los 6 requeridos):

- En modalidad **liga**: gráfico de líneas comparando la evolución de puntos acumulados de varios equipos (multi-serie); barras horizontales con los top 10 anotadores; un gráfico adicional a elección de la pareja.
- En modalidad **eliminación directa**: barras horizontales con los top 10 anotadores; gráfico de anotaciones por ronda; un gráfico adicional a elección de la pareja (ejemplos válidos: evolución de anotaciones por ronda, promedio de goles por partido por ronda, distribución de tiempos de anotación, etc.).

---

## 5. Requerimientos No Funcionales

| ID     | Requerimiento              | Descripción                                                                                                                                                                                |
| ------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RNF-01 | Tecnología                 | HTML, CSS y JavaScript vanilla. Se permite **Chart.js** como única librería externa para visualización de gráficos. No se permite ninguna otra librería ni framework.                      |
| RNF-02 | Persistencia               | Todos los datos relacionales se guardan en **IndexedDB**. Solo se permite LocalStorage para preferencias de usuario (liga activa, tema visual, idioma).                                    |
| RNF-03 | Transacciones              | Toda operación que afecte a más de una entidad (finalizar partido, deshacer partido, eliminar liga en cascada, importar liga) debe ejecutarse dentro de una sola transacción de IndexedDB. |
| RNF-04 | Sin recarga                | La navegación entre vistas no debe recargar la página. El contenido se intercambia dinámicamente.                                                                                          |
| RNF-05 | Funcionamiento offline     | La aplicación debe funcionar completamente sin conexión a internet (excepto la carga inicial de Chart.js desde CDN, si se opta por esa vía).                                               |
| RNF-06 | Validaciones de formulario | Todas las validaciones (campos obligatorios, unicidad, rangos numéricos) deben hacerse del lado del cliente antes de persistir.                                                            |
| RNF-7  | Comentarios                | El código debe tener comentarios que expliquen las secciones principales: capa de IndexedDB, transacciones, renderizado de gráficos y manejo de navegación.                                |

---

## 6. Requerimientos Técnicos

### 6.1 Capa de Persistencia (IndexedDB)

- **Una sola base de datos** con el nombre `leaguehub-db` (o similar consensuado por la pareja).
- **Object stores** con índices apropiados para las consultas necesarias. Como mínimo:
  - `leagues` con índice por `name` y por `isActive`.
  - `teams` con índice por `leagueId` y por `name`.
  - `players` con índice por `teamId` y por `name`.
  - `matches` con índice por `leagueId`, por `homeTeamId`, por `awayTeamId`, por `date` y por `status`.
  - `events` con índice por `matchId` y por `playerId`.
- **Capa de acceso abstracta:** todas las operaciones a IndexedDB deben pasar por funciones helper centralizadas. No se permite que un componente abra directamente una transacción ad-hoc; debe consumir la capa.
- **Versionado del esquema:** la base de datos debe declarar una versión inicial. Si en algún momento del desarrollo cambia el esquema, debe incrementarse la versión y manejarse en `onupgradeneeded`.

### 6.2 Transacciones

- Toda operación de integridad (V-08, importar, eliminar en cascada, activar liga) debe ser una transacción `readwrite` que toque todos los object stores necesarios.
- Si la transacción falla, debe capturarse el evento `error` o `abort` y mostrarse un mensaje al usuario con la opción de reintentar.
- No se permite simular transacciones con múltiples `await` sin una transacción real abierta; debe usarse `db.transaction([...stores], 'readwrite')`.

### 6.3 Visualización con Chart.js

- Mínimo **6 gráficos distintos** entre `#dashboard` y `#stats`.
- Al menos **3 tipos diferentes** de gráficos (ej. barras, líneas, torta).
- Los gráficos deben **reaccionar a cambios en los datos**: si el usuario finaliza un partido y luego navega al dashboard, los gráficos deben reflejar los datos actualizados.
- Cuando no haya datos suficientes, el gráfico debe mostrar un mensaje informativo en lugar de quedarse vacío o roto.

### 6.4 Componentes requeridos

La aplicación debe implementar como mínimo los siguientes componentes. La pareja puede crear componentes adicionales si lo considera necesario.

| Componente       | Responsabilidad                                                        |
| ---------------- | ---------------------------------------------------------------------- |
| `NavBar`         | Barra de navegación global con liga activa y links                     |
| `LeagueCard`     | Tarjeta de una liga en el listado                                      |
| `TeamCard`       | Tarjeta de un equipo con escudo                                        |
| `PlayerCard`     | Tarjeta de un jugador                                                  |
| `MatchCard`      | Tarjeta de un partido con marcador o estado                            |
| `StandingsTable` | Tabla de posiciones (modalidad liga)                                   |
| `BracketView`    | Representación visual del bracket (modalidad eliminación directa)      |
| `RankingTable`   | Tabla genérica de rankings de jugadores                                |
| `EventForm`      | Sub-formulario para registrar una anotación en un partido              |
| `ChartContainer` | Componente envolvente que recibe configuración y renderiza un Chart.js |
| `ConfirmDialog`  | Diálogo modal de confirmación reutilizable                             |
| `Toast`          | Notificaciones flotantes de éxito/error                                |
| `LoadingState`   | Indicador visual de carga reutilizable                                 |

### 6.6 Preferencias de usuario en LocalStorage

LocalStorage se utiliza **únicamente** para:

- ID de la liga activa (para mantenerla seleccionada entre sesiones).
- Tema visual (claro / oscuro, si se implementa).
- Cualquier otra preferencia visual del usuario.

**No** se permite usar LocalStorage para datos relacionales (equipos, jugadores, partidos). Eso debe ir en IndexedDB.

---

## 7. Modalidad de Trabajo en Pareja

El proyecto se desarrolla en parejas de **dos integrantes**. Ambos miembros son responsables del producto final en su totalidad, pero deben repartir el trabajo de forma equilibrada y dejar evidencia de ello.

### 7.1 División Sugerida de Responsabilidades

Esta división es **orientativa**; la pareja puede ajustarla siempre que ambos integrantes tengan una carga comparable.

| Estudiante A — Datos y Partidos           | Estudiante B — Catálogos y Estadísticas                       |
| :---------------------------------------- | :------------------------------------------------------------ |
| Capa de IndexedDB y transacciones         | Vista `#teams` y `#team/:id`                                  |
| Vistas `#matches` y `#match/:id`          | Vistas `#players` y `#player/:id`                             |
| Operación de finalizar / deshacer partido | Vista `#stats` con tabla y gráficos                           |
| Vista `#leagues` y export/import JSON     | Vista `#dashboard` con gráficos                               |
| Componente `EventForm`, `MatchCard`       | Componente `StandingsTable`, `RankingTable`, `ChartContainer` |

**Responsabilidades conjuntas (deben construirse en pareja):**

- Diseño del esquema de IndexedDB (los índices, los object stores, las relaciones).
- Router de hash y arquitectura general.
- `NavBar`, `LoadingState`, `ConfirmDialog`, `Toast` (los usan ambos).
- Estilos globales y diseño visual unificado.

La capa de IndexedDB es el punto de mayor interdependencia: ambos estudiantes la consumen y por lo tanto deben acordar su interfaz (nombres de funciones, parámetros, formato de respuesta) **desde el primer día**.

### 7.2 Evidencia de Trabajo Colaborativo

- **Ambos integrantes deben tener commits propios** en el repositorio de forma consistente a lo largo de las 2-3 semanas.
- Se valorará la existencia de commits, PRS que evidencien coordinación entre los dos.
- En la presentación final, **ambos integrantes deben poder explicar cualquier parte del código**, no únicamente la suya. En particular, ambos deben dominar la capa de IndexedDB y la operación transaccional de finalizar partido.

---

## 8. Entrega y Control de Versiones

### 8.1 Repositorio Git

- El proyecto debe estar alojado en un repositorio de Git (GitHub, GitLab, etc.).
- El repositorio debe tener configurados como colaboradores a **ambos integrantes**.
- **Estructura recomendada de commits:**
  - Commit inicial con estructura básica del proyecto.
  - Commits incrementales por funcionalidad (esquema de IndexedDB, primera vista, transacciones, gráficos, export/import, etc.).
  - Mensajes de commit descriptivos en español o inglés, consistentes en idioma.

### 8.2 Entregables

1. **Código fuente completo** en repositorio Git (link entregado por Google Classroom).
2. Aplicación funcionando localmente abriendo `index.html` (no requiere servidor).
3. **Archivo `README.md`** que incluya:
   - Nombre de los dos integrantes y división del trabajo realizado.
   - **Catálogo de deportes soportados** (mínimo 3) con su mapa de terminología documentado (qué etiqueta se usa para cada concepto en cada deporte).
   - Instrucciones para ejecutar el proyecto.
   - Lista de componentes implementados con una línea de descripción cada uno.
   - Esquema de IndexedDB documentado (object stores, índices, relaciones).
   - Capturas de pantalla de las nueve vistas mostrando al menos dos deportes distintos en funcionamiento.
   - Decisiones técnicas relevantes (cómo se implementaron las transacciones, cómo se calcula la tabla, cómo se organiza el mapa de terminología, etc.).
4. La aplicación debe contar con ligas plantilla de ejemplo insertables para poder testear da manera instantanea las funcionalidades y facilitar el proceso de debug.

---

## 9. Escenarios de Prueba Manual (mínimos)

1. Crear una liga en modalidad **liga** con 4 equipos, generar fixture, agregar jugadores. Verificar que se generaron los partidos correctos según el número de vueltas configurado.
2. Abrir un partido programado, agregar 2 anotaciones para el equipo local y 1 para el visitante, finalizar. Verificar que:
   - El partido pasa a "Finalizado".
   - El equipo local sube su PG y puntos; el visitante sube su PP.
   - Los jugadores que anotaron tienen su contador actualizado.
   - La tabla de posiciones se actualiza.
   - Los gráficos del dashboard reflejan los nuevos datos.
3. Deshacer un partido finalizado. Verificar que las estadísticas vuelven al estado anterior.
4. Crear una segunda liga en modalidad **eliminación directa** con 4 u 8 equipos, generar bracket. Verificar que se muestran las rondas correctas con equipos "Por definir" en las posteriores a la primera.
5. Finalizar un partido de octavos/cuartos. Verificar que el ganador se avanza automáticamente al slot correspondiente del partido de la siguiente ronda, en la misma transacción.
6. Intentar deshacer un partido de octavos cuyo partido de cuartos ya está finalizado. Verificar que la operación se rechaza con mensaje claro.
7. Deshacer un partido de octavos cuyo partido de cuartos aún está programado. Verificar que el slot del partido de cuartos vuelve a "Por definir".
8. Exportar una liga a JSON (una de cada modalidad). Borrar la liga. Importar el JSON. Verificar que todo se restaura idénticamente, incluyendo la modalidad y el estado del bracket si aplica.
9. Intentar eliminar un equipo con partidos jugados. Verificar que la aplicación lo impide con mensaje claro.
10. Cambiar de liga activa entre una de fútbol (liga) y otra de básquet (eliminación directa). Verificar que:
    - La terminología cambia (goles/canastas).
    - La estructura del torneo en `#stats` cambia (tabla vs bracket).
    - Los gráficos del dashboard se adaptan al contexto.
11. Cerrar el navegador y volver a abrir. Verificar que toda la información persiste y que la liga activa sigue siendo la misma.
12. Navegación con historial: usar botones del navegador para moverse entre vistas y verificar que el estado se restaura correctamente.

---

## 10. Consideraciones Adicionales

- Se evaluará la **originalidad de la interfaz gráfica**. Proyecto que se determine que no fue realizado por los estudiantes sino por inteligencia artificial no tendrá oportunidad de ser evaluado.
- Se valorará la **constancia** del trabajo a lo largo de las semanas a través de los commits, no la concentración del trabajo en los últimos días.
- La aplicación debe funcionar correctamente abriendo el `index.html` directamente en el navegador, sin necesidad de servidor local ni configuraciones adicionales.
- **El diseño visual e iconografía por deporte es completamente decisión de la pareja.** Los ejemplos textuales del documento son solo referenciales para el mapeo de terminología. La identidad visual de cada deporte forma parte de la originalidad evaluada del proyecto.
