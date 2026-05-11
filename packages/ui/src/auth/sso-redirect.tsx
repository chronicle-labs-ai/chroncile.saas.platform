"use client";

import * as React from "react";
import { Spinner } from "../primitives/spinner";
import { Eyebrow } from "../primitives/eyebrow";
import { SystemWindow, SysRow, SysPre } from "../admin/system-window";
import { AuthDisplay, AuthLede } from "./_internal";

/*
 * SSORedirect — interstitial rendered while the browser is being
 * redirected to the SSO/OAuth provider (C.2 / D.3 in the prototype).
 *
 * Doubles as a developer-readable inspector: the SystemWindow shows
 * the `getAuthorizationUrl` payload (state / redirect_uri / scope /
 * organizationId) so we can pass through it without hiding what's
 * happening on the wire. Pure presentation.
 */

export interface SSORedirectProps {
  /** "Google" / "GitHub" / "Okta" — visible in the headline. */
  provider: string;
  /** Full authorization URL we're 302-ing to. */
  authorizationUrl: string;
  /** The `state` parameter (anti-CSRF). */
  state: string;
  /** The `redirect_uri` parameter. */
  redirectUri: string;
  /** Space-separated scopes (e.g. "openid profile email"). */
  scope: string;
  /**
   * When set, the org id is pre-bound on the provider request — D.3.
   * Surfaces a row in the inspector + tweaks the lede.
   */
  organizationId?: string;
}

/**
 * "Connecting to <provider>…" interstitial with a developer-readable
 * SystemWindow exposing the OAuth/SAML request params.
 */
export function SSORedirect({
  provider,
  authorizationUrl,
  state,
  redirectUri,
  scope,
  organizationId,
}: SSORedirectProps) {
  const isPreBound = !!organizationId;
  let host = "the provider";
  try {
    host = new URL(authorizationUrl).host;
  } catch {
    /* fall through to default */
  }

  return (
    <div className="flex flex-col">
      <Eyebrow>
        SSO ·{" "}
        <b className="text-ink-hi">{isPreBound ? "Pre-bound" : "Connecting"}</b>
      </Eyebrow>
      <AuthDisplay>
        Connecting to <em>{provider}…</em>
      </AuthDisplay>
      <AuthLede>
        {isPreBound ? (
          <>
            Your organization is pre-bound on this request — the callback will
            land you straight in your workspace, no membership lookup.
          </>
        ) : (
          <>
            One redirect, then we&rsquo;ll exchange the code for a session and
            route you back.
          </>
        )}
      </AuthLede>

      <div className="cg-fade-up cg-fade-up-2 mt-s-8 flex flex-col gap-s-4">
        <div className="inline-flex items-center gap-s-2 font-mono text-mono-sm text-ink-lo">
          <Spinner size="sm" tone="ember" />
          <span>302 → {host}</span>
        </div>

        <SystemWindow title="getAuthorizationUrl" note={`/ ${provider}`}>
          <SysRow label="Provider" value={provider} />
          {organizationId ? (
            <SysRow
              label="Organization"
              value={organizationId}
              tone="highlight"
            />
          ) : null}
          <SysRow label="State" value={state} />
          <SysRow label="Redirect URI" value={redirectUri} />
          <SysRow label="Scope" value={scope} />
          <SysPre label="302 LOCATION">{authorizationUrl}</SysPre>
        </SystemWindow>
      </div>
    </div>
  );
}
