# Especificación: estética de bloques de color

Referencia visual y de comportamiento para aplicar la estética «1c · bloques de color, tipografía expandida» a toda la app. La maqueta funcional está en [`mockup.html`](mockup.html). También está publicada como artefacto privado del responsable: https://claude.ai/artifact/LCHGoXgmtV9RFyhSqTPuC1.

El seguimiento, el plan vigente y los avances están en el issue de GitHub enlazado desde el PR. Este documento describe **qué** debe verse y **cómo** debe comportarse; no registra el estado de la tarea.

## 0. Regla principal

1. **La app conserva toda su funcionalidad actual.** Solo cambia lo que este documento marca como cambio decidido (sección 2).
2. **Si algo de la app no aparece en la maqueta ni en este documento, o si aplicar la maqueta quitaría o cambiaría un comportamiento actual, se pregunta al responsable antes de cambiarlo.** No se asume.
3. La maqueta manda en aspecto, medidas e interacción. Si este documento y la maqueta no coinciden, se pregunta.
4. Lo que la maqueta simula con un aviso («Fuera de esta maqueta»), por ejemplo «+», «Nuevo movimiento», «Iniciar sesión», «Carga rápida» o tocar un PR, en la app hace lo mismo que hace hoy.
5. Lo que solo existe para la demo **no** se implementa: el botón «Demo ×10» del timer, el marco de teléfono, la lista de notas bajo el teléfono y la tecla Escape como atrás (en la app, atrás lo dan Android y el gesto de iOS; ver 6.9).

## 1. Cómo leer la maqueta

- Es un solo HTML con CSS y JS en línea. Para verla localmente, envuélvelo en `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>[hidden]{display:none!important}</style></head><body>…</body></html>`.
- A menos de 520 px de ancho se muestra a pantalla completa, como en el iPhone. Por encima, dentro de un marco de 390×844.
- Usa los mismos datos que `?demo=1` (`DEMO_RECORDS` de `src/lib/catalog.js`) y una copia de `plateOptions`, `computeLoad` y `buildLadder` de `src/lib/plates.js`, y de la lógica del timer de `src/lib/timer-engine.js`.
- Sigue el tema del sistema (claro u oscuro) con los tokens de la sección 3.
- Recorrido para revisarla: inicio → Squats → Back Squat → cambiar RM y % → tocar discos → «Porcentajes» → deslizar desde el borde para volver. Después: Timer → AMRAP → Iniciar → minimizar → ver la cápsula en otras pantallas. Por último: PRs y Ajustes.

## 2. Decisiones del responsable

Cambios decididos explícitamente; no se vuelven a preguntar:

| # | Decisión |
| --- | --- |
| D-1 | Estilo de bloques de color con texto negro y tipografía ancha (Archivo, ancho 125 %, peso 900) en títulos y números. |
| D-2 | Esquinas menos redondas: 16 px en tiles, tarjetas y filas agrupadas; 10–12 px en controles internos; 20 px arriba en paneles (sheets). |
| D-3 | Squats deja de ser rojo (rojo = peligro): es **rosa**. Ninguna categoría usa rojo. En PRs, Run es **lima** y Heroes es **rosa**. |
| D-4 | Pantalla principal de Execute **sin** el tile «Nuevo movimiento». Sigue dentro de cada categoría y en PRs. |
| D-5 | La tarjeta «Continuar» no muestra discos: solo «Continuar», el movimiento con su % y el peso. |
| D-6 | Tarjeta del peso compacta: sin modo de edición, sin check, sin −10/+10, sin etiqueta «PESO TOTAL», sin la línea del % exacto y sin la letra de fondo. Contorno de color y número sólido en color. |
| D-7 | El RM y el % están siempre visibles en una fila discreta: RM como texto (1RM, 3RM, 5RM) y % con «− valor +» de 5 en 5, editable al tocar el número. |
| D-8 | Se **elimina la escalera de calentamiento** de la interfaz. La pestaña pasa a ser «Porcentajes» (6.4). Su paso del tour se reemplaza por uno de Porcentajes. `buildLadder` y sus pruebas se quedan en `src/lib/plates.js` sin cambios. |
| D-9 | En la pantalla de trabajo, la barra de navegación y la tarjeta del peso forman un encabezado fijo arriba: el peso y el botón de regresar no se pierden al hacer scroll. |
| D-10 | Discos de la barra como los actuales: rectángulos con número vertical y las mismas proporciones. Discos para agregar y de Ajustes como aros (`PlateDisc`). Solo cambia la paleta. |
| D-11 | Timer: plantillas en filas horizontales, no en tiles. La cápsula pequeña aparece en todas las pantallas mientras corre, como hoy. |
| D-12 | En la lista de cada categoría, «Cálculo libre» va primero y destacado; «Nuevo movimiento» va después y discreto. |
| D-13 | Navegación hacia atrás nativa: botón o gesto atrás de Android con el historial del navegador, y deslizar desde el borde izquierdo en iPhone con la app instalada. |
| D-14 | La estética se aplica a **toda la app**, incluidas las pantallas que la maqueta no dibujó. Se cambia solo el aspecto, no lo que hacen (sección 7). |
| D-15 | Menos espacio arriba: el título queda cerca del borde superior y de la cápsula del timer. |

