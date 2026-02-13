import Link from "next/link";

export default function DocsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <div className="text-xs text-tertiary tracking-wide uppercase mb-1">
          Help
        </div>
        <h1 className="text-2xl font-semibold text-primary">
          User Manual
        </h1>
        <p className="text-sm text-tertiary mt-1">
          Learn how to use Chronicle Labs.
        </p>
      </div>

      <div className="panel">
        <div className="panel__header">
          <span className="panel__title">What is Chronicle Labs?</span>
        </div>
        <div className="panel__content space-y-3 text-sm text-secondary">
          <p>
            Chronicle Labs helps you connect your tools and services, see the
            events they generate, and keep an eye on your activity in one place.
            You can add connections (like webhooks or integrations), watch
            events as they come in, and use the dashboard to see how things are
            going. When session replay is available, you can also replay and
            validate recorded sessions.
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="panel__header">
          <span className="panel__title">Signing in and your account</span>
        </div>
        <div className="panel__content space-y-3 text-sm text-secondary">
          <p>
            Use the sign-in page to log in with your email and password. If you
            don’t have an account yet, choose “Create one” to sign up. Once
            you’re in, you’re in your own workspace: your events, connections,
            and settings are tied to your account and organization, so only you
            (and others in your organization, if applicable) see them.
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="panel__header">
          <span className="panel__title">Dashboard overview</span>
        </div>
        <div className="panel__content space-y-4 text-sm text-secondary">
          <p>
            The main dashboard gives you a quick snapshot of your account:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong className="text-primary">Events Today</strong> — How many
              events were received today (from midnight to now). Use this to see
              if data is flowing.
            </li>
            <li>
              <strong className="text-primary">Connections</strong> — How many
              active connections you have. Active means the connection is set up
              and can receive events.
            </li>
            <li>
              <strong className="text-primary">Sessions</strong> — Reserved for
              session-related metrics when that feature is available.
            </li>
            <li>
              <strong className="text-primary">System status</strong> — A short
              message at the top (e.g. “All Systems Operational”) so you know the
              service is running normally.
            </li>
          </ul>
          <p>
            Below the metrics you’ll see the Getting Started checklist and
            Recent Activity. Use the sidebar to open Events, Connections,
            Settings, or this manual.
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="panel__header">
          <span className="panel__title">Getting Started checklist</span>
        </div>
        <div className="panel__content space-y-4 text-sm text-secondary">
          <p>
            The checklist on the dashboard has three steps:
          </p>
          <ol className="list-decimal list-inside space-y-2">
            <li>
              <strong className="text-primary">Connect your first integration</strong> — Go to{" "}
              <Link href="/dashboard/connections" className="text-data hover:underline">
                Connections
              </Link>{" "}
              and add at least one connection. When it’s active, this step is
              marked complete.
            </li>
            <li>
              <strong className="text-primary">See your events</strong> — Once
              events are flowing, the second step completes. You can check{" "}
              <Link href="/dashboard/events" className="text-data hover:underline">
                Events
              </Link>{" "}
              and the “Events Today” number on the dashboard to confirm.
            </li>
            <li>
              <strong className="text-primary">Replay and validate</strong> —
              When session replay is available, you’ll be able to run recorded
              sessions against your agent for validation. This step will become
              available in a future update.
            </li>
          </ol>
        </div>
      </div>

      <div className="panel">
        <div className="panel__header">
          <span className="panel__title">Connections</span>
        </div>
        <div className="panel__content space-y-3 text-sm text-secondary">
          <p>
            A connection is a link between Chronicle Labs and an external service
            (for example a webhook or an integration like Pipedream). On the{" "}
            <Link href="/dashboard/connections" className="text-data hover:underline">
              Connections
            </Link>{" "}
            page you can add new connections and manage existing ones. When a
            connection is <strong className="text-primary">active</strong>, it
            is set up correctly and can receive events. If a connection is
            inactive or failed, check the details on the Connections page or
            your integration’s setup (e.g. webhook URL and credentials).
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="panel__header">
          <span className="panel__title">Events</span>
        </div>
        <div className="panel__content space-y-3 text-sm text-secondary">
          <p>
            The{" "}
            <Link href="/dashboard/events" className="text-data hover:underline">
              Events
            </Link>{" "}
            page shows the events that have been received for your account. You
            can see when each event happened, where it came from (source), and
            what type it is. Use this page to confirm that your connections are
            sending data and to browse recent activity. The list updates as new
            events arrive.
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="panel__header">
          <span className="panel__title">Recent Activity</span>
        </div>
        <div className="panel__content space-y-3 text-sm text-secondary">
          <p>
            On the main dashboard, the <strong className="text-primary">Recent Activity</strong> section
            shows the latest events from the last 24 hours. It’s a quick way to
            see what’s been happening without opening the full Events page. If
            there are no events yet, you’ll see an empty state—add a connection
            and start sending events to see them here.
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="panel__header">
          <span className="panel__title">Settings</span>
        </div>
        <div className="panel__content space-y-4 text-sm text-secondary">
          <p>
            In{" "}
            <Link href="/dashboard/settings" className="text-data hover:underline">
              Settings
            </Link>{" "}
            you can:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong className="text-primary">Profile</strong> — View your name
              and email (managed by your account provider).
            </li>
            <li>
              <strong className="text-primary">Organization</strong> — See your
              organization name and identifier. When you set up webhooks or
              integrations elsewhere, you may need to use the identifier shown
              here so events are sent to your workspace.
            </li>
            <li>
              <strong className="text-primary">API / Webhook</strong> — See the
              webhook endpoint and API details used to send events into Agent
              Warmup. Use these when configuring external tools.
            </li>
            <li>
              <strong className="text-primary">System Status</strong> — Check
              that database, authentication, and integrations are connected and
              working.
            </li>
            <li>
              <strong className="text-primary">Danger Zone</strong> — Options
              to delete your organization and data. These actions are permanent
              and may be disabled by your administrator.
            </li>
          </ul>
        </div>
      </div>

      <div className="panel">
        <div className="panel__header">
          <span className="panel__title">Help and support</span>
        </div>
        <div className="panel__content space-y-3 text-sm text-secondary">
          <p>
            This manual covers the main areas of the app. For technical
            assistance or to report a problem, use the{" "}
            <strong className="text-primary">Contact Support</strong> button on
            the dashboard. We’ll get back to you as soon as we can.
          </p>
        </div>
      </div>

      <div className="pt-4 border-t border-border-dim">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-data hover:underline"
        >
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
