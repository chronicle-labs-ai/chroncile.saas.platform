-- 011_drop_legacy_password_columns.sql
--
-- WorkOS migration cleanup (CP 10 / Sprint D).
--
-- After the WorkOS migration, every authenticated user goes through
-- WorkOS — there is no more bcrypt password column to write to, no more
-- password reset tokens to issue, and `authProvider` is always "workos"
-- (the only other historical value was "credentials" which is dead now).
--
-- IMPORTANT: this migration is destructive. Before running it in
-- production, audit the User table:
--
--   SELECT COUNT(*)
--     FROM "User"
--    WHERE "workosUserId" IS NULL
--      AND password IS NOT NULL;
--
-- If that count is non-zero, you have legacy users that were never
-- imported into WorkOS — fix that first (run `workos-import`) or accept
-- that those users won't be able to sign in anymore.

BEGIN;

-- 1. Drop password column on User. After WorkOS, the only password lives
--    in WorkOS-side; we never touch it.
ALTER TABLE "User" DROP COLUMN IF EXISTS password;

-- 2. Drop the authProvider column. Every user is implicitly "workos" now.
ALTER TABLE "User" DROP COLUMN IF EXISTS "authProvider";

-- 3. Drop the password reset token table.
DROP TABLE IF EXISTS "PasswordResetToken";

COMMIT;
