import { NextResponse } from "next/server";
import { getResend } from "@/backend/integrations/email";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const resend = getResend();
  const { data, error } = await resend.templates.publish(id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
