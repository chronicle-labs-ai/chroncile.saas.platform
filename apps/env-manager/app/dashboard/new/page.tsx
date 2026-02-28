"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { BranchPicker } from "@/components/ui/branch-picker";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Branch {
  name: string;
  sha: string;
  isDefault: boolean;
}

const SECRET_FIELDS = [
  { key: "AUTH_SECRET", label: "Auth Secret", placeholder: "Override or leave blank for default" },
  { key: "STRIPE_SECRET_KEY", label: "Stripe Secret Key", placeholder: "sk_test_..." },
  { key: "PIPEDREAM_CLIENT_ID", label: "Pipedream Client ID", placeholder: "" },
  { key: "PIPEDREAM_CLIENT_SECRET", label: "Pipedream Client Secret", placeholder: "" },
  { key: "PIPEDREAM_PROJECT_ID", label: "Pipedream Project ID", placeholder: "" },
];

const TTL_OPTIONS = [
  { value: 4, label: "4 hours" },
  { value: 12, label: "12 hours" },
  { value: 24, label: "24 hours" },
  { value: 48, label: "48 hours" },
  { value: 168, label: "7 days" },
];

export default function NewEnvironmentPage() {
  const router = useRouter();
  const { data: branches, isLoading: branchesLoading } = useSWR<Branch[]>(
    "/api/branches",
    fetcher
  );

  const [selectedBranch, setSelectedBranch] = useState("");
  const [ttlHours, setTtlHours] = useState(24);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedBranchInfo = branches?.find((b) => b.name === selectedBranch);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranch) return;

    setSubmitting(true);
    setError(null);

    try {
      const nonEmptySecrets = Object.fromEntries(
        Object.entries(secrets).filter(([, v]) => v.trim() !== "")
      );

      const res = await fetch("/api/environments/ephemeral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch: selectedBranch,
          ttlHours,
          secrets: nonEmptySecrets,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to provision");
      }

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => router.push("/dashboard")}
          className="btn btn--ghost btn--sm"
        >
          &larr; Back to Dashboard
        </button>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-sans font-semibold">New Ephemeral Environment</h1>
        <p className="text-xs text-tertiary mt-1">
          Spin up an isolated environment for any git branch
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Branch selector */}
        <div className="panel">
          <div className="panel__header">
            <span className="panel__title">Git Branch</span>
          </div>
          <div className="panel__content">
            <BranchPicker
              branches={branches ?? []}
              value={selectedBranch}
              onChange={setSelectedBranch}
              loading={branchesLoading}
            />
          </div>
        </div>

        {/* TTL selector */}
        <div className="panel">
          <div className="panel__header">
            <span className="panel__title">Time to Live</span>
          </div>
          <div className="panel__content">
            <div className="flex gap-2 flex-wrap">
              {TTL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTtlHours(opt.value)}
                  className={
                    ttlHours === opt.value
                      ? "btn btn--primary btn--sm"
                      : "btn btn--secondary btn--sm"
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Secrets */}
        <div className="panel">
          <div className="panel__header">
            <span className="panel__title">Secrets</span>
            <span className="font-mono text-[10px] text-tertiary">Optional overrides</span>
          </div>
          <div className="panel__content space-y-4">
            <p className="text-xs text-tertiary">
              Leave blank to use defaults from SECRETS_TEMPLATE.
            </p>
            {SECRET_FIELDS.map((field) => (
              <div key={field.key}>
                <label className="label block mb-1.5">{field.label}</label>
                <input
                  type="text"
                  value={secrets[field.key] ?? ""}
                  onChange={(e) =>
                    setSecrets((prev) => ({
                      ...prev,
                      [field.key]: e.target.value,
                    }))
                  }
                  placeholder={field.placeholder}
                  className="input font-mono text-xs"
                />
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="panel border-critical-dim bg-critical-bg">
            <div className="panel__content">
              <div className="flex items-center gap-2">
                <span className="status-dot status-dot--critical" />
                <span className="text-xs text-critical">{error}</span>
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={!selectedBranch || submitting}
          className="btn btn--primary w-full py-3 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "Provisioning..." : "Create Environment"}
        </button>
      </form>
    </div>
  );
}
