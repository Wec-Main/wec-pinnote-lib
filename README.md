# wec-pinnote-lib

![React](https://img.shields.io/badge/React-%3E%3D18-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?logo=vite)
![License](https://img.shields.io/badge/License-Proprietary-red)

Figma-like website annotations and comments for any React application. The library renders the annotation UI, detects DOM elements, positions pins on them, and runs threaded, @mention-aware comment conversations against **your** REST API. It does not connect to a database and does not read host environment variables.

**This README covers integration and user-facing behavior.** For internal technical docs, see:

- [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md) — what this project is and how its docs are organized
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — folder structure, feature domains, build pipeline, state management
- [docs/API_CONTRACT.md](docs/API_CONTRACT.md) — the full backend REST contract
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — scripts, environment setup, testing, adding a feature

---

## Core Principles

1. **The host owns the backend** — every read and write goes to the `apiBaseUrl` you configure; the library has no database access and reads no environment variables of its own.
2. **Element-anchored pins with fallback** — pins attach to a resolved DOM element and keep fallback coordinates, so a missing element degrades to an orphaned pin instead of a lost one.
3. **Router-agnostic page keys** — the current page comes from `getPageKey()` or `window.location.pathname`; no router package is required.
4. **Host or built-in auth** — pass `getAuthToken` to reuse the host's session, or omit it and use the built-in sign-in flow.
5. **Optimistic, recoverable writes** — sends, edits, deletes and status changes appear instantly and roll back if the API rejects them.
6. **SSR-safe** — nothing is portaled until the provider has mounted on the client, and the build ships with a `"use client"` directive.

---

## Setup

This library is **not published to the npm registry**. Install it either from its GitHub repository or from a local checkout on disk.

Peer dependencies: `react` and `react-dom` >= 18.

### Option A: from GitHub

Add it straight to your host app's `package.json` (or run the equivalent `npm install` command) using a git URL instead of a version:

```bash
npm install git+https://github.com/Wec-Main/wec-pinnote-lib.git
# or, pinned to a branch/tag/commit:
npm install git+https://github.com/Wec-Main/wec-pinnote-lib.git#main
```

npm clones the repo, runs its `prepare` script (which runs `npm run build`), and installs it like any other dependency.

### Option B: from a local checkout

Useful when developing the library and a consuming app side by side (for example both cloned under the same parent folder, as `wec-pinnote-lib` and your app).

**B1. As a built package dependency** — build the library once, then point npm at the folder:

```bash
cd wec-pinnote-lib
npm install
npm run build        # produces dist/, which package.json's main/module/types point to

cd ../your-app
npm install ../wec-pinnote-lib
```

npm creates a symlink in `your-app/node_modules/wec-pinnote-lib`. Re-run `npm run build` in `wec-pinnote-lib` after each change; `your-app` picks up the new `dist` output automatically since it's a symlink.

**B2. Alias straight to source (fastest inner loop, no build step)** — resolve the package name directly to `src/index.ts` in your bundler config, so edits to the library are reflected immediately:

```ts
// your-app/vite.config.ts
import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "wec-pinnote-lib/style.css": resolve(
        __dirname,
        "../wec-pinnote-lib/src/styles/annotation.css",
      ),
      "wec-pinnote-lib": resolve(__dirname, "../wec-pinnote-lib/src/index.ts"),
    },
  },
});
```

`examples/demo` in this repository is wired up this way; see it for a full working example.

---

## Configuration

The library owns its own API URL and mock-mode defaults (`WEC_PINNOTE_API_URL` /
`WEC_USE_MOCK_API`, configured in the library's own `.env`). The **host
application** only needs to provide project-specific configuration:

```tsx
import { AnnotationProvider } from "wec-pinnote-lib";
import "wec-pinnote-lib/style.css";

const annotationConfig = {
  projectId: import.meta.env.VITE_ANNOTATION_PROJECT_ID,
  currentUser: {
    id: currentUser.id,
    name: currentUser.name,
    avatarUrl: currentUser.avatarUrl,
  },
  getAuthToken: () => authToken,
  getPageKey: () => window.location.pathname,
};

export function AppRoot() {
  return (
    <AnnotationProvider config={annotationConfig}>
      <App />
    </AnnotationProvider>
  );
}
```

That is enough to enable the floating comment button, annotation mode, pins, threaded comments with replies and @mentions, the comments list, and status changes.

`currentUser` may also carry an optional `role`; a `role` of `admin` or `super_admin` lets that user edit and delete other people's comments in the UI (see [Comments and threads](#comments-and-threads)).

Optional config:

| Field              | Default      | Purpose                                                 |
| ------------------ | ------------ | ------------------------------------------------------- |
| `zIndex`           | `2147483000` | Overlay stacking                                        |
| `enabled`          | `true`       | Hide the entire library                                 |
| `showToggleButton` | `true`       | Set `false` to place `AnnotationToggleButton` yourself  |
| `showPinsWhenIdle` | `true`       | Keep pins visible when annotation mode is off           |
| `showResolved`     | `true`       | Show completed/closed pins                              |
| `apiClient`        | REST client  | Advanced/demo override. The library default is HTTP     |
| `authClient`       | REST client  | Advanced/demo override for the built-in auth API client |
| `trackPageVisits`  | `true`       | Set `false` to turn off page-visit tracking             |

### Event callbacks

`AnnotationConfig` accepts optional callbacks, invoked as the corresponding events happen:
`onAnnotationCreate`, `onAnnotationUpdate`, `onAnnotationDelete`, `onCommentAdd`, `onStatusChange`,
`onError` and `onConnectionStateChange`.

### Page-visit tracking

While a user is signed in (built-in session or host `getAuthToken`), the provider records one visit
per page key: the path without query string or hash, the page title, the referrer's origin and path,
when the view started, visible time on the page, maximum scroll depth, viewport size, browser
language, timezone and a per-tab session id. A view ends when the page key changes, the tab is hidden
or the page is unloaded. Visits are sent in small batches to `POST /analytics/visits` every few
seconds, with a heartbeat at least once a minute while the page is visible, and with
`navigator.sendBeacon` when the tab is hidden or closed. Signed-out users are never tracked, and no
`/analytics` request is made for them.

Set `trackPageVisits: false` to disable collection entirely. How the API stores this data is
described in the "Analytics tables" section of the `wec-pinnote-api` README.

---

## Authentication

If `getAuthToken` is provided, every API request sends:

```http
Authorization: Bearer <token>
```

Tokens are requested per call.

### Host-authenticated mode

Passing `getAuthToken` puts the library in host-authenticated mode: annotations, tags, flow pins,
project tags, EpicFlow and the real-time streams all use the token it returns, the toggle button
and annotation mode are enabled immediately, and the library's built-in `ToolbarAuthControl` /
`LoginDialog` sign-in UI is hidden. Omit `getAuthToken` to use the library's own login flow instead,
backed by `useAuthSessions`.

### Built-in login and token storage

When the host does not supply `getAuthToken`, `ToolbarAuthControl` and `LoginDialog` handle sign-in
themselves. The resulting access token and refresh token are stored in `localStorage`, keyed by
`projectId`, on the host application's own origin. Anyone who can run script on that origin (for
example through an XSS vulnerability elsewhere in the host app) can read those tokens. Prefer
`getAuthToken` with tokens the host already manages securely if this risk is not acceptable.

---

## Page identification

The current page key comes from `getPageKey()`, or `window.location.pathname` if that function is omitted.

The library works with React Router, Next.js, TanStack Router, and custom routing because it does not depend on any router package: it re-reads the page key on `popstate`, `hashchange`, `history.pushState` and `history.replaceState`. When `pageKey` changes it aborts the previous request, clears the previous page, and fetches annotations for the new page.

A screen that changes only in-memory state (a modal, a tab, a wizard step) does not change the pathname, so it keeps the same page key by default and shares its annotations with every other screen on that path. Call `useAnnotationView(name)` inside a screen that should isolate its own annotations from the rest of that page: while mounted, the effective page key becomes `<pageKey>::<name>`, and it reverts to the plain page key on unmount. Nesting views uses the innermost mounted name.

```tsx
function ForgotPasswordModal() {
  useAnnotationView("forgot-password");
  return <div>...</div>;
}
```

---

## DOM anchoring

Pins are attached to elements, not only to screen coordinates.

Preferred identity order:

1. `data-annotation-id`
2. unique stable `id`
3. stable `data-name` / `data-field`
4. unique `name` / `aria-label`
5. generated DOM selector (`nth-of-type` only as a last resort)

Each annotation also stores `relativeX` / `relativeY` plus fallback coordinates. If the original element cannot be resolved, the pin uses the fallback position and is visually marked as orphaned, and its thread shows "Original element is not on screen. Showing fallback position."

For the most stable anchors, add:

```html
<button data-annotation-id="login-submit">Login</button>
```

Two screens that reuse the same markup (a shared modal component used for both a Reset Password and a Recover Username dialog, for example) can otherwise generate colliding selectors: the same relative path from a common ancestor matches the corresponding element in both. Mark each screen's root with the `data-annotation-scope` attribute (its name is exported as `ANNOTATION_SCOPE_ATTRIBUTE`) to scope both capture and resolution to that subtree:

```html
<div data-annotation-scope="login-forgot_password">...</div>
```

When one or more scoped elements are present and visible, only the topmost visible one is active: capture and resolution run against its subtree, and any pin anchored outside every currently active scope, or inside a different scope, does not resolve while that scope is active. An annotation whose element cannot be resolved does not render a pin; it appears in the comment list marked "Not in this view" instead. Adding this attribute is optional and additive — selectors captured with no scope present behave exactly as before.

Elements inside a shadow root or an iframe cannot be captured or resolved; every lookup runs against the top-level document.

---

## Annotation mode

- Mode off: the host app works normally. Existing pins stay visible by default. Clicking a pin opens its thread.
- Mode on: the cursor becomes a crosshair, hover highlights annotatable elements, and a click creates a numbered pin plus composer. The composer lets you pick the new pin's initial status (default Open).
- The intercepted click does not fire the host action. A login button will not submit the form while annotation mode is selecting an element.
- Host listeners are not rewritten. Capture listeners are removed when mode is disabled or the provider unmounts.
- Cancelling a new-pin draft that still holds unsaved text, or jumping to another pin from it, asks "Discard comment?" before throwing the text away.

---

## Comments and threads

Each annotation is a thread: its first comment is the root and every later comment is a reply. Comments are limited to 5000 characters; the composer hint shows `Enter` to send, `Shift`+`Enter` for a new line and `@` to mention, and a character counter once a message reaches 80% of the limit.

### Quote-replies

- Every comment in a thread has a **Reply** action. Choosing it shows a quote of that comment above the reply box (author, relative time, message) and changes the placeholder to "Reply to _name_"; cancel with the × button or `Escape`.
- The reply is sent with `replyToId` set to the quoted comment's id (`CreateCommentRequest.replyToId`, stored on `AnnotationComment.replyToId`).
- Replies render their quote above the message. If the quoted comment no longer exists, the quote reads "Original message was deleted".
- If sending fails, the typed text and the reply target are restored so the reply can be retried.

### @mentions

- Typing `@` (or pressing the **@** button) in the new-comment composer, the reply box or the comment editor opens a suggestion list of up to six people. Candidates are the project's users from `GET /auth/users?projectId=`, excluding the current user, matched by name (or email prefix), with word-prefix matches first.
- Navigate the list with `ArrowUp` / `ArrowDown`, pick with `Enter`, `Tab` or a click, and close it with `Escape`.
- On send, each typed `@Name` that matches a candidate is stored in the message as `@[Name](userId)`. Editing a comment keeps previously mentioned people resolvable even if they are no longer in the candidate list.
- Mentions render as chips, with mentions of the current user highlighted. Quotes and the delete dialog show them as plain `@Name`.

### Status menu

Every annotation has one of five statuses, chosen from a menu that shows a description for each:

| Status           | Description                    |
| ---------------- | ------------------------------ |
| `open`           | New, waiting for triage        |
| `re-open`        | Raised again after a fix       |
| `dev-inprogress` | Being worked on                |
| `completed`      | Fix delivered, ready to verify |
| `closed`         | No further action needed       |

`completed` and `closed` count as resolved (for `showResolved` and the comments-list filters). The menu supports `ArrowUp` / `ArrowDown`, `Home` / `End`, `Enter` / `Space` to choose and `Escape` to close.

### Comments list

`AnnotationListPanel` groups the current page's comments into one **thread card** per annotation: pin number, element label and status chip, the root comment, and a collapsible "_N_ replies" section (the first card's replies start expanded). Cards mark edited comments, dim resolved threads, and open the thread when clicked. Replies to a reply show their quote inside the card.

Filters and sorting:

- **Resolution** — All comments, Unresolved only, Resolved only.
- **Status** — any status currently present on the page.
- **Author** — anyone who commented in a thread.
- **Sort** — Latest activity (default), Oldest first, Pin number, Author A–Z.
- **Only mine** — threads the current user commented in.
- **Clear** — resets every filter.

The panel can be resized (280–760 px) or expanded, and remembers both per project in `localStorage`.

### Editing, deleting and permissions

- A comment can be edited or deleted by its author, or by a `currentUser` whose `role` is `admin` or `super_admin`. Authorization for edit/delete/status changes remains the backend's responsibility.
- Deleting a comment opens a "Delete this comment?" confirmation showing the author and message; nothing is removed until it is confirmed.
- Closing a thread while an edit is unsaved asks "Discard unsaved edit?" first.

### Optimistic updates

Creating an annotation, sending or replying, editing, deleting a comment, changing status and removing an annotation all update the UI immediately: the composer, reply box, editor and confirmation dialog close without waiting for the server. If the API call fails, the change is rolled back (a deleted comment returns to its original position, an edit restores the previous text and reopens the editor), the error is shown as a dismissible toast, and `onError` is called. Pending items survive a concurrent refetch, and in-flight writes are aborted when the signed-in account changes.

---

## Toolbar and launcher

`AnnotationToolbar` has two parts, both draggable and both remembering their position and open/collapsed state per project in `localStorage`:

- **Launcher** (bottom-left) — the Wec logo, which collapses the launcher to the logo alone; the pen button that opens or closes the toolbar; **EpicFlow**; and **Settings**. Panels behind these buttons need a signed-in user.
- **Toolbar** (top-centre) — sign-in control, **Comments** with the pin count, the annotation-mode toggle, show/hide pins, tag mode and show/hide tags, place-a-flow mode and show/hide flows, refresh, a live-updates indicator (reconnecting, or paused until you sign in again), a retry button when loading failed, and close. Closing the toolbar also leaves annotation mode and closes open panels and drafts.

---

## Tags, flows and EpicFlow

- **Tag pins** — with tag mode on, clicking an element opens a picker to attach one of the project's tags to it. Tag pins can be hidden, and removed from the pin itself.
- **Flow pins** — with place-a-flow mode on, clicking an element asks for a flow name and pins a flowchart there. Opening a flow pin shows the flowchart editor (nodes, connections, validation, undo/redo, fit view); **Save** and **Publish** ask for confirmation and close at once, reporting success or failure afterwards. **Delete this flow?** removes the pin immediately and restores it with an error toast if the API rejects the delete.
- **EpicFlow** — a board of epics and their user stories, with live updates through `useEpicFlowStream`.

---

## Settings

`SettingsPanel` is opened from the launcher. Which tabs appear depends on the signed-in user's role: organization managers see **Users**, **Organizations**, **Projects**, **Tags**, **Audit history** and **Dashboard** (page-visit analytics); users who can manage tags see **Users** and **Tags**; everyone else sees **Users**. Destructive actions in these tabs ask for confirmation first.

---

## AI agents (Claude and Codex)

AI chat, the inline AI bar in the data-model and flow editors, and the comment-thread actions (summarise, draft reply) run on a **Claude** or **Codex** account. The agents run inside the Pinnote API server; there is nothing to install or run on the user's computer. Each agent can be connected two ways: **personally** (the user's own subscription or API key, used only by them) or **shared** by an admin for the whole organization (used by everyone without their own connection). A user's own connection always wins.

