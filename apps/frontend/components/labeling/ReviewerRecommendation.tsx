"use client";

import { useState, useMemo } from "react";
import type { Trace } from "@/lib/labeling/types";
import {
  recommendReviewers,
  buildOrgTree,
  type OrgMember,
  type OrgNode,
  type ReviewerRecommendation as Recommendation,
} from "@/lib/labeling/org";

interface ReviewerRecommendationProps {
  trace: Trace;
  onNotificationSent?: (memberName: string, channel: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function ReviewerRecommendation({
  trace,
  onNotificationSent,
}: ReviewerRecommendationProps) {
  const [expanded, setExpanded] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());

  const recommendations = useMemo(
    () =>
      recommendReviewers(
        null, // journey type removed — recommendations based on source expertise + escalation capability
        trace.sources,
        trace.confidence,
        3
      ),
    [trace.sources, trace.confidence]
  );

  const orgTree = useMemo(() => buildOrgTree(), []);

  const handleNotify = async (
    memberId: string,
    memberName: string,
    channel: "slack" | "email"
  ) => {
    const key = `${memberId}-${channel}`;
    setSending(key);
    try {
      const res = await fetch("/api/labeling/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          traceId: trace.id,
          channel,
          message: `Review request for trace ${trace.conversationId} (confidence: ${trace.confidence?.toFixed(2)})`,
        }),
      });
      if (res.ok) {
        setSent((prev) => new Set(prev).add(key));
        onNotificationSent?.(memberName, channel);
      }
    } catch (err) {
      console.error("Failed to notify:", err);
    } finally {
      setSending(null);
    }
  };

  return (
    <div>
      <div className="panel__header">
        <span className="panel__title">Request Review</span>
        <span className="font-mono text-[10px] text-tertiary">
          {recommendations.length} recommended
        </span>
      </div>

      {/* Recommended reviewers */}
      <div className="p-3 space-y-2">
        {recommendations.map((rec) => (
          <RecommendedCard
            key={rec.member.id}
            rec={rec}
            sending={sending}
            sent={sent}
            onNotify={handleNotify}
          />
        ))}
      </div>

      {/* Org chart toggle */}
      <div className="border-t border-border-dim">
        <button
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-tertiary hover:text-secondary hover:bg-hover transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <span className="font-mono text-[10px] uppercase tracking-wider">
            Organization Chart
          </span>
          <svg
            className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {expanded && (
          <div className="px-3 pb-3">
            <div className="bg-void border border-border-dim rounded-sm p-3">
              {orgTree.map((node) => (
                <OrgTreeNode
                  key={node.member.id}
                  node={node}
                  depth={0}
                  recommendations={recommendations}
                  sending={sending}
                  sent={sent}
                  onNotify={handleNotify}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Recommended reviewer card                                          */
/* ------------------------------------------------------------------ */

function RecommendedCard({
  rec,
  sending,
  sent,
  onNotify,
}: {
  rec: Recommendation;
  sending: string | null;
  sent: Set<string>;
  onNotify: (id: string, name: string, channel: "slack" | "email") => void;
}) {
  const { member, matchScore, matchReasons } = rec;
  const slackKey = `${member.id}-slack`;
  const emailKey = `${member.id}-email`;

  return (
    <div className="bg-elevated border border-border-dim rounded-sm p-3">
      {/* Top: avatar + name + score */}
      <div className="flex items-start gap-2.5 mb-2">
        <Avatar member={member} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-primary font-medium truncate">
              {member.name}
            </span>
            <StatusDot status={member.status} />
          </div>
          <span className="text-[11px] text-tertiary">{member.role}</span>
        </div>
        <div className="shrink-0 text-right">
          <span className={`font-mono text-[11px] font-medium tabular-nums ${
            matchScore >= 70 ? "text-nominal" : matchScore >= 40 ? "text-caution" : "text-secondary"
          }`}>
            {matchScore}%
          </span>
          <div className="text-[9px] text-disabled">match</div>
        </div>
      </div>

      {/* Match reasons */}
      <div className="flex flex-wrap gap-1 mb-2.5">
        {matchReasons.slice(0, 3).map((r, i) => (
          <span
            key={i}
            className="inline-block px-1.5 py-0.5 font-mono text-[9px] text-tertiary bg-surface border border-border-dim rounded-sm"
          >
            {r}
          </span>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1.5">
        <NotifyButton
          label="Slack"
          icon={<SlackIcon />}
          loading={sending === slackKey}
          done={sent.has(slackKey)}
          onClick={() => onNotify(member.id, member.name, "slack")}
        />
        <NotifyButton
          label="Email"
          icon={<EmailIcon />}
          loading={sending === emailKey}
          done={sent.has(emailKey)}
          onClick={() => onNotify(member.id, member.name, "email")}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Org tree node (recursive)                                          */
/* ------------------------------------------------------------------ */

function OrgTreeNode({
  node,
  depth,
  recommendations,
  sending,
  sent,
  onNotify,
}: {
  node: OrgNode;
  depth: number;
  recommendations: Recommendation[];
  sending: string | null;
  sent: Set<string>;
  onNotify: (id: string, name: string, channel: "slack" | "email") => void;
}) {
  const { member, children } = node;
  const isRecommended = recommendations.some((r) => r.member.id === member.id);
  const slackKey = `${member.id}-slack`;
  const emailKey = `${member.id}-email`;

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-1.5 px-2 rounded-sm ${
          isRecommended
            ? "bg-data-bg border border-data-dim"
            : "hover:bg-hover"
        }`}
        style={{ marginLeft: depth * 16 }}
      >
        {/* Indent connector */}
        {depth > 0 && (
          <span className="text-border-default text-[10px] select-none">└</span>
        )}

        <Avatar member={member} size="sm" />

        <div className="flex-1 min-w-0">
          <span className={`text-[11px] truncate block ${
            isRecommended ? "text-data font-medium" : "text-secondary"
          }`}>
            {member.name}
          </span>
          <span className="text-[9px] text-disabled truncate block">
            {member.role}
          </span>
        </div>

        <StatusDot status={member.status} />

        {/* Quick action buttons (compact) */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            className={`p-1 rounded-sm transition-colors ${
              sent.has(slackKey)
                ? "text-nominal"
                : "text-tertiary hover:text-primary hover:bg-hover"
            }`}
            onClick={() => onNotify(member.id, member.name, "slack")}
            disabled={sending === slackKey || sent.has(slackKey)}
            title={`Slack ${member.name}`}
          >
            <SlackIcon className="w-3 h-3" />
          </button>
          <button
            className={`p-1 rounded-sm transition-colors ${
              sent.has(emailKey)
                ? "text-nominal"
                : "text-tertiary hover:text-primary hover:bg-hover"
            }`}
            onClick={() => onNotify(member.id, member.name, "email")}
            disabled={sending === emailKey || sent.has(emailKey)}
            title={`Email ${member.name}`}
          >
            <EmailIcon className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Recurse */}
      {children.map((child) => (
        <OrgTreeNode
          key={child.member.id}
          node={child}
          depth={depth + 1}
          recommendations={recommendations}
          sending={sending}
          sent={sent}
          onNotify={onNotify}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared primitives                                                  */
/* ------------------------------------------------------------------ */

function Avatar({ member, size }: { member: OrgMember; size: "sm" | "md" }) {
  const dim = size === "sm" ? "w-5 h-5 text-[8px]" : "w-7 h-7 text-[10px]";
  const initials = member.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  const bgMap: Record<string, string> = {
    data: "bg-data-bg border-data-dim text-data",
    nominal: "bg-nominal-bg border-nominal-dim text-nominal",
    caution: "bg-caution-bg border-caution-dim text-caution",
    critical: "bg-critical-bg border-critical-dim text-critical",
  };

  return (
    <div
      className={`${dim} rounded-full border flex items-center justify-center font-mono font-medium shrink-0 ${bgMap[member.color]}`}
    >
      {initials}
    </div>
  );
}

function StatusDot({ status }: { status: OrgMember["status"] }) {
  const cls =
    status === "available"
      ? "status-dot--nominal"
      : status === "busy"
        ? "status-dot--caution"
        : "status-dot--offline";
  return <div className={`status-dot ${cls}`} title={status} />;
}

function NotifyButton({
  label,
  icon,
  loading,
  done,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  loading: boolean;
  done: boolean;
  onClick: () => void;
}) {
  if (done) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 font-mono text-[10px] text-nominal bg-nominal-bg border border-nominal-dim rounded-sm">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
        Sent
      </span>
    );
  }

  return (
    <button
      className="inline-flex items-center gap-1 px-2 py-1 font-mono text-[10px] text-tertiary
        bg-surface border border-border-dim rounded-sm
        hover:text-primary hover:border-border-bright transition-colors
        disabled:opacity-50"
      onClick={onClick}
      disabled={loading}
    >
      {icon}
      {loading ? "Sending..." : label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */

function SlackIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.163 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.163 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.163 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.27a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.315A2.528 2.528 0 0 1 24 15.163a2.528 2.528 0 0 1-2.522 2.523h-6.315z" />
    </svg>
  );
}

function EmailIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}
