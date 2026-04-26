/*
 * Connectors — per-source modals + supporting primitives.
 *
 * Composed from `ConnectorModalShell` (head + footer chrome around
 * the existing `Modal`), the helpers in `_internal.tsx`, and the
 * per-archetype catalog in `data.ts`. Imported by
 * `onboarding/step-connect.tsx` to dispatch on `source.id`.
 */

export { ConnectorModalShell } from "./connector-modal-shell";
export type { ConnectorModalShellProps } from "./connector-modal-shell";

/* ── Archetype modals ────────────────────────────────────── */

export { ConnectShared } from "./connect-shared";
export type { ConnectSharedProps } from "./connect-shared";

export { ConnectStripe } from "./connect-stripe";
export type { ConnectStripeProps } from "./connect-stripe";

export { ConnectSlack } from "./connect-slack";
export type { ConnectSlackProps } from "./connect-slack";

export { ConnectHubSpot } from "./connect-hubspot";
export type { ConnectHubSpotProps } from "./connect-hubspot";

export { ConnectReverseWebhook } from "./connect-reverse-webhook";
export type { ConnectReverseWebhookProps } from "./connect-reverse-webhook";

export { ConnectWizard } from "./connect-wizard";
export type { ConnectWizardProps } from "./connect-wizard";

/* ── Edge states ─────────────────────────────────────────── */

export { StateError } from "./state-error";
export type { StateErrorProps, ConnectorErrorKind } from "./state-error";

export { StateReauth } from "./state-reauth";
export type { StateReauthProps } from "./state-reauth";

export { StateTesting } from "./state-testing";
export type { StateTestingProps, ConnectorCheck } from "./state-testing";

/* ── Video pieces ────────────────────────────────────────── */

export { VideoPlayer } from "./video-player";
export type { VideoPlayerProps, VideoChapter } from "./video-player";

export { WatchPill } from "./watch-pill";
export type { WatchPillProps } from "./watch-pill";

export { VideoInline } from "./video-inline";
export type { VideoInlineProps } from "./video-inline";

export { VideoRail } from "./video-rail";
export type { VideoRailProps } from "./video-rail";

export { VideoPip } from "./video-pip";
export type { VideoPipProps } from "./video-pip";

export { VideoStepClips } from "./video-step-clips";
export type { VideoStepClipsProps, VideoStepClip } from "./video-step-clips";

/* ── Catalogs (consumed by archetype modals; apps can extend) ── */

export {
  STRIPE_EVENT_TYPES,
  SLACK_SCOPES,
  SLACK_CHANNEL_SAMPLES,
  HUBSPOT_SCOPES,
  HUBSPOT_OBJECTS,
  HUBSPOT_DEFAULT_MAPPING,
  SALESFORCE_REGIONS,
  REVERSE_WEBHOOK_URL_TEMPLATE,
} from "./data";
export type {
  StripeEventType,
  StripeEnvMode,
  SlackScope,
  SlackChannelStub,
  SlackDirection,
  HubSpotScope,
  HubSpotObject,
  HubSpotMappingRow,
  SalesforceRegion,
} from "./data";
