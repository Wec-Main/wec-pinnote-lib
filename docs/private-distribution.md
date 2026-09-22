# Private distribution via GitHub Packages

This guide covers publishing `wec-pinnote-lib` as a private npm package on GitHub Packages and installing it in other projects. Consumers receive only the compiled `dist` output; the source repository stays private.

Package name after this setup: `@wec-main/wec-pinnote-lib`

---

## Part 1 — One-time setup in the library repo (maintainer)

### 1.1 Make the repository private

1. Open https://github.com/Wec-Main/wec-pinnote-lib/settings
2. Scroll to **Danger Zone** → **Change repository visibility** → **Make private**
3. Confirm by typing the repository name

### 1.2 Update `package.json`

Change these fields:

```json
{
  "name": "@wec-main/wec-pinnote-lib",
  "license": "UNLICENSED",
  "publishConfig": {
    "registry": "https://npm.pkg.github.com",
    "access": "restricted"
  },
  "scripts": {
    "prepublishOnly": "npm run build"
  }
}
```

Remove the `"prepare": "npm run build"` script. Keep `"files": ["dist", "NOTICE"]`.

### 1.3 Stop shipping source maps

In `vite.config.ts`, change `sourcemap: true` to `sourcemap: false`. Source maps embed the full TypeScript source and would be published inside `dist`.

### 1.4 Replace the MIT licence

Replace the contents of `LICENSE` with a proprietary notice, for example:

```
Copyright (c) 2026 WEC. All rights reserved.
This software is proprietary and confidential. Unauthorized copying,
distribution, or use is prohibited.
```

### 1.5 Add a publish workflow

Create `.github/workflows/publish.yml`:

```yaml
name: Publish package

on:
  push:
    tags:
      - "v*"

permissions:
  contents: read
  packages: write

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: https://npm.pkg.github.com
          scope: "@wec-main"
      - run: npm ci
      - run: npm test
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

No secret needs to be created for this. `GITHUB_TOKEN` is provided automatically by GitHub Actions.

### 1.6 Publish a version

```bash
npm version patch        # or minor / major — updates package.json and creates a git tag
git push origin main --follow-tags
```

The workflow runs on the tag push and publishes the package. Check progress under the repo's **Actions** tab. The published package appears at https://github.com/orgs/Wec-Main/packages.

### 1.7 Verify the package contents before the first publish (optional)

```bash
npm pack --dry-run
```

The file list must contain only `dist/**`, `NOTICE`, `package.json`, `README.md`, `LICENSE`. No `src/`, no `.map` files.

---

## Part 2 — Create a GitHub token (every developer and every CI system that installs the package)

Each person or machine that installs the package needs a token with permission to read packages.

### 2.1 Create a classic personal access token

GitHub Packages for npm requires a **classic** token. Fine-grained tokens are not supported for npm registry reads.

1. Open https://github.com/settings/tokens
2. Click **Generate new token** → **Generate new token (classic)**
3. **Note**: `npm read wec-main packages`
4. **Expiration**: choose 90 days or 1 year. Set a calendar reminder to rotate it.
5. Tick exactly one scope: **`read:packages`**
6. Click **Generate token**
7. Copy the token immediately. It starts with `ghp_` and is shown only once.

### 2.2 Authorize the token for the organization (only if SSO is enabled)

If `Wec-Main` enforces SAML SSO, the token also needs SSO authorization:

1. Back on https://github.com/settings/tokens, find the token
2. Click **Configure SSO** → **Authorize** next to `Wec-Main`

### 2.3 Store the token on your machine

Never paste the token into a file that is committed. Put it in your shell profile instead.

macOS / Linux (`~/.zshrc` or `~/.bashrc`):

```bash
export GITHUB_PACKAGES_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

Then reload the shell: `source ~/.zshrc`

Windows (PowerShell, persistent):

```powershell
[Environment]::SetEnvironmentVariable("GITHUB_PACKAGES_TOKEN", "ghp_xxxxxxxxxxxxxxxxxxxx", "User")
```

Restart the terminal afterwards.

---

## Part 3 — Use the package in a new project

### 3.1 Add an `.npmrc` to the project root

Create a file named `.npmrc` next to `package.json`:

```
@wec-main:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
```

Commit this file. It contains no secret; npm substitutes the environment variable at install time.

### 3.2 Install

```bash
npm install @wec-main/wec-pinnote-lib
```

pnpm and yarn read the same `.npmrc`:

```bash
pnpm add @wec-main/wec-pinnote-lib
yarn add @wec-main/wec-pinnote-lib
```

### 3.3 Import

```tsx
import { AnnotationProvider } from "@wec-main/wec-pinnote-lib";
import "@wec-main/wec-pinnote-lib/style.css";
```

### 3.4 Upgrade later

```bash
npm install @wec-main/wec-pinnote-lib@latest
# or a specific version
npm install @wec-main/wec-pinnote-lib@1.2.0
```

---

## Part 4 — Install from CI / Docker in consuming projects

### GitHub Actions (consumer repo inside the Wec-Main org)

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 22
- run: npm ci
  env:
    GITHUB_PACKAGES_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

The automatic `GITHUB_TOKEN` can read packages from the same organization. Ensure the consuming repo has access under the package's **Package settings → Manage Actions access**.

### GitHub Actions (consumer repo outside the org) or other CI

1. Create a classic token as in Part 2 with `read:packages`
2. Add it as a CI secret named `GITHUB_PACKAGES_TOKEN`
3. Expose it to the install step as an environment variable of the same name

### Docker

Pass the token as a build secret, never as an `ARG` or `ENV` (those persist in image layers):

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine
WORKDIR /app
COPY package*.json .npmrc ./
RUN --mount=type=secret,id=gh_token \
    GITHUB_PACKAGES_TOKEN=$(cat /run/secrets/gh_token) npm ci
COPY . .
```

```bash
docker build --secret id=gh_token,env=GITHUB_PACKAGES_TOKEN .
```

---

## Part 5 — Grant access to people and repos

Package visibility is controlled separately from repository visibility.

1. Open https://github.com/orgs/Wec-Main/packages
2. Click the package → **Package settings**
3. **Manage access**: add users or teams with the **Read** role
4. **Manage Actions access**: add consuming repositories so their workflows can install with `GITHUB_TOKEN`

Members of the organization with a valid `read:packages` token can install once they are listed here or once the package inherits repository permissions.

---

## Troubleshooting

| Symptom                       | Cause                                                                          | Fix                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `401 Unauthorized` on install | Token missing, expired, or env var not exported in this shell                  | `echo $GITHUB_PACKAGES_TOKEN` must print the token; re-source the profile |
| `403 Forbidden` on install    | Token lacks `read:packages`, not SSO-authorized, or user has no package access | Recreate token with the scope; authorize SSO; add user in Part 5          |
| `404 Not Found` on install    | Scope missing from `.npmrc`, or package name misspelled                        | Confirm `@wec-main:registry=` line and exact package name                 |
| `E404` on publish             | `name` in `package.json` lacks the `@wec-main/` scope                          | Fix the name and republish                                                |
| `403` on publish              | Workflow lacks `packages: write` permission                                    | Add the `permissions` block from 1.5                                      |
| Types not found in consumer   | `dist/index.d.ts` missing from the published tarball                           | Run `npm run build` locally, confirm `dist/index.d.ts` exists, republish  |
