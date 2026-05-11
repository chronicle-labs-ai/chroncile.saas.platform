import { NextResponse } from "next/server";
import { prisma } from "@/backend/data/db";
import { execFile as _execFile } from "child_process";
import { promisify } from "util";

const execAsync = promisify(_execFile);
const DOPPLER_PROJECT = process.env.DOPPLER_PROJECT ?? "chronicle-platform";

async function doppler(args: string[]): Promise<string> {
  const { stdout } = await execAsync("doppler", args, { timeout: 30_000 });
  return stdout.trim();
}

export async function GET() {
  const developers = await prisma.developer.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(developers);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, email, tunnelDomain } = body as {
    name?: string;
    email?: string;
    tunnelDomain?: string;
  };

  if (!name || !tunnelDomain) {
    return NextResponse.json(
      { error: "name and tunnelDomain are required" },
      { status: 400 }
    );
  }

  const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!safeName) {
    return NextResponse.json(
      { error: "name must contain at least one alphanumeric character" },
      { status: 400 }
    );
  }

  const existing = await prisma.developer.findUnique({
    where: { name: safeName },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Developer "${safeName}" already exists` },
      { status: 409 }
    );
  }

  const frontendConfig = `dev_frontend_${safeName}`;
  const backendConfig = `dev_backend_${safeName}`;
  const errors: string[] = [];

  try {
    await doppler([
      "configs",
      "create",
      frontendConfig,
      "--project",
      DOPPLER_PROJECT,
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("already exists")) errors.push(`Frontend config: ${msg}`);
  }

  try {
    await doppler([
      "configs",
      "create",
      backendConfig,
      "--project",
      DOPPLER_PROJECT,
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("already exists")) errors.push(`Backend config: ${msg}`);
  }

  try {
    await doppler([
      "secrets",
      "set",
      `AUTH_URL=https://${tunnelDomain}`,
      `NEXT_PUBLIC_APP_URL=https://${tunnelDomain}`,
      "--project",
      DOPPLER_PROJECT,
      "--config",
      frontendConfig,
    ]);
  } catch (err) {
    errors.push(
      `Frontend secrets: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  try {
    await doppler([
      "secrets",
      "set",
      "DATABASE_URL=postgresql://chronicle:chronicle_dev@localhost:5432/chronicle",
      "--project",
      DOPPLER_PROJECT,
      "--config",
      backendConfig,
    ]);
  } catch (err) {
    errors.push(
      `Backend secrets: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const developer = await prisma.developer.create({
    data: {
      name: safeName,
      email: email || null,
      tunnelDomain,
      dopplerSuffix: safeName,
    },
  });

  return NextResponse.json(
    {
      developer,
      dopplerConfigs: { frontend: frontendConfig, backend: backendConfig },
      errors: errors.length > 0 ? errors : undefined,
    },
    { status: 201 }
  );
}
