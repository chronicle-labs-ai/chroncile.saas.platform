"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ConfirmModal } from "@/components/ui/modal";

interface ConnectionData {
  id: string;
  provider: string;
  status: string;
  pipedreamAuthId?: string | null;
  metadata: {
    workspace_id?: string;
    workspace_name?: string;
    account_name?: string;
    admin_email?: string;
    region?: string;
    connected_at?: string;
    connected_via?: string;
  } | null;
  createdAt: Date;
}

interface PipedreamApp {
  id: string;
  name_slug: string;
  name: string;
  auth_type: string;
  description?: string;
  img_src?: string;
  categories?: string | string[];
}

interface DeployedTrigger {
  id: string;
  deploymentId: string;
  triggerId: string;
  connectionId: string;
  provider: string;
  status: string;
  active: boolean;
  createdAt: string;
}

interface HealthCheckResult {
  healthy: boolean;
  status: "connected" | "error" | "expired" | "unknown";
  message: string;
  details?: {
    workspace_name?: string;
    admin_email?: string;
    region?: string;
    last_checked?: string;
  };
  error?: string;
}

type ConnectionHealth = {
  [connectionId: string]: {
    status: "idle" | "testing" | "healthy" | "error" | "expired";
    message?: string;
    lastChecked?: string;
  };
};

interface ConnectionsClientProps {
  connections: ConnectionData[];
  successMessage?: string;
  errorMessage?: string;
  pipedreamSuccess?: boolean;
  pipedreamError?: boolean;
  pipedreamApp?: string;
}

const FEATURED_APPS = ["intercom", "slack", "stripe", "hubspot", "zendesk", "github", "notion"];

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "connected", label: "Connected" },
  { id: "crm", label: "CRM" },
  { id: "communication", label: "Communication" },
  { id: "developer-tools", label: "Dev Tools" },
  { id: "marketing", label: "Marketing" },
  { id: "productivity", label: "Productivity" },
];

