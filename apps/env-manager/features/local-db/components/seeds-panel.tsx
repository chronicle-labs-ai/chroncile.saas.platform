"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/shared/fetcher";
import { Spinner } from "./shared";

interface SeedEntry {
  name: string;
  filename: string;
  description: string;
  url: string;
}

export function SeedsPanel({
  pgReady,
  onRefresh,
}: {
  pgReady: boolean;
  onRefresh: () => void;
}) {
  const { data: seeds } = useSWR<SeedEntry[]>("/api/seeds", fetcher);
  const [runningSeed, setRunningSeed] = useState<string | null>(null);
  const [seedResult, setSeedResult] = useState<Record<string, { success: boolean; message: string }>>({});

  const runSeed = async (name: string) => {
    setRunningSeed(name);
    setSeedResult((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    try {
      const res = await fetch("/api/local-db/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      setSeedResult((prev) => ({
        ...prev,
        [name]: {
          success: data.success,
          message: data.success
            ? `${data.rowsAffected} rows affected`
            : data.error ?? "Failed",
        },
      }));
    } catch {
      setSeedResult((prev) => ({
        ...prev,
        [name]: { success: false, message: "Request failed" },
      }));
    }
    setRunningSeed(null);
    onRefresh();
  };

  return (
    <div className="panel">
      <div className="panel__header">
        <span className="panel__title">Seed Data</span>
      </div>
      <div className="panel__content">
        {!pgReady ? (
          <p className="text-sm text-secondary py-2">Start Postgres to run seeds</p>
        ) : !seeds || seeds.length === 0 ? (
          <p className="text-sm text-secondary py-2">No seed files found in seeds/</p>
        ) : (
          <div className="divide-y divide-border-dim">
            {seeds.map((seed) => (
              <div key={seed.name} className="flex items-center justify-between py-3">
                <div>
                  <span className="font-mono text-sm text-primary">{seed.name}</span>
                  <p className="text-xs text-tertiary mt-0.5">{seed.description}</p>
                  {seedResult[seed.name] && (
                    <p className={`text-xs font-mono mt-1 ${seedResult[seed.name].success ? "text-nominal" : "text-critical"}`}>
                      {seedResult[seed.name].message}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => runSeed(seed.name)}
                  disabled={runningSeed !== null}
                  className="btn btn--secondary btn--sm disabled:opacity-40"
                >
                  {runningSeed === seed.name ? (
                    <span className="flex items-center gap-2"><Spinner />Running...</span>
                  ) : "Run Seed"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
