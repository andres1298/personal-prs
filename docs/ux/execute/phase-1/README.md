# Evidencia de la fase 1: análisis UX de la pantalla Execute

Capturas y mapas del análisis de la pantalla Execute. El plan, los hallazgos y el estado se registran en el issue de GitHub; esta carpeta solo guarda la evidencia y cómo reproducirla.

## Archivos

| Prefijo | Contenido |
| --- | --- |
| `states_*` | Capturas de los 16 estados de la pantalla (390×844 claro y 360×800 oscuro). |
| `thumb-right_*` | Alcance del pulgar derecho sobre la captura real, con cada control numerado y su tamaño. |
| `thumb-left_*` | La misma vista para la mano izquierda. |
| `blur_*` | Prueba de entrecerrar los ojos: la captura y su desenfoque gaussiano. |
| `tools/summary.json` | Medidas por estado: controles por zona, controles de menos de 44 px y textos que no llegan a WCAG AA. |

Los mapas de alcance usan un modelo heurístico (Hoober 2013; zonas del pulgar de Hurff), no datos de uso. El modelo sitúa la base del pulgar 4 mm fuera del borde derecho y 18 mm sobre el borde inferior. Clasifica la distancia hasta el centro de cada control: menos de 25 mm es zona media, de 25 a 70 mm es fácil, de 70 a 88 mm es media y más de 88 mm es difícil. Para pasar de píxeles CSS a milímetros usa 0,1666 mm/px en 390×844 y 0,1796 mm/px en 360×800.

## Reproducir

Los datos son ficticios (`tools/fixtures.mjs`) y no hacen falta credenciales.

1. Copia el repositorio a una carpeta temporal, ejecuta `npm ci` y coloca `tools/ux-harness-page.jsx` en `src/app/ux-harness/page.jsx`. Ese archivo no se versiona en la app.
2. Ejecuta `npx next dev -p 3100` en esa copia.
3. Ejecuta `node tools/capture.mjs <carpeta-capturas>`. El navegador responde `/api/records` y `/api/movements` con los datos ficticios, y el script toma las capturas y mide el DOM.
4. Ejecuta `python3 tools/analyze.py <carpeta-capturas> <carpeta-mapas>` (requiere Pillow y NumPy) para generar los mapas y `summary.json`.

Limitaciones: Chromium en Linux no tiene SF Pro, así que el texto se dibuja con otra fuente y sus medidas pueden variar unos píxeles respecto al iPhone. En 390×844 las áreas seguras se simulan con 47 px arriba y 34 px abajo; en 360×800 se usan 0 px. Nada de esto reemplaza una prueba en un iPhone físico.
