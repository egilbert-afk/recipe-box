-- Add 'discover' to the capture_method check constraint.
-- The original constraint omitted 'discover', causing every Discover clone
-- insert to fail with a constraint violation.
ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_capture_method_check;
ALTER TABLE recipes ADD CONSTRAINT recipes_capture_method_check
  CHECK (capture_method IN ('manual', 'url', 'document', 'email', 'text_paste', 'discover'));
