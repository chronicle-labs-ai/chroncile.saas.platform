import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/backend/data/db";
import {
  buildEnvName,
  generateSuffix,
  provisionEphemeral,
} from "@/backend/environments/lifecycle";

const ProvisionSchema = z.object({
  branch: z.string().min(1),
  ttlHours: z.number().min(1).max(720).default(24),
  secrets: z.record(z.string()).default({}),
  dbTemplateId: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ProvisionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Generate a unique name for this deployment of the branch
  // e.g. branch "test/ephemeral-env-test" → "test-ep-a3f2"
  let envName = buildEnvName(parsed.data.branch, generateSuffix());

  // Extremely unlikely collision guard
  let attempts = 0;
  while (await prisma.environment.findUnique({ where: { name: envName } })) {
    envName = buildEnvName(parsed.data.branch, generateSuffix());
    if (++attempts > 5) {
      return NextResponse.json(
        { error: "Could not generate unique environment name" },
        { status: 500 }
      );
    }
  }

  const flyAppName = `chronicle-backend-${envName}`;
  const flyDbName = `chronicle-db-${envName}`;

  const defaultSecrets = getDefaultSecrets();
  const mergedSecrets = { ...defaultSecrets, ...parsed.data.secrets };

  const env = await prisma.environment.create({
    data: {
      name: envName,
      type: "EPHEMERAL",
      status: "PROVISIONING",
      gitBranch: parsed.data.branch,
      flyAppName,
      flyAppUrl: `https://${flyAppName}.fly.dev`,
      flyDbName,
      expiresAt: new Date(Date.now() + parsed.data.ttlHours * 60 * 60 * 1000),
    },
  });

  provisionEphemeral({
    name: envName,
    branch: parsed.data.branch,
    ttlHours: parsed.data.ttlHours,
    secrets: mergedSecrets,
    dbTemplateId: parsed.data.dbTemplateId ?? null,
  }).catch((err) => {
    console.error(`Provision failed for ${envName}:`, err);
  });

  return NextResponse.json(
    { id: env.id, name: envName, status: "provisioning" },
    { status: 202 }
  );
}

function getDefaultSecrets(): Record<string, string> {
  const template = process.env.SECRETS_TEMPLATE;
  if (!template) return {};
  try {
    return JSON.parse(template);
  } catch {
    return {};
  }
}
