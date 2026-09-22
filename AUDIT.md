# wec-pinnote-lib — Deep-Dive Audit

**Audited:** 2026-09-22 · **Scope:** `src/` (6,701 LOC TS/TSX + 3,349 LOC CSS across 85 files), `docs/`, `examples/demo`, build and packaging config.
**Method:** six independent parallel audits (accessibility, UI/UX, code quality/architecture, security, performance, features/API-DX, state/testing/hygiene), each evidence-based with `file:line` citations, then cross-verified against the source by the coordinating session.
**Nothing in the repository was modified.**

> **Working-tree caveat.** 33 files were uncommitted at audit time. The entire `Auth/`, `UserManagement/` and `primitives/` layers are **untracked** — never committed, never reviewed. Findings reflect the working tree, not `HEAD`.

---

## Verdict

A **competent, carefully-built single-player annotation overlay** with a genuinely above-average DOM-anchoring engine, strict TypeScript, and a clean bring-your-own-backend seam. It is held back by four things: it is **unusable without a mouse**, roughly **a third of it is non-functional mock code that ships to consumers**, its **built-in login blocks the primary integration path**, and it has **zero tests and zero CI**.

Both quality gates the project defines for itself pass clean — `npx tsc --noEmit` and `npx eslint .` each exit 0, with zero `any`, zero non-null assertions and zero `eslint-disable` comments in `src/`. The gaps are overwhelmingly in checks that _do not exist_.

| Dimension            | Grade  | One-line summary                                                                 |
| -------------------- | ------ | -------------------------------------------------------------------------------- |
| Code quality & types | **B+** | Strict TS done properly; `noUncheckedIndexedAccess` respected throughout         |
| DOM anchoring        | **A−** | The standout: five-tier identity ladder, reasoned fallbacks, honest orphan state |
| Security             | **C**  | No XSS; but tokenless self-asserted identity and name-based authorization        |
| Performance          | **C−** | 44% of bundle is one PNG; observer churn; per-mousemove forced reflow            |
| UI/UX                | **C**  | Strong empty/optimistic states; data-loss flows and no responsive story          |
| Accessibility        | **D**  | No focus trap in any of 6 dialogs; keyboard-trapping annotation mode             |
| Features vs. peers   | **C−** | No realtime, attachments, mentions or context capture                            |
| API & DX             | **C+** | Real adapter seam, undersold; built-in auth blocks adoption                      |
| Testing & CI         | **F**  | No test file, no runner, no CI workflow                                          |

---

## P0 — Fix before any further adoption

### 1. Annotation mode traps keyboard users

`AnnotationOverlay.tsx:69-73` installs a capture-phase handler that `preventDefault` + `stopImmediatePropagation`s **Enter and Space on every host element**, with no `Escape` branch anywhere in the overlay. Host UI becomes focusable-but-dead, and there is no keyboard way to exit the mode.

Mitigating detail (verified): a keyboard-activated click _is_ handled — `AnnotationOverlay.tsx:63-66` detects `clientX === 0 && clientY === 0` and creates a pin at the focused element's center. So pin _placement_ has a keyboard path; **exiting the mode does not**. WCAG 2.2 SC 2.1.1, 2.1.2.

### 2. No dialog has a focus trap or focus restoration

Verified by grep: **zero** occurrences of `activeElement`, `inert` or any focus-trap logic in `src/`. All six dialogs (`LoginDialog`, `ConfirmDialog`, `UserFormModal`, `CreateEpicModal`, `CreateUserStoryModal`, `CreateEpicNoteModal`) let Tab walk out behind a `rgba(0,0,0,0.6)` scrim onto controls the user cannot see, and return focus to `<body>` on close. `ConfirmDialog` and `LoginDialog` additionally lack `aria-modal` (the other four have it). APG Modal Dialog; SC 2.4.3, 2.4.11.

### 3. Built-in login blocks the documented integration path

`AnnotationProvider.tsx:57-62` — `setModeEnabled` **silently returns** when there is no `activeAccount`. A host that already authenticated its user and passed `currentUser` still cannot annotate until the user logs in _again_ through the library's own dialog. It fails with no error, no message, no indication. This is the single largest adoption blocker.

