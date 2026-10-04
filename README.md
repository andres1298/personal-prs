# personal-prs
Personal CrossFit PR tracker, lifts, cardio and benchmarks with progress charts and video uploads. Minimal iPhone-installable web app backed by Google Sheets &amp; Drive via Apps Script.

## Desarrollo con Next.js

Requiere Node.js 20.9 o superior. Instala dependencias y configura la implementación existente de Apps Script:

```bash
npm ci
cp .env.example .env.local
# Edita APPS_SCRIPT_URL en .env.local con la URL que termina en /exec.
npm run dev
```

Abre `http://localhost:3000`. Si `APPS_SCRIPT_URL` está vacía, la aplicación usa datos de ejemplo. Con la URL configurada, introduce la clave actual desde **Ajustes → Datos → Conectar**. La clave permanece en el almacenamiento local de ese navegador, como en la versión HTML. Si cambias de dominio, tendrás que introducirla de nuevo.

La ruta `/api/apps-script` envía las acciones `list`, `add` y `uploadUrl` desde el servidor a Apps Script. La URL de Apps Script solo se lee en el servidor. La subida del archivo de video sigue usando la URL temporal que devuelve Apps Script; el archivo se envía directamente allí desde el navegador.

## Supabase Postgres

La preparación de Supabase y la prueba de conexión de servidor están documentadas en [docs/SUPABASE.md](docs/SUPABASE.md). Configura `DATABASE_URL` y `DIRECT_DATABASE_URL` en `.env.local` y ejecuta `npm run db:check`. Los datos de la interfaz siguen en Apps Script hasta las tareas de Prisma y migración.

## Despliegue en Vercel

Importa este repositorio como proyecto Next.js. En **Project Settings → Environment Variables**, define `APPS_SCRIPT_URL` para los entornos donde quieras datos reales, con la URL HTTPS de Apps Script que termina en `/exec`. No uses el prefijo `NEXT_PUBLIC_`. Despliega de nuevo después de modificarla. Si no configuras la variable, se mostrará el modo demo.

Usa HTTPS para instalar la aplicación en iPhone o Android. El manifiesto y los iconos están en `public/`. Si tu flujo de subida de video limita orígenes, autoriza el dominio final de Vercel en la configuración de Apps Script/Drive.

## Gestión de tareas

Este proyecto usa [Backlog.md](https://github.com/MrLesk/Backlog.md) como dependencia de desarrollo. Las tareas se guardan como archivos Markdown en `backlog/` y se versionan con el proyecto. El comando se ejecuta con `npx --no-install` para usar la versión instalada localmente.

```bash
npm ci
npx --no-install backlog task create "Descripción de la tarea"
npx --no-install backlog task list --plain
npx --no-install backlog board
npx --no-install backlog browser
```

Para actualizar una tarea, usa `npx --no-install backlog task edit <id>`. El tablero web se abre localmente y permite organizar las tareas por estado. Los estados iniciales son **To Do**, **In Progress** y **Done**.

## Acceso desde el teléfono

Consulta el [manual para iPhone y Android](docs/INSTALACION.md) para añadir un icono de Mis PRs a la pantalla de inicio y abrir la aplicación web sin la barra del navegador cuando el teléfono lo permita.
