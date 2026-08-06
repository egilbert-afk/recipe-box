-- Layer 14: Discover community pool
--
-- is_discoverable: auto-set at parse time when source_url is from a known public
-- domain. Users can override per-recipe in Settings. Only true recipes enter the
-- Discover pool. Defaults false so private links (Google Docs, etc.) are excluded.
--
-- jump_url: "Jump to Recipe" anchor href extracted during parsing. Used in cook
-- mode only — Discover always opens source_url (top of page).
--
-- discover_opt_out: household-level. When true, no recipes from that household
-- appear in any other household's Discover pool.
--
-- discover_dismissals: permanent "Not for us" per household. Dismissed recipes
-- never resurface in Discover for that household.

ALTER TABLE recipes ADD COLUMN is_discoverable boolean NOT NULL DEFAULT false;
ALTER TABLE recipes ADD COLUMN jump_url text;

ALTER TABLE households ADD COLUMN discover_opt_out boolean NOT NULL DEFAULT false;

CREATE TABLE discover_dismissals (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id   uuid        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  recipe_id      uuid        NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  dismissed_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, recipe_id)
);

ALTER TABLE discover_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_manage_own_dismissals" ON discover_dismissals
  USING  (household_id = get_my_household_id())
  WITH CHECK (household_id = get_my_household_id());

-- Fast lookup: all dismissals for a given household
CREATE INDEX discover_dismissals_household_idx ON discover_dismissals (household_id);

-- Returns one random eligible pool recipe for the requesting household.
-- SECURITY DEFINER so it can read across households without exposing household_id
-- to callers. The caller only sees recipe content — never who contributed it.
CREATE OR REPLACE FUNCTION discover_next_recipe(
  p_household_id uuid,
  p_cuisine_id   text DEFAULT NULL,
  p_meal_type_id text DEFAULT NULL
)
RETURNS TABLE (
  id           uuid,
  title        text,
  source_url   text,
  cuisine_id   text,
  meal_type_id text,
  servings     integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.title,
    r.source_url,
    r.cuisine_id,
    r.meal_type_id,
    r.servings
  FROM recipes r
  JOIN households h ON h.id = r.household_id
  WHERE r.source_url IS NOT NULL
    AND r.is_discoverable = true
    AND r.archived = false
    AND h.discover_opt_out = false
    AND r.household_id != p_household_id
    AND NOT EXISTS (
      SELECT 1
      FROM discover_dismissals dd
      WHERE dd.household_id = p_household_id
        AND dd.recipe_id = r.id
    )
    AND (p_cuisine_id   IS NULL OR r.cuisine_id   = p_cuisine_id)
    AND (p_meal_type_id IS NULL OR r.meal_type_id = p_meal_type_id)
  ORDER BY RANDOM()
  LIMIT 1;
$$;
