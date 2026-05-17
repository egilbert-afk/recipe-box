-- amount is nullable because some ingredients have no quantity (e.g. "salt to taste").
-- unit is nullable for ingredients measured by count (e.g. "2 eggs").
-- ON DELETE CASCADE: removing a recipe removes all its ingredients automatically.
CREATE TABLE ingredients (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id   uuid    NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  name        text    NOT NULL,
  amount      decimal,
  unit        text,
  order_index integer NOT NULL,
  UNIQUE (recipe_id, order_index)
);
