---
id: TASK-4
title: Integrar inicio de sesión con Google mediante Supabase Auth
status: To Do
assignee: []
created_date: '2026-10-03 06:08'
labels: []
dependencies:
  - TASK-1
  - TASK-2
documentation:
  - 'https://supabase.com/docs/guides/auth/social-login/auth-google'
priority: high
type: feature
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
La clave compartida que hoy se guarda en el navegador no identifica a cada persona. Se requiere un inicio de sesión individual con Google para sostener acceso privado y sesiones por usuario.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Una persona puede iniciar y cerrar sesión con Google y conservar una sesión válida al recargar la aplicación.
- [ ] #2 Las rutas y operaciones privadas rechazan sesiones ausentes o caducadas.
- [ ] #3 Iniciar sesión con Google por sí solo no concede acceso a los datos si la persona no está autorizada.
- [ ] #4 La configuración de OAuth contempla desarrollo y producción sin secretos públicos.
<!-- AC:END -->
