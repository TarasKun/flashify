# Local Supabase

Flashify uses Supabase locally for PostgreSQL and Auth services. NestJS remains
the only public business API; the frontend must not call generated Supabase
data APIs for decks, cards, progress, chat, or sync data.

## Prerequisites

- Node.js 20+ (this repository uses Node.js 24).
- Docker Desktop, OrbStack, Podman, or another Docker-compatible runtime that
  is running and available to the current user.
- Run `npm install` after pulling workspace changes.

The Supabase CLI starts its local stack with Docker. It can use several GB of
RAM, so close unused containers first. Keep the local stack bound to your own
machine; do not expose it on a public network.

## Start and stop

```bash
npm run supabase:start
npm run supabase:status
npm run supabase:stop
```

The default local endpoints are:

- API/Auth: `http://127.0.0.1:54321`
- PostgreSQL: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Studio: `http://127.0.0.1:54323`

After the stack starts, copy only the displayed **publishable** key into the
local `.env` value `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never expose a
Supabase secret/service key to the browser, commit it, or add it to an example
file.

## Environment boundaries

- Root `.env`: Next.js/OpenRouter plus browser-safe `NEXT_PUBLIC_SUPABASE_*`
  values. It is gitignored.
- `flashify-api/.env`: NestJS runtime values. It is gitignored; begin from
  `flashify-api/.env.example`. For the local stack, `DATABASE_URL` points to
  `postgresql://postgres:postgres@127.0.0.1:54322/postgres?schema=public`.
- Hosted deployment values are configured in the relevant host dashboards,
  never committed to this repository.

## Schema ownership

`supabase/config.toml` has `db.migrations.enabled = false`. Prisma in
`flashify-api/` will be the only owner of Flashify tables and migrations in the
`public` schema. Do not create `supabase/migrations` for Flashify application
tables. Supabase manages its own Auth/internal schemas.

## Prisma commands

Run these from the repository root after the local stack is healthy:

```bash
npm run db:migrate:dev --workspace=@flashify/api
npm run db:migrate:status --workspace=@flashify/api
npm run db:migrate:deploy --workspace=@flashify/api
```

Use `db:migrate:dev` only for local development. Production deployments apply
the committed migration history with `db:migrate:deploy`.

## Reference

The setup follows the official Supabase local-development flow:
[Supabase CLI getting started](https://supabase.com/docs/guides/local-development/cli/getting-started) and
[Supabase CLI configuration](https://supabase.com/docs/guides/local-development/cli/config).
