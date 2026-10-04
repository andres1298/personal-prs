---
id: TASK-13
title: Mantener el timer visible y activo entre módulos
status: To Do
assignee: []
created_date: '2026-10-03 06:14'
labels: []
dependencies:
  - TASK-12
priority: high
type: feature
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
El usuario necesita consultar la calculadora de pesos, los PRs y otros módulos durante un workout sin perder el tiempo o la ronda que está siguiendo.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 El timer continúa al navegar entre calculadora, PRs y demás módulos de la app.
- [ ] #2 Un indicador compacto y accesible muestra siempre tiempo y ronda, y permite volver al control completo.
- [ ] #3 Al bloquear el teléfono o dejar la app en segundo plano, el tiempo se reconcilia al volver usando una referencia temporal y no se reinicia por la suspensión del navegador.
- [ ] #4 Se documenta el comportamiento cuando el sistema operativo limita señales o ejecución en segundo plano.
<!-- AC:END -->
