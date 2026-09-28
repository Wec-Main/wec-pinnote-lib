# Current workflow

How data is organized and how the system actually behaves today, verified
directly against the live schema and code (not written from memory). Backend
is `wec-pinnote-api` (Express + Postgres); this package (`wec-pinnote-lib`)
is the React annotation/collaboration widget a host app embeds.

## 1. Tenant hierarchy

```
organizations                          (root tenant)
├─ users                                 organization_id FK, ON DELETE SET NULL
├─ projects                              organization_id FK, ON DELETE CASCADE
│  └─ user_projects                      (user_id, project_id) — see below
└─ user_projects                         cross-cutting join, see below
```

- **Organization** is the top-level tenant. A `super_admin` role is the only
  one that can see/manage across *all* organizations (`tagScopeFor`,
  `pinnedOrganizationScope` in the API); every other role is pinned to one
  organization.
- **Projects belong to exactly one organization** (`projects.organization_id`,
  `ON DELETE CASCADE`). `project_id` is `TEXT`, not `UUID` — the server
  generates a random `crypto.randomUUID()` string at creation time (fixed
  this session so two organizations naming a project the same thing can never
  collide); it is never derived from the project name.
- **A user belongs to at most one organization** (`users.organization_id`,
  nullable, `ON DELETE SET NULL`).
- **Project access is a separate, many-to-many concept**: `user_projects`
  (`user_id`, `project_id`) grants a specific user access to a specific
  project, independent of the user's home organization. `admin`/`super_admin`
  bypass this and can reach every project in their scope; other roles
  (`contributor`/`reviewer`/`developer`) are restricted to exactly the
  projects listed here (`requireProjectMembership` in
  `src/middleware/requireActor.ts`).

**Known gap (found this session, not yet fixed):** a project can belong to an
organization that has zero users of its own, while a user from a *different*
organization has been granted access to it via `user_projects`. The
project's login picker (`listLoginOptions` in `src/repositories/users.repo.ts`)
filters strictly by `users.organization_id = <project's org>`, so that user —
even a `super_admin` who can genuinely open the project — never appears as a
login option for it. The `user_projects`/`super_admin` eligibility check
exists but is trapped inside that outer organization filter.

## 2. Project-scoped resources

Everything below hangs off a project (and, redundantly, its owning
organization — most of these tables store `organization_id` *and*
`project_id` directly rather than joining through `projects` alone, a
deliberate query-scoping shortcut):

```
projects
├─ project_tags                         tag palette (name, color, status)
│  └─ annotation_tags                   a project_tag "pinned" onto one page
├─ annotations                          page comment pins
│  └─ annotation_comments               thread on one annotation
├─ epics                                kanban epics
│  └─ epic_user_stories                 composite FK → epics(epic_id, project_id)
├─ flows                                flowchart diagrams
│  ├─ flow_documents                    ONE JSONB blob per flow (see below)
│  ├─ flow_versions                     published snapshot, unique per flow+version
│  └─ flow_pins                         older "flow pin" annotation feature
└─ user_preferences                     per user+project settings (e.g. tags_visible)
```

**Flow storage was redesigned this session (by other work, not by me):** the
old fully-relational `flow_pages` / `flow_layers` / `flow_nodes` /
`flow_edges` tables are gone, replaced by a single `flow_documents` table —
one row per flow, `document JSONB` holding `{version, nodes, edges, meta}` as
one blob, with a `revision` counter for optimistic concurrency. Simpler, at
the cost of losing per-node/edge SQL queryability.

**`created_by_id` consistency, fixed this session:** `annotations` and
`annotation_comments` used to store a denormalized `created_by_name` /
`created_by_avatar_url` captured at creation time, which went stale whenever
a user's name changed. Both now compute the author's name/avatar live via a
`LEFT JOIN users` at query time — the same pattern `flows`, `project_tags`,
and `annotation_tags` already used. `annotations.created_by_id` is plain
`TEXT` (not a real FK) and can hold legacy non-UUID values (found a real
`"anonymous"` placeholder in seed data) — the join guards against this with a
`CASE WHEN ... THEN ...::uuid END` cast rather than a bare `::uuid` cast,
which would otherwise throw on those rows.

