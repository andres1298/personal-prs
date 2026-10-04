# Estándares de trabajo

## Seguimiento con GitHub Issues

- GitHub Issues de `andres1298/personal-prs` es la única fuente de verdad para tareas, planes, dependencias y avances.
- Antes de implementar trabajo no trivial, lee [docs/GITHUB_ISSUES.md](docs/GITHUB_ISSUES.md), busca un issue existente y lee su cuerpo y comentarios.
- Usa las herramientas de GitHub disponibles. Si el conector no permite escribir, usa `gh` autenticado. Si ninguno tiene acceso, informa la limitación; no afirmes que una actualización se guardó.
- Identifica las tareas por el número real del issue, por ejemplo `#3`. No crees un segundo registro de tareas en archivos locales.
- Antes de implementar, comprueba las dependencias y registra el plan y el estado en el issue. Para planes futuros, conserva Pendiente.
- Actualiza el cuerpo del issue al terminar una parte relevante, encontrar un bloqueo o cambiar el plan. Registra evidencia y el siguiente paso. No agregues comentarios de progreso.
- Al cerrar un issue, agrega un único comentario con el contexto del cierre: resultado, validación y trabajo que queda fuera de alcance.
- Antes de publicar el comentario de cierre, revisa su texto completo. Limítalo al resultado funcional, comprobaciones generales y referencias públicas a issues, commits o PRs. Omite identificadores de infraestructura, hosts, rutas locales, usuarios, nombres de variables o certificados, errores internos, permisos y configuración de seguridad. No pegues logs ni valores de configuración. Aplica la misma protección de secretos al cuerpo del issue y al PR.
- No cierres un issue hasta verificar sus criterios y publicar los cambios según el flujo documentado. Un build exitoso no demuestra una conexión real ni una prueba en navegador.
- No publiques credenciales, cadenas de conexión, tokens ni datos privados en issues, comentarios o logs.

## Implementación y validación

- Mantén los cambios dentro del alcance del issue y respeta las convenciones del código existente.
- Conserva las credenciales en variables de entorno de servidor. Los módulos de base de datos deben permanecer exclusivos de servidor.
- Usa Prisma Migrate como único flujo de migraciones del esquema de la aplicación cuando se implemente Prisma.
- Tras modificar dependencias, actualiza `package-lock.json` y verifica `npm ci`.
- Ejecuta `npm run build` y `git diff --check`, además de las comprobaciones que prueben el comportamiento cambiado.
- Describe qué se verificó y qué sigue pendiente. No marques como aprobado un chequeo que no ejecutaste o que falló.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