Compounding: `useAuthSessions.ts:76-95` fires `GET /auth/users` **unconditionally on mount**, so a consumer supplying only `apiClient` gets an unexpected request to an endpoint they never intended to serve. Neither `/auth/users` nor `/auth/login` appears in `docs/api-contract.md`.

### 4. Authorization by display-name string comparison

`AnnotationThread.tsx:30` — `const canEdit = comment.createdBy.name === currentUser.name;`

`AnnotationUser` carries a stable `id` (`annotation.types.ts:24`) that is deliberately ignored. Two users named "Alex Chen" can edit and delete each other's comments; renaming yourself forfeits edit rights on your own history. `docs/api-contract.md:222` documents this as intentional ("name-based, not id-based"), which makes it a design decision to reverse rather than an oversight. **One-token fix.**

### 5. ~32% of the library is non-functional mock code that ships

Measured: EpicFlow 1,104 + UserManagement 675 + seed data 300 + their types 71 = **2,150 of 6,701 TS/TSX lines**.

- Verified: **zero** `fetch`/`apiClient` calls in either feature. All state is `useState` seeded from `src/data/*`; every create/edit/delete is lost on unmount.
- `UserManagementPanel.tsx:140` displays **`Temporary password sent to {email}.`** — no email is sent anywhere in the codebase. A fabricated success message.
- Both are **statically imported** by `AnnotationLayer.tsx:6-7`, so tree-shaking cannot remove them. `UserManagementPanel` is a public export (`index.ts:12`).
- **There is no config flag to disable either** — `AnnotationConfig` has no `showEpicFlow`/`showUserManagement`, so consumers cannot opt out. Both occupy slots in the _collapsed_ launcher (`AnnotationToolbar.tsx:233,249`), the most prominent real estate in the library.
- Twelve fabricated person records with real-format corporate emails (`@wec.ai`) and phone numbers ship inside `dist/index.es.js` (confirmed by grep).

### 6. No tests, no CI

No `*.test.*`/`*.spec.*` in `src/`, no runner in `devDependencies`, no `test` script, no `.github/`. `tsconfig.build.json:13` already excludes test globs — tests were anticipated and never written. Since `prepare: npm run build` runs on git install, **a broken `main` breaks every consumer's `npm install`**, with nothing gating it.

---

## P1 — High

### Performance

**44% of the JS bundle is one decorative PNG.** `src/assets/icons/index.ts:9` imports `wec-logo.png?inline`, forcing base64 embedding: 127,106 of 287,150 bytes in `dist/index.es.js`. Used only for "Powered by Wec.ai" in five places, three with `alt=""`.
_Correction to one agent's claim:_ the other eight PNGs are imported with `?inline` but are **dead code** — only `Icons.wecLogo` is referenced; all UI icons use the inline-SVG `Icon.tsx`. Exactly one base64 payload exists in the bundle, so tree-shaking already dropped them. Deleting them is hygiene, **not** a size win. The single logo is the whole 44%.

**Observer churn.** `useAnnotationPosition.ts:100` depends on `[items, itemsKey]`; `items` is a fresh array identity on every layer render, so the entire observer graph is torn down and rebuilt on every annotation update. Each rebuild observes **every ancestor of every pin** (`:70-80`, O(pins × depth), duplicates not deduped) plus a `MutationObserver` on `document.body` with `subtree: true` (`:82-91`). On any host with an animation or spinner this recomputes all pin positions continuously.

**Per-mousemove forced reflow.** `AnnotationOverlay.tsx:6-12` writes `pointerEvents`, reads `offsetHeight` **specifically to force synchronous layout**, calls `elementFromPoint`, then writes back — on every `pointermove`, unthrottled, each followed by a `setHighlight` re-render.

**Context invalidation.** `AnnotationProvider.tsx:38` memoizes on the `config` **object identity**, and `README.md:194` documents passing an inline object literal — so the documented integration defeats every `useMemo` in the provider. Independently, `clearActionError` is a fresh inline arrow (`useAnnotations.ts:323`) in the context memo's deps, so **the context `useMemo` can never hit**. Every consumer re-renders on every host render.

