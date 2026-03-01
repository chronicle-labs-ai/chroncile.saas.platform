import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

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
    <Html>
      <Head />
      <Preview>You&apos;ve been invited to join {orgName} on Chronicle Labs</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={logoSection}>
            <Text style={logoText}>Chronicle Labs</Text>
          </Section>

          <Section style={main}>
            <Heading style={heading}>
              You&apos;ve been invited to join {orgName}
            </Heading>

            <Text style={paragraph}>
              <strong>{invitedByName}</strong> has invited you ({inviteeEmail}) to
              join <strong>{orgName}</strong> on the Chronicle Labs platform.
            </Text>

            {environmentName && (
              <Text style={envBadge}>
                Environment: {environmentName}
              </Text>
            )}

            <Text style={paragraph}>
              Chronicle Labs is an AI agent testing and validation platform.
              You&apos;ll be able to monitor events, manage runs, configure
              connections, and collaborate with your team.
            </Text>

            <Section style={buttonContainer}>
              <Button style={button} href={loginUrl}>
                Accept Invitation
              </Button>
            </Section>

            <Text style={note}>
              Sign in with your <strong>{inviteeEmail}</strong> Google account
              to get started.
            </Text>

            <Hr style={hr} />

            <Text style={footer}>
              If you weren&apos;t expecting this invitation, you can safely ignore
              this email. The invitation link will remain active.
            </Text>

            <Text style={footer}>
              <Link href="https://chronicle-labs.com" style={footerLink}>
                chronicle-labs.com
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default OrgInviteEmail;

const body: React.CSSProperties = {
  backgroundColor: "#0a0c0f",
  fontFamily: "'Helvetica Neue', Helvetica, -apple-system, system-ui, sans-serif",
  margin: 0,
  padding: 0,
};

const container: React.CSSProperties = {
  maxWidth: "520px",
  margin: "0 auto",
  padding: "40px 20px",
};

const logoSection: React.CSSProperties = {
  textAlign: "center" as const,
  marginBottom: "32px",
};

const logoText: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "#9aa0a6",
};

const main: React.CSSProperties = {
  backgroundColor: "#0f1215",
  border: "1px solid #252a30",
  borderRadius: "4px",
  padding: "32px",
};

const heading: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: 600,
  color: "#e8eaed",
  margin: "0 0 16px 0",
  lineHeight: "1.3",
};

const paragraph: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "1.6",
  color: "#9aa0a6",
  margin: "0 0 16px 0",
};

const envBadge: React.CSSProperties = {
  fontSize: "12px",
  fontFamily: "'IBM Plex Mono', Consolas, monospace",
  color: "#00d4ff",
  backgroundColor: "#001419",
  border: "1px solid #005566",
  borderRadius: "2px",
  padding: "6px 10px",
  display: "inline-block",
  margin: "0 0 16px 0",
};

const buttonContainer: React.CSSProperties = {
  textAlign: "center" as const,
  margin: "24px 0",
};

const button: React.CSSProperties = {
  backgroundColor: "#00d4ff",
  color: "#000000",
  fontSize: "13px",
  fontWeight: 600,
  letterSpacing: "0.02em",
  textTransform: "uppercase" as const,
  textDecoration: "none",
  padding: "12px 32px",
  borderRadius: "2px",
  display: "inline-block",
};

const note: React.CSSProperties = {
  fontSize: "12px",
  color: "#5f6368",
  textAlign: "center" as const,
  margin: "0 0 16px 0",
};

const hr: React.CSSProperties = {
  borderColor: "#252a30",
  margin: "24px 0",
};

const footer: React.CSSProperties = {
  fontSize: "11px",
  color: "#3c4043",
  lineHeight: "1.5",
  margin: "0 0 8px 0",
};

const footerLink: React.CSSProperties = {
  color: "#5f6368",
  textDecoration: "underline",
};
