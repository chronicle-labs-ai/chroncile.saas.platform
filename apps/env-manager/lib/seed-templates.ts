import { prisma } from "@/lib/data";

const BUILT_IN_TEMPLATES = [
  {
    name: "demo-users",
    description:
      "Two orgs (Acme Corp + Chronicle Labs) with 5 users. Good for testing auth and org management.",
    mode: "SEED_ONLY" as const,
    seedSqlUrl: "/api/seeds/demo-users",
  },
  {
    name: "full-demo",
    description:
      "3 orgs, 6 users, connections, 7 runs, audit logs, and sample events. Complete demo dataset.",
    mode: "SEED_ONLY" as const,
    seedSqlUrl: "/api/seeds/full-demo",
  },
];

export async function ensureBuiltInTemplates(appUrl: string): Promise<void> {
  for (const tmpl of BUILT_IN_TEMPLATES) {
    const existing = await prisma.dbTemplate.findUnique({
      where: { name: tmpl.name },
    });
    if (existing) continue;

    await prisma.dbTemplate.create({
      data: {
        name: tmpl.name,
        description: tmpl.description,
        mode: tmpl.mode,
        seedSqlUrl: `${appUrl}${tmpl.seedSqlUrl}`,
      },
    });
  }
}
