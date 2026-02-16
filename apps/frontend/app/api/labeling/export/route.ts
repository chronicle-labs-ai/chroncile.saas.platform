import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getLabelingStore } from "@/lib/labeling/store";
import { exportTraces } from "@/lib/labeling/export";
import type { ExportFormat } from "@/lib/labeling/types";

export const dynamic = "force-dynamic";

const VALID_FORMATS: ExportFormat[] = ["alpaca", "sharegpt", "dpo"];

/** GET /api/labeling/export?format=alpaca|sharegpt|dpo — download JSONL */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") as ExportFormat | null;

  if (!format || !VALID_FORMATS.includes(format)) {
    return NextResponse.json(
      { error: `Invalid format. Must be one of: ${VALID_FORMATS.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const store = await getLabelingStore();
    const traces = await store.getLabeledTraces(session.user.tenantId);
    const jsonl = exportTraces(traces, format);

    const filename = `labeled-traces-${format}-${new Date().toISOString().slice(0, 10)}.jsonl`;

    return new Response(jsonl, {
      headers: {
        "Content-Type": "application/jsonl",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("Failed to export:", err);
    return NextResponse.json(
      { error: "Failed to export traces" },
      { status: 500 }
    );
  }
}