## 3. Tokens

Reemplazan los tokens iOS de `src/app/globals.css`. Se definen en `:root` (claro) y se redefinen en oscuro con `@media (prefers-color-scheme: dark)`, igual que hoy. Nombres en inglés.

### 3.1 Superficies y texto

| Token | Claro | Oscuro | Uso |
| --- | --- | --- | --- |
| `--bg` | `#f3f1ec` | `#0d0d0d` | Fondo de la app |
| `--surface` | `#ffffff` | `#1c1c1b` | Tarjetas, filas, controles |
| `--surface2` | `#e9e6df` | `#2a2a28` | Relleno secundario, tope de la barra |
| `--ink` | `#0d0d0d` | `#f5f3ee` | Texto principal |
| `--ink2` | `#5a5852` | `#aaa79f` | Texto secundario |
| `--ink3` | `#8d8a83` | `#74716a` | Deshabilitado, chevrons |
| `--line` | `rgba(13,13,13,.12)` | `rgba(245,243,238,.12)` | Separadores, contornos neutros |
| `--inverse` | `#0d0d0d` | `#ffffff` | Pastillas activas, «Continuar», botón «Listo» |
| `--inverse-ink` | `#ffffff` | `#0d0d0d` | Texto sobre `--inverse` |
| `--scrim` | `rgba(13,13,13,.35)` | `rgba(0,0,0,.6)` | Fondo detrás de paneles |
| `--accent-mix` | `74%` | `100%` | Intensidad del color de categoría usado como texto o contorno (3.4) |

### 3.2 Bloques (categorías y plantillas)

Iguales en claro y oscuro. Siempre llevan texto `#0d0d0d`.

| Token | Valor | Asignación |
| --- | --- | --- |
| `--b-pink` | `#ff86b8` | Squats, Heroes |
| `--b-blue` | `#6e9bff` | Cleans |
| `--b-yellow` | `#ffc23d` | Presses, Bike, For time |
| `--b-green` | `#3fd18f` | Jerks, AMRAP, «Reanudar», pasos completados |
| `--b-lilac` | `#b48cff` | Snatches, Girls, Tabata |
| `--b-cyan` | `#3fd0e2` | Deadlifts, Row, EMOM |
| `--b-lime` | `#c2e55c` | Run |
| `--b-coral` | `#ff6a4d` | **No es color de categoría.** Botón «+» de la barra inferior, acciones destructivas («Terminar») y estado «lb arriba». |

En `src/lib/catalog.js`, el campo `color` de cada grupo apunta al nuevo token (`'--b-pink'`, etc.). Los grupos propios (`CUSTOM_COLORS`) pasan a la paleta de bloques sin coral: `['--b-cyan', '--b-pink', '--b-green', '--b-yellow', '--b-blue', '--b-lilac', '--b-lime']`. El grupo «Mis movimientos» (`CUSTOM_GROUP`) y «Otros» (`--muted`) se preguntan al responsable si no encajan (ver sección 9). No se cambian los colores que ya tienen guardados los movimientos de los usuarios sin preguntar.

### 3.3 Discos

| Disco | Token | Valor | Altura (%) |
| --- | --- | --- | --- |
| 55 | `--p55` | `#ff5747` | 100 |
| 45 | `--p45` | `#5b8cff` | 100 |
| 35 | `--p35` | `#ffc23d` | 92 |
| 25 | `--p25` | `#3fd18f` | 84 |
| 15 | `--p15` | `#b48cff` | 74 |
| 10 | `--p10` | `#dedbd4` | 64 |
| 5 | `--p5` | `#3fd0e2` | 48 |
| 2.5 | `--p2` | `#ff86b8` | 38 |

