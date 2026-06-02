-- Enable Row Level Security on all tables
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuisines ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_types ENABLE ROW LEVEL SECURITY;

-- Authenticated users have full access to recipe data
CREATE POLICY "authenticated_full_access" ON recipes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_full_access" ON ingredients
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_full_access" ON steps
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Cuisines and meal types are read-only reference data
CREATE POLICY "authenticated_read" ON cuisines
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_read" ON meal_types
  FOR SELECT TO authenticated USING (true);
