-- Enforce "one household per user" at the database level.
-- Previously this was only checked in application code (a SELECT before each
-- INSERT), which does not protect against two near-simultaneous requests
-- (double-click, duplicate tab, a retried request) both passing the check
-- before either INSERT completes. That race would leave a user belonging to
-- two households, which breaks every membership lookup in the app that
-- expects a single row (.maybeSingle() errors on more than one match).
ALTER TABLE household_members
  ADD CONSTRAINT household_members_user_id_key UNIQUE (user_id);