**Published sourcemaps.** `vite.config.ts:34` sets `sourcemap: true` and `files` ships all of `dist`. Verified: `sourcesContent` contains full source for all 52 modules — 945 KB of maps beside 517 KB of JS, roughly tripling install size and publishing the entire implementation.

### Correctness

**Stale-snapshot rollback (4 sites).** `useAnnotations.ts:198, 239, 280, 302` each capture `const snapshot = annotations` and restore the **whole list** on failure (`:229, 252, 292, 309`). The optimistic write correctly uses a functional updater; the rollback does not. A failed status change can resurrect a just-deleted comment or wipe a just-added one. Systematic — one consistent refactor fixes all four.

**Duplicate pin numbers.** `nextNumber(annotations)` (`useAnnotations.ts:99`) reads the render closure; two creates before the first commit compute the same number, and `docs/table-query.md:72` declares `UNIQUE (project_id, page_key, number)` — the second POST 409s. The allocation is duplicated at `AnnotationProvider.tsx:98`, so draft and optimistic numbering can disagree.

**Error boundary protects the wrong scope.** `AnnotationProvider.tsx:251-262` wraps only the portaled `<AnnotationLayer />`. Everything riskier runs _outside_ it — `useAnnotationCollection`, `useAuthSessions` (`JSON.parse` of localStorage), `usePageKey` (host callback), and `createPortal` itself. A throw in any of those unmounts **the host application's entire tree**, inverting the guarantee the boundary exists to provide.

**Mutations carry no abort signal.** Verified: all seven mutation call sites pass none, though the client accepts one. No timeout anywhere either — a hung backend leaves the optimistic UI stuck permanently.

**No runtime validation at the trust boundary.** `annotationApi.ts:101` (`JSON.parse(text) as T`), `authApi.ts:31,48`. `parseListPayload` checks only `Array.isArray`. `roleId` flows from the wire into the session with no enum check.

### Security

No XSS was found, and the rich-text path is genuinely well-designed — see Strengths. The real issues are identity and authorization:

**Tokenless, self-asserted identity.** `AuthSession` (`auth.types.ts:12-19`) contains **no token and no expiry** — only profile fields. `login()` returns a user object; `useAuthSessions.ts:34` persists it to `localStorage`, whose `readStored` validates only `Array.isArray(parsed.accounts)`. Any script in the host origin can write `wpn-auth:<projectId>` with `roleId: "super_admin"` and the library adopts it. "Logout" is purely local — there is nothing to revoke. Sessions never expire.

_Severity note:_ because no credential is stored, this is **not** token theft. It is forgeable client-side identity plus PII at rest. The library's own docs are candid (`docs/api-contract.md:138`: "the library has no real auth"), and `README.md:177` correctly defers authorization to the backend — the right posture. The defect is that the client presents this as authentication.

**Client-asserted authorship.** Verified at `useAnnotations.ts:163-167`: `authorId` and `authorName` are chosen by the client and sent in the body; `:168` then overwrites the server's `createdBy` with the local user, discarding any server canonicalization. The server should derive authorship from the authenticated principal.

**Unauthenticated user-directory enumeration.** `authApi.ts:24` calls `GET /auth/users` with no `Authorization` header and `LoginDialog` renders the result as a pick-list — names, emails, roles and organizations for every user.

**No role gating.** `roleId` is used only for a filter and a display pill. A `viewer` session sees the identical admin surface. Harmless today (mock-only), a live privilege-escalation path the moment it is wired to a real endpoint.

### Accessibility (beyond P0)

