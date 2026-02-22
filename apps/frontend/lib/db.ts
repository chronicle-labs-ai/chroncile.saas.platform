import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Configure URL for pooled Postgres (Supabase, Neon, etc.)
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("connection_limit")) {
      // Use more connections in dev to avoid pool timeout (auth + page queries)
      const limit = process.env.NODE_ENV === "development" ? "5" : "1";
      parsed.searchParams.set("connection_limit", limit);
    }
    // Disable prepared statements for PgBouncer/Supabase pooler (fixes "prepared statement already exists")
    if (!parsed.searchParams.has("pgbouncer")) {
      parsed.searchParams.set("pgbouncer", "true");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: getDatabaseUrl() } },
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;

export default prisma;
