import { Resend } from "resend";
import { OrgInviteEmail } from "@/emails/org-invite";

let resendInstance: Resend | null = null;

export function getResend(): Resend {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not set");
    }
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

const FROM_ADDRESS =
  process.env.RESEND_FROM_ADDRESS ??
  "Chronicle Labs <noreply@notify.chronicle-labs.com>";

interface SendOrgInviteParams {
  to: string;
  orgName: string;
  invitedByName: string;
  loginUrl: string;
  environmentName?: string;
}

export async function sendOrgInviteEmail(params: SendOrgInviteParams) {
  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: `You've been invited to join ${params.orgName} on Chronicle Labs`,
    react: OrgInviteEmail({
      orgName: params.orgName,
      invitedByName: params.invitedByName,
      inviteeEmail: params.to,
      loginUrl: params.loginUrl,
      environmentName: params.environmentName,
    }),
  });

  if (error) {
    throw new Error(`Failed to send invite email: ${error.message}`);
  }

  return data;
}
