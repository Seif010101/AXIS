# AXIS engineering conventions

This is the contract every change follows. Reviewers (human or agent) reject work that breaks it.
The Arabic overview of the project lives in `docs/ARCHITECTURE.md`.

## 1. Stack

- **Next.js 16.3 App Router**, React 19, TypeScript strict. This is NOT the Next.js in your
  memory: read the relevant guide in `node_modules/next/dist/docs/` before using an API.
- **MySQL/MariaDB** through **Drizzle ORM** (`src/server/db`). UUID string ids, UTC
  `DATETIME(3)`, JSON columns stored as LONGTEXT (`json<T>()` in `schema/_columns.ts`).
  MySQL has no `RETURNING`: generate ids in code (`pk()` does) and re-select if needed.
- **Better Auth** (`src/server/auth`): DB sessions, mandatory TOTP for owner/manager/admin,
  step-up (an authenticator code verified in the last 5 minutes) for high-risk actions.
- **next-intl** with 6 locales (`ar` default/RTL, `en`, `zh`, `de`, `es`, `fr`); the locale is
  a cookie, never part of the URL.
- **UI:** Tailwind v4 + shadcn/ui (`radix-nova` style, RTL enabled) in `src/components/ui`,
  lucide icons, sonner toasts, recharts (through `components/ui/chart`).
- **AI:** Vercel AI SDK 7 with Google Gemini, only through `src/server/services/ai`.
- **Files:** Backblaze B2 (S3 API) only through `src/server/services/storage`; text extraction
  through `src/server/services/files`.
- **Tests:** Vitest. `npm test` (unit, no DB) and `npm run test:api` (real MariaDB).

Dependencies are fixed. Do not add or upgrade packages; if something is truly missing, say so
in your report instead.

## 2. Layout

```
src/
  app/
    (public)/            landing, about                         – public, no session
    (auth)/              login, two-factor, change-password, setup-2fa
    (app)/               signed-in app: layout = session gate + shell (sidebar/topbar)
      student/ teacher/ manager/ admin/ owner/   role areas (see route map)
      settings/ notifications/ feedback/         shared by every role
    api/                 route handlers: auth, health, AI streaming, file download only
    forbidden.tsx not-found.tsx error.tsx global-error.tsx
  components/
    ui/                  shadcn primitives (shared, foundation-owned)
    shell/               app shell: sidebar, topbar, user menu, theme/locale switchers
    common/              shared composites: page header, stat card, empty state, data table…
    <area>/              components owned by one feature area (e.g. components/classroom)
  config/                brand.ts (product name), navigation.ts (route map), features.ts
  hooks/                 client hooks (use-action.ts …)
  i18n/                  locale config, message loading, typed message keys
  lib/                   isomorphic helpers (utils.ts, format.ts …)
  server/                server-only code (`import "server-only"` at the top of every module)
    action.ts            action() — the only way to write a server action
    auth/                Better Auth, sessions, page guards, step-up, throttles
    db/                  Drizzle client, schema, boot-time migrator
    policy/              roles, areas, school scoping, who-may-manage-whom
    services/            cross-cutting infrastructure: ai, storage, files, accounts, …
    modules/<area>/      business logic of one feature area (queries + commands)
messages/<locale>/<namespace>.json   one file per namespace per locale
drizzle/                 SQL migrations (generated; bundled by scripts/bundle-migrations.mjs)
tests/unit, tests/api    see §9
```

## 3. Feature areas and ownership

Each area owns its routes, its `server/modules/<area>/` folder, its `components/<area>/`
folder, its message namespace and its tests. Work in one area never edits another area's files.
Shared files (`components/ui`, `components/common`, `server/services/*`, `config/*`, schema,
`common`/`nav` messages) belong to the foundation; if you need a change there, report it.

