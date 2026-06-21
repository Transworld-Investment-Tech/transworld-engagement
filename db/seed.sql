-- ============================================================================
-- Seed the first admin user.
-- The password hash below is a PLACEHOLDER. Generate a real one first:
--
--   node scripts/hash-password.js "YourStrongPassword"
--
-- then paste the printed hash in place of the placeholder and run this file.
-- ============================================================================

insert into app_users (name, email, password_hash, role)
values (
  'Okezie Ofoegbu',
  'okezie@transworldltd.com.ng',
  '$2a$REPLACE_WITH_REAL_BCRYPT_HASH',
  'admin'
)
on conflict (email) do nothing;
