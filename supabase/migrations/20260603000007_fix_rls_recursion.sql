-- Fix infinite recursion in the household_members RLS policy.
--
-- The chain that causes the crash:
--   1. Query on recipes triggers household_recipes_access policy
--   2. That policy runs: SELECT household_id FROM household_members WHERE user_id = auth.uid()
--   3. That query triggers household_members_read policy
--   4. That policy runs: SELECT household_id FROM household_members WHERE user_id = auth.uid()
--   5. Step 4 triggers the policy again → infinite recursion
--
-- Fix: replace the self-referential subquery in household_members_read with a
-- call to a SECURITY DEFINER function. SECURITY DEFINER runs as the function
-- owner (postgres), bypassing RLS, so the lookup completes without recursing.

CREATE OR REPLACE FUNCTION get_my_household_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT household_id FROM household_members WHERE user_id = auth.uid() LIMIT 1;
$$;

DROP POLICY IF EXISTS "household_members_read" ON household_members;

CREATE POLICY "household_members_read" ON household_members
  FOR SELECT TO authenticated
  USING (household_id = get_my_household_id());
