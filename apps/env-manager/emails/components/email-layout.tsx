import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

const EMAIL_ASSETS_BASE =
  process.env.EMAIL_ASSETS_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "https://app.chronicle-labs.com";

const LOGO_URL = `${EMAIL_ASSETS_BASE}/email/logo@2x.png`;

const DEFAULT_FROM = "Chronicle Labs <noreply@notify.chronicle-labs.com>";

interface EmailLayoutProps {
  preview: string;
  children: React.ReactNode;
  footerText?: string;
}

export function EmailLayout({
  preview,
  children,
  footerText,
}: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={logoSection}>
            <Img
              src={LOGO_URL}
              width="32"
              height="32"
              alt="Chronicle Labs"
              style={logoImg}
            />
            <Text style={logoText}>Chronicle Labs</Text>
          </Section>

          <Section style={main}>{children}</Section>

          <Section style={footerSection}>
            {footerText && <Text style={footerStyle}>{footerText}</Text>}
            <Text style={footerStyle}>
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

export { Hr, Text, Link, Section, Img };

export const styles = {
  heading: {
    fontSize: "20px",
    fontWeight: 600,
    color: "#e8eaed",
    margin: "0 0 16px 0",
    lineHeight: "1.3",
  } as React.CSSProperties,

  paragraph: {
    fontSize: "14px",
    lineHeight: "1.6",
    color: "#9aa0a6",
    margin: "0 0 16px 0",
  } as React.CSSProperties,

  monoBadge: {
    fontSize: "12px",
    fontFamily: "'IBM Plex Mono', Consolas, monospace",
    color: "#00d4ff",
    backgroundColor: "#001419",
    border: "1px solid #005566",
    borderRadius: "2px",
    padding: "6px 10px",
    display: "inline-block",
    margin: "0 0 16px 0",
  } as React.CSSProperties,

  buttonContainer: {
    textAlign: "center" as const,
    margin: "24px 0",
  } as React.CSSProperties,

  button: {
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
  } as React.CSSProperties,

  note: {
    fontSize: "12px",
    color: "#5f6368",
    textAlign: "center" as const,
    margin: "0 0 16px 0",
  } as React.CSSProperties,

  hr: {
    borderColor: "#252a30",
    margin: "24px 0",
  } as React.CSSProperties,
};

const body: React.CSSProperties = {
  backgroundColor: "#0a0c0f",
  fontFamily:
    "'Helvetica Neue', Helvetica, -apple-system, system-ui, sans-serif",
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

const logoImg: React.CSSProperties = {
  margin: "0 auto 8px auto",
  display: "block",
};

const logoText: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "#9aa0a6",
  margin: "0",
};

const main: React.CSSProperties = {
  backgroundColor: "#0f1215",
  border: "1px solid #252a30",
  borderRadius: "4px",
  padding: "32px",
};

const footerSection: React.CSSProperties = {
  textAlign: "center" as const,
  paddingTop: "24px",
};

const footerStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "#3c4043",
  lineHeight: "1.5",
  margin: "0 0 8px 0",
};

const footerLink: React.CSSProperties = {
  color: "#5f6368",
  textDecoration: "underline",
};
