"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_APP_ID = "drwqvw3v";

type IntercomWindow = Window & {
  Intercom?: (action: string, ...args: unknown[]) => void;
  intercomSettings?: Record<string, unknown>;
};

export function IntercomMessengerWidget() {
  const appId = process.env.NEXT_PUBLIC_INTERCOM_APP_ID || DEFAULT_APP_ID;
  const [loaded, setLoaded] = useState(false);
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const onHideRegistered = useRef(false);

  useEffect(() => {
    if (!appId.trim()) return;

    const w = window as IntercomWindow;
    w.intercomSettings = {
      app_id: appId,
      hide_default_launcher: true,
      z_index: 99999,
    };

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://widget.intercom.io/widget/${appId}`;
    script.onload = () => {
      scriptRef.current = script;
      setLoaded(true);
      // When user closes messenger, shutdown so next open = new identity
      if (!onHideRegistered.current && w.Intercom) {
        w.Intercom("onHide", () => {
          w.Intercom?.("shutdown");
        });
        onHideRegistered.current = true;
      }
    };
    document.body.appendChild(script);

    return () => {
      w.Intercom?.("shutdown");
      w.intercomSettings = undefined;
      delete (window as unknown as Record<string, unknown>)["Intercom"];
      if (script?.parentNode) script.parentNode.removeChild(script);
      document.querySelectorAll('script[src^="https://widget.intercom.io/widget/"]').forEach((el) => el.remove());
      onHideRegistered.current = false;
    };
  }, [appId]);

  const openMessenger = useCallback(() => {
    const w = window as IntercomWindow;
    if (!w.Intercom) return;
    // Shutdown clears cookie; boot without user_id = new anonymous visitor (avoids 403
    // when Identity Verification is enabled, which requires user_hash for user_id)
    w.Intercom("shutdown");
    w.Intercom("boot", {
      app_id: appId,
      hide_default_launcher: true,
      z_index: 99999,
    });
    w.Intercom("show");
  }, [appId]);

  return (
    <button
      type="button"
      onClick={openMessenger}
      className="fixed bottom-6 right-6 z-[100] w-12 h-12 rounded-full flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity border-2 border-data flex-shrink-0 disabled:opacity-50"
      style={{ background: "var(--data)", color: "var(--black)" }}
      title="Open Intercom messenger"
      aria-label="Open Intercom messenger"
      disabled={!loaded}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>
    </button>
  );
}
