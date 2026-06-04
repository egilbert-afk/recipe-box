-- Usage analytics event log.
-- Each row records one thing a user did. properties is flexible JSONB
-- so we can attach context (capture_method, result_count, etc.) without
-- schema changes as instrumentation evolves.

CREATE TABLE events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id  uuid REFERENCES households(id) ON DELETE SET NULL,
  event_name    text NOT NULL,
  properties    jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX events_user_id_idx       ON events(user_id);
CREATE INDEX events_event_name_idx    ON events(event_name);
CREATE INDEX events_created_at_idx    ON events(created_at DESC);

-- Events are insert-only from the app. No user should read or modify them
-- directly — the /admin page uses the service role client.
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_insert" ON events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
