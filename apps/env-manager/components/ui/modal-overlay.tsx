"use client";

interface ModalOverlayProps {
  onClose: () => void;
  maxWidth?: string;
  children: React.ReactNode;
}

export function ModalOverlay({
  onClose,
  maxWidth = "max-w-md",
  children,
}: ModalOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-void/80 backdrop-blur-sm" />
      <div className={`relative w-full ${maxWidth} mx-4 panel`}>{children}</div>
    </div>
  );
}

export function ModalHeader({
  title,
  icon,
  onClose,
}: {
  title: string;
  icon?: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="panel__header">
      <div className="flex items-center gap-2">
        {icon}
        <span className="panel__title">{title}</span>
      </div>
      <button onClick={onClose} className="text-tertiary hover:text-primary">
        <svg
          className="w-4 h-4"
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
  );
}

export function InviteResultBanner({
  email,
  emailSent,
  emailError,
}: {
  email: string;
  emailSent?: boolean;
  emailError?: string | null;
}) {
  return (
    <>
      {emailSent && (
        <div className="flex items-center gap-2 p-2 bg-nominal-bg border border-nominal-dim rounded-sm">
          <svg
            className="w-4 h-4 text-nominal shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
            />
          </svg>
          <span className="text-xs text-nominal">
            Invite email sent to {email}
          </span>
        </div>
      )}
      {emailError && (
        <div className="flex items-center gap-2 p-2 bg-caution-bg border border-caution-dim rounded-sm">
          <span className="status-dot status-dot--caution shrink-0" />
          <span className="text-xs text-caution">
            Email failed: {emailError}
          </span>
        </div>
      )}
    </>
  );
}

export function LoginLinkDisplay({ loginUrl }: { loginUrl: string }) {
  return (
    <div>
      <span className="label block mb-1.5">Login link</span>
      <div className="flex items-center gap-2 bg-elevated border border-border-default rounded-sm px-3 py-2">
        <span className="font-mono text-xs text-data flex-1 truncate">
          {loginUrl}
        </span>
        <button
          onClick={() => navigator.clipboard.writeText(loginUrl)}
          className="text-tertiary hover:text-primary shrink-0"
          title="Copy"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
