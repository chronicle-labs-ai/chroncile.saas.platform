"use client";

import * as React from "react";

import { Input } from "../../../primitives/input";

export interface TextEditorProps {
  value: string | undefined;
  onChange: (next: string) => void;
  placeholder?: string;
  /** Debounce before committing changes upstream. */
  debounceMs?: number;
  /**
   * If provided, pressing Enter commits and fires this callback with the
   * current field value (bypassing the internal debounce so the caller
   * can avoid reading stale state).
   */
  onSubmit?: (value: string) => void;
}

export function TextEditor({
  value,
  onChange,
  placeholder = "Enter value\u2026",
  debounceMs = 180,
  onSubmit,
}: TextEditorProps) {
  const [local, setLocal] = React.useState<string>(value ?? "");

  React.useEffect(() => {
    setLocal(value ?? "");
  }, [value]);

  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  React.useEffect(() => {
    if (local === (value ?? "")) return;
    const t = window.setTimeout(() => {
      onChangeRef.current(local);
    }, debounceMs);
    return () => window.clearTimeout(t);
  }, [local, value, debounceMs]);

  return (
    <div className="w-[260px] p-s-2">
      <Input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onSubmit && local.trim() !== "") {
            e.preventDefault();
            onChangeRef.current(local);
            onSubmit(local);
          }
        }}
        placeholder={placeholder}
        autoFocus
        aria-label="Filter value"
      />
    </div>
  );
}
