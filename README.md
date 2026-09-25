# wec-pinnote-lib

Figma-like website annotations and comments for any React application.

The library renders the annotation UI, detects DOM elements, positions pins, and talks to **your** REST API. It does not connect to a database and does not read host environment variables.

## Installation

This library is **not published to the npm registry**. Install it either from its GitHub repository or from a local checkout on disk.

Peer dependencies: `react` and `react-dom` >= 18.

### Option A: from GitHub

Add it straight to your host app's `package.json` (or run the equivalent `npm install` command) using a git URL instead of a version:

```bash
npm install git+https://github.com/Wec-Main/wec-pinnote-lib.git
# or, pinned to a branch/tag/commit:
npm install git+https://github.com/Wec-Main/wec-pinnote-lib.git#main
```

npm clones the repo, runs its `prepare`/`build` step, and installs it like any other dependency.

### Option B: from a local checkout

Useful when developing the library and a consuming app side by side (e.g. both cloned under the same parent folder, as `wec-pinnote-lib` and your app).

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

`examples/demo` in this repository is wired up this way — see it for a full working example.

## Configuration

Read environment variables in the **host application**, then pass them into `AnnotationProvider`.

```ts
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

That is enough to enable the floating comment button, annotation mode, pins, threads, replies, and resolve/reopen.

Optional config:

| Field              | Default      | Purpose                                                |
| ------------------ | ------------ | ------------------------------------------------------ |
| `zIndex`           | `2147483000` | Overlay stacking                                       |
| `enabled`          | `true`       | Hide the entire library                                |
| `showToggleButton` | `true`       | Set `false` to place `AnnotationToggleButton` yourself |
| `showPinsWhenIdle` | `true`       | Keep pins visible when annotation mode is off          |
| `showResolved`     | `true`       | Show completed/closed pins                             |
| `apiClient`        | REST client  | Advanced/demo override. The library default is HTTP    |
| `trackPageVisits`  | `true`       | Set `false` to turn off page-visit tracking            |

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
described in the privacy note of the API README.

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

## Page identification

The current page key comes from `getPageKey()`, or `window.location.pathname` if that function is omitted.

The library works with React Router, Next.js, TanStack Router, and custom routing because it does not depend on any router package. When `pageKey` changes it aborts the previous request, clears the previous page, and fetches annotations for the new page.

## DOM anchoring

Pins are attached to elements, not only to screen coordinates.

Preferred identity order:

1. `data-annotation-id`
2. unique stable `id`
3. stable `data-name` / `data-field`
4. unique `name` / `aria-label`
5. generated DOM selector (`nth-of-type` only as a last resort)

Each annotation also stores `relativeX` / `relativeY` plus fallback coordinates. If the original element cannot be resolved, the pin uses the fallback position and is visually marked as orphaned.

For the most stable anchors, add:

```html
<button data-annotation-id="login-submit">Login</button>
```

## Annotation mode

- Mode off: the host app works normally. Existing pins stay visible by default. Clicking a pin opens its thread.
- Mode on: the cursor becomes a crosshair, hover highlights annotatable elements, and a click creates a numbered pin plus composer.
- The intercepted click does not fire the host action. A login button will not submit the form while annotation mode is selecting an element.
- Host listeners are not rewritten. Capture listeners are removed when mode is disabled or the provider unmounts.

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

`useAnnotations()` returns the current page annotations, loading/error/retry, mutation helpers
(including `createAnnotation`), and `actionError`/`clearActionError` to surface a failed mutation.

For narrower re-renders than `useAnnotationContext` (which combines everything), use the split
context hooks: `useAnnotationData` (annotations, mutations, tags, flow pins), `useAnnotationUi`
(mode, drafts, panel visibility) and `useAnnotationAuth` (accounts, login/logout, host-auth state).

### Event callbacks

`AnnotationConfig` accepts optional callbacks, invoked as the corresponding events happen:
`onAnnotationCreate`, `onAnnotationUpdate`, `onAnnotationDelete`, `onCommentAdd`, `onStatusChange`,
`onError` and `onConnectionStateChange`.

Optional panels, mounted the same way as `AnnotationToggleButton`:

- `UserManagementPanel`, `SettingsPanel`, `AuditHistoryPanel` — admin surfaces for user, project/organization/tag and audit-log management.
- `LoginDialog`, `ToolbarAuthControl` — the built-in sign-in flow, used when the host app has no auth UI of its own; hidden automatically in host-authenticated mode.

Real-time updates:

- `useAnnotationStream` / `applyStreamEvent` — live annotation and comment updates. Takes `getAuthToken` and `sessionKey` (not a raw token) so the stream reconnects on session changes without losing its place.
- `useEpicFlowStream` / `applyEpicFlowStreamEvent` — live epic and user-story updates for the EpicFlow board. Also takes `sessionKey`.
- `createEpicFlowApi` / `useEpicFlowApi` / `EpicFlowApiClient` / `EpicFlowApiError` — the EpicFlow REST client, exposed for hosts that call it directly.

Every exported type (`Annotation`, `AuthSession`, `ManagedUser`, `Organization`, `ProjectTag`, `AuditRecord`, `AnnotationContextValue` and its `Data`/`Ui`/`Auth` slices, `AuthSessionsValue`, `Epic`, `UserStory`, and their request/response shapes) is available from the package root and discoverable through editor autocomplete; this README does not duplicate the type signatures.

## SSR and Next.js

`AnnotationProvider` is safe to render on the server: it does not read `window` during render or in
a `useState` initializer, and it only portals its overlay into `document.body` after mounting on the
client. The compiled output (`dist/index.js` and `dist/index.es.js`) starts with a `"use client"`
directive, so it can be imported directly from a Next.js App Router client component:

```tsx
"use client";

