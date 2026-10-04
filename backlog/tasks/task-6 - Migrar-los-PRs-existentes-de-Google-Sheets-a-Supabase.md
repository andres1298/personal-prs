---
id: TASK-6
title: Migrar los PRs existentes de Google Sheets a Supabase
status: To Do
assignee: []
created_date: '2026-10-03 06:08'
labels: []
dependencies:
  - TASK-3
  - TASK-5
references:
  - index.html
priority: high
type: feature
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Los registros históricos no deben perderse al sustituir Apps Script y Google Sheets. La transición debe asignarlos a la cuenta propietaria y permitir comprobar que los valores originales se conservaron.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Existe un procedimiento reproducible para importar los registros históricos y asignarlos a la cuenta correcta.
- [ ] #2 Se validan cantidad y campos clave de los registros importados antes de retirar la lectura de Google Sheets.
- [ ] #3 La aplicación lee y guarda nuevos PRs en Supabase mediante la capa de datos del servidor.
- [ ] #4 Las referencias de videos existentes se conservan o se reportan explícitamente como pendientes de migración.
<!-- AC:END -->
