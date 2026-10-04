---
id: TASK-9
title: Crear accesos directos de la app web en iPhone y Android
status: In Progress
assignee:
  - '@codex'
created_date: '2026-10-03 06:10'
updated_date: '2026-10-03 15:05'
labels: []
dependencies:
  - TASK-15
documentation:
  - 'https://support.apple.com/en-gw/guide/iphone/iphea86e5236/ios'
  - 'https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid'
priority: medium
type: feature
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
La aplicación seguirá siendo un sitio web. El objetivo es que cada persona pueda guardar un icono en la pantalla de inicio de iPhone o Android y abrir desde allí la misma aplicación y sus datos, sin compilar ni distribuir apps nativas.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 En iPhone y Android se puede añadir un icono a la pantalla de inicio que abre la misma aplicación web publicada en una ventana sin barra del navegador cuando el sistema lo permite.
- [ ] #2 Existe un manual en español con pasos para crear el icono desde Safari y Chrome y volver a abrir la misma cuenta y datos.
- [ ] #3 El manual aclara que la ventana sin barra sigue siendo una aplicación web, no una app nativa ni un widget, y señala qué funciones requieren conexión.
- [ ] #4 Se verifica el flujo en un iPhone y un dispositivo Android, o se documenta la comprobación pendiente si no hay dispositivos disponibles.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Conservar el manifiesto y los iconos para abrir la web sin barra del navegador cuando el sistema lo permita. 2. Ajustar el manual de Safari y Chrome para distinguir la apariencia de app de una app nativa. 3. Verificar archivos y comportamiento en dispositivos reales cuando estén disponibles.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Se añadió manifest.webmanifest con modo standalone e iconos PNG 192/512, se enlazó desde index.html y se creó docs/INSTALACION.md con pasos para Safari y Chrome. Validación local: JSON, rutas de iconos y git diff --check correctos. Pendiente: publicar estos cambios y comprobar la opción de instalación y apertura en dispositivos iPhone y Android reales.

Aclaración del usuario: el icono debe abrir la misma aplicación web sin barra del navegador, con apariencia de app; no se crearán aplicaciones nativas.

La verificación en dispositivos se realizará después del despliegue HTTPS previsto en TASK-15.
<!-- SECTION:NOTES:END -->