import { AnnotationProvider } from "wec-pinnote-lib";
```

## API contract

The library calls these backend endpoints. Full request/response shapes live in [docs/api-contract.md](docs/api-contract.md).

- `GET /annotations?projectId=&pageKey=`
- `POST /annotations`
- `GET /annotations/{annotationId}`
- `POST /annotations/{annotationId}/comments`
- `PATCH /annotations/{annotationId}`
- `DELETE /annotations/{annotationId}`
- `PATCH /annotations/{annotationId}/comments/{commentId}`
- `DELETE /annotations/{annotationId}/comments/{commentId}`

Authorization for edit/delete/resolve remains the backend’s responsibility.

## Integrate into an existing Vite React project

1. Install the package.
2. Import `wec-pinnote-lib/style.css` once in your root file.
3. Wrap the app with `AnnotationProvider`.
4. Pass `apiBaseUrl`, `projectId`, `currentUser`, and `getAuthToken` from your Vite env and auth layer.
5. Add `data-annotation-id` to important elements.

```ts
// main.tsx
import { AnnotationProvider } from "wec-pinnote-lib";
import "wec-pinnote-lib/style.css";

createRoot(document.getElementById("root")!).render(
  <AnnotationProvider
    config={{
      apiBaseUrl: import.meta.env.VITE_ANNOTATION_API_URL,
      projectId: import.meta.env.VITE_ANNOTATION_PROJECT_ID,
      currentUser: { id: user.id, name: user.name },
      getAuthToken: () => accessToken,
      getPageKey: () => window.location.pathname,
    }}
  >
    <App />
  </AnnotationProvider>,
);
```

## Example project

`examples/demo` is the canonical example for checking `wec-pinnote-lib` integration — a minimal login/home app wired up per Option B2 above, aliased straight to this package's own `src/`. It defaults to the real `wec-pinnote-api` backend; set `VITE_USE_MOCK_API=true` in `examples/demo/.env` to use the bundled in-memory mock instead.

```bash
npm run demo
```

or, from inside the folder:

```bash
cd examples/demo
npm install
npm run dev
```

## Development

```bash
npm run typecheck
npm run lint
npm run build
npm run demo:build
```

Build output:

- `dist/index.js`
- `dist/index.es.js`
- `dist/index.d.ts`
- `dist/style.css`

## License

MIT. Positioning ideas were adapted from [react-pinote](https://github.com/kapeka0/react-pinote) (MIT). See [NOTICE](NOTICE).
