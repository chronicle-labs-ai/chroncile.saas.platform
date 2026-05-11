import { NextResponse } from "next/server";
import { getResend } from "@/backend/integrations/email";

export async function GET() {
  const resend = getResend();
  const { data, error } = await resend.templates.list({ limit: 100 });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, alias, html, subject, from, variables } = body;
  if (!name || !html) {
    return NextResponse.json(
      { error: "name and html are required" },
      { status: 400 }
    );
  }

  const resend = getResend();
  const { data, error } = await resend.templates.create({
    name,
    alias,
    html,
    subject,
    from,
    variables,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
