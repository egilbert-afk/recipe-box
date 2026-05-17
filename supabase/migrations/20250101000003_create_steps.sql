-- ON DELETE CASCADE: removing a recipe removes all its steps automatically.
CREATE TABLE steps (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id   uuid    NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  instruction text    NOT NULL,
  order_index integer NOT NULL,
  UNIQUE (recipe_id, order_index)
);
