DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'password'
    ) THEN
        ALTER TABLE "User" ALTER COLUMN password DROP NOT NULL;
    END IF;
END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "authProvider" TEXT NOT NULL DEFAULT 'credentials';
