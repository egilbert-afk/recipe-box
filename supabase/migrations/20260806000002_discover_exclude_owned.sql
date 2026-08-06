-- Exclude recipes whose source_url the requesting household already owns.
-- Prevents a user from seeing in Discover a recipe they already have,
-- even if it was contributed to the pool by a different household.
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
    AND NOT EXISTS (
      SELECT 1
      FROM recipes own
      WHERE own.household_id = p_household_id
        AND own.source_url = r.source_url
        AND own.archived = false
    )
    AND (p_cuisine_id   IS NULL OR r.cuisine_id   = p_cuisine_id)
    AND (p_meal_type_id IS NULL OR r.meal_type_id = p_meal_type_id)
  ORDER BY RANDOM()
  LIMIT 1;
$$;
