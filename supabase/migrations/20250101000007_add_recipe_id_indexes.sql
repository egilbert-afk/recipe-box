-- Foreign key columns used in every recipe fetch — index them so Postgres
-- doesn't do a full table scan when loading a recipe's ingredients or steps.
CREATE INDEX ingredients_recipe_id_idx ON ingredients (recipe_id);
CREATE INDEX steps_recipe_id_idx ON steps (recipe_id);
