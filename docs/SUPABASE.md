# Supabase Postgres para desarrollo y despliegue

TASK-2 prepara la conexión a Postgres. Los modelos, las tablas y la migración de los PRs se harán en TASK-3 y TASK-6.

## Crear el proyecto y obtener las conexiones

1. Crea un proyecto en [Supabase](https://supabase.com/dashboard) para desarrollo, elige una región próxima a la futura instalación de Vercel y guarda la contraseña de la base de datos en tu gestor de contraseñas. La creación del proyecto y cualquier costo asociado quedan en tu cuenta.
2. En el proyecto, abre **Connect**. Copia la cadena **Transaction pooler** (puerto 6543) para `DATABASE_URL`. Esta es la conexión que usará el servidor Next.js cuando ejecute consultas.
3. Copia la cadena **Direct connection** (puerto 5432) para `DIRECT_DATABASE_URL`. Prisma Migrate usará esta conexión para los cambios de esquema. Si la máquina que ejecuta migraciones no tiene IPv6 y el proyecto no tiene el complemento IPv4, usa **Session pooler** (puerto 5432) como alternativa compatible.
4. Sustituye `[YOUR-PASSWORD]` en ambas cadenas. Si la contraseña contiene caracteres reservados de URL (por ejemplo `&`, `#`, `?` o espacios), codifícalos como porcentaje. No publiques las cadenas ni las pegues en un chat.

Las opciones de conexión y sus puertos están documentados en [Supabase: Connect to your database](https://supabase.com/docs/guides/database/connecting-to-postgres). El modo transacción requiere desactivar las consultas preparadas al configurar Prisma en TASK-3; la [guía de Prisma de Supabase](https://supabase.com/docs/guides/database/prisma/prisma-troubleshooting) indica `pgbouncer=true` para su cadena de ejecución.

## Desarrollo local

```bash
cp .env.example .env.local
```

Edita **solo** `.env.local` con los dos valores. `.gitignore` excluye los archivos `.env` y `.env.*` salvo `.env.example`. `DATABASE_URL` y `DIRECT_DATABASE_URL` son secretos de servidor: nunca uses el prefijo `NEXT_PUBLIC_` ni los pases a componentes del navegador.

Comprueba la conexión con una consulta de lectura que no crea ni modifica tablas:

```bash
npm run db:check
```

El código de servidor puede obtener el pool mediante `getDbPool()` en `src/lib/server/db.js`. La importación `server-only` impide usar ese módulo desde un componente cliente. La configuración limita cada proceso a una conexión y exige TLS. La aplicación actual sigue usando Apps Script hasta que las tareas de datos cambien sus rutas.

## Despliegue

Cuando se prepare TASK-15, configura `DATABASE_URL` y `DIRECT_DATABASE_URL` como variables privadas del proyecto en Vercel para cada entorno que vaya a usarlas. Usa cadenas del proyecto Supabase correspondiente a ese entorno. No introduzcas secretos en archivos versionados ni en variables `NEXT_PUBLIC_`. La migración del esquema se ejecuta como paso controlado de despliegue, no durante `next build` ni en cada petición.

## Único flujo de migraciones de esquema

Prisma Migrate será la fuente de verdad para el esquema de la aplicación a partir de TASK-3. Se versionarán `prisma/schema.prisma` y `prisma/migrations/`. En desarrollo se crearán migraciones con `prisma migrate dev`; para despliegues se aplicarán las migraciones revisadas con `prisma migrate deploy`, usando `DIRECT_DATABASE_URL` en la configuración de Prisma. La aplicación usará `DATABASE_URL` para consultas. Esto sigue la [documentación de Prisma Migrate](https://www.prisma.io/docs/cli/v7/migrate/deploy) y la recomendación de Supabase de usar una conexión directa para migraciones.

Los cambios de tablas, índices, restricciones y políticas de la aplicación se incorporarán a esas migraciones. Evita crear el mismo cambio manualmente en el editor SQL de Supabase, con `prisma db push` o mediante una segunda carpeta de migraciones de Supabase: produciría un historial de esquema divergente. Los esquemas internos gestionados por Supabase, como `auth`, quedan fuera de las migraciones de la aplicación.
