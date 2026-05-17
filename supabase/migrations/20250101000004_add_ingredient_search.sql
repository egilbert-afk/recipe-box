-- GENERATED ALWAYS AS ... STORED keeps the tsvector in sync automatically
-- whenever the ingredient name is inserted or updated — no application code needed.
-- GIN index makes full-text search fast even with many rows.
ALTER TABLE ingredients
  ADD COLUMN name_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('english', name)) STORED;

CREATE INDEX ingredients_name_tsv_idx ON ingredients USING GIN (name_tsv);
