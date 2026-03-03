import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";
import type { TraceSummaryForNotification } from "@/lib/labeling/notification-summary";
import { formatConfidenceLabel, formatDuration } from "@/lib/labeling/notification-summary";

export interface TraceEscalationEmailProps {
  summary: TraceSummaryForNotification;
  viewUrl: string;
  claimUrl: string;
  escalateUrl: string;
  customMessage?: string | null;
}

const styles = {
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
    margin: "0 0 8px 0",
  } as React.CSSProperties,
  mono: {
    fontSize: "12px",
    fontFamily: "'IBM Plex Mono', Consolas, monospace",
    color: "#00d4ff",
    backgroundColor: "#001419",
    border: "1px solid #005566",
    borderRadius: "2px",
    padding: "6px 10px",
    display: "inline-block",
    margin: "0 0 4px 0",
  } as React.CSSProperties,
  metaRow: {
    fontSize: "13px",
    color: "#9aa0a6",
    margin: "4px 0",
  } as React.CSSProperties,
  button: {
    backgroundColor: "#00d4ff",
    color: "#000000",
    fontSize: "13px",
    fontWeight: 600,
    textDecoration: "none",
    padding: "12px 24px",
    borderRadius: "2px",
    display: "inline-block",
    margin: "4px 8px 4px 0",
  } as React.CSSProperties,
  quote: {
    fontSize: "13px",
    color: "#9aa0a6",
    fontStyle: "italic",
    borderLeft: "3px solid #005566",
    paddingLeft: "12px",
    margin: "16px 0",
  } as React.CSSProperties,
  body: {
    backgroundColor: "#0a0c0f",
    fontFamily: "'Helvetica Neue', Helvetica, sans-serif",
  } as React.CSSProperties,
  container: {
    maxWidth: "520px",
    margin: "0 auto",
    padding: "24px 20px",
  } as React.CSSProperties,
  main: {
    backgroundColor: "#0f1215",
    border: "1px solid #252a30",
    borderRadius: "4px",
    padding: "24px",
  } as React.CSSProperties,
  hr: {
    borderColor: "#252a30",
    margin: "20px 0",
  } as React.CSSProperties,
};

export function TraceEscalationEmail({
  summary,
  viewUrl,
  claimUrl,
  escalateUrl,
  customMessage,
}: TraceEscalationEmailProps) {
  const confidenceLabel = formatConfidenceLabel(summary.confidence);
  const duration = formatDuration(summary.firstEventAt, summary.lastEventAt);
  const sourcesText = summary.sources.join(", ") || "—";
  const incorrectText =
    summary.incorrectActionsCount > 0
      ? `${summary.incorrectActionsCount}. Critical errors may be present.`
      : `${summary.incorrectActionsCount}.`;

  return (
    <Html>
      <Head />
      <Preview>{`Trace #${summary.id} requires review — ${summary.conversationId}`}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.main}>
            <Heading style={styles.heading}>
              {`Trace Requires Review — #${summary.id}`}
            </Heading>

            <Text style={styles.metaRow}>
              {`Conversation ID: ${summary.conversationId}`}
            </Text>
            <Text style={styles.metaRow}>
              {`Sources: ${sourcesText}`}
            </Text>
            <Text style={styles.metaRow}>
              {`Confidence: ${confidenceLabel}`}
            </Text>
            <Text style={styles.metaRow}>
              {`Events: ${summary.eventCount} · Duration: ${duration}`}
            </Text>

            <Text style={styles.paragraph}>
              {`Incorrect actions: ${incorrectText}`}
            </Text>

            {customMessage && (
              <>
                <Hr style={styles.hr} />
                <Text style={styles.quote}>{customMessage}</Text>
              </>
            )}

            <Hr style={styles.hr} />

            <Text style={styles.paragraph}>Choose an action:</Text>
            <Section style={{ marginTop: "16px" }}>
              <Button style={styles.button} href={viewUrl}>
                View Trace
              </Button>
              <Button style={styles.button} href={claimUrl}>
                Claim Trace
              </Button>
              <Button style={styles.button} href={escalateUrl}>
                Escalate to Manager
              </Button>
            </Section>

            <Text style={{ ...styles.paragraph, fontSize: "11px", color: "#5f6368", marginTop: "24px" }}>
              Links expire in 48 hours. If you didn’t expect this request, you can ignore this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default TraceEscalationEmail;
