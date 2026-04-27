import { NextResponse } from "next/server";
import { readdir, readFile } from "fs/promises";
import { join } from "path";

const SEEDS_DIR = join(process.cwd(), "seeds");

export async function GET() {
  try {
    const files = await readdir(SEEDS_DIR);
    const seeds = await Promise.all(
      files
        .filter((f) => f.endsWith(".sql"))
        .map(async (f) => {
          const content = await readFile(join(SEEDS_DIR, f), "utf-8");
          const firstComment = content.match(/^--\s*(.+)/m);
          const name = f.replace(".sql", "");
          return {
            name,
            filename: f,
            description:
              firstComment?.[1]?.replace(/^Chronicle Labs —\s*/, "") ?? name,
            url: `/api/seeds/${name}`,
          };
        })
    );
    return NextResponse.json(seeds);
  } catch {
    return NextResponse.json([]);
  }
}
