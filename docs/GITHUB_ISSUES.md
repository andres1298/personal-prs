# Seguimiento de tareas con GitHub Issues

## Fuente de verdad

El trabajo se registra en [andres1298/personal-prs/issues](https://github.com/andres1298/personal-prs/issues). El cuerpo del issue contiene el alcance, el plan vigente, los avances y las decisiones. Los comentarios se reservan para dar contexto del cierre. Los documentos del repositorio explican procesos y arquitectura, sin duplicar el estado de las tareas.

Cada tarea tiene un título que describe un resultado y el número que asigna GitHub. Por ejemplo, `#3` prepara Supabase y `#4` incorpora Prisma. Los números antiguos `TASK-n` dejaron de ser identificadores activos: usa los números de GitHub y comprueba el título antes de actuar.

Para un cambio trivial puede bastar el PR. Para trabajo que requiera decisiones, dependencias, varias etapas o seguimiento, busca primero un issue y crea uno si no existe.

## Formato del issue

Usa la plantilla **Tarea** al crear un issue. Mantén estas secciones:

| Sección | Contenido |
| --- | --- |
| Resumen | Problema, resultado esperado y límites del alcance. |
| Seguimiento | Estado, prioridad, tipo y responsable. |
| Criterios de aceptación | Checklist de resultados observables y verificables. |
| Dependencias | Enlaces a los issues que deben completarse antes; `Ninguna` si no hay. |
| Plan de implementación | Pasos concretos; `Por definir` mientras la tarea siga pendiente. |
| Validación y avances | Comprobaciones, resultados, limitaciones y siguiente paso. |

Las secciones **Referencias** y **Resultado** son opcionales. Conserva notas útiles y criterios al actualizar el plan. El responsable puede ser una cuenta real asignada en GitHub o un agente identificado en el cuerpo; no inventes cuentas para agentes.

Prioridades: **Alta**, **Media**, **Baja**. Tipos: `feature`, `bug`, `chore`, `docs`, `task`, `enhancement` o `spike`. No hacen falta Projects, automatizaciones ni etiquetas adicionales para seguir este estándar.

## Estados

| Estado en Seguimiento | Estado de GitHub | Regla |
| --- | --- | --- |
| Pendiente | Open | El trabajo todavía no empezó. |
| En progreso | Open | Hay trabajo activo y un plan registrado. |
| Bloqueado | Open | Indica la causa, quién puede resolverla y el siguiente paso. |
| En revisión | Open | Cambios implementados; enlaza el PR o describe qué queda por revisar o publicar. |
| Completado | Closed / completed | Criterios verificados y cambios integrados en la rama destino o entrega publicada según el alcance. |
| Cancelado | Closed / not planned | Explica por qué se abandona el trabajo. |

El campo **Estado** es obligatorio. La etiqueta existente `in progress` puede ayudar a filtrar tareas activas: úsala solo para **En progreso** y retírala cuando cambie el estado. No sustituye el estado del cuerpo. Si GitHub muestra un issue cerrado y el cuerpo dice En progreso, corrige esa inconsistencia.

## Flujo de trabajo

1. **Buscar y leer.** Revisa el issue, los comentarios y cada dependencia. Un número que no se puede consultar es una dependencia sin verificar.
2. **Preparar.** Confirma alcance, criterios y responsable. Registra el plan antes de implementar. Para planificar trabajo futuro, conserva Pendiente.
3. **Iniciar.** Cambia a En progreso. Usa una rama con referencia al issue para trabajo nuevo, por ejemplo `codex/issue-4-prisma`; conserva una rama ya acordada con el usuario.
4. **Actualizar.** Actualiza el cuerpo al terminar una parte útil o encontrar un bloqueo, incluyendo plan, estado, dependencias y evidencia. No agregues comentarios de progreso.
5. **Verificar.** Ejecuta las comprobaciones apropiadas y registra sus resultados. Marca cada criterio solo con evidencia. Diferencia compilación, prueba manual y conexión real.
6. **Revisar y publicar.** Enlaza el PR y usa En revisión mientras falte revisión o integración. Las correcciones locales sin commit o push siguen abiertas.
7. **Cerrar.** Actualiza el cuerpo y agrega un único comentario con el resultado, la validación y lo que quede fuera de alcance. Cierra como completado solo cuando se cumpla la entrega del issue o el usuario solicite explícitamente su cierre. Para código, normalmente al integrar el PR. Si GitHub lo cierra automáticamente, comprueba que el cuerpo y la validación quedaron actualizados y agrega el contexto del cierre si todavía falta.

No inicies una tarea dependiente como si sus prerequisitos estuvieran completos. Puedes registrar su plan mientras espera. Para dependencias usa enlaces como `Depende de #3`; para PRs parciales usa `Refs #3`. Usa `Closes #3` solo si el PR resuelve el issue completo y su rama destino permite el cierre automático.

## Actualizaciones breves

La sección Validación y avances del cuerpo puede usar este formato:

```markdown
Avance: conexión de servidor preparada.
Validación: npm run build pasó. db:check no pudo conectar porque falta DATABASE_URL.
Pendiente: configurar la variable local y repetir SELECT 1.
Siguiente paso: comprobar la conexión sin publicar credenciales.
```

Para un bloqueo, añade quién debe resolverlo y conserva el issue abierto. No publiques comentarios para bloqueos o avances. Para el único comentario de cierre, indica el resultado, los criterios verificados, las comprobaciones ejecutadas y el PR o entrega. Los comentarios históricos se conservan.

## Herramientas

Los agentes usan las herramientas de GitHub disponibles para buscar, leer, crear y actualizar issues. Si el conector devuelve un error de permisos al escribir, pueden usar `gh` ya autenticado. Si tampoco funciona, informa el bloqueo y conserva el contenido preparado para publicarlo; no declares una sincronización exitosa.

La CLI es opcional para desarrollar la aplicación. Ejemplos en PowerShell:

```powershell
gh auth status
gh issue list --repo andres1298/personal-prs --state open
gh issue list --repo andres1298/personal-prs --state all --search 'Supabase in:title'
gh issue view 3 --repo andres1298/personal-prs --comments

# Prepara un archivo temporal con el cuerpo COMPLETO antes de reemplazarlo.
$issueBodyPath = Join-Path $env:TEMP 'personal-prs-issue-body.md'
gh issue create --repo andres1298/personal-prs --title 'Preparar conexión de servidor' --body-file $issueBodyPath
gh issue edit 3 --repo andres1298/personal-prs --body-file $issueBodyPath

# Solo para el comentario de contexto del cierre, prepara el texto exacto.
$issueCommentPath = Join-Path $env:TEMP 'personal-prs-issue-comment.md'
gh issue comment 3 --repo andres1298/personal-prs --body-file $issueCommentPath

# Solo después de cumplir las reglas de cierre.
gh issue close 3 --repo andres1298/personal-prs --reason completed
```

Relee el cuerpo más reciente antes de reemplazarlo para conservar cambios de otras personas. Tras escribir, vuelve a consultar el issue y confirma el contenido, estado y dependencias. Nunca incluyas secretos ni datos privados en cuerpos, comentarios, capturas o logs.
