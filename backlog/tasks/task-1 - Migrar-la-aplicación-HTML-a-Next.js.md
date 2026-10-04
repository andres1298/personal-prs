---
id: TASK-1
title: Migrar la aplicación HTML a Next.js
status: Done
assignee:
  - '@andres'
created_date: '2026-10-03 06:07'
updated_date: '2026-10-03 15:07'
labels: []
dependencies: []
references:
  - index.html
modified_files:
  - src/app/page.jsx
  - src/app/prs-app.jsx
  - src/app/api/apps-script/route.js
  - src/lib/legacy.js
  - README.md
priority: high
type: feature
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
La aplicación vive en un único index.html con interfaz, lógica y acceso a Apps Script mezclados. Esta migración debe preparar una base mantenible para las siguientes funciones sin perder las capacidades actuales de PRs, calculadora de discos, gráficos, ajustes y experiencia móvil.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 La aplicación corre en Next.js y conserva en modo demo los flujos de consulta y registro de PRs, calculadora, gráficos y ajustes.
- [x] #2 La interfaz conserva el diseño móvil y los metadatos de aplicación web en Next.js.
- [x] #3 El modo demo funciona y la conexión con Apps Script se realiza mediante una ruta de servidor que conserva las acciones existentes.
- [x] #4 La URL de Apps Script se configura fuera del código cliente y existen instrucciones de desarrollo y configuración para Vercel.
- [x] #5 Next.js sirve el manifiesto y los iconos necesarios para la instalación; la publicación y prueba en dispositivos se gestionan en TASK-15 y TASK-9.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Crear la base Next.js con App Router y separar la interfaz, estilos y lógica actuales en archivos propios, conservando el comportamiento.
2. Implementar una ruta de servidor para las acciones de Apps Script y configurar su URL mediante variable de entorno; mantener modo demo y subida de video.
3. Migrar manifiesto e iconos, documentar desarrollo y despliegue en Vercel, y verificar compilación y flujos principales.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Base Next.js App Router implementada en codex/nextjs-migration. La interfaz y la lógica existentes se separaron en src/app y src/lib; Chart.js es dependencia local. /api/apps-script reenvía list/add/uploadUrl usando APPS_SCRIPT_URL del servidor; .env.local conserva la URL local y .env.example documenta la variable. Se copiaron manifiesto e iconos a public/ y se documentó Vercel. Verificado: npm ci --offline, npm run build, flujos UI de PRs/gráfico, registro demo, calculadora y ajustes. La ruta real respondió unauthorized con clave ficticia, lo que confirma conectividad. Pendiente: verificar list/add y subida de video con clave válida, además de instalación en dispositivos tras despliegue HTTPS.

Alcance aclarado por el usuario: TASK-1 termina con verificación local; el despliegue y la validación con datos reales se harán en TASK-15, y la instalación en dispositivos se mantiene en TASK-9.

Cierre local: los cinco criterios se verificaron con la compilación de producción, navegación y registro demo en navegador, gráfico/calculadora/ajustes, viewport de 390 px sin desbordamiento, respuesta unauthorized para list/add/uploadUrl con clave ficticia, inspección del bundle cliente sin la URL y HTTP 200 para página, manifiesto e iconos. La prueba con clave válida y el despliegue quedan explícitamente en TASK-15; la instalación física en TASK-9.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Migración local a Next.js completada en codex/nextjs-migration. Conserva PRs, registro demo, gráficos, calculadora y ajustes; Apps Script se conecta mediante proxy con APPS_SCRIPT_URL del servidor. npm ci y npm run build pasaron; los flujos demo se comprobaron en navegador, la ruta respondió unauthorized para las tres acciones con clave ficticia y los recursos PWA devolvieron HTTP 200. El despliegue y la validación con datos reales corresponden a TASK-15; la instalación en dispositivos, a TASK-9.
<!-- SECTION:FINAL_SUMMARY:END -->
