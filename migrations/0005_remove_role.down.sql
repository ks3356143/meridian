ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'tester', 'viewer'));
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
