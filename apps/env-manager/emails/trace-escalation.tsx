import { Button, Heading, Hr, Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles } from "./components/email-layout";

interface TraceEscalationEmailProps {
  traceId: string;
  conversationId: string;
  sources: string;
  confidence: string;
  eventCount: string;
  duration: string;
  incorrectActions: string;
  customMessage: string;
  viewUrl: string;
  claimUrl: string;
  escalateUrl: string;
}

const metaRow: React.CSSProperties = {
  fontSize: "13px",
  lineHeight: "1.6",
  color: "#9aa0a6",
  margin: "4px 0",
};

const quote: React.CSSProperties = {
  fontSize: "13px",
  color: "#9aa0a6",
  fontStyle: "italic",
  borderLeft: "3px solid #005566",
  paddingLeft: "12px",
  margin: "16px 0",
};

const actionButton: React.CSSProperties = {
  ...styles.button,
  padding: "12px 24px",
  margin: "4px 8px 4px 0",
  textTransform: undefined,
  letterSpacing: undefined,
};

export function TraceEscalationEmail({
  traceId = "trace_001",
  conversationId = "conv_001",
  sources = "intercom, slack",
  confidence = "Low 22%",
  eventCount = "8",
  duration = "45m",
  incorrectActions = "2. Critical errors may be present.",
  customMessage = "",
  viewUrl = "https://app.chronicle-labs.com/dashboard/labeling/trace_001",
  claimUrl = "https://app.chronicle-labs.com/dashboard/labeling/trace_001?claimed=1",
  escalateUrl = "https://app.chronicle-labs.com/dashboard/labeling/trace_001?escalated=1",
}: TraceEscalationEmailProps) {
  return (
    <EmailLayout
      preview={`Trace #${"{{{TRACE_ID}}}"} requires review — ${"{{{CONVERSATION_ID}}}"}`}
      footerText="Links expire in 48 hours. If you didn't expect this request, you can safely ignore this email."
    >
      <Heading style={styles.heading}>
        {`Trace Requires Review — #${"{{{TRACE_ID}}}"}`}
      </Heading>

      <Text style={metaRow}>
        {`Conversation ID: ${"{{{CONVERSATION_ID}}}"}`}
      </Text>
      <Text style={metaRow}>
        {`Sources: ${"{{{SOURCES}}}"}`}
      </Text>
      <Text style={metaRow}>
        {`Confidence: ${"{{{CONFIDENCE}}}"}`}
      </Text>
      <Text style={metaRow}>
        {`Events: ${"{{{EVENT_COUNT}}}"} · Duration: ${"{{{DURATION}}}"}`}
      </Text>

      <Text style={styles.paragraph}>
        {`Incorrect actions: ${"{{{INCORRECT_ACTIONS}}}"}`}
      </Text>

      <Hr style={styles.hr} />

      <Text style={quote}>{"{{{CUSTOM_MESSAGE}}}"}</Text>

      <Hr style={styles.hr} />

      <Text style={styles.paragraph}>Choose an action:</Text>

      <Section>
        <Button style={actionButton} href={"{{{VIEW_URL}}}"}>
          View Trace
        </Button>
        <Button style={actionButton} href={"{{{CLAIM_URL}}}"}>
          Claim Trace
        </Button>
        <Button style={actionButton} href={"{{{ESCALATE_URL}}}"}>
          Escalate to Manager
        </Button>
      </Section>
    </EmailLayout>
  );
}

export default TraceEscalationEmail;
