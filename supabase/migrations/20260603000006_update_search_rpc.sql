-- Add household scoping to the ingredient search RPC.
-- The old function filtered only by archived status. Since recipes now belong
-- to a household, results must be scoped to the requesting household.
-- DROP is required because adding a parameter changes the function signature,
-- which CREATE OR REPLACE would treat as a new overload, leaving the old one.
DROP FUNCTION IF EXISTS search_recipes_by_ingredient(text);

CREATE FUNCTION search_recipes_by_ingredient(query text, p_household_id uuid)
RETURNS TABLE (
  id           uuid,
  title        text,
  cuisine_id   text,
  meal_type_id text,
  servings     integer,
  match_count  bigint
) AS $$
  SELECT
    r.id,
    r.title,
    r.cuisine_id,
    r.meal_type_id,
    r.servings,
    COUNT(*) AS match_count
  FROM recipes r
  JOIN ingredients i ON i.recipe_id = r.id
  WHERE i.name_tsv @@ to_tsquery('english', query)
    AND r.archived = false
    AND r.household_id = p_household_id
  GROUP BY r.id, r.title, r.cuisine_id, r.meal_type_id, r.servings
  ORDER BY match_count DESC, r.title ASC
$$ LANGUAGE sql STABLE;
