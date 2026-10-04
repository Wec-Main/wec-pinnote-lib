# wec-pinnote-lib

A React component library (Figma-like website annotations, EpicFlow kanban, ERD editor, flowchart
editor, settings/admin, AI dock). Published as `wec-pinnote-lib`, consumed by host apps via
`src/index.ts` — never via `dist/` directly in this repo's own dev loop. Full docs live in
[docs/](docs/) — read [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md) first if you're
unfamiliar with this repo; it's the index into everything else.

## Before doing anything non-trivial

1. **Read the relevant doc first.** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the code is
   organized and why; [docs/features/](docs/features/) for how a specific feature
   (annotation/epicFlow/erd/flowchart/settings/ai) actually works end to end, including its AI
   integration. These docs are detailed and were adversarially verified against the code — trust them
   over guessing from file names.
2. **Verify after changing anything**: `npm run typecheck && npm run lint && npm run build`. `npm test`
   currently has pre-existing failures unrelated to most changes (in-progress ERD/AI feature work) —
   check [docs/DEVELOPMENT.md Known Gaps](docs/DEVELOPMENT.md#known-gaps) before assuming a failing
   test is something you broke. The `/verify` skill runs all of this in one pass with a clear report.

## Architecture conventions (don't violate these without a reason)

- **Organize by feature, not by kind.** UI lives in `src/features/<domain>/components/`. Logic
  (`hooks/`, `services/`, `types/`, `utils/`) stays flat and top-level — see
  [ARCHITECTURE.md §4](docs/ARCHITECTURE.md#4-why-logic-folders-stay-flat) for why. `utils/erd/` and
  `utils/flowchart/` are the one deliberate exception (multi-file subsystems).
- **No `index.ts` barrels for components, ever** — except `features/ai/ops/index.ts`, which is a real
  multi-module registry, not a thin wrapper. If a component folder exists, it's because the component
  genuinely has several files; import the specific file you need directly. See
  [ARCHITECTURE.md §3](docs/ARCHITECTURE.md#3-barrel-indexts-policy).
- **`services/*.ts` are named `<domain>Service.ts`** (`erdService.ts`, `authService.ts`), except the
  handful of cross-cutting infra files (`apiClientFactory.ts`, `httpClient.ts`, `streamApi.ts`,
  `actorIdentity.ts`).
- **Only `src/index.ts` defines the public API.** Being reachable from inside `src/features/` does
  not make something public. Adding or changing a public export always means deciding it belongs in
  the published contract, not just wiring it through internally.
- **`verbatimModuleSyntax: true`** — type-only imports/exports must use `import type`/`export type`
  or inline `type` specifiers. A plain `import { SomeType }` where `SomeType` is only a type will fail
  the build, not just lint.
- **If you move or rename a file under a lazy-loaded panel's directory**
  (Settings/UserManagement/AuditHistory/EpicFlow/ai-ops-apply), check `vite.config.ts`'s
  `lazyPanelDirectories`/`sharedPanelModules` — they're plain string matches against resolved module
  ids, not real imports, so nothing will type-error on a stale path; the panel will just silently stop
  being code-split correctly.
- **A test file that reads another file by literal path for static analysis** (e.g.
  `test/aiOpsSchema.test.ts`'s import-graph check) won't follow a rename either — same failure mode,
  update the literal by hand.

## Commands

| | |
| --- | --- |
| `npm run dev` | Watch-rebuild `dist/` |
| `npm run typecheck` | `src/` only — not `test/`, not `examples/demo/` (see Known Gaps) |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run format` / `format:check` | Prettier |
| `npm test` | Vitest — two projects, `node` and `dom` (`happy-dom`) |
| `npm run build` | Full build incl. `.d.ts` |
| `npm run demo` | `examples/demo`, aliased to `src/`, not `dist/` |

## Known sharp edges

See [docs/DEVELOPMENT.md Known Gaps](docs/DEVELOPMENT.md#known-gaps) for the live list (CSS catch-all
file, no CI, test/ layout, examples/demo vs. real dist, an in-progress ERD export/codegen feature).
Don't silently "fix" something flagged there mid-way through an unrelated task without flagging it —
some of these are deliberate/deferred, not oversights.

## This repo's sibling

`wec-pinnote-api` (sibling directory, separate git repo) is the backend this library talks to over
HTTP/SSE — see [docs/API_CONTRACT.md](docs/API_CONTRACT.md) for the contract. A change to an
endpoint's shape needs both sides updated; this repo's typecheck/tests can't catch a backend-side
contract break.
