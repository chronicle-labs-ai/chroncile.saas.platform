import { NextResponse } from "next/server";
import { runSeed } from "@/backend/local-dev";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = body.name as string | undefined;

    if (!name) {
      return NextResponse.json(
        { error: 'Missing required field: "name"' },
        { status: 400 }
      );
    }

    const result = await runSeed(name);
    return NextResponse.json(result, {
      status: result.success ? 200 : 422,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
