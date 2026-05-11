import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { createOAuthState } from "@/server/auth/state-token";
import {
  assertWorkOSEnvironment,
  workos,
  WORKOS_CLIENT_ID,
  WORKOS_REDIRECT_URI,
} from "@/server/auth/workos";

const PROVIDER_MAP = {
  google: "GoogleOAuth",
  github: "GitHubOAuth",
  microsoft: "MicrosoftOAuth",
  apple: "AppleOAuth",
} as const satisfies Record<string, string>;

type ProviderAlias = keyof typeof PROVIDER_MAP;

function isProviderAlias(value: string): value is ProviderAlias {
  return value in PROVIDER_MAP;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  assertWorkOSEnvironment();

  const { provider: rawProvider } = await params;
  const alias = rawProvider.toLowerCase();

  if (!isProviderAlias(alias)) {
    redirect(
      `/login?error=${encodeURIComponent("unsupported_oauth_provider")}`,
    );
  }

  const fromParam = request.nextUrl.searchParams.get("from");
  const invitationTokenParam =
    request.nextUrl.searchParams.get("invitation_token");
  const state = createOAuthState(fromParam, invitationTokenParam);

  const authorizationUrl = workos.userManagement.getAuthorizationUrl({
    provider: PROVIDER_MAP[alias],
    redirectUri: WORKOS_REDIRECT_URI,
    clientId: WORKOS_CLIENT_ID,
    state,
  });

  redirect(authorizationUrl);
}