- **Focus ring invisible on light backgrounds.** `annotation.css:37` — `#c4b5fd` measures **1.85:1 on white** (needs 3:1). Fine on the library's dark panels, but the toolbar, pins and toast sit directly on host content. SC 1.4.11.
- **Pins have no identity.** `AnnotationPin.tsx:35` gives every pin the same name — `"Open comment"`. Twenty pins, twenty identical buttons. The number, author, status and element label are all available and none reach AT. Status is conveyed by hue alone (SC 1.4.1).
- **No live regions for async change.** Zero `aria-live` in the codebase; no `.wpn-sr-only` utility exists. Loading, posted replies, deletions, filter results and the inline error+Retry are all silent. SC 4.1.3.
- **Status chips fail contrast:** `#d97706` on `#fffbeb` = 3.07:1; `#059669` on `#ecfdf5` = 3.58:1; dark-menu options 2.88–3.80:1. All at 11px, so the large-text allowance does not apply. SC 1.4.3.
- **No landmarks or headings.** Every panel title is a `<span>`; no `role="toolbar"`, no `role="complementary"`. The library is unreachable by landmark navigation.
- **`useEscapeKey` steals Escape globally** (`useEscapeKey.ts:8-16`): capture-phase on `document` with unconditional `stopPropagation`, so host modals never see Escape, and stacked library dialogs all close at once.
- **`SearchableSelect` combobox is mis-wired** — `role="combobox"` on the button while focus moves to a different input; `activeIndex` drives the highlight but no `aria-activedescendant` is ever set. Used in 8 places. Its clear control is a `<span aria-hidden="true">` with a pointer-only handler, nested inside a button (invalid HTML).
- **No `forced-colors` support**; structure depends on `rgba()` and `box-shadow`, both suppressed in High Contrast.
- **Three unlabelled textareas** — `AnnotationReplyComposer.tsx:29`, `AnnotationComposer.tsx:123`, `AnnotationThread.tsx:45` (the last has neither label nor placeholder).

### UI/UX

- **Unsaved comments are destroyed silently.** `cancelDraft` and `selectAnnotation` discard draft text with no confirmation — clicking a second pin or navigating loses it. The most damaging loss possible in a commenting tool.
- **Armed delete targets the wrong annotation.** `AnnotationThreadPanel.tsx:36` holds `confirmDelete` in state with **no reset when `annotationId` changes**, and the panel stays mounted across selection changes. Arm delete on A, click pin B, next click deletes B. No Cancel, no undo.
- **Three different destructive-confirm patterns** — modal `ConfirmDialog`, inline two-click swap (no Cancel), inline Confirm/Cancel chips.
- **Empty state and error render simultaneously.** `AnnotationListPanel.tsx:51` gates on `!loading` but not `!error`, so a failed fetch shows "No comments on this page." beneath the error banner — the library states there are none when it simply failed.
- **Essentially no responsive story:** 2 media queries in 3,349 lines; fixed 420/360/320px panels; a ~10-control toolbar with no wrap. Touch targets are 18–32px against a 44px minimum.
- **Pins break under transformed ancestors.** `position: fixed` is not viewport-relative inside a `transform`/`filter`/`will-change` ancestor — common in real apps. No `visualViewport` listener, so pins drift on pinch-zoom.
- **Page-status failures are swallowed** into `setPageStatusState("review")` (`useAnnotations.ts:74-79`) — an outage is indistinguishable from a genuinely unreviewed page.

### Features & API/DX

- **No realtime** — verified: no WebSocket/SSE/polling/focus-revalidation anywhere. Two reviewers on one page never see each other's comments. The core collaboration use case is broken.
- **No attachments or screenshots** — `AnnotationComment` is `{id, message, createdBy, createdAt, updatedAt}`. This is the feature buyers of Marker.io/BugHerd/Usersnap evaluate first.
- **No context capture** — no UA, URL, console or network metadata. `viewportWidth/Height` is stored on the anchor but never read back.
- **No pagination** — `listAnnotations` takes only `{projectId, pageKey}`; every annotation with every comment arrives in one unbounded response.
- **No mentions, assignment, notifications, reactions, read state, labels, priority or export.** Ironically `Epic`/`UserStory` _do_ have `priority` and `tags` — the mock feature is richer than the real one.
- **The adapter seam is real but undersold.** `apiClient`/`authClient` injection genuinely works end-to-end (proven by `examples/demo`), yet `README.md:101` labels it _"Advanced/demo override"_ and never documents `authClient`. This is the library's best adoption story, buried in a parenthetical.
- **`apiBaseUrl`/`projectId` are required even with a full `apiClient`.**
- **SSR:** no module-scope DOM access (verified — importing will not crash Node), but no `"use client"` anywhere, and `usePageKey.ts:7` and `useAuthSessions.ts:58` both read `window` in `useState` initializers **during render**. `README.md:117`'s Next.js claim does not hold for the App Router.
- **Exactly one TSDoc comment in `src/`** (`richText.tsx:46`). Not one exported symbol is documented.
- **Missing exports:** `AnnotationContextValue`, `PinScreenPosition`, `PanelPlacement`, `PositionedItem`, `AuthSessionsValue`, `statusLabel`/`ANNOTATION_STATUS_OPTIONS` — all needed to consume the exported hooks.
- **`1.0.0` is not defensible** with no CHANGELOG, no tags, and four pending breaking changes to `AnnotationApiClient`/`AnnotationAnchor`/`AnnotationConfig`.

