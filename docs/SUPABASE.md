# Supabase Postgres para desarrollo y despliegue

El [issue #3](https://github.com/andres1298/personal-prs/issues/3) prepara la conexión a Postgres. Los modelos y las tablas corresponden al [issue #4](https://github.com/andres1298/personal-prs/issues/4), y la migración de los PRs al [issue #7](https://github.com/andres1298/personal-prs/issues/7).

## Crear el proyecto y obtener las conexiones

1. Crea un proyecto en [Supabase](https://supabase.com/dashboard) para desarrollo, elige una región próxima a la futura instalación de Vercel y guarda la contraseña de la base de datos en tu gestor de contraseñas. La creación del proyecto y cualquier costo asociado quedan en tu cuenta.
2. En el proyecto, abre **Connect**. Copia la cadena **Transaction pooler** (puerto 6543) para `DATABASE_URL`. Esta es la conexión que usará el servidor Next.js cuando ejecute consultas.
3. Copia la cadena **Direct connection** (puerto 5432) para `DIRECT_DATABASE_URL`. Prisma Migrate usará esta conexión para los cambios de esquema. Si la máquina que ejecuta migraciones no tiene IPv6 y el proyecto no tiene el complemento IPv4, usa **Session pooler** (puerto 5432) como alternativa compatible.
4. Sustituye `[YOUR-PASSWORD]` en ambas cadenas. Si la contraseña contiene caracteres reservados de URL (por ejemplo `&`, `#`, `?` o espacios), codifícalos como porcentaje. No publiques las cadenas ni las pegues en un chat.

Las opciones de conexión y sus puertos están documentados en [Supabase: Connect to your database](https://supabase.com/docs/guides/database/connecting-to-postgres). Prisma utiliza el adaptador `pg`, que gestiona sus conexiones. La configuración y las diferencias respecto a parámetros de versiones anteriores se describen en [PRISMA.md](PRISMA.md).

## Desarrollo local

```bash
cp .env.example .env.local
```

Edita **solo** `.env.local` con los dos valores. `.gitignore` excluye los archivos `.env` y `.env.*` salvo `.env.example`. `DATABASE_URL` y `DIRECT_DATABASE_URL` son secretos de servidor: nunca uses el prefijo `NEXT_PUBLIC_` ni los pases a componentes del navegador.

Comprueba la conexión con una consulta de lectura que no crea ni modifica tablas:

```bash
npm run db:check
```

El servidor y `db:check` confían en la CA raíz pública de Supabase (Supabase Root 2021 CA), incluida en `src/lib/server/database-config.js` junto a las CA predeterminadas de Node. No hace falta `NODE_EXTRA_CA_CERTS` ni descargar el certificado; no desactives la validación del certificado. Las variables de conexión siguen exclusivamente en `.env.local` o en la configuración privada del despliegue.

El código de servidor obtiene el cliente mediante `getPrisma()` en `src/lib/server/prisma.js`; las operaciones de persistencia están en `src/lib/server/records.js`. La importación `server-only` impide usar esos módulos desde un componente cliente. La configuración limita cada proceso a una conexión y exige TLS para conexiones remotas. El script `db:check` conserva una consulta diagnóstica de conectividad con `pg`. La interfaz Next.js usa `/api/records` para leer y registrar PRs con una sesión autorizada de Supabase. Consulta [AUTH.md](AUTH.md) para configurar el acceso y [PRISMA.md](PRISMA.md) para las entidades y pruebas de persistencia.

## Despliegue

Para [issue #16](https://github.com/andres1298/personal-prs/issues/16), la integración de Supabase en Vercel instala las variables del proyecto enlazado. La aplicación las usa como alternativa cuando no existen las variables propias:

| Variable de la aplicación | Alternativa de la integración |
| --- | --- |
| `DATABASE_URL` | `POSTGRES_PRISMA_URL` (transaction pooler) |
| `DIRECT_DATABASE_URL` | `POSTGRES_URL_NON_POOLING` |

La integración también instala `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY`. `SUPABASE_ADMIN_USER_IDS` se configura manualmente (ver [AUTH.md](AUTH.md)). Tras cambiar variables, vuelve a desplegar. Para migrar la base enlazada desde tu máquina, descarga sus variables con `vercel env pull .env.local` y ejecuta `npm run db:migrate:deploy` y `npm run db:seed`. No introduzcas secretos en archivos versionados ni en variables `NEXT_PUBLIC_`. La migración del esquema se ejecuta como paso controlado de despliegue, no durante `next build` ni en cada petición.

## Único flujo de migraciones de esquema

Prisma Migrate será la fuente de verdad para el esquema de la aplicación a partir de [issue #4](https://github.com/andres1298/personal-prs/issues/4). Se versionarán `prisma/schema.prisma` y `prisma/migrations/`. En desarrollo se crearán migraciones con `prisma migrate dev`; para despliegues se aplicarán las migraciones revisadas con `prisma migrate deploy`, usando `DIRECT_DATABASE_URL` en la configuración de Prisma. La aplicación usará `DATABASE_URL` para consultas. Esto sigue la [documentación de Prisma Migrate](https://www.prisma.io/docs/cli/v7/migrate/deploy) y la recomendación de Supabase de usar una conexión directa para migraciones.

Los cambios de tablas, índices, restricciones y políticas de la aplicación se incorporarán a esas migraciones. Evita crear el mismo cambio manualmente en el editor SQL de Supabase, con `prisma db push` o mediante una segunda carpeta de migraciones de Supabase: produciría un historial de esquema divergente. Los esquemas internos gestionados por Supabase, como `auth`, quedan fuera de las migraciones de la aplicación.
