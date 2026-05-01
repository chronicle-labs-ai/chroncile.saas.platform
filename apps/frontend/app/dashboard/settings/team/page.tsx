import { auth } from "@/server/auth/auth";

import { TeamSettingsClient } from "./team-settings-client";

export const dynamic = "force-dynamic";

export default async function TeamSettingsPage() {
  const session = await auth();
  return (
    <TeamSettingsClient
      orgName={session?.user?.tenantName || null}
      orgSlug={session?.user?.tenantSlug || null}
    />
  );
}