`PLATE_STYLE` en `src/lib/plates.js` apunta a estos tokens; las alturas no cambian. El disco de 55 sigue rojo porque es su color real.

### 3.4 Color de acento por categoría

Donde el color de la categoría se usa como **texto o contorno** sobre el fondo (número del peso, contorno de la tarjeta, % activo en Porcentajes), se usa:

```css
--accent: color-mix(in oklab, var(--b) var(--accent-mix), black);
```

En oscuro queda el color puro; en claro se oscurece para leerse sobre `--bg`. `--b` es el bloque del grupo actual. En cálculo libre `--b` es `var(--ink)`.

### 3.5 Tipografía

- Familia: **Archivo** (Google Fonts, eje de ancho 62–125 y peso 400–900), para títulos y texto. Se carga con `next/font` (consulta `node_modules/next/dist/docs/` antes, como pide `AGENTS.md`) para servirla desde la propia app; no se usa la hoja de estilos de Google en producción.
- Clase `display`: `font-stretch: 125%; font-weight: 900; text-transform: uppercase; letter-spacing: -.01em; line-height: .92`. Se usa en títulos de pantalla, nombres de categoría y plantilla, números grandes (peso, conteos, reloj, % de la lista) y valores en filas.
- Texto normal: Archivo con ancho 100 %, pesos 500–800. Etiquetas en mayúsculas: 11–13 px, peso 800, `letter-spacing: .08–.12em`.
- Números alineados con `font-variant-numeric: tabular-nums`.
- Inputs con 16 px o más en iOS para evitar el zoom. Si un número del diseño es menor dentro de un input, se pregunta.

### 3.6 Movimiento

`--ease: cubic-bezier(.22,1,.36,1)`, `--spring: cubic-bezier(.32,.72,0,1)`, `--bounce: cubic-bezier(.34,1.56,.64,1)`. Los toques escalan a `.96–.97`. Con `prefers-reduced-motion: reduce` se desactivan animaciones y transiciones, como hoy.

## 4. Elementos comunes

| Elemento | Especificación (ver clases homónimas en la maqueta) |
| --- | --- |
| Encabezado de pantalla (`.hd`) | Kicker de 16 px en `--ink2` arriba («¿Qué vas a levantar?», «Tus mejores marcas», «Elige una plantilla para tu workout.») y título `display` de `clamp(34px, 11.5vw, 48px)`. A la derecha, la acción de la pantalla. Margen superior mínimo (D-15). |
| Botón cuadrado (`.sq-btn`) | 48×48 (44×44 en barras de navegación), esquina 10 px, fondo `--surface`, ícono 20–22 px en `--ink`. |
| Pastilla (`.pill-btn`) | Alto 40, esquina 10 px, fondo `--inverse`, texto `--inverse-ink` 14 px/700. «Iniciar sesión», «Carga rápida», «Listo», «Cancelar». |
| Aviso (`.banner`) | Fondo `--surface`, esquina 12 px, texto 14 px y la acción como pastilla. Cubre los cuatro estados actuales del `Banner` de `prs-app.jsx`: cargando, demo, error y datos desactualizados. |
| Barra de navegación (`.nb`) | «‹ Texto» a la izquierda (700, 16 px), título centrado (800, 16 px, con elipsis) y acciones a la derecha. |
| Control segmentado (`.seg`) | Fondo `--surface`, padding 4, esquina 12; botón activo con fondo `--inverse` y texto `--inverse-ink`; 42 px de alto. |
| Grupo de filas (`.group`, `.row-btn`) | Fondo `--surface`, esquina 16, filas de 60 px con separador `--line`. Valor a la derecha en `display` 22 px con unidad de 12 px; etiqueta de RM (`3RM`) en una pastilla `--surface2`. |
| Panel inferior (`.sheet`) | Fondo `--bg`, esquina superior 20, agarre de 40×5. Encabezado: título `display` de 30 px y pastilla «Listo»/«Cancelar». Fondo `--scrim`. Mantiene el comportamiento del `Sheet` actual (deslizar para cerrar, capas, foco). |
| Barra inferior (`.tabbar`) | Pastilla `--surface` de 62 px con esquina 16 y sombra. Pestaña activa con fondo `--inverse`, ícono y nombre; inactivas solo con ícono. El botón «+» es un cuadrado de 62 px con esquina 14 en `--b-coral` y ícono negro. Se oculta en el modo enfoque (modo simple con levantamiento activo), como hoy. |
| Aviso flotante | Si la app muestra mensajes temporales, usan pastilla `--inverse`. |

