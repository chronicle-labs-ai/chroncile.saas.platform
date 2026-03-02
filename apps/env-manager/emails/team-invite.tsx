import { Button, Heading, Hr, Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles } from "./components/email-layout";

interface TeamInviteEmailProps {
  orgName: string;
  inviterName: string;
  inviteeEmail: string;
  acceptUrl: string;
  role: string;
}

export function TeamInviteEmail({
  orgName = "Chronicle Labs",
  inviterName = "Admin",
  inviteeEmail = "user@example.com",
  acceptUrl = "https://app.chronicle-labs.com/invite/abc123",
  role = "Member",
}: TeamInviteEmailProps) {
  return (
    <EmailLayout
      preview={`You've been invited to join ${orgName} on Chronicle Labs`}
      footerText="If you weren't expecting this invitation, you can safely ignore this email. The invitation link will remain active."
    >
      <Heading style={styles.heading}>
        You&apos;ve been invited to join {"{{{ORG_NAME}}}"}
      </Heading>

      <Text style={styles.paragraph}>
        <strong>{"{{{INVITER_NAME}}}"}</strong> has invited you ({"{{{INVITEE_EMAIL}}}"}) to
        join <strong>{"{{{ORG_NAME}}}"}</strong> on the Chronicle Labs platform.
      </Text>

      <Text style={styles.monoBadge}>
        Role: {"{{{ROLE}}}"}
      </Text>

      <Text style={styles.paragraph}>
        Chronicle Labs is an AI agent testing and validation platform.
        You&apos;ll be able to monitor events, manage runs, configure
        connections, and collaborate with your team.
      </Text>

      <Section style={styles.buttonContainer}>
        <Button style={styles.button} href={"{{{ACCEPT_URL}}}"}>
          Accept Invitation
        </Button>
      </Section>

      <Text style={styles.note}>
        Sign in with your <strong>{"{{{INVITEE_EMAIL}}}"}</strong> Google account
        to get started.
      </Text>

      <Hr style={styles.hr} />
    </EmailLayout>
  );
}

export default TeamInviteEmail;
