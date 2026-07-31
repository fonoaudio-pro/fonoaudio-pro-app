-- Enable RLS for appointments
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for appointments
CREATE POLICY "Enable all access for all users" ON appointments
  FOR ALL USING (true) WITH CHECK (true);

-- Ensure patients has the policy too (just in case)
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for all users" ON patients
  FOR ALL USING (true) WITH CHECK (true);
