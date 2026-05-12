import * as React from "react";

import { cx } from "../utils/cx";

export type LogLevel = "info" | "ok" | "warn" | "err" | "error";

const levelClass: Record<LogLevel, string> = {
  info: "text-event-teal",
  ok: "text-event-green",
  warn: "text-event-amber",
  err: "text-event-red",
  error: "text-event-red",
};

export interface LogStreamProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  heightClassName?: string;
}

function LogStreamRoot({
  heightClassName = "h-[320px]",
  className,
  children,
  ...props
}: LogStreamProps) {
  return (
    <div
      className={cx(
        "overflow-y-auto bg-surface-00 px-s-5 py-[14px] font-mono text-[11.5px] leading-relaxed text-ink",
        heightClassName,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface LogLineProps extends React.HTMLAttributes<HTMLDivElement> {
  time?: React.ReactNode;
  level?: LogLevel;
  children: React.ReactNode;
}

function LogLine({
  time,
  level = "info",
  children,
  className,
  ...props
}: LogLineProps) {
  return (
    <div
      className={cx(
        "grid grid-cols-[70px_50px_1fr] gap-[10px] py-px",
        className
      )}
      {...props}
    >
      <span className="text-ink-dim">{time}</span>
      <span
        className={cx(
          "self-center text-[9.5px] uppercase tracking-[0.12em]",
          levelClass[level]
        )}
      >
        {level === "err" ? "ERR" : level}
      </span>
      <span className="[&_em]:not-italic [&_em]:text-[color:var(--l-accent)]">
        {children}
      </span>
    </div>
  );
}

interface LogStreamNamespace {
  (props: LogStreamProps): React.ReactElement;
  Line: typeof LogLine;
}

const LogStream = LogStreamRoot as LogStreamNamespace;
LogStream.Line = LogLine;

export { LogStream };