### Docs & hygiene

- **`docs/table-query.md` documents a different repository** — Postgres DDL for `wec-pinnote-api`, in a client library that advertises "does not connect to a database."
- **`docs/api-contract.md:134-141` describes removed behavior** — a "Your name" toolbar field that no longer exists — and omits both `/auth/*` endpoints the code calls.
- **README omits EpicFlow, User Management and the entire login UI**, all of which render buttons into the consumer's app by default. It lists 5 exports where `index.ts` has 15.
- `.gitignore` does not cover `.claude/`; `.prettierignore` uses `node_modules` rather than `**/node_modules`.
- `react-hooks/exhaustive-deps` is a **warning**, not an error — both major dependency-array defects would have been caught. No `jsx-a11y` plugin, which is why an a11y-heavy overlay lints clean.

---

## Strengths — preserve these

1. **DOM anchoring is the standout.** Five-tier identity ladder with uniqueness verification at each tier (`selectorGenerator.ts:96-154`), a framework-generated-id blocklist that already handles **React 19's changed `useId()` format** (`:6-7`), a bounded ancestor climb with documented rationale (`elementAnchor.ts:14-19`), and honest degradation to a visibly-marked orphan rather than a silently wrong pin.
2. **`richText.tsx` is genuinely XSS-safe** and the comment at `:46` says why. `DOMParser` with `text/html` is inert; the walker is a strict allowlist over `nodeType` that **never reads a single attribute**, so `onerror`/`href`/`src` cannot survive. Verified independently — not a false negative.
3. **Type discipline is excellent.** Strict mode with `noUncheckedIndexedAccess` actually respected (`format.ts:48-49`), zero `any`, zero `!`, zero `eslint-disable`. Uncommon consistency.
4. **The backend really is swappable** — a clean 10-method interface, honored ahead of the default client, proven by a working in-memory implementation in the demo.
5. **Correct abort handling on all read paths** — `AbortController` plus an `ignore` flag, with `AbortError` distinguished from real failures.
6. **Every listener, observer, rAF and timer has a matching cleanup** — traced exhaustively across both audits; no leaks. The churn is a dependency-array bug, not a leak.
7. **Host non-interference is treated as a first-class guarantee** — capture-phase interception, listeners removed on mode exit, `history` methods restored, body class cleaned up, `pointer-events: none` on the root with opt-in children.
8. **CSS is fully namespaced** — all 308 classes under a consistent `wpn-` BEM prefix with tokens scoped to `.wpn-root` (not `:root`), plus a correctly-scoped `prefers-reduced-motion` block and `:focus-visible`-only outlines with no unreplaced `outline: none`.
9. **Zero runtime dependencies**, fully-hashed lockfile, only two expected install scripts. The strongest possible supply-chain posture for an embedded library.
10. **Honest licensing** — `NOTICE` names the upstream project, lists the specific concepts adapted, states the source is not vendored, and ships in `files`.
11. **Optimistic updates with rollback on all seven mutations** — the intent and coverage are right even where the snapshot granularity is wrong.
12. **`Icon.tsx` is exemplary** — `aria-hidden` _and_ `focusable="false"` on every SVG; ~60 `aria-label`s and 82 real `<button>`s against 84 `onClick`s, so interactive elements are semantic rather than click-handling divs.

