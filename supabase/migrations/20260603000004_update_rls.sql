-- Replace the broad "all authenticated users" policies with household-scoped ones.
-- The service role client (used in API routes) bypasses RLS entirely —
-- those routes are responsible for filtering by household_id explicitly.

-- ── Drop old broad policies ───────────────────────────────────────────────────

DROP POLICY "authenticated_full_access" ON recipes;
DROP POLICY "authenticated_full_access" ON ingredients;
DROP POLICY "authenticated_full_access" ON steps;

-- ── households ────────────────────────────────────────────────────────────────

ALTER TABLE households ENABLE ROW LEVEL SECURITY;

-- Members can read their own household.
CREATE POLICY "household_read" ON households
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

-- Only owners can update household details (name, invite code regeneration).
CREATE POLICY "household_owner_update" ON households
  FOR UPDATE TO authenticated
  USING (
    id IN (
      SELECT household_id FROM household_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- ── household_members ─────────────────────────────────────────────────────────

ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;

-- Members can see all members of their own household.
CREATE POLICY "household_members_read" ON household_members
  FOR SELECT TO authenticated
  USING (
    household_id IN (
      SELECT household_id FROM household_members hm WHERE hm.user_id = auth.uid()
    )
  );

-- ── recipes ───────────────────────────────────────────────────────────────────

-- Members can only see and modify recipes belonging to their household.
CREATE POLICY "household_recipes_access" ON recipes
  FOR ALL TO authenticated
  USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

-- ── ingredients ───────────────────────────────────────────────────────────────

-- Ingredients are accessible when the parent recipe is accessible.
CREATE POLICY "household_ingredients_access" ON ingredients
  FOR ALL TO authenticated
  USING (
    recipe_id IN (
      SELECT r.id FROM recipes r
      JOIN household_members hm ON hm.household_id = r.household_id
      WHERE hm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    recipe_id IN (
      SELECT r.id FROM recipes r
      JOIN household_members hm ON hm.household_id = r.household_id
      WHERE hm.user_id = auth.uid()
    )
  );

-- ── steps ─────────────────────────────────────────────────────────────────────

CREATE POLICY "household_steps_access" ON steps
  FOR ALL TO authenticated
  USING (
    recipe_id IN (
      SELECT r.id FROM recipes r
      JOIN household_members hm ON hm.household_id = r.household_id
      WHERE hm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    recipe_id IN (
      SELECT r.id FROM recipes r
      JOIN household_members hm ON hm.household_id = r.household_id
      WHERE hm.user_id = auth.uid()
    )
  );

-- ── cook_sessions ─────────────────────────────────────────────────────────────

ALTER TABLE cook_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household_cook_sessions_access" ON cook_sessions
  FOR ALL TO authenticated
  USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

-- ── pantry_staples ────────────────────────────────────────────────────────────

ALTER TABLE pantry_staples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household_pantry_staples_access" ON pantry_staples
  FOR ALL TO authenticated
  USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );
