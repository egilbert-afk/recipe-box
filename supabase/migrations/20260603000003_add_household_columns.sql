-- Add household ownership and authorship to recipes.
-- Nullable for now — the seed migration fills in values for existing rows,
-- then adds the NOT NULL constraints.
ALTER TABLE recipes
  ADD COLUMN household_id uuid REFERENCES households(id) ON DELETE CASCADE,
  ADD COLUMN created_by   uuid REFERENCES auth.users(id);

-- Fast lookup: all recipes for a household (used in every recipe query).
CREATE INDEX recipes_household_id_idx ON recipes (household_id);

-- Records each time a household member cooks a recipe.
-- started_at and ended_at allow the app to learn personal cook time multipliers.
-- rating and notes are filled in after cooking, not during.
CREATE TABLE cook_sessions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id    uuid        NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  household_id uuid        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  cooked_by    uuid        NOT NULL REFERENCES auth.users(id),
  started_at   timestamptz NOT NULL DEFAULT now(),
  ended_at     timestamptz,
  rating       integer     CHECK (rating BETWEEN 1 AND 5),
  notes        text,
  -- Soft delete: null means active, timestamp means removed.
  deleted_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cook_sessions_household_id_idx ON cook_sessions (household_id);
CREATE INDEX cook_sessions_recipe_id_idx    ON cook_sessions (recipe_id);

-- Ingredients a household always has on hand.
-- Excluded from generated shopping lists.
CREATE TABLE pantry_staples (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, name)
);
