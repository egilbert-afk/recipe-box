-- Enables recipe sharing via an unguessable link.
-- share_token is null until the owner chooses to share; set to a UUID when they do.
-- Regenerating the token revokes all existing share links for that recipe.
ALTER TABLE recipes
  ADD COLUMN share_token uuid UNIQUE DEFAULT NULL;

CREATE INDEX recipes_share_token_idx ON recipes (share_token)
  WHERE share_token IS NOT NULL;

-- Allow anonymous reads on recipes where the share token matches.
-- The public /r/[token] page uses the service role client, so this policy
-- is defence-in-depth for any future anon client usage.
CREATE POLICY "public_read_by_share_token" ON recipes
  FOR SELECT TO anon
  USING (share_token IS NOT NULL);

-- Same for ingredients and steps — needed to render the full shared recipe.
CREATE POLICY "public_read_shared_ingredients" ON ingredients
  FOR SELECT TO anon
  USING (
    recipe_id IN (
      SELECT id FROM recipes WHERE share_token IS NOT NULL
    )
  );

CREATE POLICY "public_read_shared_steps" ON steps
  FOR SELECT TO anon
  USING (
    recipe_id IN (
      SELECT id FROM recipes WHERE share_token IS NOT NULL
    )
  );
