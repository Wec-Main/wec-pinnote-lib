# wec-pinnote-lib

![React](https://img.shields.io/badge/React-%3E%3D18-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?logo=vite)
![License](https://img.shields.io/badge/License-Proprietary-red)

Figma-like website annotations and comments for any React application. The library renders the annotation UI, detects DOM elements, positions pins on them, and runs threaded, @mention-aware comment conversations against **your** REST API. It does not connect to a database and does not read host environment variables.

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

This library is **not published to the npm registry**; install it from its GitHub repository.

Peer dependencies: `react` and `react-dom` >= 18.

### Install from GitHub

Add it straight to your host app's `package.json` (or run the equivalent `npm install` command) using a git URL instead of a version:

```bash
npm install git+https://github.com/Wec-Main/wec-pinnote-lib.git
# or, pinned to a branch/tag/commit:
npm install git+https://github.com/Wec-Main/wec-pinnote-lib.git#main
```

npm clones the repo, runs its `prepare` script (which runs `npm run build`), and installs it like any other dependency.

---

## Configuration

Read environment variables in the **host application**, then pass them into `AnnotationProvider`.

```tsx
import { AnnotationProvider } from "wec-pinnote-lib";
import "wec-pinnote-lib/style.css";

const annotationConfig = {
  apiBaseUrl: import.meta.env.VITE_ANNOTATION_API_URL,
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
`fetchTags`, `fetchAuditPage`, `fetchAnalyticsSummary`, `downloadAnalyticsVisitsCsv`).

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

The library calls these annotation endpoints. Full request/response shapes live in [docs/api-contract.md](docs/api-contract.md).

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

`examples/demo` is the canonical example for checking `wec-pinnote-lib` integration — a minimal login/home app whose Vite config aliases `wec-pinnote-lib` straight to this package's own `src/`. It defaults to the real `wec-pinnote-api` backend; set `VITE_USE_MOCK_API=true` in `examples/demo/.env` to use the bundled in-memory mock instead.

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
│   ├── index.ts                  # Public exports — the package root
│   ├── context/                  # AnnotationProvider, split Data/Ui/Auth contexts, FlowContext
│   ├── components/
│   │   ├── AnnotationLayer.tsx    # Portaled overlay root: pins, panels, dialogs, toasts
│   │   ├── AnnotationOverlay/     # Annotation mode — hover highlight, click capture
│   │   ├── AnnotationPin/         # Numbered pin, orphaned styling
│   │   ├── AnnotationComposer/    # New-pin composer with initial status
│   │   ├── AnnotationThreadPanel/ # Floating thread panel, delete confirmation
│   │   ├── AnnotationThread/      # Comment list with reply/edit/delete actions
│   │   ├── AnnotationReplyComposer/ # Reply box with quote target
│   │   ├── AnnotationStatusSelect/  # Status menu with descriptions
│   │   ├── AnnotationListPanel/   # Comments list — ThreadCard, commentFilters
│   │   ├── CommentQuote/          # Quoted comment preview
│   │   ├── CommentMessage/        # Message renderer with mention chips
│   │   ├── MentionTextarea/       # Textarea with @mention suggestions
│   │   ├── ComposerHint/          # Keyboard hint and character counter
│   │   ├── AnnotationToggleButton/, AnnotationToolbar/, AnnotationErrorBoundary/
│   │   ├── Auth/                  # LoginDialog, ToolbarAuthControl
│   │   ├── Settings/              # SettingsPanel — organizations, projects, tags, dashboard
│   │   ├── UserManagement/        # UserManagementPanel, ConfirmDialog
│   │   ├── AuditHistory/          # AuditHistoryPanel
│   │   ├── EpicFlow/              # Epic / user-story board
│   │   ├── WecFlow/               # Flowchart editor
│   │   ├── FlowPin/, TagPin/      # Flow and tag pins
│   │   └── primitives/            # Menu, Tooltip, SearchableSelect, ModalShell, …
│   ├── hooks/                    # useAnnotations, useAnnotationMode, useAuthSessions, streams,
│   │                             #   usePageKey, usePageVisitTracker, useMentionCandidates, …
│   │   └── flowchart/            # Flowchart editor hooks
│   ├── services/                 # REST clients — annotations, auth, analytics, users, tags, …
│   ├── types/                    # Domain and request/response types
│   ├── utils/                    # status, mentions, anchoring/selectors, page keys, permissions, …
│   │   └── flowchart/            # Flowchart engine, geometry, validation
│   ├── data/                     # Static option lists
│   ├── assets/icons/             # Bundled icons
│   └── styles/                   # annotation.css (→ dist/style.css), flowchart.css
├── test/                         # Vitest suites
├── docs/api-contract.md          # Backend contract
├── examples/demo/                # Integration example app
├── vite.config.ts
├── tsconfig.json / tsconfig.build.json
└── package.json
```

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

Proprietary. Copyright (c) 2026 Wec Technologies. All rights reserved. See [LICENSE](LICENSE).
