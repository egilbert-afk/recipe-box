-- Lookup tables for cuisine and meal type values.
-- Using text primary keys so values are human-readable in queries and the UI
-- can use them directly without a join just to get the label.
CREATE TABLE cuisines (
  id    text PRIMARY KEY,
  label text NOT NULL
);

CREATE TABLE meal_types (
  id    text PRIMARY KEY,
  label text NOT NULL
);

CREATE TABLE recipes (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title          text        NOT NULL,
  cuisine_id     text        NOT NULL REFERENCES cuisines(id),
  meal_type_id   text        NOT NULL REFERENCES meal_types(id),
  source_url     text,
  servings       integer     NOT NULL CHECK (servings > 0),
  archived       boolean     NOT NULL DEFAULT false,
  archive_note   text,
  -- How the recipe entered the system; constrains to known values at DB level.
  capture_method text        NOT NULL DEFAULT 'manual'
                             CHECK (capture_method IN ('manual', 'url', 'document', 'email', 'text_paste')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
