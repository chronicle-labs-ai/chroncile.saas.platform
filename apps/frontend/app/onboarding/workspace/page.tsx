import { redirect } from "next/navigation";

import { getSession } from "@/server/auth/session";
import { WorkspaceSetupClient } from "./workspace-setup-client";

export default async function WorkspaceOnboardingPage() {
  const session = await getSession();

  if (!session.authenticated) {
    redirect("/login?from=/onboarding/workspace");
  }

  return (
    <WorkspaceSetupClient
      email={session.user.email}
      firstName={session.user.firstName ?? null}
    />
  );
}