| Area (namespace)                                   | Routes it builds                                                                                                                                                                                                                                |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| foundation: `auth`, `shell`, `settings`, `landing` | `/`, `/about`, `/login`, `/two-factor`, `/change-password`, `/setup-2fa`, `(app)` layout + shell, `/settings`, error/forbidden/not-found pages                                                                                                  |
| **classroom**                                      | `/teacher` (overview), `/teacher/classes`, `/teacher/classes/students/[id]`, `/teacher/homework/**`, `/teacher/worksheets/**`, `/student/homework/**`, `/student/worksheets/**`                                                                 |
| **assessments**                                    | `/teacher/tests/**`, `/student/tests/**`, `/student/games/**`, `/student/learning-style`                                                                                                                                                        |
| **chat**                                           | `/student/chat/[[...id]]`, `/teacher/assistant/[[...id]]`, `/manager/advisor/[[...id]]`, `api/chat`                                                                                                                                             |
| **studio**                                         | `/student/studio/**`, `/teacher/studio/**`, `/admin/incident`                                                                                                                                                                                   |
| **student**                                        | `/student` (home), `/student/challenge`, `/student/leaderboard`, `/student/progress`, `/student/focus`, `/student/wellbeing`, `/student/notebook`, `/teacher/notebook`                                                                          |
| **library**                                        | `/student/library/**`, `/teacher/library/**`, `/manager/books/**`, `api/library/*`                                                                                                                                                              |
| **schools**                                        | `/manager/schools/**`, `/admin/people/**`, `/admin/import`, `/owner/users`                                                                                                                                                                      |
| **insights**                                       | `/owner` (overview), `/owner/ai-cost`, `/owner/churn`, `/owner/broadcast`, `/owner/feedback`, `/owner/reports`, `/manager` (overview), `/admin` (overview), `/admin/announcements`, `/notifications`, `/feedback`, the topbar notification bell |

The sidebar renders `src/config/navigation.ts`; every `href` there must resolve to a page.

## 4. Server code

- Business logic lives in `src/server/modules/<area>/*.ts` as plain async functions that take
  the caller's `SessionContext` (or its `actor`) and validated input:
  `listHomework(ctx, filters)`, `submitHomework(ctx, { homeworkId, content })`.
  They never read cookies/headers themselves, so tests call them directly.
- **Authorization happens in the module function**, every time, using `server/policy`:
  `schoolScope(actor)`, `requireOwnSchool`, `assertCanActOnSchool`, `assertCanManageUser`,
  `studentCanSee`. A school-bound account without a school gets nothing (`NO_SCHOOL`).
  Never accept a `schoolId`, `teacherId` or `studentId` from the client as proof of anything:
  derive it from the actor and verify ownership in the query (`WHERE teacher_id = actor.id`).
- Throw `AppError(code, englishMessage)` for expected failures (`NOT_FOUND`, `FORBIDDEN`,
  `CONFLICT`, `VALIDATION`, …). Return 404 rather than 403 for resources the caller may not
  even know exist (another user's conversation, another school's homework).
- Multi-statement writes use `db.transaction`. Counts/stats use SQL aggregates, never
  fetch-all-and-count.
- Never return secrets or answer keys to a client: password hashes, TOTP secrets, test
  answers before submission, other users' private data.

### Server actions

`"use server"` files named `actions.ts`, next to the page that uses them, contain only
`action()` exports:

```ts
"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { action } from "@/server/action";
import { createHomework } from "@/server/modules/classroom/homework";

export const createHomeworkAction = action(
  { area: "teacher", input: z.object({ title: z.string().trim().min(1).max(255) /* … */ }) },
  async (input, ctx) => {
    const created = await createHomework(ctx, input);
    revalidatePath("/teacher/homework");
    return created;
  },
);
```

`action()` checks the session/area, runs step-up when `stepUp: true`, validates with zod and
returns `ActionResult<T>` (`{ ok: true, data } | { ok: false, code, message, fieldErrors? }`).
**Step-up is mandatory** (`stepUp: true`) for: password resets, bulk account generation and the
one-time credentials download, deleting an account or a school, (de)activating a user, role
changes, the owner broadcast, platform-wide settings.

### Pages

- Pages and layouts are Server Components. They gate with
  `const ctx = await requirePageSession("teacher")` (from `@/server/auth/page`) and load data by
  calling module functions directly — never by fetching the app's own API.
- School-only pages call `requirePageSchool(ctx)` (renders the forbidden page for the owner).
- Client components (`"use client"`) are only for interactivity; pass them plain serializable
  props. Call actions through `useAction()` from `@/hooks/use-action`, which shows localized
  error toasts and handles the step-up dialog.
- Every route has a `loading.tsx` skeleton or Suspense fallback, an empty state and a sensible
  error state. Use `notFound()` for missing resources.

### Route handlers

Only for streaming AI responses, file downloads, Better Auth, health and external callbacks.
Use `requireSession()` and return errors with `toErrorResponse()`.

## 5. Internationalization

