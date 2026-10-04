---
id: TASK-5
title: Aislar los datos para múltiples usuarios
status: To Do
assignee: []
created_date: '2026-10-03 06:08'
labels: []
dependencies:
  - TASK-3
  - TASK-4
references:
  - index.html
priority: high
type: feature
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
La aplicación actual usa una sola colección de PRs y una clave compartida. Al abrirla a amigos, cada persona necesita sus propios registros y ajustes sin poder consultar o modificar los de otra.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Cada registro y ajuste persistente pertenece a una identidad de usuario.
- [ ] #2 Las lecturas y escrituras del servidor verifican la identidad y la pertenencia del recurso.
- [ ] #3 Las políticas de base de datos impiden leer, crear, modificar o borrar datos de otra persona.
- [ ] #4 Pruebas con al menos dos usuarios verifican el aislamiento, incluidos enlaces o referencias de videos.
<!-- AC:END -->
