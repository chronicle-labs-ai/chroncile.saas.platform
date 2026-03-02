import { Button, Heading, Hr, Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles } from "./components/email-layout";

interface OrgInviteEmailProps {
  orgName: string;
  invitedByName: string;
  inviteeEmail: string;
  loginUrl: string;
  environmentName?: string;
}

export function OrgInviteEmail({
  orgName = "Chronicle Labs",
  invitedByName = "Admin",
  inviteeEmail = "user@example.com",
  loginUrl = "https://app.chronicle-labs.com/login",
  environmentName,
}: OrgInviteEmailProps) {
  return (
    <EmailLayout
      preview={`You've been invited to join ${orgName} on Chronicle Labs`}
      footerText="If you weren't expecting this invitation, you can safely ignore this email. The invitation link will remain active."
    >
      <Heading style={styles.heading}>
        You&apos;ve been invited to join {orgName}
      </Heading>

      <Text style={styles.paragraph}>
        <strong>{invitedByName}</strong> has invited you ({inviteeEmail}) to
        join <strong>{orgName}</strong> on the Chronicle Labs platform.
      </Text>

      {environmentName && (
        <Text style={styles.monoBadge}>
          Environment: {environmentName}
        </Text>
      )}

      <Text style={styles.paragraph}>
        Chronicle Labs is an AI agent testing and validation platform.
        You&apos;ll be able to monitor events, manage runs, configure
        connections, and collaborate with your team.
      </Text>

      <Section style={styles.buttonContainer}>
        <Button style={styles.button} href={loginUrl}>
          Accept Invitation
        </Button>
      </Section>

      <Text style={styles.note}>
        Sign in with your <strong>{inviteeEmail}</strong> Google account
        to get started.
      </Text>

      <Hr style={styles.hr} />
    </EmailLayout>
  );
}

export default OrgInviteEmail;
