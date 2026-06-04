CREATE TABLE feedback (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id  uuid REFERENCES households(id) ON DELETE SET NULL,
  message       text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX feedback_created_at_idx ON feedback(created_at DESC);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback; only service role can read
CREATE POLICY "feedback_insert" ON feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
