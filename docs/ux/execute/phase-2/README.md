# Evidencia de la fase 2: propuestas de flujo para Execute

Wireframes de baja fidelidad de las tres propuestas (A · Calculadora, B · Tabla de cargas, C · Pizarrón) y sus mapas de alcance del pulgar. Las propuestas, la comparación y las decisiones se registran en el issue de GitHub.

| Archivo | Contenido |
| --- | --- |
| `wireframes_390x844.jpg` | Las 6 pantallas: A1, A2, B1, B2, C1 y C2. |
| `thumb-right_*` | Alcance del pulgar derecho sobre cada wireframe, con cada control numerado y su tamaño. |
| `thumb-left_*` | La misma vista para la mano izquierda. |
| `tools/wireframes.html` | Los wireframes en HTML, a tamaño real en px CSS (`?s=A1&vp=390`). |
| `tools/capture-wireframes.mjs` | Captura y mide los wireframes en el formato de la fase 1. |
| `tools/summary.json` | Controles por zona y por tamaño en cada pantalla. |

Los mapas usan el mismo modelo heurístico de la fase 1 (ver `../phase-1/README.md`); no son datos de uso. Para reproducirlos:

1. `node tools/capture-wireframes.mjs <carpeta>`
2. `python3 ../phase-1/tools/analyze.py <carpeta> <mapas> wf-A1_390x844_light wf-B1_390x844_light wf-C2_390x844_light`

Los últimos argumentos de `analyze.py` son las vistas que también se dibujan para la mano izquierda.
