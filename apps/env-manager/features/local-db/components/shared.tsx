"use client";

import { useState } from "react";

export type ActionState = "idle" | "loading" | "success" | "error";

export function Spinner() {
  return (
    <span className="w-3 h-3 rounded-full border-2 border-current/30 border-t-current animate-spin inline-block" />
  );
}

export function containerDotClass(state: string): string {
  if (state === "running") return "status-dot--nominal";
  if (state === "stopped") return "status-dot--caution";
  return "status-dot--critical";
}

export function ActionButton({
  onClick,
  state,
  label,
  loadingLabel,
  className,
  disabled,
}: {
  onClick: () => void;
  state: ActionState;
  label: string;
  loadingLabel?: string;
  className: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={state === "loading" || disabled}
      className={`${className} disabled:opacity-40`}
    >
      {state === "loading" ? (
        <span className="flex items-center gap-2">
          <Spinner />
          {loadingLabel ?? label}
        </span>
      ) : (
        label
      )}
    </button>
  );
}

export function useAction(): [ActionState, (url: string, body?: object) => Promise<boolean>, () => void] {
  const [state, setState] = useState<ActionState>("idle");
  const run = async (url: string, body?: object): Promise<boolean> => {
    setState("loading");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const ok = res.ok;
      setState(ok ? "success" : "error");
      return ok;
    } catch {
      setState("error");
      return false;
    }
  };
  const reset = () => setState("idle");
  return [state, run, reset];
}
