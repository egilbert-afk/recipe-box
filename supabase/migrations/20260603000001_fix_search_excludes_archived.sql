-- Recreate the ingredient search function to exclude archived recipes.
-- The original did not filter by archived, so archived recipes could
-- appear in search results even though they're hidden from browse views.
CREATE OR REPLACE FUNCTION search_recipes_by_ingredient(query text)
RETURNS TABLE (
  id         uuid,
  title      text,
  cuisine_id text,
  meal_type_id text,
  servings   integer,
  match_count bigint
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
  GROUP BY r.id, r.title, r.cuisine_id, r.meal_type_id, r.servings
  ORDER BY match_count DESC, r.title ASC
$$ LANGUAGE sql STABLE;
