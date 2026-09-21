CREATE TYPE annotation_status AS ENUM (
  'open',
  're-open',
  'dev-inprogress',
  'completed',
  'closed'
);
CREATE TYPE page_status AS ENUM (
  'review',
  'approved'
);
CREATE TABLE annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
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
  status annotation_status NOT NULL DEFAULT 'open',
  created_by_id TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  created_by_avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, page_key, number)
);
CREATE INDEX annotations_project_page_idx
  ON annotations (project_id, page_key);
CREATE TABLE annotation_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annotation_id UUID NOT NULL REFERENCES annotations (id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_by_id TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  created_by_avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX annotation_comments_annotation_idx
  ON annotation_comments (annotation_id, created_at);
CREATE TABLE page_statuses (
  project_id TEXT NOT NULL,
  page_key TEXT NOT NULL,
  status page_status NOT NULL DEFAULT 'review',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, page_key)
);
