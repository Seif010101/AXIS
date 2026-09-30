# web

The Next.js (App Router, TypeScript) rewrite of the platform: UI and API in one app.
It replaces `../frontend` (Vue) and `../backend` (FastAPI), which stay in the repo until cutover.

## Requirements

- Node.js 22+
- A **staging** Supabase project (never develop against production)

## Setup

```bash
npm install
```

Copy `.env.example` to `.env.local` and fill it in, then:

```bash
npm run dev
```

## Scripts

| Script                 | What it does                                                          |
| ---------------------- | --------------------------------------------------------------------- |
| `npm run dev`          | Dev server                                                            |
| `npm run build`        | Production build                                                      |
| `npm run lint`         | ESLint                                                                |
| `npm run typecheck`    | TypeScript, no emit                                                   |
| `npm test`             | Unit tests (Vitest)                                                   |
| `npm run format`       | Prettier                                                              |
| `npm run i18n:convert` | Regenerate `messages/*.json` from the legacy Vue dictionary (one-off) |

## Layout

- `src/app` — routes (pages and `/api/v1` route handlers)
- `src/server` — server-only code: `policy/` (roles, school scoping), `errors.ts`, later `db/`, `auth/`, `services/`, `modules/`
- `src/i18n` — locale config; the locale is a cookie, there is no locale in the URL
- `src/config/brand.ts` — the only place the product name lives (`{brand}` token in messages)
- `messages/` — translations for ar, en, zh, de, es, fr
- `tests/` — `unit/`, later `api/` and `e2e/`

## Notes

- `next.config.ts` sets the `next-intl/config` alias by hand instead of using `next-intl/plugin`;
  the comment there explains why.
- Next.js must be upgraded to 16.3.8+ (security release) before anything is deployed.