- No user-visible literal strings in components, pages, actions or errors shown to users.
  Everything goes through `useTranslations("<namespace>")` / `getTranslations("<namespace>")`.
- Each area writes only its own namespace file, in **all 6 locales**, with the same keys.
  Nested keys are fine (`homework.form.title`). Arabic is the reference locale and is checked by
  TypeScript (`src/i18n/types.ts`); `tests/unit/i18n.test.ts` checks the others.
- Real translations, not English copies. Natural Modern Standard Arabic, friendly and clear.
- Use ICU for plurals and variables (`{count, plural, one {# task} other {# tasks}}`).
- The product name is never written literally: use the `{brand}` token in messages.
- Dates, numbers and relative times use next-intl's `useFormatter()` / `getFormatter()`, with
  the Gregorian calendar.
- Error toasts use `common.errors.<CODE>`.

## 6. UI

- Build from `@/components/ui` (shadcn) and `@/components/common`. Do not restyle primitives
  ad hoc; use the design tokens (`bg-background`, `text-muted-foreground`, `bg-primary`, …),
  never raw hex colors.
- **RTL-safe only:** logical utilities (`ms-* me-* ps-* pe-* start-* end-* text-start
text-end border-s border-e rounded-s rounded-e`). Never `ml/mr/pl/pr/left/right/text-left/
text-right`. Icons that point a direction (arrows, chevrons) get `rtl:rotate-180`.
- Mobile first: every page works at 360px width; tables become cards or scroll horizontally
  inside their container, never the page.
- Accessible: real `<button>`/`<a>`, labels for inputs, `aria-label` on icon-only buttons,
  visible focus, AA contrast in light and dark themes.
- Confirm destructive actions with an `AlertDialog`; report results with `toast` (sonner).
  Never `alert()`/`confirm()`.
- AI output and any user-written rich text render through the sanitized Markdown component
  (`@/components/common/markdown`), never `dangerouslySetInnerHTML`.

## 7. AI

- Only `@/server/services/ai`. Every call names a `feature` (used for usage/cost reporting),
  passes the actor (quota + usage accounting) and a model tier (`fast` | `smart`).
- Structured output uses zod schemas (no regex JSON parsing).
- Prompts answer in the user's UI language unless the feature says otherwise.
- Tests never call the real provider: use the mock helpers exported by the AI service.
- When the provider key is missing, features fail with `AI_NOT_CONFIGURED` and the UI shows
  `common.errors.AI_NOT_CONFIGURED` instead of crashing.

## 8. Security checklist (legacy bugs that must never come back)

- Plaintext or retrievable passwords anywhere (DB, API, logs, exports). New passwords are shown
  once.
- Missing tenant scoping: an admin seeing/changing another school; a manager-only endpoint
  reachable by an admin; a missing `school_id` meaning "all schools".
- Test answers sent before submission; client-reported scores or stars. Scores and stars are
  computed on the server; stars go through the star ledger with daily caps.
- IDOR: reading another user's conversation/submission/result by id.
- AI caches mixing users' personal replies.
- Unescaped HTML or proxied third-party pages that can run script with our origin.
- Seeded or hard-coded credentials.

## 9. Tests

- `tests/unit/**` — pure logic, no DB. `tests/api/**` — module functions against a real MariaDB.
- API tests start with `await resetDatabase()` in `beforeAll` and build data with
  `tests/api/fixtures.ts` (`createSchool`, `createUser`, `contextFor`).
- Each area has its own files: `tests/api/<area>*.test.ts`, `tests/unit/<area>*.test.ts`.
- Cover: the happy path, the authorization rules (other school, other teacher, wrong role,
  inactive), validation, and every legacy bug fix in §8 that the area touches.
- Run against your own database so parallel work never collides:
  `TEST_DATABASE_URL=mysql://root@127.0.0.1:3306/axis_test_<area> npm run test:api`.

## 10. Definition of done

1. `npm run typecheck`, `npm run lint` and `npm test` pass; the area's API tests pass.
2. Every route the area owns exists, is reachable from the sidebar where listed, and has
   loading, empty and error states.
3. Every legacy feature of the area is ported (or consciously dropped and reported), with the
   legacy bugs fixed.
4. All strings are translated in 6 locales; RTL and LTR both look right; mobile works.
5. Authorization is enforced in the module functions and covered by tests.
6. No `any`, no `@ts-ignore`, no `eslint-disable` without a written reason, no dead code,
   no `console.log` left behind.
