---
id: TASK-7
title: Restringir el acceso mediante enlaces de invitación
status: To Do
assignee: []
created_date: '2026-10-03 06:08'
labels: []
dependencies:
  - TASK-4
  - TASK-5
documentation:
  - 'https://supabase.com/docs/guides/auth/users'
priority: high
type: feature
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
La aplicación se compartirá con un grupo limitado de amigos. Una cuenta de Google válida no debe bastar para entrar: el acceso requiere una invitación emitida por un administrador.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Solo una invitación vigente permite activar acceso para la identidad de Google esperada.
- [ ] #2 Cada enlace tiene caducidad, se usa una sola vez y puede revocarse antes de aceptarlo.
- [ ] #3 Una persona sin invitación o con enlace inválido puede autenticarse, pero no acceder a funciones ni datos privados.
- [ ] #4 El sistema limita nuevas invitaciones según una política de cupo configurable y registra quién invitó a cada persona.
<!-- AC:END -->
