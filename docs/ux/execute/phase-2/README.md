# Evidencia de la fase 2: propuestas de flujo para Execute

Maquetas de alta fidelidad de las tres propuestas: A · Barra, B · Tabla de cargas y C · Pizarrón. Usan los estilos de la app, la misma lógica de discos que `src/lib/plates.js` y datos de ejemplo. Reemplazan a los wireframes en gris de la primera versión, que el responsable descartó. Las propuestas, la comparación y las decisiones están en el issue de GitHub.

| Archivo | Contenido |
| --- | --- |
| `prototype.html` | El prototipo interactivo. Se abre en una página que ya trae la estructura del documento. Cambia de propuesta con `#a`, `#b` o `#c`. |
| `mockups_390_light.jpg` | A, A al buscar, A con la escalera, B, B con el detalle y C, en 390×844 y modo claro. |
| `mockups_dark_and_360.jpg` | A, B y C en modo oscuro (390×844) y en 360×800. |
| `reach-right_*` / `reach-left_*` | Alcance del pulgar derecho e izquierdo sobre cada maqueta, con cada control numerado y su tamaño. |
| `tools/capture-prototype.mjs` | Captura y mide el prototipo con el mismo formato de la fase 1. |
| `tools/summary.json` | Controles por zona, controles de menos de 44 px y textos que no llegan a AA en cada pantalla. |

Los mapas usan el modelo heurístico de la fase 1 (ver `../phase-1/README.md`); no son datos de uso.

## Reproducir

1. Envuelve `prototype.html` en `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>…</body></html>`.
2. Ejecuta `node tools/capture-prototype.mjs <archivo envuelto> <carpeta>`.
3. Ejecuta `python3 ../phase-1/tools/analyze.py <carpeta> <mapas> hf-A1_390x844_light hf-B1_390x844_light hf-C1_390x844_light`.

El auditor marca como fallo el número de los discos en modo oscuro (1,11:1), pero es un falso positivo. El auditor lee solo el color de fondo, no el degradado del disco. El contraste real es de 5,18:1 o más (#111 sobre el color de cada disco).