## 5. Execute: pantalla principal

- Encabezado: kicker «¿Qué vas a levantar?», título «EXECUTE» y el botón de engranaje que abre Ajustes (`data-tour="settings"`).
- Debajo, el `banner` actual.
- **Continuar** (solo si hay un cálculo anterior, con las mismas reglas de hoy, incluida la expiración de 8 h de `restoreExercise`): tarjeta `--inverse` con esquina 16. Muestra «CONTINUAR» (11 px, 800, `letter-spacing .1em`, opacidad .65), «Movimiento · 70%» en 17 px/800 y el peso en `display` de 34 px con «LB». Sin discos (D-5). Una X a la derecha descarta el cálculo, como hoy.
- **Tiles de categoría** (`data-tour="categories"`): cuadrícula de 2 columnas con 10 px de separación. Cada tile:
  - Mide 140 px de alto mínimo, esquina 16, fondo del bloque del grupo y texto negro.
  - Arriba, el conteo de movimientos con PR en `display` 48 px y al lado «con PR», o «0 Sin PRs», en 13 px/600.
  - Abajo, el nombre del grupo en `display` `clamp(14px, 4.3vw, 19px)`, en una línea.
  - Letra inicial gigante de fondo: 128 px `display`, `rgba(13,13,13,.09)`, en la esquina superior derecha, cortada por el tile; al tocar, se desplaza un poco.
  - Los nombres de grupo siguen como hoy (en inglés). Los grupos propios del usuario también se muestran como tiles.
- **Cálculo libre** (`data-tour="free-calc"`): fila de 72 px con contorno de 2 px en `--ink`, esquina 16, «%» en `display` 28 px, «Cálculo libre» con «Cualquier peso y porcentaje» debajo y una flecha →.
- Sin tile «Nuevo movimiento» (D-4).

## 6. Execute: categoría y pantalla de trabajo

### 6.1 Lista de una categoría

- «‹ Execute» arriba.
- Bloque del grupo: fondo del bloque, esquina 16, letra gigante de fondo de 170 px, «N con PR · M movimientos» en 14 px/700 y el nombre en `display` 36 px.
- Grupo de filas con PR: punto de 10 px en el color del bloque, nombre y mejor marca en `display` 22 px. Si el primer RM con PR no es 1RM, lleva la etiqueta (`3RM`). Chevron a la derecha.
- «SIN PR REGISTRADO» y filas deshabilitadas, como hoy.
- Último grupo, en este orden (D-12):
  1. «Cálculo libre», con «Cualquier peso y porcentaje» debajo e ícono «%» sobre un cuadrado del color del bloque.
  2. «Nuevo movimiento», con «En {grupo}» debajo, en estilo discreto: ícono «+» gris sobre `--surface2`, título 15 px/600 en `--ink2` y fila de 56 px. Hace lo mismo que hoy.

### 6.2 Encabezado fijo de la pantalla de trabajo (D-9)

`.wb-head` reúne la barra de navegación y la tarjeta del peso. Es `position: sticky; top: 0` dentro del área con scroll, con fondo `--bg`. Una franja del mismo color por encima tapa el relleno superior. Nada debe tapar el botón de regresar en ningún estado. La maqueta lo comprueba con una prueba que verifica que el centro del botón sea el elemento visible.

- Barra: «‹ {grupo}» vuelve a la categoría, o «‹ Execute» en cálculo libre. Título: el movimiento o «Cálculo libre». A la derecha:
  - Movimiento: lápiz (abre cálculo libre) y engranaje (abre Ajustes).
  - Cálculo libre: «Limpiar» y engranaje.

### 6.3 Tarjeta del peso (`data-tour="weight"`)