Agents are connected in **Settings → Integrations**, which has two tabs:

- **Connectors** — one card per agent saying which account is in use ("Using your account" / "Using your organization's shared account · connected by …" / "Not connected"), with the user's own **Connect** / **Disconnect**. Admins also get a separate **Shared with everyone** row per card (**Connect for everyone** / **Disconnect shared**, confirmed because it affects everyone without their own connection). **Connect** opens the _Connect {agent}_ dialog: admins pick **Connect for: Just me | Everyone**, then a method card (subscription or API key):
  - Claude subscription: a three-step guide — **Open Claude sign-in** (new tab), copy the code Claude shows, paste it (with a **Paste** button) and **Connect**. A chip shows when the sign-in link expires and offers a new one.
  - Codex subscription: copy the one-time device code, **Open ChatGPT** and approve there; the dialog finishes by itself from the AI stream.
  - API key: paste an Anthropic / OpenAI key (show / hide) and **Save and connect**.

  Closing the dialog (Esc, ×, Cancel) cancels a sign-in that is still running. Below the cards is the default model for new chats.

- **Connections** — **Your connections** (Check now, Reconnect, Disconnect) and **Shared with your organization** (connected by; manageable by admins, read-only for everyone else).

Until an agent is connected, AI entry points say "Connect Claude or Codex in Settings → Integrations, or ask an admin to connect it for everyone" and link there (`useAiUi().openIntegrations("connectors")`). Connector state comes from `GET /ai/me` (`me.connectors`, `me.systemConnectors`) and is kept live by the `ai_connectors.updated` and `ai_connector_login.updated` stream events — nothing is polled. The routes are listed in [docs/API_CONTRACT.md](docs/API_CONTRACT.md#ai-connectors-api-contract).

The op appliers are loaded on demand so they stay out of the main bundle: `applyErdOps`, `applyFlowOps` and `applyBatchToDocument` are **async** and return a `Promise`. Op batches can be in the `applying` status (another client is applying them); status updates are compare-and-set, so a `409` with code `op_batch_status_conflict` makes the client refetch the batch with `fetchAiOpBatch` (`GET /ai/op-batches/{aiOpBatchId}`) and adopt the server's status.

---

## Public API

Core annotation overlay:

```ts
import {
  AnnotationProvider,
  AnnotationToggleButton,
  AnnotationListPanel,
  AnnotationToolbar,
  useAnnotations,
  useAnnotationMode,
} from "wec-pinnote-lib";
```

`useAnnotations()` returns the current page annotations, `pageKey`, `connectionState`,
loading/error/retry, selection (`selectedId`, `selectAnnotation`), the mutation helpers
`createAnnotation`, `addComment(annotationId, message, replyToId?)`, `editComment`, `removeComment`,
`setStatus` and `removeAnnotation`, and `actionError`/`clearActionError` to surface a failed mutation.

For narrower re-renders than `useAnnotationContext` (which combines everything), use the split
context hooks: `useAnnotationData` (annotations, mutations, tags, flow pins), `useAnnotationUi`
(mode, drafts, panel visibility) and `useAnnotationAuth` (accounts, login/logout, host-auth state).

Optional panels, mounted the same way as `AnnotationToggleButton`:

- `UserManagementPanel`, `SettingsPanel`, `AuditHistoryPanel` — admin surfaces for user, project/organization/tag and audit-log management.
- `LoginDialog`, `ToolbarAuthControl` — the built-in sign-in flow, used when the host app has no auth UI of its own; hidden automatically in host-authenticated mode.

Real-time updates:

- `useAnnotationStream` / `applyStreamEvent` — live annotation and comment updates. Takes `getAuthToken` and `sessionKey` (not a raw token) so the stream reconnects on session changes without losing its place.
- `useEpicFlowStream` / `applyEpicFlowStreamEvent` — live epic and user-story updates for the EpicFlow board. Also takes `sessionKey`.
- `createEpicFlowApi` / `useEpicFlowApi` / `EpicFlowApiClient` / `EpicFlowApiError` — the EpicFlow REST client, exposed for hosts that call it directly.

Clients and services, for hosts that call the API directly: `createAnnotationApi`, `useAnnotationApi`,
`createAuthApi`, `useAuthSessions`, `AnnotationApiError`, plus the user, organization/project, tag,
annotation-tag, audit and analytics request functions (for example `fetchUsers`, `fetchProjects`,
`fetchTags`, `fetchAuditPage`, `fetchAnalyticsOverview`, `downloadAnalyticsVisitsCsv`).

Every exported type (`Annotation`, `AnnotationComment`, `CreateCommentRequest`, `AuthSession`, `ManagedUser`, `Organization`, `ProjectTag`, `AuditRecord`, `AnnotationContextValue` and its `Data`/`Ui`/`Auth` slices, `AuthSessionsValue`, `Epic`, `UserStory`, and their request/response shapes) is available from the package root and discoverable through editor autocomplete; this README does not duplicate the type signatures.

---

## SSR and Next.js

`AnnotationProvider` is safe to render on the server: browser-only APIs are guarded for a missing
`window`, and the overlay is only portaled into `document.body` after the provider has mounted on the
client. The compiled output (`dist/index.js`, `dist/index.es.js` and their chunks) starts with a
`"use client"` directive, so it can be imported directly from a Next.js App Router client component:

```tsx
"use client";

import { AnnotationProvider } from "wec-pinnote-lib";
```

---

## API contract

The library calls these annotation endpoints. Full request/response shapes live in [docs/API_CONTRACT.md](docs/API_CONTRACT.md).

- `GET /annotations?projectId=&pageKey=`
- `POST /annotations`
- `GET /annotations/{annotationId}`
- `POST /annotations/{annotationId}/comments` (body: `message`, optional `replyToId`, `authorId`)
- `PATCH /annotations/{annotationId}`
- `DELETE /annotations/{annotationId}`
- `PATCH /annotations/{annotationId}/comments/{commentId}`
- `DELETE /annotations/{annotationId}/comments/{commentId}`

Mention candidates come from `GET /auth/users?projectId=`, and page visits go to `POST /analytics/visits`.

Authorization for edit/delete/resolve remains the backend's responsibility.

---

## Example project

`examples/demo` is the canonical example for checking `wec-pinnote-lib` integration — a minimal login/home app whose Vite config aliases `wec-pinnote-lib` straight to this package's own `src/`. It defaults to the real `wec-pinnote-api` backend; set `WEC_USE_MOCK_API=true` in this library's own `.env` to use the bundled in-memory mock instead.

```bash
npm run demo
```

or, from inside the folder:

```bash
cd examples/demo
npm install
npm run dev
```

---

## Project Structure

```text
wec-pinnote-lib/
├── src/
│   ├── index.ts                  # Public exports — the ONLY public entry point
│   ├── context/                  # AnnotationProvider (mounting root) + split Data/Ui/Auth contexts
│   ├── features/                 # One folder per domain — each owns its own components/ (and,
│   │   │                         #   where relevant, its own context). No index.ts barrels — see
│   │   │                         #   docs/ARCHITECTURE.md §3.
│   │   ├── annotation/            # Pins, threads, comments, tags-on-page, toolbar, overlay —
│   │   │                          #   includes AnnotationLayer, the orchestration root
│   │   ├── ai/                    # AI dock, op system (ai/ops/), session stores, AiStreamHub
│   │   ├── erd/                   # Data-model (ERD) editor → DataModelPanel
│   │   ├── flowchart/             # Flowchart editor ("WecFlow") → WecFlowPanel
│   │   ├── epicFlow/              # Kanban board → EpicFlowPanel
│   │   ├── flowPin/               # Flow pins placed on page elements
│   │   ├── tags/                  # Tag pins placed on page elements
│   │   ├── settings/              # SettingsPanel — organizations, projects, tags, dashboard
│   │   ├── userManagement/        # UserManagementPanel
│   │   ├── auditHistory/          # AuditHistoryPanel
│   │   └── auth/                  # LoginDialog, ToolbarAuthControl
│   ├── components/                # Shared/generic UI only — primitives/, Loading/, Versions/
│   ├── hooks/                     # Flat — one use*.ts per concern (see ARCHITECTURE.md §4)
│   ├── services/                  # Flat — one <domain>Service.ts REST client per concern
│   ├── types/                     # Flat — one <domain>.types.ts per concern
│   ├── utils/                     # Mostly flat; utils/erd/ and utils/flowchart/ stay as
│   │                               #   multi-file subsystems (engine, geometry, DDL, validation)
│   ├── config/                    # env.ts — the library's own build-time env (not the host's)
│   ├── assets/icons/              # Bundled icons
│   └── styles/                    # Plain CSS, concatenated into dist/style.css
├── test/                          # Vitest suites (flat, "node" + "dom" projects)
├── docs/                          # ARCHITECTURE.md, API_CONTRACT.md, DEVELOPMENT.md, PROJECT_OVERVIEW.md
├── examples/demo/                 # Integration example app (aliased to src/, not dist/)
├── vite.config.ts
├── tsconfig.json / tsconfig.build.json
└── package.json
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full technical breakdown of this layout —
why logic folders stay flat while UI is grouped by feature, the barrel policy, state management
patterns, and the build pipeline.

---

## Getting Started

```bash
npm install
npm run dev            # Rebuild the library on change (vite build --watch)
npm run typecheck      # TypeScript --noEmit
npm run lint           # ESLint (lint:fix to autofix)
npm run format:check   # Prettier check (format to write)
npm test               # Vitest
npm run build          # Library build + type declarations
npm run demo           # Run examples/demo
npm run demo:build     # Build examples/demo
```

Build output:

- `dist/index.js` (CommonJS)
- `dist/index.es.js` (ES module)
- `dist/index.d.ts`
- `dist/style.css`

The admin panels (settings, user management, audit history, EpicFlow) are split into their own chunks next to these entry files.

---

## License

Proprietary. Copyright (c) 2026 Wec.ai. All rights reserved. See [LICENSE](LICENSE) for the full terms.
