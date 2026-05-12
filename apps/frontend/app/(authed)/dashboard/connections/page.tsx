"use client";

import { ConnectionsManager } from "ui";

import {
  useConnectionBackfills,
  useConnectionDeliveries,
  useConnectionEventSubs,
  useConnections,
  useDisconnectConnectionAction,
  usePauseConnectionAction,
  useReauthConnectionAction,
  useResumeConnectionAction,
  useRotateConnectionSecretAction,
  useRunConnectionBackfillAction,
  useTestConnectionAction,
} from "@/lib/data/connections";

/*
 * /dashboard/connections
 *
 * The connections manager — list/grid + detail drawer for every
 * live integration in the workspace. Data + every per-row mutation
 * (pause/resume/test/reauth/rotate/backfill/disconnect) flow
 * through the connections provider, so flipping
 * `NEXT_PUBLIC_DATA_CONNECTIONS=mock|app|chronicle` swaps the source
 * without touching this file.
 */
export default function ConnectionsPage() {
  const { data: connections } = useConnections();
  const { data: backfillsByConnection } = useConnectionBackfills();
  const { data: deliveriesByConnection } = useConnectionDeliveries();
  const { data: eventSubsByConnection } = useConnectionEventSubs();

  const onPause = usePauseConnectionAction();
  const onResume = useResumeConnectionAction();
  const onTest = useTestConnectionAction();
  const onReauth = useReauthConnectionAction();
  const onRotateSecret = useRotateConnectionSecretAction();
  const onRunBackfill = useRunConnectionBackfillAction();
  const onDisconnect = useDisconnectConnectionAction();

  return (
    <ConnectionsManager
      connections={connections}
      backfillsByConnection={backfillsByConnection}
      deliveriesByConnection={deliveriesByConnection}
      eventSubsByConnection={eventSubsByConnection}
      onPause={onPause}
      onResume={onResume}
      onTest={onTest}
      onReauth={onReauth}
      onRotateSecret={onRotateSecret}
      onRunBackfill={onRunBackfill}
      onDisconnect={onDisconnect}
    />
  );
}