- Contenedor: fondo `color-mix(in srgb, var(--b) 7%, var(--bg))`, contorno interior de 2.5 px en `--accent`, esquina 16 y padding `12px 12px 10px 16px`. Sin etiqueta, sin letra de fondo (D-6).
- Línea principal, alineada abajo:
  - Izquierda: el peso en `display` `clamp(52px, 16vw, 64px)`, color `--accent`, con «LB» en 18 px `--ink`. Al cambiar, anima con un pequeño «pop».
  - Derecha: «70% de 260» en 15 px/800 y debajo «81,6 kg» en 13 px `--ink2`. Si hay discos agregados o quitados, el % es el real (por ejemplo, «76,9% de 260»).
  - Ya no se muestra la línea «70% exacto = 182 lb · 180 lb es el 69,23%». Ver sección 9.
- Estado del ajuste (solo si se agregaron o quitaron discos): fila compacta con fondo `--surface` y esquina 12.
  - Ícono redondo de 32 px: ↓ amarillo si faltan libras, ↑ coral si sobran, ✓ verde si da exacto.
  - Texto: «Faltan 90 lb» / «20 lb arriba» / «En el objetivo», con «45 lb por lado · meta 180 lb» debajo.
  - Botón «↺ 70%» en `--inverse` que deshace el ajuste. Mismos textos y lógica que `TargetStatus` hoy.
- Fila de controles (`data-tour="base-editor"`; D-7): separador `--line` arriba.
  - Izquierda, en movimiento: tres botones de texto «1RM 3RM 5RM» de 44 px de alto. El activo tiene fondo `--surface` y opacidad 1; los demás, opacidad .5. Si ese RM no tiene PR, el botón queda deshabilitado (opacidad .2). Al cambiar de RM se usa la mejor marca de ese RM y se reinician los ajustes, como hoy.
  - Izquierda, en cálculo libre: campo «Peso» + «lb» con fondo `--surface`. Acepta coma decimal.
  - Derecha: «− 70% +» con fondo `--surface` y botones de 40 px. Cambia de 5 en 5 dentro de 5–150. El número es un input editable: acepta coma y Enter cierra el teclado.
  - Cualquier cambio de RM o % reinicia los ajustes de discos.
- No hay modo de edición: el campo `editBase` del estado deja de usarse en la interfaz. Hay que comprobar que los estados guardados viejos sigan abriendo bien (sección 9).

### 6.4 Pestañas «Barra · Porcentajes» (`data-tour="exec-panel"`)

Control segmentado bajo el encabezado fijo. En modo simple no se muestra y solo aparece la barra, como hoy.

**Barra** (`data-tour="barbell"`): tarjeta `--surface` con esquina 16.
- Encabezado: «POR LADO · 67,5 LB» a la izquierda y «Barra 45 lb» a la derecha.
- Barra igual que hoy: contenedor de tamaño con unidad `--u: min(1cqh, 1.5px)`, 156 px de alto en la maqueta y que crece en la app como hoy.
  - Eje de 12 px en `color-mix(in srgb, var(--ink) 22%, transparent)`.
  - Tope con el peso de la barra en vertical sobre `--surface2`.
  - Discos de `26.5u` de ancho y `alto%·u` de alto, esquina `5.5u`, número vertical (rotado) de 800 en `#111` y borde de .5 px.
  - Disco extra con rayas blancas y borde interior blanco.
  - Tocar un disco lo quita, y tocar un disco extra lo quita del extra, como hoy. Con más de 5 discos por lado, la barra pasa a tamaño pequeño.
- Selector de opciones: «‹ Recomendado ›» con puntos, y «+ extra» si hay discos agregados, como hoy.
- Discos para agregar: aros `PlateDisc` (borde de color de 3 px, labio interior de 1.2 px con opacidad .55 y número en `--ink`), con tamaño según el disco y scroll horizontal. Debajo, la pista «Toca un disco para agregarlo · tócalo en la barra para quitarlo».
- «No se puede armar X lb con tus discos…» si no hay combinación, como hoy.

**Porcentajes** (D-8): reemplaza «Calentamiento».
- Lista del 100% al 40%, de 5 en 5, calculada sobre la base actual (RM elegido o peso libre). Para cada %:
  - El peso objetivo es `max(bar, round5(base·pct/100))` y se carga con la opción recomendada (`plateOptions(...)[0]`). El peso mostrado es barra + 2·suma de esos discos.
  - Fila de 58 px con `grid-template-columns: 72px 1fr auto`:
    - El % en `display` 22 px.
    - «235 lb» en 16 px/800, con «45 · 45 · 15 · 2.5 por lado» debajo en 12 px `--ink2` («Solo la barra» o «Sin combinación con tus discos» según el caso).
    - Mini discos a la derecha (barras de 8 px de ancho, esquina 3, altura `alto%·0.26` px).
