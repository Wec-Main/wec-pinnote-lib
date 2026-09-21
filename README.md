# wec-pinnote-lib

Figma-like website annotations and comments for any React application.

The library renders the annotation UI, detects DOM elements, positions pins, and talks to **your** REST API. It does not connect to a database and does not read host environment variables.

## Installation

This library is **not published to the npm registry**. Install it either from its GitHub repository or from a local checkout on disk.

Peer dependencies: `react` and `react-dom` >= 18.

### Option A: from GitHub

Add it straight to your host app's `package.json` (or run the equivalent `npm install` command) using a git URL instead of a version:

```bash
npm install git+https://github.com/<org>/wec-pinnote-lib.git
# or, pinned to a branch/tag/commit:
npm install git+https://github.com/<org>/wec-pinnote-lib.git#main
```

npm clones the repo, runs its `prepare`/`build` step, and installs it like any other dependency. Replace `<org>/wec-pinnote-lib` with the actual GitHub path once the repo is hosted there.

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
      "wec-pinnote-lib/style.css": resolve(__dirname, "../wec-pinnote-lib/src/styles/annotation.css"),
      "wec-pinnote-lib": resolve(__dirname, "../wec-pinnote-lib/src/index.ts"),
    },
  },
});
```

This is how the sibling `wec-pinnote-consumer` project (under the same `wec-lib` parent folder) is wired up — see it for a full working example.

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

| Field | Default | Purpose |
| --- | --- | --- |
| `zIndex` | `2147483000` | Overlay stacking |
| `enabled` | `true` | Hide the entire library |
| `showToggleButton` | `true` | Set `false` to place `AnnotationToggleButton` yourself |
| `showPinsWhenIdle` | `true` | Keep pins visible when annotation mode is off |
| `showResolved` | `true` | Show completed/closed pins |
| `apiClient` | REST client | Advanced/demo override. The library default is HTTP |

## Authentication

If `getAuthToken` is provided, every API request sends:

```http
Authorization: Bearer <token>
```

Tokens are requested per call and are not stored by the library.

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
<button data-annotation-id="login-submit">
  Login
</button>
```

## Annotation mode

- Mode off: the host app works normally. Existing pins stay visible by default. Clicking a pin opens its thread.
- Mode on: the cursor becomes a crosshair, hover highlights annotatable elements, and a click creates a numbered pin plus composer.
- The intercepted click does not fire the host action. A login button will not submit the form while annotation mode is selecting an element.
- Host listeners are not rewritten. Capture listeners are removed when mode is disabled or the provider unmounts.

## Public API

```ts
import {
  AnnotationProvider,
  AnnotationToggleButton,
  AnnotationListPanel,
  useAnnotations,
  useAnnotationMode,
} from "wec-pinnote-lib";
```

`useAnnotations()` returns the current page annotations, loading/error/retry, and mutation helpers.

## API contract

The library calls these backend endpoints. Full request/response shapes live in [docs/api-contract.md](docs/api-contract.md).

- `GET /annotations?projectId=&pageKey=`
- `GET /page-status?projectId=&pageKey=`
- `PATCH /page-status`
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

There is no bundled `examples/` folder in this repo. To try the library, see the sibling `wec-pinnote-consumer` project (under the same `wec-lib` parent folder as this one) — a minimal login/home app wired up per Option B2 above, hitting the real `wec-pinnote-api` backend.

```bash
cd ../wec-pinnote-consumer
npm install
npm run dev
```

## Development

```bash
npm run typecheck
npm run lint
npm run build
```

Build output:

- `dist/index.js`
- `dist/index.es.js`
- `dist/index.d.ts`
- `dist/style.css`

## License

MIT. Positioning ideas were adapted from [react-pinote](https://github.com/kapeka0/react-pinote) (MIT). See [NOTICE](NOTICE).
