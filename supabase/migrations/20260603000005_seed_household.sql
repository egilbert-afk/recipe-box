-- One-time seed for the single existing user.
-- Creates their household, makes them the owner, and assigns all orphaned recipes.
-- Safe to run on a fresh database (the IF v_user_id IS NULL guard skips gracefully).
-- After filling in household_id and created_by, promotes both columns to NOT NULL
-- so all future recipes are required to have them.
DO $$
DECLARE
  v_user_id    uuid;
  v_household_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No existing users — skipping household seed.';
    RETURN;
  END IF;

  INSERT INTO households (name, is_beta)
  VALUES ('Gilbert Household', true)
  RETURNING id INTO v_household_id;

  INSERT INTO household_members (household_id, user_id, role)
  VALUES (v_household_id, v_user_id, 'owner');

  -- Assign all recipes that pre-date the household model.
  UPDATE recipes
  SET household_id = v_household_id,
      created_by   = v_user_id
  WHERE household_id IS NULL;

  RAISE NOTICE 'Seeded household % for user %.', v_household_id, v_user_id;
END $$;

-- Now that all rows have values, enforce NOT NULL going forward.
ALTER TABLE recipes
  ALTER COLUMN household_id SET NOT NULL,
  ALTER COLUMN created_by   SET NOT NULL;
