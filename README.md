# web

The Next.js (App Router, TypeScript) rewrite of the platform: UI and API in one app.
It replaces `../frontend` (Vue) and `../backend` (FastAPI), which stay in the repo until cutover.

## Requirements

- Node.js 22+
- MySQL or MariaDB. Production uses the Hostinger database; locally, XAMPP's MariaDB works.

## Setup

```bash
npm install
```

Start MariaDB/MySQL, then create the databases (the second one is only for `npm run test:api`):

```sql
CREATE DATABASE axis_dev  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE axis_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Copy `.env.example` to `.env.local`, fill it in, then create the tables and the first owner:

```bash
npm run db:migrate
```

```bash
npm run create-owner -- owner@example.com "Owner Name"
```

```bash
npm run dev
```

There is no public sign-up. `create-owner` prints a temporary password once; the owner must
change it and set up two-factor authentication on first login.

## Scripts

| Script                 | What it does                                                          |
| ---------------------- | --------------------------------------------------------------------- |
| `npm run dev`          | Dev server                                                            |
| `npm run build`        | Production build                                                      |
| `npm run lint`         | ESLint                                                                |
| `npm run typecheck`    | TypeScript, no emit                                                   |
| `npm test`             | Unit tests (no database)                                              |
| `npm run test:api`     | API tests against the local `axis_test` database                      |
| `npm run format`       | Prettier                                                              |
| `npm run db:generate`  | Generate a SQL migration from `src/server/db/schema`                  |
| `npm run db:migrate`   | Apply migrations to the database in `.env.local`                      |
| `npm run create-owner` | Create the first platform owner                                       |
| `npm run i18n:convert` | Regenerate `messages/*.json` from the legacy Vue dictionary (one-off) |

## Layout

- `src/app` — routes: pages, `/api/auth` (Better Auth) and `/api/v1` route handlers
- `src/server` — server-only code
  - `db/` — Drizzle schema and client
  - `auth/` — Better Auth config, session helpers, step-up ("enter the code"), throttling
  - `policy/` — roles and school scoping
  - `services/` — business services (accounts, …)
- `src/i18n` — locale config; the locale is a cookie, there is no locale in the URL
- `src/config/brand.ts` — the only place the product name lives (`{brand}` token in messages)
- `messages/` — translations for ar, en, zh, de, es, fr
- `drizzle/` — SQL migrations
- `tests/` — `unit/`, `api/`, later `e2e/`

## Security model in short

- Sessions are httpOnly cookies backed by the database; nothing is kept in localStorage.
- Every route handler calls `requireSession()`. It enforces the temporary-password change,
  two-factor enrollment for owner/manager/admin, and the role's allowed area.
- High-risk actions also call `requireStepUp()`: a TOTP code entered in the last 5 minutes.
- Passwords are stored only as hashes. A temporary password is shown once when an account
  is created or reset.

## Notes

- `next.config.ts` sets the `next-intl/config` alias by hand instead of using `next-intl/plugin`;
  the comment there explains why.
- JSON columns use a custom type stored as LONGTEXT so they behave the same on MySQL and MariaDB.
- Next.js must be upgraded to 16.3.8+ (security release) before anything is deployed.
