The authoritative DDL lives in `wec-pinnote-api/db/tables/`, one file per table, applied in
filename order by `npm run db:migrate`. There are no enum types: every status, role and
state column is plain `TEXT`, validated at the API boundary by the zod schemas.
Every table names its own primary key (`organization_id`, `project_id`, `user_id`, ...).

| File                          | Contents                                          |
| ----------------------------- | ------------------------------------------------- |
| `00_extensions.sql`           | `pgcrypto` (for `gen_random_uuid()`)              |
| `01_organizations.sql`        | `organizations` — the tenant root                 |
| `02_projects.sql`             | `projects` — owned by an organization             |
| `03_users.sql`                | `users` + login/filter/search indexes             |
| `04_annotations.sql`          | `annotations` + org/project/page indexes          |
| `05_annotation_comments.sql`  | `annotation_comments` + thread indexes            |
| `06_page_statuses.sql`        | `page_statuses` + project/status indexes          |
| `07_stream_events.sql`        | `stream_events` — the SSE replay log              |
| `08_audit_log.sql`            | `audit_log` — who did what, with before/after     |

## Ownership

An organization owns many projects; a project owns everything a page produces. `project_id` is
the human-readable key callers pass (`wec-lib`), and it is a real foreign key into `projects`.
Scoped tables also carry `organization_id` so a query filters on the tenant directly instead of
joining through `projects` on every read.

```
organizations
  └── projects            (project_id: 'wec-lib')
        ├── annotations   ──> annotation_comments
        ├── page_statuses
        └── stream_events
  └── users
```

```sql
CREATE TABLE organizations (
  organization_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  slug TEXT NOT NULL,
  country_code TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE projects (
  project_id TEXT PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations (organization_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations (organization_id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role_id TEXT NOT NULL DEFAULT 'viewer',
  status TEXT NOT NULL DEFAULT 'invited',
  country_code TEXT NOT NULL,
  avatar_url TEXT,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE annotations (
  annotation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (organization_id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects (project_id) ON DELETE CASCADE,
  page_key TEXT NOT NULL,
  number INTEGER NOT NULL,
  selector TEXT NOT NULL,
  element_identifier TEXT NOT NULL,
  relative_x DOUBLE PRECISION NOT NULL,
  relative_y DOUBLE PRECISION NOT NULL,
  fallback_x DOUBLE PRECISION NOT NULL,
  fallback_y DOUBLE PRECISION NOT NULL,
  viewport_width INTEGER NOT NULL,
  viewport_height INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_by_id TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  created_by_avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, page_key, number)
);
CREATE TABLE annotation_comments (
  comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annotation_id UUID NOT NULL REFERENCES annotations (annotation_id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_by_id TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  created_by_avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE page_statuses (
  organization_id UUID NOT NULL REFERENCES organizations (organization_id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects (project_id) ON DELETE CASCADE,
  page_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'review',
  updated_by_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, page_key)
);
CREATE TABLE stream_events (
  event_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id UUID NOT NULL,
  project_id TEXT NOT NULL,
  page_key TEXT NOT NULL,
  event_type TEXT NOT NULL,
  annotation_id UUID,
  comment_id UUID,
  actor_user_id TEXT,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE audit_log (
  audit_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id TEXT,
  actor_name TEXT,
  organization_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  project_id TEXT,
  page_key TEXT,
  before_data JSONB,
  after_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`stream_events` and `audit_log` hold `organization_id` without a foreign key on purpose: both are
append-only history, and deleting an organization should not erase the record that it existed.

## Live updates

`stream_events.event_id` is the SSE cursor. Every mutation appends an event row and
calls `pg_notify` inside the same transaction as the data change, so an event is
never published for a write that rolled back. Each API instance holds one
`LISTEN pinnote_events` connection and fans out to its own SSE clients, which keeps
the connection count at one per instance rather than one per viewer. Subscriptions are
keyed on (organization, project, page), so an event never reaches another tenant's stream.

A client reconnecting sends `Last-Event-ID`; the server replays
`stream_events` rows above that id for the requested page before resuming live
delivery. Retain the table for `EVENT_RETENTION_DAYS` — a client offline longer than
that resyncs with a full refetch instead.