export function ConnectionsClient({
  connections: initialConnections,
  successMessage,
  errorMessage,
  pipedreamSuccess,
  pipedreamError,
  pipedreamApp,
}: ConnectionsClientProps) {
  const router = useRouter();
  const [connections, setConnections] = useState(initialConnections);
  
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  
  const [pipedreamApps, setPipedreamApps] = useState<PipedreamApp[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [searchingApps, setSearchingApps] = useState(false);
  const [connectingApp, setConnectingApp] = useState<string | null>(null);
  const [deployedTriggers, setDeployedTriggers] = useState<DeployedTrigger[]>([]);
  const [isPipedreamConfigured, setIsPipedreamConfigured] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showAllApps, setShowAllApps] = useState(false);
  
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [connectionToDisconnect, setConnectionToDisconnect] = useState<ConnectionData | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const [connectionHealth, setConnectionHealth] = useState<ConnectionHealth>({});

  const showToastMessage = useCallback((message: string, type: "success" | "error") => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
  }, []);

  useEffect(() => {
    if (successMessage === "disconnected") {
      showToastMessage("Connection disconnected successfully", "success");
    } else if (pipedreamSuccess) {
      async function syncConnections() {
        try {
          const response = await fetch("/api/pipedream/accounts/sync", {
            method: "POST",
          });

          if (response.ok) {
            const data = await response.json();
            const appName = pipedreamApp || "the integration";
            showToastMessage(
              `Successfully connected to ${appName}! ${data.synced > 0 ? `Synced ${data.synced} connection(s).` : ""}`,
              "success"
            );
            router.refresh();
            setTimeout(() => {
              window.location.href = "/dashboard/connections";
            }, 500);
          } else {
            throw new Error("Failed to sync connections");
          }
        } catch (error) {
          console.error("Failed to sync Pipedream connections:", error);
          showToastMessage(
            pipedreamApp 
              ? `Connected to ${pipedreamApp}, but failed to sync. Please refresh the page.`
              : "Connection successful, but failed to sync. Please refresh the page.",
            "error"
          );
          setTimeout(() => {
            window.location.href = "/dashboard/connections";
          }, 1000);
        }
      }
      
      syncConnections();
    } else if (pipedreamError) {
      showToastMessage("Failed to connect - please try again", "error");
    } else if (errorMessage) {
      const errorMessages: Record<string, string> = {
        invalid_state: "Security check failed. Please try connecting again.",
        state_expired: "Your session expired. Please try connecting again.",
        token_exchange_failed: "Failed to connect. Please try again.",
        configuration_error: "There's a configuration issue. Please contact support.",
        database_error: "Failed to save the connection. Please try again.",
        access_denied: "You cancelled the authorization. Connect when you're ready.",
        workspace_info_failed: "Couldn't retrieve workspace information. Please try again.",
        missing_params: "The authorization response was incomplete. Please try again.",
        invalid_state_format: "Invalid authorization data. Please try again.",
        no_token: "No access token received. Please try again.",
        token_exchange_error: "Network error during authorization. Please check your connection.",
        workspace_info_error: "Network error getting workspace info. Please try again.",
        encryption_not_configured: "Server configuration error. Please contact support.",
        disconnect_failed: "Failed to disconnect. Please try again.",
        intercom_oauth_deprecated: "Direct Intercom OAuth has been deprecated. Please use the Pipedream integration below.",
      };
      showToastMessage(errorMessages[errorMessage] || `Error: ${errorMessage}`, "error");
    }
  }, [successMessage, errorMessage, pipedreamSuccess, pipedreamError, pipedreamApp, showToastMessage, router]);

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const fetchApps = useCallback(async (query?: string) => {
    try {
      const params = new URLSearchParams();
      params.set("limit", "50");
      if (query) {
        params.set("q", query);
      }
      
      const response = await fetch(`/api/pipedream/apps?${params}`);
      if (response.ok) {
        const data = await response.json();
        return data.data || [];
      } else if (response.status === 500) {
        setIsPipedreamConfigured(false);
        return [];
      }
      return [];
    } catch (error) {
      console.error("Failed to fetch Pipedream apps:", error);
      setIsPipedreamConfigured(false);
      return [];
    }
  }, []);

  useEffect(() => {
    async function loadInitialApps() {
      setLoadingApps(true);
      try {
        const featuredPromises = FEATURED_APPS.map(appSlug => 
          fetchApps(appSlug).then(apps => apps.filter((app: PipedreamApp) => app.name_slug === appSlug))
        );
        
        const popularPromise = fetchApps();
        
        const [featuredResults, popularApps] = await Promise.all([
          Promise.all(featuredPromises),
          popularPromise,
        ]);
        
        const featuredApps = featuredResults.flat();
        const featuredSlugs = new Set(featuredApps.map((app: PipedreamApp) => app.name_slug));
        const uniquePopularApps = popularApps.filter((app: PipedreamApp) => !featuredSlugs.has(app.name_slug));
        
        setPipedreamApps([...featuredApps, ...uniquePopularApps]);
      } catch (error) {
        console.error("Failed to load initial apps:", error);
      } finally {
        setLoadingApps(false);
      }
    }
    loadInitialApps();
  }, [fetchApps]);

  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (!searchQuery.trim()) {
      async function resetApps() {
        setSearchingApps(true);
        try {
          const featuredPromises = FEATURED_APPS.map(appSlug => 
            fetchApps(appSlug).then(apps => apps.filter((app: PipedreamApp) => app.name_slug === appSlug))
          );
          const popularPromise = fetchApps();
          
          const [featuredResults, popularApps] = await Promise.all([
            Promise.all(featuredPromises),
            popularPromise,
          ]);
          
          const featuredApps = featuredResults.flat();
          const featuredSlugs = new Set(featuredApps.map((app: PipedreamApp) => app.name_slug));
          const uniquePopularApps = popularApps.filter((app: PipedreamApp) => !featuredSlugs.has(app.name_slug));
          
          setPipedreamApps([...featuredApps, ...uniquePopularApps]);
        } finally {
          setSearchingApps(false);
        }
      }
      if (!loadingApps) {
        resetApps();
      }
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      setSearchingApps(true);
      try {
        const results = await fetchApps(searchQuery.trim());
        setPipedreamApps(results);
      } finally {
        setSearchingApps(false);
      }
    }, 300);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery, fetchApps, loadingApps]);

  useEffect(() => {
    async function fetchTriggers() {
      try {
        const response = await fetch("/api/pipedream/triggers/deployed");
        if (response.ok) {
          const data = await response.json();
          setDeployedTriggers(data.data || []);
        }
      } catch (error) {
        console.error("Failed to fetch deployed triggers:", error);
      }
    }
    if (isPipedreamConfigured) {
      fetchTriggers();
    }
  }, [isPipedreamConfigured]);

  const handleConnectPipedream = useCallback(async (app: string) => {
    setConnectingApp(app);
    try {
      const tokenResponse = await fetch("/api/pipedream/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app }),
      });

      if (!tokenResponse.ok) {
        throw new Error("Failed to get connect token");
      }

      const responseData = await tokenResponse.json();
      const { connectLinkUrl } = responseData;
      
      let finalConnectUrl = connectLinkUrl;
      if (app && !connectLinkUrl.includes(`app=${app}`) && !connectLinkUrl.includes(`app_id=${app}`)) {
        const url = new URL(connectLinkUrl);
        url.searchParams.set('app', app);
        finalConnectUrl = url.toString();
      }
      
      window.location.href = finalConnectUrl;
    } catch (error) {
      console.error("Failed to initiate Pipedream connection:", error);
      showToastMessage("Failed to start connection flow", "error");
      setConnectingApp(null);
    }
  }, [showToastMessage]);

  const handleDeleteTrigger = async (deploymentId: string) => {
    if (!confirm("Are you sure you want to delete this trigger?")) return;

    try {
      const response = await fetch(`/api/pipedream/triggers/deployed/${deploymentId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setDeployedTriggers(prev => prev.filter(t => t.deploymentId !== deploymentId));
        showToastMessage("Trigger deleted successfully", "success");
      } else {
        throw new Error("Failed to delete trigger");
      }
    } catch (error) {
      console.error("Failed to delete trigger:", error);
      showToastMessage("Failed to delete trigger", "error");
    }
  };

  const handleDisconnectClick = (connection: ConnectionData) => {
    setConnectionToDisconnect(connection);
    setShowDisconnectModal(true);
  };

  const handleConfirmDisconnect = async () => {
    if (!connectionToDisconnect) return;

    setIsDisconnecting(true);

    try {
      const response = await fetch(`/api/connections/${connectionToDisconnect.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to disconnect");
      }

      setConnections((prev) => prev.filter((c) => c.id !== connectionToDisconnect.id));

      showToastMessage("Connection disconnected successfully", "success");
      setShowDisconnectModal(false);
      setConnectionToDisconnect(null);
      
      router.refresh();
    } catch (error) {
      console.error("Disconnect error:", error);
      showToastMessage(
        error instanceof Error ? error.message : "Failed to disconnect",
        "error"
      );
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleTestConnection = async (connection: ConnectionData) => {
    setConnectionHealth((prev) => ({
      ...prev,
      [connection.id]: { status: "testing" },
    }));

    try {
      const response = await fetch(`/api/connections/${connection.id}/test`, {
        method: "POST",
      });

      const data: HealthCheckResult = await response.json();

      setConnectionHealth((prev) => ({
        ...prev,
        [connection.id]: {
          status: data.healthy ? "healthy" : data.status === "expired" ? "expired" : "error",
          message: data.message,
          lastChecked: data.details?.last_checked,
        },
      }));

      if (data.healthy) {
        showToastMessage("Connection is healthy!", "success");
      } else {
        showToastMessage(data.error || data.message, "error");
      }
    } catch (error) {
      console.error("Health check error:", error);
      setConnectionHealth((prev) => ({
        ...prev,
        [connection.id]: {
          status: "error",
          message: "Failed to test connection",
        },
      }));
      showToastMessage("Failed to test connection", "error");
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getConnection = (provider: string) => {
    return connections.find(c => c.provider === provider && c.status === "active");
  };

  const filteredApps = pipedreamApps
    .filter((app) => {
      if (selectedCategory === "all") return true;
      if (selectedCategory === "connected") return !!getConnection(app.name_slug);
      
      const categoriesStr = Array.isArray(app.categories) 
        ? app.categories.join(" ").toLowerCase()
        : (typeof app.categories === "string" ? app.categories.toLowerCase() : "");
      
      return categoriesStr.includes(selectedCategory.toLowerCase());
    })
    .sort((a, b) => {
      if (!searchQuery) {
        const aIsFeatured = FEATURED_APPS.includes(a.name_slug);
        const bIsFeatured = FEATURED_APPS.includes(b.name_slug);
        
        if (aIsFeatured && !bIsFeatured) return -1;
        if (!aIsFeatured && bIsFeatured) return 1;
        
        if (aIsFeatured && bIsFeatured) {
          return FEATURED_APPS.indexOf(a.name_slug) - FEATURED_APPS.indexOf(b.name_slug);
        }
      }
      
      return a.name.localeCompare(b.name);
    });

  const displayedApps = showAllApps ? filteredApps : filteredApps.slice(0, 12);
  const hasMoreApps = filteredApps.length > 12;
  const activeConnections = connections.filter(c => c.status === "active").length;

  const getHealthIndicator = (connectionId: string) => {
    const health = connectionHealth[connectionId];
    if (!health || health.status === "idle") {
      return null;
    }

    if (health.status === "testing") {
      return (
        <span className="flex items-center gap-1 text-xs text-tertiary">
          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Testing...
        </span>
      );
    }

    if (health.status === "healthy") {
      return (
        <span className="flex items-center gap-1 text-xs text-nominal">
          <span className="w-2 h-2 bg-nominal rounded-full" />
          Healthy
        </span>
      );
    }

    if (health.status === "expired") {
      return (
        <span className="flex items-center gap-1 text-xs text-caution">
          <span className="w-2 h-2 bg-caution rounded-full" />
          Token Expired
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1 text-xs text-critical">
        <span className="w-2 h-2 bg-critical rounded-full" />
        Error
      </span>
    );
  };

  const renderAppCard = (app: PipedreamApp | { name_slug: string; name: string; description?: string }) => {
    const connection = getConnection(app.name_slug);
    const isConnected = !!connection;
    const isConnecting = connectingApp === app.name_slug;

    return (
      <div key={app.name_slug} className={`panel transition-all ${isConnected ? "border-nominal-dim" : ""}`}>
        <div className={`flex items-center justify-between px-4 py-3 border-b ${
          isConnected ? "bg-nominal-bg border-nominal-dim" : "bg-elevated border-border-dim"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 border flex items-center justify-center text-xs font-bold ${
              isConnected 
                ? "border-nominal bg-nominal-bg text-nominal" 
                : "border-border-default bg-surface text-tertiary"
            }`}>
              {app.name_slug.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-medium text-primary">{app.name}</div>
              <div className="text-xs text-tertiary">
                {Array.isArray((app as PipedreamApp).categories) 
                  ? ((app as PipedreamApp).categories as string[]).slice(0, 1).join("")
                  : "Integration"}
              </div>
            </div>
          </div>
          {isConnected && (
            <div className="flex items-center gap-2">
              <div className="status-dot status-dot--nominal" />
              <span className="font-mono text-xs text-nominal">Online</span>
            </div>
          )}
        </div>

        <div className="p-4">
          {isConnected ? (
            <div className="space-y-3">
              <div>
                <div className="text-xs text-tertiary tracking-wide uppercase mb-1">Connected to</div>
                <div className="text-sm font-medium text-primary">
                  {connection.metadata?.account_name || connection.metadata?.workspace_name || "Account"}
                </div>
              </div>
              {connection.metadata?.connected_at && (
                <div className="font-mono text-xs text-tertiary tabular-nums">
                  Since {formatDate(connection.metadata.connected_at)}
                </div>
              )}
              {connection.id && getHealthIndicator(connection.id)}
              <div className="flex gap-2">
                <button
                  onClick={() => handleTestConnection(connection)}
                  disabled={connectionHealth[connection.id]?.status === "testing"}
                  className="flex-1 btn btn--secondary disabled:opacity-50"
                >
                  {connectionHealth[connection.id]?.status === "testing" ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Testing...
                    </span>
                  ) : (
                    "Test"
                  )}
                </button>
                <button
                  onClick={() => handleConnectPipedream(app.name_slug)}
                  disabled={isConnecting}
                  className="btn btn--secondary"
                >
                  {isConnecting ? "..." : "Reconnect"}
                </button>
              </div>
              <button
                onClick={() => handleDisconnectClick(connection)}
                className="w-full px-3 py-2 bg-critical-bg text-critical border border-critical-dim text-sm font-medium hover:bg-critical hover:text-base transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-tertiary mb-4 line-clamp-2">
                {app.description || `Connect ${app.name} to capture events.`}
              </p>
              <button
                onClick={() => handleConnectPipedream(app.name_slug)}
                disabled={isConnecting}
                className="btn btn--primary w-full"
              >
                {isConnecting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Connecting...
                  </span>
                ) : (
                  "Connect"
                )}
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {showToast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 border transition-all ${
          toastType === "success" 
            ? "bg-nominal-bg border-nominal-dim text-nominal" 
            : "bg-critical-bg border-critical-dim text-critical"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`status-dot ${toastType === "success" ? "status-dot--nominal" : "status-dot--critical"}`} />
            <span className="text-sm font-medium">{toastMessage}</span>
            <button
              onClick={() => setShowToast(false)}
              className="ml-2 hover:opacity-80"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showDisconnectModal}
        onClose={() => {
          setShowDisconnectModal(false);
          setConnectionToDisconnect(null);
        }}
        onConfirm={handleConfirmDisconnect}
        title="Disconnect Integration"
        message={`Are you sure you want to disconnect ${connectionToDisconnect?.provider}? This will stop receiving new events from this integration. Your existing event data will be preserved.`}
        confirmText="Disconnect"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDisconnecting}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-tertiary tracking-wide uppercase mb-1">Integration Management</div>
          <h1 className="text-2xl font-semibold text-primary">Connections</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-elevated border border-border-dim">
            <div className={`status-dot ${activeConnections > 0 ? "status-dot--nominal" : "status-dot--offline"}`} />
            <span className="text-sm text-secondary">
              <span className="font-mono tabular-nums">{activeConnections}</span> active
            </span>
          </div>
        </div>
      </div>

      {/* Status Banner */}
      <div className="panel">
        <div className={`flex items-center justify-between px-4 py-3 ${
          activeConnections > 0 ? "bg-nominal-bg border-b border-nominal-dim" : "bg-data-bg border-b border-data-dim"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`status-dot ${activeConnections > 0 ? "status-dot--nominal status-dot--pulse" : "status-dot--data"}`} />
            <span className={`text-sm font-medium ${activeConnections > 0 ? "text-nominal" : "text-data"}`}>
              {activeConnections > 0 ? "Integrations Operational" : "Awaiting Connections"}
            </span>
          </div>
        </div>
      </div>

      {/* Available Integrations */}
      <div className="panel">
        <div className="panel__header">
          <span className="panel__title">Available Integrations</span>
          {isPipedreamConfigured && <span className="badge badge--neutral">Pipedream</span>}
        </div>

        {isPipedreamConfigured && !loadingApps && (
          <div className="px-4 py-4 border-b border-border-dim space-y-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                {searchingApps ? (
                  <svg className="w-4 h-4 text-data animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                )}
              </div>
              <input
                type="text"
                placeholder="Search integrations... (e.g., Intercom, Slack, Stripe)"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowAllApps(false);
                }}
                className="w-full pl-10 pr-3 py-2 bg-base border border-border-default text-sm placeholder:text-disabled focus:outline-none focus:border-data"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-tertiary hover:text-primary"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  onClick={() => {
                    setSelectedCategory(category.id);
                    setShowAllApps(false);
                  }}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors border ${
                    selectedCategory === category.id
                      ? "bg-data text-base border-data"
                      : "bg-elevated text-secondary border-border-default hover:border-border-bright"
                  }`}
                >
                  {category.label}
                  {category.id === "connected" && activeConnections > 0 && (
                    <span className="ml-1.5 font-mono tabular-nums">{activeConnections}</span>
                  )}
                </button>
              ))}
            </div>

            {(searchQuery || selectedCategory !== "all") && (
              <div className="text-sm text-tertiary">
                {searchingApps ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Searching...
                  </span>
                ) : (
                  <>
                    <span className="font-mono tabular-nums">{filteredApps.length}</span> result{filteredApps.length !== 1 ? "s" : ""}
                    {searchQuery && ` for "${searchQuery}"`}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <div className="p-4">
          {loadingApps ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="w-12 h-12 border-2 border-border-default rounded-full" />
                <div className="absolute top-0 left-0 w-12 h-12 border-2 border-data border-t-transparent rounded-full animate-spin" />
              </div>
              <div className="text-sm text-tertiary mt-4">Loading integrations...</div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isPipedreamConfigured && pipedreamApps.length > 0 ? (
                  <>
                    {displayedApps.map((app) => renderAppCard(app))}

                    {filteredApps.length === 0 && (searchQuery || selectedCategory !== "all") && (
                      <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-12 h-12 border border-border-dim bg-elevated flex items-center justify-center mb-3">
                          <svg className="w-6 h-6 text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                          </svg>
                        </div>
                        <div className="text-sm text-tertiary mb-2">No matches found</div>
                        <button
                          onClick={() => {
                            setSearchQuery("");
                            setSelectedCategory("all");
                          }}
                          className="text-sm text-data hover:text-primary"
                        >
                          Clear filters
                        </button>
                      </div>
                    )}
                  </>
                ) : !isPipedreamConfigured ? (
                  <div className="col-span-full panel">
                    <div className="flex items-center justify-between px-4 py-3 bg-caution-bg border-b border-caution-dim">
                      <div className="flex items-center gap-3">
                        <div className="status-dot status-dot--caution" />
                        <span className="text-sm font-medium text-caution">Pipedream not configured</span>
                      </div>
                    </div>
                    <div className="p-4">
                      <p className="text-sm text-tertiary">
                        Configure Pipedream credentials to enable additional integrations.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              {isPipedreamConfigured && hasMoreApps && !searchQuery && selectedCategory === "all" && (
                <div className="mt-6 text-center">
                  <button onClick={() => setShowAllApps(!showAllApps)} className="btn btn--ghost">
                    {showAllApps ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                        </svg>
                        Show Less
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                        Show All ({filteredApps.length})
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Active Connections */}
      {activeConnections > 0 && (
        <div className="panel">
          <div className="panel__header">
            <span className="panel__title">Active Connections</span>
            <span className="badge badge--nominal">{activeConnections} Online</span>
          </div>
          <div className="divide-y divide-border-dim">
            {connections
              .filter((c) => c.status === "active")
              .map((connection) => (
                <div
                  key={connection.id}
                  className="flex items-center justify-between px-4 py-4 hover:bg-hover transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 border border-nominal bg-nominal-bg flex items-center justify-center">
                      <span className="text-sm font-bold text-nominal">
                        {connection.provider.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-primary capitalize">
                          {connection.provider}
                        </span>
                        <span className="badge badge--nominal">Active</span>
                        {connection.pipedreamAuthId && <span className="badge badge--data">Pipedream</span>}
                      </div>
                      <div className="text-xs text-tertiary mt-0.5">
                        {connection.metadata?.account_name || connection.metadata?.workspace_name || "Connected workspace"}
                        {connection.metadata?.connected_at && (
                          <span className="ml-2">· <span className="font-mono tabular-nums">{formatDate(connection.metadata.connected_at)}</span></span>
                        )}
                      </div>
                      {getHealthIndicator(connection.id)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {connection.metadata?.region && (
                      <span className="badge badge--neutral">{connection.metadata.region}</span>
                    )}
                    <button
                      onClick={() => handleTestConnection(connection)}
                      disabled={connectionHealth[connection.id]?.status === "testing"}
                      className="p-2 text-tertiary hover:text-primary transition-colors disabled:opacity-50"
                      title="Test connection"
                    >
                      {connectionHealth[connection.id]?.status === "testing" ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => handleDisconnectClick(connection)}
                      className="p-2 text-tertiary hover:text-critical transition-colors"
                      title="Disconnect"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {isPipedreamConfigured && deployedTriggers.length > 0 && (
        <div className="panel">
          <div className="panel__header">
            <span className="panel__title">Event Sources</span>
            <span className="badge badge--data">{deployedTriggers.length} Deployed</span>
          </div>
          <div className="divide-y divide-border-dim">
            {deployedTriggers.map((trigger) => (
              <div
                key={trigger.id}
                className="flex items-center justify-between px-4 py-4 hover:bg-hover transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 border flex items-center justify-center ${
                    trigger.active 
                      ? "border-nominal bg-nominal-bg text-nominal" 
                      : "border-border-default bg-elevated text-tertiary"
                  }`}>
                    <span className="text-sm font-bold">
                      {trigger.provider.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-primary">{trigger.triggerId}</span>
                      <span className={`badge ${trigger.active ? "badge--nominal" : "badge--neutral"}`}>
                        {trigger.active ? "Active" : "Paused"}
                      </span>
                    </div>
                    <div className="text-xs text-tertiary mt-0.5">
                      {trigger.provider} · Created <span className="font-mono tabular-nums">{formatDate(trigger.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteTrigger(trigger.deploymentId)}
                  className="p-2 text-tertiary hover:text-critical transition-colors"
                  title="Delete trigger"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