- Tocar una fila fija el % en la tarjeta de arriba, reinicia los ajustes y la opción seleccionada, y **no** mueve el scroll. La fila del % activo se marca con fondo `color-mix(--b 18%, --surface)`, una barra izquierda de 4 px y el % en `--accent`. Si el % no es múltiplo de 5, o si hay discos ajustados, ninguna fila queda marcada.

### 6.5 Ajustes (sheet)

Título «AJUSTES» y «Listo». Mismas secciones y comportamiento que `settings-sheet.jsx`:
- Barra: segmentado 45/35/15 lb.
- Discos que tienes: aros `PlateDisc`. El inactivo se ve punteado y en `--ink3`. Debajo: «Las combinaciones solo usan los discos activos.» (sin «escalera de calentamiento»).
- App: filas con switch para «Modo simple» y «Pantalla siempre encendida», y fila «Ver tour de la app».
- Movimientos: «Mis movimientos».
- Cuenta: «Datos» e «Iniciar sesión» o «Cerrar sesión».
- Panel de administrador, si aplica.

El switch es de 52×32 con perilla blanca y fondo `--b-green` cuando está activo. Las filas tienen fondo `--surface` y esquina 16.

### 6.6 Timer

- **Lista**: encabezado «TIMER» con kicker. Si hay un timer en curso, arriba aparece la tarjeta «TIMER EN CURSO»: bloque del color de la plantilla, punto que parpadea, nombre y reloj en `display` 30 px; al tocarla se abre el timer. Debajo, las plantillas en filas de 84 px (D-11), fondo `--surface` y esquina 16:
  - Cuadrado de 60 px con esquina 12 en el color de la plantilla y su glifo actual (`TEMPLATES`).
  - Nombre en `display` 20 px y descripción (`describe`) en 13 px `--ink2`.
  - Chevron.
  - Colores: AMRAP verde, EMOM cian, Tabata lila, For time amarillo.
- **Configuración** (sheet):
  - Título con el nombre en `display` y «Cancelar».
  - Encabezado con el glifo y la descripción.
  - Presets en 2 columnas (46 px, esquina 12, `display` 15 px); el que coincide se marca con el color de la plantilla.
  - Campos con «− valor +»: se mantiene escribir el valor con teclado (`ValueInput`, formato de microondas) y los pasos actuales.
  - «Duración total X · empieza con 10 s para prepararte» y, si hay otro timer en curso, «. Reemplaza el timer en curso.».
  - Botón «▶ INICIAR» en bloque del color de la plantilla, de 60 px y esquina 16.
- **En marcha** (sheet de pantalla completa):
  - Arriba, chevron para minimizar y el nombre en `display`.
  - Anillo de progreso con trazo de 16 px y extremos redondeados. Color según la fase: trabajo = color de la plantilla, preparación = `--ink2`, descanso = `--ink3`, en pausa = `--ink3`. Pista en `--surface`.
  - Dentro del anillo: fase en mayúsculas (13 px, 800, `letter-spacing .12em`, mismo color que el anillo), reloj en `display` `clamp(52px, 17vw, 68px)` y el texto inferior actual («Empieza AMRAP», «Ronda 1 de 8», «Quedan 10:36», «Límite 12:00»). Debajo, «Quedan X en total» cuando aplica.
  - AMRAP: fila «3 rondas» con «Deshacer» y botón «+1 RONDA» en bloque.
  - For time: botón «Terminé» en bloque.
  - Controles: «Terminar» en `--surface` y «Pausa» en `--inverse`, o «Reanudar» en `--b-green`.
  - «Terminar» pide confirmación con el `Alert` actual («¿Terminar el workout?», «Seguir» / «Terminar» en coral).
  - Se mantienen sonidos, ondas (ahora en el color de la plantilla), modo horizontal, Wake Lock y restauración tras recargar.
- **Resumen**: insignia cuadrada de 72 px con esquina 22 en el color de la plantilla (✓, o bandera si se terminó antes), título, número grande en `display` y detalle, con los mismos textos que `Summary`. Debajo, «LISTO» en bloque y «↺ Repetir» en `--surface`.
- **Cápsula** (`TimerPill`): visible en todas las pantallas mientras hay un timer activo y su pantalla está minimizada, como hoy.
  - Pastilla negra de 40 px con borde de 1 px `rgba(255,255,255,.1)` y sombra.
  - Punto de 9 px en el color de la plantilla, que parpadea; en pausa queda fijo con opacidad .4.
  - Reloj en `display` 17 px en el color de la plantilla y estado en 13 px blanco al 65 %: «Prepárate», «En pausa», «R1/10» o el nombre.
  - Al tocarla abre el timer. El contenido de la pantalla baja para no quedar tapado.

