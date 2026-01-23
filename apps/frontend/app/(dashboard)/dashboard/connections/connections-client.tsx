"use client";

import { useEffect, useState } from "react";

interface ConnectionData {
  id: string;
  provider: string;
  status: string;
  metadata: {
    workspace_id?: string;
    workspace_name?: string;
    admin_email?: string;
    region?: string;
    connected_at?: string;
  } | null;
  createdAt: Date;
}

interface ConnectionsClientProps {
  connections: ConnectionData[];
  intercomConnection: ConnectionData | null;
  successMessage?: string;
  errorMessage?: string;
}

export function ConnectionsClient({
  connections,
  intercomConnection,
  successMessage,
  errorMessage,
}: ConnectionsClientProps) {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  useEffect(() => {
    if (successMessage === "intercom") {
      setToastMessage("Successfully connected to Intercom!");
      setToastType("success");
      setShowToast(true);
    } else if (errorMessage) {
      const errorMessages: Record<string, string> = {
        invalid_state: "Invalid state - please try again",
        state_expired: "Session expired - please try again",
        token_exchange_failed: "Failed to connect - please try again",
        configuration_error: "Configuration error - contact support",
        database_error: "Failed to save connection - please try again",
        access_denied: "Access denied - you cancelled the authorization",
      };
      setToastMessage(errorMessages[errorMessage] || `Error: ${errorMessage}`);
      setToastType("error");
      setShowToast(true);
    }
  }, [successMessage, errorMessage]);

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const handleConnectIntercom = () => {
    window.location.href = "/api/connections/intercom/authorize";
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Toast notification */}
      {showToast && (
        <div
          className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transition-all ${
            toastType === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          <div className="flex items-center gap-2">
            {toastType === "success" ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {toastMessage}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Connections</h1>
          <p className="text-gray-600 mt-1">Manage your integrations and data sources</p>
        </div>
      </div>

      {/* Available Integrations */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Available Integrations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Intercom */}
          <div className={`border rounded-lg p-4 transition-all ${
            intercomConnection 
              ? "border-green-300 bg-green-50" 
              : "border-gray-200 hover:border-blue-300 hover:shadow-md"
          }`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                intercomConnection ? "bg-green-100" : "bg-blue-100"
              }`}>
                <svg className={`w-6 h-6 ${intercomConnection ? "text-green-600" : "text-blue-600"}`} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-gray-900">Intercom</h3>
                  {intercomConnection && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                      Connected
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">Customer messaging</p>
              </div>
            </div>
            
            {intercomConnection ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  Connected to <span className="font-medium">{intercomConnection.metadata?.workspace_name || "Workspace"}</span>
                </p>
                <p className="text-xs text-gray-500">
                  {intercomConnection.metadata?.admin_email}
                </p>
                <button
                  onClick={handleConnectIntercom}
                  className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors text-sm"
                >
                  Reconnect
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  Capture conversations, events, and user data from Intercom.
                </p>
                <button
                  onClick={handleConnectIntercom}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
                >
                  Connect Intercom
                </button>
              </>
            )}
          </div>

          {/* Zendesk - Coming Soon */}
          <div className="border border-gray-200 rounded-lg p-4 opacity-60">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Zendesk</h3>
                <p className="text-xs text-gray-500">Support tickets</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Sync support tickets and customer interactions.
            </p>
            <button
              className="w-full px-4 py-2 bg-gray-100 text-gray-500 rounded-lg font-medium cursor-not-allowed text-sm"
              disabled
            >
              Coming Soon
            </button>
          </div>

          {/* Stripe - Coming Soon */}
          <div className="border border-gray-200 rounded-lg p-4 opacity-60">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Stripe</h3>
                <p className="text-xs text-gray-500">Payment events</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Track payment events and subscription changes.
            </p>
            <button
              className="w-full px-4 py-2 bg-gray-100 text-gray-500 rounded-lg font-medium cursor-not-allowed text-sm"
              disabled
            >
              Coming Soon
            </button>
          </div>
        </div>
      </div>

      {/* Connected Integrations */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Connected Integrations</h2>
        {connections.filter(c => c.status === "active").length > 0 ? (
          <div className="space-y-3">
            {connections
              .filter((c) => c.status === "active")
              .map((connection) => (
                <div
                  key={connection.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                      {connection.provider === "intercom" && (
                        <svg className="w-6 h-6 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                        </svg>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 capitalize">
                          {connection.provider}
                        </h3>
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                          Active
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {connection.metadata?.workspace_name || "Connected workspace"}
                        {connection.metadata?.connected_at && (
                          <span className="ml-2">
                            · Connected {formatDate(new Date(connection.metadata.connected_at))}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {connection.metadata?.region && (
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                        {connection.metadata.region}
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No integrations connected yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
