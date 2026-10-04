---
id: TASK-3
title: Gestionar las entidades de la aplicación con Prisma
status: To Do
assignee: []
created_date: '2026-10-03 06:08'
labels: []
dependencies:
  - TASK-2
documentation:
  - 'https://supabase.com/docs/guides/database/prisma'
priority: high
type: feature
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
La futura aplicación Next.js necesita un modelo tipado y mantenible para perfiles, registros y relaciones. Prisma será la capa de acceso a Supabase Postgres desde el servidor.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Los modelos Prisma representan perfiles, PRs y sus relaciones con identificadores y restricciones apropiadas.
- [ ] #2 Los cambios de esquema se pueden reproducir mediante migraciones versionadas.
- [ ] #3 Las operaciones de datos del servidor usan Prisma y no exponen credenciales ni consultas privilegiadas al navegador.
- [ ] #4 Queda documentado qué capa gestiona autenticación y autorización y cuál gestiona persistencia.
<!-- AC:END -->