### 6.7 PRs

- Encabezado: kicker «Tus mejores marcas», título «PRS» y pastilla «⚡ Carga rápida» (`data-tour="quick-upload"`, misma acción).
- Segmentado Lift/Cardio/Benchmarks y chips de grupo (`data-tour="prs-groups"`). Cada chip tiene fondo `--surface`, punto del color, nombre y «2/3». El chip activo toma el bloque como fondo y el texto en negro. Tocarlo filtra, como hoy.
- Cada grupo lleva un encabezado en mayúsculas con punto de color y un grupo de filas: nombre, valor en `display` (lb con RM, o tiempo m:ss) o «—», y chevron. Tocar abre el detalle, como hoy.
- Al final, la fila «Nuevo movimiento» en estilo discreto, con su texto actual al pie.
- El detalle de PR, el registro de PR y la carga rápida se rediseñan con el sistema (sección 7) sin cambiar lo que hacen.

### 6.8 Modo simple y modo enfoque

Sin cambios de comportamiento: sin segmentado, sin opciones, sin discos para agregar, discos de la barra no tocables y barra inferior oculta mientras se levanta. Solo cambia el aspecto.

### 6.9 Atrás nativo (D-13)

Orden de «atrás», igual que `goBack()` en la maqueta:
1. Confirmación o alerta abierta → se cierra.
2. Sheet abierto (cualquiera) → se cierra.
3. Timer en pantalla completa → se minimiza.
4. Pestaña PRs o Timer → vuelve a Execute.
5. Pantalla de trabajo → categoría, o al inicio si es cálculo libre.
6. Categoría → inicio de Execute.
7. Inicio de Execute → comportamiento del sistema (en Android instalado, salir de la app).

Implementación:
- **Android y navegadores:** cada paso interno (abrir categoría, abrir movimiento, abrir un sheet, abrir el timer, cambiar a PRs o Timer) agrega una entrada con `history.pushState`. En `popstate` se ejecuta el paso 1–6 correspondiente.
  - Al volver con los botones de la interfaz, el historial se mantiene coherente: por ejemplo, con `history.back()` en lugar de agregar otra entrada.
  - Al recargar, la app abre donde estaba (como hoy, por el estado guardado) y el historial empieza de nuevo. No se usan rutas nuevas ni parámetros en la URL salvo que el responsable lo apruebe.
- **iPhone instalado** (`navigator.standalone` o `display-mode: standalone` en iOS): gesto desde el borde izquierdo, solo en ese modo, porque Safari ya tiene el suyo.
  - Empieza a menos de 28 px del borde.
  - Se cancela si el movimiento es más vertical que horizontal (más de 12 px).
  - Al pasar 10 px, la pantalla sigue al dedo con sombra `-12px 0 32px rgba(0,0,0,.35)`.
  - La pantalla anterior se pinta debajo: desplazada `-30%·(1−progreso)` y con un oscurecimiento de `.25·(1−progreso)`.
  - Al soltar, regresa si se pasó un tercio del ancho o la velocidad supera 0,6 px/ms. Si no, vuelve a su lugar en 0,28 s con `--ease`.
  - Después de un arrastre, el toque bajo el dedo no se dispara.
  - En la pantalla principal de Execute y con un sheet o el timer abierto, el gesto no actúa.
  - El área de scroll usa `touch-action: pan-y`.
- Se prueba en Android (Chrome e instalada) y en iPhone (Safari e instalada). Si `popstate` choca con el `Sheet` o el tour actuales, se pregunta.

## 7. Pantallas que la maqueta no dibujó (D-14)

Se aplican los tokens y los elementos comunes sin cambiar flujo, campos, textos de error ni validaciones:

