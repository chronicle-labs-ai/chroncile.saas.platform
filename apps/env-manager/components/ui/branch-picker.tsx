"use client";

import { useState, useRef, useEffect } from "react";

interface Branch {
  name: string;
  sha: string;
  isDefault: boolean;
}

interface BranchPickerProps {
  branches: Branch[];
  value: string;
  onChange: (branch: string) => void;
  loading?: boolean;
}

function GitBranchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 3v12m0 0a3 3 0 103 3H15a3 3 0 100-3m-9 0h9m-9 0a3 3 0 01-3-3V6a3 3 0 013-3h0a3 3 0 013 3v6" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

export function BranchPicker({ branches, value, onChange, loading }: BranchPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = branches.find((b) => b.name === value);

  const filtered = branches.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  const defaultBranches = filtered.filter((b) => b.isDefault);
  const otherBranches = filtered.filter((b) => !b.isDefault);

  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 bg-[var(--bg-base)] border border-[var(--border-default)] rounded-[var(--radius-sm)]">
        <div className="w-4 h-4 rounded-full border-2 border-[var(--border-bright)] border-t-[var(--data)] animate-spin" />
        <span className="text-sm text-secondary font-mono">Loading branches...</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`
          w-full flex items-center gap-3 px-3 py-2.5
          bg-[var(--bg-base)] border rounded-[var(--radius-sm)]
          transition-colors text-left
          ${open ? "border-[var(--data)]" : "border-[var(--border-default)] hover:border-[var(--border-bright)]"}
        `}
      >
        <GitBranchIcon className="w-4 h-4 text-tertiary shrink-0" />
        {selected ? (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-sm font-mono text-primary truncate">{selected.name}</span>
            {selected.isDefault && (
              <span className="badge badge--data shrink-0">default</span>
            )}
            <span className="text-[10px] font-mono text-tertiary ml-auto shrink-0">
              {selected.sha.slice(0, 7)}
            </span>
          </div>
        ) : (
          <span className="text-sm text-disabled flex-1">Select a branch...</span>
        )}
        <svg
          className={`w-4 h-4 text-tertiary shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-md)] shadow-lg overflow-hidden">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-dim)]">
            <SearchIcon className="w-4 h-4 text-tertiary shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search branches..."
              className="flex-1 bg-transparent text-sm text-primary placeholder:text-disabled outline-none font-mono"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-tertiary hover:text-primary"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Branch list */}
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-tertiary">
                No branches matching &ldquo;{search}&rdquo;
              </div>
            )}

            {defaultBranches.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-tertiary bg-[var(--bg-elevated)]">
                  Default
                </div>
                {defaultBranches.map((b) => (
                  <BranchRow
                    key={b.name}
                    branch={b}
                    selected={value === b.name}
                    onSelect={() => {
                      onChange(b.name);
                      setOpen(false);
                      setSearch("");
                    }}
                  />
                ))}
              </>
            )}

            {otherBranches.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-tertiary bg-[var(--bg-elevated)]">
                  Branches
                  <span className="ml-1.5 text-disabled">{otherBranches.length}</span>
                </div>
                {otherBranches.map((b) => (
                  <BranchRow
                    key={b.name}
                    branch={b}
                    selected={value === b.name}
                    onSelect={() => {
                      onChange(b.name);
                      setOpen(false);
                      setSearch("");
                    }}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BranchRow({
  branch,
  selected,
  onSelect,
}: {
  branch: Branch;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        w-full flex items-center gap-3 px-3 py-2 text-left transition-colors
        ${selected
          ? "bg-[var(--data-bg)] text-[var(--data)]"
          : "hover:bg-[var(--bg-hover)] text-primary"
        }
      `}
    >
      <GitBranchIcon className={`w-3.5 h-3.5 shrink-0 ${selected ? "text-[var(--data)]" : "text-tertiary"}`} />
      <span className="text-sm font-mono truncate flex-1">{branch.name}</span>
      {branch.isDefault && (
        <span className={`text-[10px] font-mono uppercase tracking-wider shrink-0 ${selected ? "text-[var(--data)]" : "text-tertiary"}`}>
          default
        </span>
      )}
      <span className={`text-[10px] font-mono shrink-0 ${selected ? "text-[var(--data)]/60" : "text-disabled"}`}>
        {branch.sha.slice(0, 7)}
      </span>
      {selected && (
        <svg className="w-4 h-4 text-[var(--data)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      )}
    </button>
  );
}
