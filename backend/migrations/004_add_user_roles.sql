ALTER TABLE "User" ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';

UPDATE "User" u
SET role = 'owner'
FROM (
    SELECT DISTINCT ON ("tenantId") id
    FROM "User"
    ORDER BY "tenantId", "createdAt" ASC
) earliest
WHERE u.id = earliest.id
  AND u.role = 'member';