---

## Recommended sequence

**Now — before the API ossifies**

1. Drop to `0.x`; add `CHANGELOG.md`. _(1h)_
2. `AnnotationThread.tsx:30` → compare `.id`. _(1 line)_
3. Make host-provided `currentUser` sufficient; gate built-in auth behind opt-in; skip the auth fetch when unconfigured. _(P0 #3)_
4. Add `showEpicFlow`/`showUserManagement` flags defaulting to `false`, unexport `UserManagementPanel`, `React.lazy` both panels, delete the fabricated password message. _(P0 #5)_
5. Stand up `vitest` + `jsdom` + CI running the four scripts that already pass. Start with `selectorGenerator`, `elementAnchor`, `positioning`, `elementResolver` — all pure and untested.
6. Freeze wire-format extension points while cheap: tag `AnnotationAnchor` with `kind`, add `attachments` to the comment model, add cursor/limit to `listAnnotations`, add a version precondition to updates.
7. Shared focus-trap + restore hook across all six dialogs; Escape at the layer level; let Escape through the overlay. _(P0 #1, #2)_
8. Fix the focus-ring contrast, name the pins, add `role="status"` regions and a `.wpn-sr-only` utility.

**Next**

9. Drop `?inline` on the logo (−44% bundle); `sourcemap: false`; delete the 8 dead PNGs.
10. Remove `items` from the position-effect deps; dedupe ancestors into a `Set`; rAF-coalesce the pointermove path.
11. Memoize `resolveConfig` on primitives; `useCallback` `clearActionError`; document the stable-`config` requirement.
12. Surgical rollback via functional updates across all four sites; move `nextNumber` inside the updater.
13. Relocate the error boundary to protect the host; add runtime validation and `AbortSignal.timeout` at the API boundary.
14. Realtime adapter with a polling default; attachments; context capture; mentions/assignment.
15. Wire the existing `ListSearchBar`/`SearchableSelect`/`TablePagination` primitives into `AnnotationListPanel` — already built, unused by the core feature.
16. Responsive breakpoints, 44px touch targets, `visualViewport` listeners.
17. Promote the adapter to a first-class README section; TSDoc the public surface; export the missing types; fix `docs/api-contract.md`; move `docs/table-query.md` to the API repo.

**Later**

18. `"use client"` + move the two `useState` initializers out of render; verify against Next App Router.
19. Split the 31-member context into data/UI/auth; normalize comments.
20. Region and text-range anchors; offline queue; edit history; dark mode; i18n; headless mode.

---

## Appendix — verified baseline

| Check                                    | Result                                                                                  |
| ---------------------------------------- | --------------------------------------------------------------------------------------- |
| `npx tsc -p tsconfig.json --noEmit`      | **exit 0**, zero diagnostics                                                            |
| `npx eslint .`                           | **exit 0**, zero errors/warnings                                                        |
| `any` / `!` / `eslint-disable` in `src/` | **0 / 0 / 0**                                                                           |
| Test files · runner · CI                 | **0 · none · none**                                                                     |
| TSDoc blocks in `src/`                   | **1** (`richText.tsx:46`)                                                               |
| `dist/index.es.js`                       | 287,150 B — **127,106 B (44.3%) base64 PNG**                                            |
| Sourcemaps                               | 945 KB, `sourcesContent` for all 52 modules                                             |
| Mock-feature share of `src/`             | **2,150 / 6,701 lines (32%)**                                                           |
| CSS                                      | 3,349 lines · 308 `wpn-`-prefixed classes · 177 custom properties · **2** media queries |
| a11y attributes                          | 60 `aria-label` · 82 `<button>` vs 84 `onClick` · **0** `aria-live` · **0** focus traps |
| Dialogs with `aria-modal`                | **4 of 6**                                                                              |
| Module-scope DOM access                  | **none** (SSR-import-safe)                                                              |
| Runtime dependencies                     | **0** · lockfile fully hashed                                                           |
