"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAnalytics } from "@/shared/analytics";
import { getSentryDebugInfo } from "@/shared/observability/sentry-client";

const REQUIRED_CLICKS = 5;
const CLICK_RESET_MS = 2000;
const COPY_RESET_MS = 1200;
const REFRESH_INTERVAL_MS = 1000;
const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "localhost"]);

type DebugTabId = "posthog" | "sentry" | "context";

function formatValue(value: boolean | string | null | undefined) {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (value === null || value === undefined || value === "") {
    return "Unavailable";
  }

  return value;
}

function InfoRow({
  copiedKey,
  label,
  onCopy,
  value,
}: {
  copiedKey: string | null;
  label: string;
  onCopy: (key: string, value: string) => void;
  value: boolean | string | null | undefined;
}) {
  const formattedValue = formatValue(value);
  const isCopyable = typeof value === "string" && value.length > 0;

  return (
    <div className="flex items-start justify-between gap-3 border-b border-border-dim pb-2 last:border-0 last:pb-0">
      <div className="min-w-0">
        <div className="text-[10px] font-medium tracking-wider text-tertiary uppercase">
          {label}
        </div>
        <div className="mt-1 break-all font-mono text-[11px] text-secondary">
          {formattedValue}
        </div>
      </div>
      {isCopyable && (
        <button
          type="button"
          onClick={() => onCopy(label, value)}
          className="shrink-0 rounded border border-border-dim bg-elevated px-2 py-1 font-mono text-[10px] text-tertiary transition-colors hover:text-primary"
        >
          {copiedKey === label ? "Copied" : "Copy"}
        </button>
      )}
    </div>
  );
}

export function DeveloperWidget() {
  const analytics = useAnalytics();
  const pathname = usePathname();
  const { data: session } = useSession();
  const [clickCount, setClickCount] = useState(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isLocalHost] = useState(
    () =>
      typeof window !== "undefined"
      && LOCAL_HOSTNAMES.has(window.location.hostname)
  );
  const [isOpen, setIsOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [activeTab, setActiveTab] = useState<DebugTabId>("posthog");

  const analyticsDebugInfo = useMemo(
    () => analytics.getDebugInfo(),
    [analytics, refreshTick],
  );
  const sentryDebugInfo = useMemo(
    () => getSentryDebugInfo(),
    [refreshTick],
  );
  const host = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return window.location.host;
  }, []);
  const tabs = useMemo(
    () =>
      [
        {
          id: "posthog" as const,
          items: [
            { label: "Provider", value: analyticsDebugInfo.provider },
            { label: "Configured", value: analyticsDebugInfo.configured },
            { label: "Key present", value: analyticsDebugInfo.keyPresent },
            { label: "Host", value: analyticsDebugInfo.host },
            { label: "Session ID", value: analyticsDebugInfo.sessionId },
            { label: "Distinct ID", value: analyticsDebugInfo.distinctId },
          ],
          label: "PostHog",
        },
        {
          id: "sentry" as const,
          items: [
            { label: "Sentry configured", value: sentryDebugInfo.configured },
            { label: "Sentry DSN present", value: sentryDebugInfo.dsnPresent },
            { label: "Sentry host", value: sentryDebugInfo.dsnHost },
            { label: "Sentry org", value: sentryDebugInfo.org },
            { label: "Sentry project", value: sentryDebugInfo.project },
            { label: "Sentry replay enabled", value: sentryDebugInfo.replayEnabled },
            { label: "Sentry replay ID", value: sentryDebugInfo.replayId },
            { label: "Sentry user ID", value: sentryDebugInfo.userId },
            { label: "Sentry last event", value: sentryDebugInfo.lastEventId },
          ],
          label: "Sentry",
        },
        {
          id: "context" as const,
          items: [
            { label: "Route", value: pathname },
            { label: "Host name", value: host },
            { label: "User ID", value: session?.user?.id },
            { label: "Tenant ID", value: session?.user?.tenantId },
            { label: "Environment", value: process.env.NODE_ENV },
            { label: "Sentry environment", value: sentryDebugInfo.environment },
          ],
          label: "Context",
        },
      ] satisfies Array<{
        id: DebugTabId;
        items: Array<{ label: string; value: boolean | string | null | undefined }>;
        label: string;
      }>,
    [analyticsDebugInfo, host, pathname, sentryDebugInfo, session?.user?.id, session?.user?.tenantId],
  );
  const activeTabContent = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  useEffect(() => {
    if (clickCount === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setClickCount(0);
    }, CLICK_RESET_MS);

    return () => window.clearTimeout(timer);
  }, [clickCount]);

  useEffect(() => {
    if (!copiedKey) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCopiedKey(null);
    }, COPY_RESET_MS);

    return () => window.clearTimeout(timer);
  }, [copiedKey]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const interval = window.setInterval(() => {
      setRefreshTick((currentTick) => currentTick + 1);
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [isOpen]);

  if (!isLocalHost) {
    return null;
  }

  const handleTriggerClick = () => {
    setClickCount((currentCount) => {
      const nextCount = currentCount + 1;

      if (nextCount >= REQUIRED_CLICKS) {
        setIsOpen(true);
        return 0;
      }

      return nextCount;
    });
  };

  const handleCopy = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleTriggerClick}
        aria-label="Open developer tools"
        className="fixed bottom-0 right-0 z-[110] h-10 w-10 rounded-tl-md opacity-0 transition-opacity hover:opacity-10"
        style={{ background: "var(--border-dim)" }}
      />

      {clickCount > 0 && !isOpen && (
        <div className="fixed bottom-4 right-12 z-[115] rounded border border-border-dim bg-surface px-3 py-2 font-mono text-[10px] text-tertiary shadow-lg">
          Dev tools {clickCount}/{REQUIRED_CLICKS}
        </div>
      )}

      {isOpen && (
        <div
          className="fixed bottom-6 right-6 z-[120] flex h-[460px] w-[360px] max-w-[calc(100vw-2rem)] flex-col rounded border border-border-dim bg-surface shadow-xl"
          style={{ isolation: "isolate" }}
        >
          <div className="flex items-center justify-between border-b border-border-dim bg-elevated px-4 py-3">
            <div>
              <div className="text-sm font-medium text-primary">Developer tools</div>
              <div className="mt-1 font-mono text-[10px] text-tertiary">
                Local observability debug panel
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded p-1 text-tertiary transition-colors hover:text-primary"
              aria-label="Close developer tools"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="border-b border-border-dim bg-surface px-2 py-2">
            <div className="flex items-center gap-1">
              {tabs.map((tab) => {
                const isActive = tab.id === activeTab;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded px-3 py-1.5 font-mono text-[10px] font-medium tracking-wider uppercase transition-colors ${
                      isActive
                        ? "bg-data-bg text-data"
                        : "text-tertiary hover:bg-elevated hover:text-primary"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-hidden px-4 py-4">
            <div className="mb-3 font-mono text-[10px] font-medium tracking-wider text-tertiary uppercase">
              {activeTabContent.label}
            </div>
            <div className="h-full overflow-y-auto pr-1">
              <div className="space-y-3">
                {activeTabContent.items.map((item) => (
                  <InfoRow
                    key={`${activeTabContent.id}-${item.label}`}
                    copiedKey={copiedKey}
                    label={item.label}
                    onCopy={handleCopy}
                    value={item.value}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-border-dim bg-elevated px-4 py-2">
            <div className="font-mono text-[10px] text-tertiary">
              Press <span className="text-primary">Esc</span> to close
            </div>
          </div>
        </div>
      )}
    </>
  );
}
