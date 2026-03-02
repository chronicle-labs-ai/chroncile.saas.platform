import { Resend } from "resend";
import { OrgInviteEmail } from "@/emails/org-invite";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS ?? "Chronicle Labs <noreply@notify.chronicle-labs.com>";

interface SendOrgInviteParams {
  to: string;
  orgName: string;
  invitedByName: string;
  loginUrl: string;
  environmentName?: string;
}

export async function sendOrgInviteEmail(params: SendOrgInviteParams) {
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
