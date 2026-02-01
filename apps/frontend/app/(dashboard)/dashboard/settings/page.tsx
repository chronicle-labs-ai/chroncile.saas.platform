import { auth } from "@/lib/auth";
import { CopyButton } from "@/components/ui/copy-button";

export default async function SettingsPage() {
  const session = await auth();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-tertiary tracking-wide uppercase mb-1">
            System Configuration
          </div>
          <h1 className="text-2xl font-semibold text-primary">Settings</h1>
        </div>
      </div>

      {/* Profile Section */}
      <div className="panel">
        <div className="panel__header">
          <span className="panel__title">Profile</span>
          <span className="badge badge--nominal">Authenticated</span>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-tertiary tracking-wide uppercase mb-2">
                Name
              </label>
              <input
                type="text"
                defaultValue={session?.user?.name || ""}
                className="w-full px-3 py-2 bg-elevated border border-border-default text-sm text-secondary focus:outline-none focus:border-data"
                disabled
              />
            </div>
            
            <div>
              <label className="block text-xs text-tertiary tracking-wide uppercase mb-2">
                Email
              </label>
              <input
                type="email"
                defaultValue={session?.user?.email || ""}
                className="w-full px-3 py-2 bg-base border border-border-dim text-sm text-disabled cursor-not-allowed"
                disabled
              />
            </div>
          </div>
        </div>
      </div>

      {/* Organization Section */}
      <div className="panel">
        <div className="panel__header">
          <span className="panel__title">Organization</span>
          <span className="badge badge--data">Tenant</span>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-tertiary tracking-wide uppercase mb-2">
                Organization Name
              </label>
              <input
                type="text"
                defaultValue={session?.user?.tenantName || ""}
                className="w-full px-3 py-2 bg-elevated border border-border-default text-sm text-secondary focus:outline-none focus:border-data"
                disabled
              />
            </div>
            
            <div>
              <label className="block text-xs text-tertiary tracking-wide uppercase mb-2">
                Slug
              </label>
              <input
                type="text"
                defaultValue={session?.user?.tenantSlug || ""}
                className="w-full px-3 py-2 bg-base border border-border-dim text-sm text-disabled cursor-not-allowed"
                disabled
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-tertiary tracking-wide uppercase mb-2">
              Tenant ID
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-base border border-border-dim font-mono text-xs text-secondary break-all">
                {session?.user?.tenantId || "—"}
              </code>
              <CopyButton text={session?.user?.tenantId || ""} />
            </div>
            <p className="mt-2 text-xs text-tertiary">
              Use this identifier when configuring webhooks or API integrations
            </p>
          </div>
        </div>
      </div>

      {/* API Configuration */}
      <div className="panel">
        <div className="panel__header">
          <span className="panel__title">API Configuration</span>
          <span className="badge badge--neutral">Read-only</span>
        </div>
        <div className="p-4">
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-tertiary tracking-wide uppercase mb-2">
                Webhook Endpoint
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-base border border-border-dim font-mono text-xs text-secondary break-all">
                  /api/webhooks/pipedream
                </code>
                <CopyButton text="/api/webhooks/pipedream" />
              </div>
            </div>

            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-tertiary">Environment</span>
                <span className="badge badge--caution">Development</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-tertiary">API Version</span>
                <span className="font-mono text-sm text-secondary">v1</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="panel">
        <div className="panel__header">
          <span className="panel__title">System Status</span>
          <span className="badge badge--nominal">All Systems Nominal</span>
        </div>
        <div className="divide-y divide-border-dim">
          <div className="flex items-center justify-between px-4 py-3 hover:bg-hover transition-colors">
            <div className="flex items-center gap-3">
              <div className="status-dot status-dot--nominal" />
              <span className="text-sm text-primary">Database</span>
            </div>
            <span className="font-mono text-xs text-nominal">Connected</span>
          </div>
          
          <div className="flex items-center justify-between px-4 py-3 hover:bg-hover transition-colors">
            <div className="flex items-center gap-3">
              <div className="status-dot status-dot--nominal" />
              <span className="text-sm text-primary">Authentication</span>
            </div>
            <span className="font-mono text-xs text-nominal">Active</span>
          </div>
          
          <div className="flex items-center justify-between px-4 py-3 hover:bg-hover transition-colors">
            <div className="flex items-center gap-3">
              <div className="status-dot status-dot--data" />
              <span className="text-sm text-primary">Events Manager</span>
            </div>
            <span className="font-mono text-xs text-data">Standby</span>
          </div>
          
          <div className="flex items-center justify-between px-4 py-3 hover:bg-hover transition-colors">
            <div className="flex items-center gap-3">
              <div className="status-dot status-dot--nominal" />
              <span className="text-sm text-primary">Pipedream</span>
            </div>
            <span className="font-mono text-xs text-nominal">Configured</span>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="panel border-critical-dim">
        <div className="flex items-center justify-between px-4 py-3 bg-critical-bg border-b border-critical-dim">
          <div className="flex items-center gap-3">
            <div className="status-dot status-dot--critical" />
            <span className="text-sm font-medium text-critical">Danger Zone</span>
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-primary mb-1">
                Delete Organization
              </div>
              <p className="text-sm text-tertiary">
                Permanently delete organization and all associated data. This action cannot be undone.
              </p>
            </div>
            <button className="btn btn--critical opacity-50 cursor-not-allowed" disabled>
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
