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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const developer = await prisma.developer.findUnique({ where: { id } });
  if (!developer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const frontendConfig = `dev_frontend_${developer.dopplerSuffix}`;
  const backendConfig = `dev_backend_${developer.dopplerSuffix}`;

  try {
    await doppler([
      "configs",
      "delete",
      frontendConfig,
      "--project",
      DOPPLER_PROJECT,
      "--yes",
    ]);
  } catch {
    /* config may not exist */
  }

  try {
    await doppler([
      "configs",
      "delete",
      backendConfig,
      "--project",
      DOPPLER_PROJECT,
      "--yes",
    ]);
  } catch {
    /* config may not exist */
  }

  await prisma.developer.delete({ where: { id } });

  return NextResponse.json({ status: "deleted", name: developer.name });
}
