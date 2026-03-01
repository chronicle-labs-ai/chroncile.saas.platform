import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

const SEEDS_DIR = join(process.cwd(), "seeds");

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const safeName = name.replace(/[^a-z0-9-]/gi, "");
  const filePath = join(SEEDS_DIR, `${safeName}.sql`);

  try {
    const content = await readFile(filePath, "utf-8");
    return new NextResponse(content, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch {
    return NextResponse.json({ error: "Seed not found" }, { status: 404 });
  }
}
