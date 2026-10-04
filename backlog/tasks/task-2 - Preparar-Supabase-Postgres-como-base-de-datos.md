---
id: TASK-2
title: Preparar Supabase Postgres como base de datos
status: In Progress
assignee:
  - '@codex'
created_date: '2026-10-03 06:08'
updated_date: '2026-10-03 15:16'
labels: []
dependencies:
  - TASK-1
references:
  - index.html
documentation:
  - 'https://supabase.com/docs/guides/database/overview'
priority: high
type: feature
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Los PRs se guardan actualmente en Google Sheets mediante Apps Script y una clave compartida. Se necesita una instancia Supabase Postgres preparada para la nueva aplicación; el modelo de entidades y la migración de datos se resolverán en tareas posteriores.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Existe una configuración documentada de Supabase para desarrollo y despliegue sin credenciales en el repositorio.
- [ ] #2 La aplicación Next.js puede conectarse a Supabase Postgres desde el servidor con credenciales protegidas.
- [ ] #3 Queda definido un único flujo de migraciones de esquema que utilizará Prisma en la tarea siguiente.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Codex: documentar la creación del proyecto Supabase, las URLs para ejecución y migraciones, y la configuración local/Vercel sin guardar secretos en Git.
2. Codex: preparar una conexión Postgres solo de servidor y una comprobación de conectividad inocua; validar compilación sin credenciales.
3. Andrés: crear o seleccionar el proyecto Supabase y colocar las cadenas de conexión en .env.local; más adelante configurarlas en Vercel.
4. Codex: probar SELECT 1 con las credenciales locales cuando estén disponibles y registrar el resultado sin revelar secretos.
5. Codex: documentar Prisma Migrate como único flujo de migraciones de esquema para TASK-3, sin crear modelos ni migrar datos en TASK-2.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Preparados docs/SUPABASE.md, .env.example, exclusión de secretos en .gitignore, módulo src/lib/server/db.js y npm run db:check (SELECT 1). pg y server-only quedaron fijados en package-lock.json. npm run build y git diff --check pasaron. db:check se detiene por falta de DATABASE_URL; pendiente que Andrés configure el proyecto y las cadenas en .env.local para verificar la conexión real. Prisma Migrate quedó documentado como único flujo de cambios de esquema.
<!-- SECTION:NOTES:END -->