## 3. Cross-cutting, append-only logs

```
audit_log        — every mutating action, organization_id/project_id/actor as plain
                    columns (no FKs) so the trail survives deletion of the thing it
                    describes.
stream_events     — realtime SSE feed + replay-on-reconnect log, same no-FK pattern.
```

## 4. Analytics / presence subsystem (new this session, added by other work)

```
login_events       — one row per login attempt, success or failure + reason.
page_visits        — one row per page visit (duration, scroll depth, viewport, etc.),
                      deduplicated per user by (user_id, client_visit_id).
page_visit_daily    — rollup: visits + total duration per (day, org, project, page).
user_visit_daily    — rollup: visits + total duration per (day, org, project, user).
user_presence       — one row per (user_id, project_id): last_seen_at, for "who's online".
```

`page_visit_daily`/`user_visit_daily` are pre-aggregated rollups (see
`db/tables/rollup_triggers.sql`) so dashboard queries don't have to scan raw
`page_visits` — `workspaceMetrics.repo.ts` reads from these for the
Overview/Usage dashboards, and also joins `user_projects` directly when a
metric needs to be scoped to one project's members.

## 5. Request-time authorization flow

1. `attachUserId`/`attachUserIdFromSseTicket` (`middleware/auth.ts`) pull the
   actor's `userId`/`tokenVersion` off the JWT.
2. `requireActor`/`requireProjectActor` (`middleware/requireActor.ts`) load the
   full `ManagedUser` (including their `user_projects` list) via
   `getUser`/`findUserAnyOrganization`, verify `tokenVersion` still matches
   (so a password change/logout-all invalidates old tokens), and attach
   `req.actor = { userId, roleId, organizationId, tokenVersion }`.
3. Route-specific checks (`isMemberProject`, `tagScopeFor`,
   `pinnedOrganizationScope`, etc.) then gate individual actions.

## 6. Realtime + audit on every mutation

Every create/update/delete repository function in `wec-pinnote-api` follows
the same shape, inside one `withTransaction`:
1. Do the write.
2. `publishEventWith` → insert into `stream_events` + `pg_notify`, so any
   connected client on that project+page gets it over SSE immediately
   (`useAnnotationStream`/`useEpicFlowStream` in `wec-pinnote-lib`).
3. `recordAuditWith` → insert into `audit_log` with before/after snapshots
   (`mappers/auditSnapshot.ts`).

## 7. Frontend (`wec-pinnote-lib`) shape

- `AnnotationProvider` is the single context provider a host app wraps its
  page in; it exposes three slices via `useAnnotationData`/`useAnnotationUi`/
  `useAnnotationAuth` (or the combined `useAnnotationContext`).
- Annotation/tag/flow-pin positions are anchor-based, not element-attached:
  `useAnnotationPositions` (`src/hooks/useAnnotationPosition.ts`) resolves
  each anchor to a live DOM element on every recompute (fixed this session —
  it used to cache the resolution once, which went stale if a host remounted
  the DOM behind an anchor, e.g. closing/reopening a dialog) and also checks
  real paint-order occlusion via `document.elementsFromPoint` so pins
  automatically hide when a host's own (sufficiently opaque) dialog covers
  them — translucent scrims are seen through, so pins elsewhere on a dimmed
  backdrop stay visible.
- `AnnotationLayer` renders at a deliberately extreme z-index
  (`DEFAULT_Z_INDEX = 2147483000` in `AnnotationProvider.tsx`) so it can
  always sit above arbitrary host content.

## Open items noted but intentionally not acted on

- The login-picker cross-org gap (§1) — diagnosed, not yet fixed, pending a
  decision on the right scoping rule.
- `flow_pins` (the older annotation-style flow feature) still exists
  alongside the new `flows`/`flow_documents` model — not consolidated.
