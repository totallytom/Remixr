-- Admin: allow certain users to access admin dashboard and update other users (e.g. is_verified_artist).
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN users.is_admin IS 'When true, user can access /admin and update other users (e.g. is_verified_artist).';

-- Admins can update any user row (for minimal dashboard: toggle verified artist).
DROP POLICY IF EXISTS "Admins can update any user" ON users;
CREATE POLICY "Admins can update any user" ON users
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_admin = TRUE)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_admin = TRUE)
  );
