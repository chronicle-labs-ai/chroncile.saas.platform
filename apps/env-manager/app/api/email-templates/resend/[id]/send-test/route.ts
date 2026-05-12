import { NextResponse } from "next/server";
import { z } from "zod";
import { getResend } from "@/backend/integrations/email";

const FROM_ADDRESS =
  process.env.RESEND_FROM_ADDRESS ??
  "Chronicle Labs <noreply@notify.chronicle-labs.com>";

const SendTestSchema = z.object({
  to: z.string().email(),
  subject: z.string().optional(),
  variables: z.record(z.string(), z.union([z.string(), z.number()])),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = SendTestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: [parsed.data.to],
    subject: parsed.data.subject ?? "[TEST] Template Preview",
    template: {
      id,
      variables: parsed.data.variables,
    },
    tags: [
      { name: "email_type", value: "test-send" },
      { name: "template_id", value: id },
    ],
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ emailId: data?.id, sent: true });
}