| Pantalla | Archivos | Cómo |
| --- | --- | --- |
| Detalle de PR | `prs/move-detail-sheet.jsx` | Encabezado `display`. Gráfica de Chart.js con el color del bloque del grupo, ejes en `--ink2` y cuadrícula en `--line`. Historial en un grupo de filas con valores en `display`. |
| Registrar PR | `prs/record-form-sheet.jsx` | Sheet con campos en filas `--surface` e inputs de 16 px o más. Guardar con botón en bloque del grupo; eliminar en coral. |
| Carga rápida | `prs/quick-upload-sheet.jsx` | Mismo patrón de filas y botón principal en bloque. |
| Nuevo movimiento y Mis movimientos | `movements/*.jsx` | Filas `--surface` y switches verdes. Los colores de grupo propio, de la paleta de bloques. |
| Login, registro e invitación | `app/auth-panel.jsx`, `app/register/*`, `app/invite/*` | Título `display`, campos `--surface`, botón principal `--inverse`. Turnstile sin cambios. |
| Administrador | `app/admin-panel.jsx`, `members-panel.jsx`, `invitations-panel.jsx` | Filas y pastillas del sistema. |
| Tour guiado | `tour/guided-tour.jsx` | Tarjeta `--surface` con esquina 16, título `display` y botones del sistema. Pasos actualizados (sección 8). |
| Carga inicial | `app/loading.jsx`, `ui/signal-loader.jsx` | Fondo `--bg` y discos con la nueva paleta. |
| Alertas | `ui/alert.jsx` | Tarjeta `--surface` con esquina 16; acción destructiva en coral y cancelar en `--surface2`. |
| Íconos de la app y `manifest.webmanifest` | — | **Sin cambios** salvo aprobación. |

## 8. Tour guiado

Se conservan los `data-tour` existentes y se mueven a los elementos nuevos:
- `weight`: la tarjeta del peso.
- `base-editor`: la fila de RM y % (texto actual «Cambia el RM y el porcentaje»). El paso ya no abre ningún modo de edición.
- `exec-panel`: el segmentado. El paso «Escalera de calentamiento» pasa a «Porcentajes» con un texto que explique que tocar un % lo aplica arriba. Se muestra el texto propuesto al responsable antes de cerrarlo.
- `timer-templates`: la lista de plantillas en filas.
- `categories`, `free-calc`, `settings`, `barbell`, `prs-groups`, `quick-upload`, `add` y `tabs` se conservan.

## 9. Riesgos y puntos a confirmar durante la implementación

Preguntar al responsable antes de decidir:
- Si al quitar la línea del % exacto se debe mostrar al tocar el número (la maqueta no lo muestra).
- Colores de «Mis movimientos» y «Otros», y qué hacer con los colores ya guardados en movimientos propios.
- Cualquier texto nuevo de interfaz no presente en la maqueta (por ejemplo, el del paso del tour de Porcentajes).
- Si cargar Archivo con `next/font` cambia el tiempo de carga o el modo sin conexión de forma notable.
- Si el historial para Android interfiere con el `Sheet`, el tour o la restauración del estado guardado.
- Cualquier diferencia entre la lógica de la maqueta y la de la app que cambie un resultado (pesos, discos, tiempos).

Comprobaciones técnicas:
- Estados guardados de versiones anteriores (`editBase`, `panel: 'warm'`, `done`) deben abrir sin errores. `panel: 'warm'` se trata como `'load'`.
- `src/lib/plates.js`: solo cambian los tokens de `PLATE_STYLE`. `buildLadder` queda igual (D-1 de #63) y `scripts/test-plates.mjs` sigue pasando sin modificar sus expectativas.

## 10. Validación

- `npm ci`, `npm run build`, `git diff --check` y todas las pruebas de `scripts/` que lista el README.
- Capturas del modo de ejemplo (`/?demo=1`), en claro y oscuro, a 390×844 y 360×800, de:
  - inicio con y sin «Continuar»;
  - categoría;
  - pantalla de trabajo: normal, con disco extra, con scroll en Porcentajes y en cálculo libre vacío y con datos;
  - modo simple;
  - Ajustes;
  - PRs y detalle;
  - registrar PR y carga rápida;
  - Timer: lista, configuración, en marcha (preparación, trabajo, descanso, pausa), confirmación, resumen y cápsula en otra pestaña;
  - login;
  - tour.
- Comparación lado a lado con la maqueta en las pantallas que ella cubre.
- Recorrido de atrás completo (6.9) en un navegador de Android o su emulación y en un iPhone con la app instalada. Si no hay un dispositivo, se dice qué faltó probar.
- Contraste AA en claro y oscuro y botones de 44 px o más en la ruta principal.
