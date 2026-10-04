---
id: TASK-10
title: Crear onboarding rápido para importar PRs en lote
status: To Do
assignee: []
created_date: '2026-10-03 06:13'
labels: []
dependencies:
  - TASK-5
  - TASK-6
references:
  - index.html
priority: high
type: feature
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Registrar muchos PRs uno por uno dificulta que un amigo empiece a usar la aplicación. Un flujo de importación debe permitirle traer sus marcas iniciales en un formato definido, revisarlas y guardarlas en su propia cuenta.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 El usuario puede pegar o subir un archivo con varios PRs siguiendo un formato documentado.
- [ ] #2 Antes de guardar, ve una vista previa con errores por fila para movimiento, valor, unidad o tipo de RM y fecha.
- [ ] #3 La importación confirma explícitamente los registros válidos y evita duplicados accidentales o permite resolverlos.
- [ ] #4 Los registros importados pertenecen solo al usuario autenticado y aparecen en sus vistas de PRs y gráficos.
<!-- AC:END -->
