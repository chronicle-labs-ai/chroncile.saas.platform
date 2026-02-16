/* ------------------------------------------------------------------ */
/*  Organization structure + reviewer recommendation engine            */
/*                                                                     */
/*  Mock org chart with expertise-based matching:                      */
/*  trace journey_type + sources → recommended reviewers              */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface OrgMember {
  id: string;
  name: string;
  role: string;
  department: string;
  email: string;
  slackHandle: string;
  /** Color for avatar initial circle */
  color: "data" | "nominal" | "caution" | "critical";
  /** Journey types this person is expert in */
  expertiseAreas: string[];
  /** Sources they have domain knowledge on */
  expertiseSources: string[];
  /** Can handle escalations / high-severity traces */
  canEscalate: boolean;
  /** Manager ID (null for top-level) */
  managerId: string | null;
  /** Labels completed (mock stat) */
  labelsCompleted: number;
  /** Availability status */
  status: "available" | "busy" | "away";
}

export interface ReviewerRecommendation {
  member: OrgMember;
  matchScore: number; // 0-100
  matchReasons: string[];
}

export interface NotificationRequest {
  memberId: string;
  traceId: string;
  channel: "slack" | "email";
  message?: string;
}

export interface NotificationResult {
  success: boolean;
  channel: "slack" | "email";
  memberName: string;
  sentAt: string;
}

/* ------------------------------------------------------------------ */
/*  Mock org data                                                      */
/* ------------------------------------------------------------------ */

export const ORG_MEMBERS: OrgMember[] = [
  // -- Leadership --
  {
    id: "mgr_03",
    name: "Diana Patel",
    role: "Head of Customer Success",
    department: "Leadership",
    email: "diana.patel@company.com",
    slackHandle: "@diana.patel",
    color: "caution",
    expertiseAreas: ["escalation", "return_request", "billing_inquiry"],
    expertiseSources: ["intercom", "slack"],
    canEscalate: true,
    managerId: null,
    labelsCompleted: 142,
    status: "available",
  },
  {
    id: "mgr_07",
    name: "Jake Torres",
    role: "CS Team Lead",
    department: "Leadership",
    email: "jake.torres@company.com",
    slackHandle: "@jake.torres",
    color: "caution",
    expertiseAreas: ["return_request", "shipping_issue", "general_inquiry"],
    expertiseSources: ["intercom", "stripe"],
    canEscalate: true,
    managerId: "mgr_03",
    labelsCompleted: 98,
    status: "available",
  },

  // -- Support Agents --
  {
    id: "agent_12",
    name: "Marcus Rivera",
    role: "Senior Support Agent",
    department: "Support",
    email: "marcus.rivera@company.com",
    slackHandle: "@marcus.r",
    color: "nominal",
    expertiseAreas: ["return_request", "shipping_issue", "bug_report"],
    expertiseSources: ["intercom", "slack", "stripe"],
    canEscalate: false,
    managerId: "mgr_07",
    labelsCompleted: 215,
    status: "available",
  },
  {
    id: "agent_08",
    name: "Priya Sharma",
    role: "Support Agent",
    department: "Support",
    email: "priya.sharma@company.com",
    slackHandle: "@priya.s",
    color: "data",
    expertiseAreas: ["billing_inquiry", "account_issue", "escalation"],
    expertiseSources: ["intercom", "stripe"],
    canEscalate: false,
    managerId: "mgr_07",
    labelsCompleted: 187,
    status: "busy",
  },
  {
    id: "agent_15",
    name: "Tom Nakamura",
    role: "Support Agent",
    department: "Support",
    email: "tom.nakamura@company.com",
    slackHandle: "@tom.n",
    color: "nominal",
    expertiseAreas: ["onboarding", "feature_request", "general_inquiry", "account_issue"],
    expertiseSources: ["intercom"],
    canEscalate: false,
    managerId: "mgr_07",
    labelsCompleted: 163,
    status: "available",
  },

  // -- Engineering --
  {
    id: "eng_05",
    name: "Alex Okafor",
    role: "Senior Engineer",
    department: "Engineering",
    email: "alex.okafor@company.com",
    slackHandle: "@alex.o",
    color: "data",
    expertiseAreas: ["bug_report", "feature_request", "onboarding"],
    expertiseSources: ["github", "slack"],
    canEscalate: false,
    managerId: "mgr_03",
    labelsCompleted: 74,
    status: "available",
  },
  {
    id: "eng_02",
    name: "Sam Patel",
    role: "Platform Engineer",
    department: "Engineering",
    email: "sam.patel@company.com",
    slackHandle: "@sam.p",
    color: "data",
    expertiseAreas: ["bug_report", "onboarding"],
    expertiseSources: ["github", "slack"],
    canEscalate: false,
    managerId: "eng_05",
    labelsCompleted: 45,
    status: "away",
  },
];

/* ------------------------------------------------------------------ */
/*  Recommendation engine                                              */
/* ------------------------------------------------------------------ */

/**
 * Score and rank org members based on how well they match a trace.
 *
 * Scoring factors:
 *   +30  journey_type expertise match
 *   +20  source expertise match (per matching source)
 *   +25  can handle escalations (if trace is low confidence or escalation)
 *   +15  high label count (experienced reviewer)
 *   +10  available status bonus
 *   -20  away status penalty
 */
export function recommendReviewers(
  journeyType: string | null,
  sources: string[],
  confidence: number | null,
  limit: number = 3
): ReviewerRecommendation[] {
  const results: ReviewerRecommendation[] = [];

  for (const member of ORG_MEMBERS) {
    let score = 0;
    const reasons: string[] = [];

    // Journey type match
    if (journeyType && member.expertiseAreas.includes(journeyType)) {
      score += 30;
      reasons.push(`Expert in ${formatJourneyType(journeyType)}`);
    }

    // Source expertise match
    const matchingSources = sources.filter((s) =>
      member.expertiseSources.includes(s)
    );
    if (matchingSources.length > 0) {
      score += matchingSources.length * 20;
      reasons.push(
        `Knows ${matchingSources.join(", ")}`
      );
    }

    // Escalation capability for low-confidence or escalation traces
    const isEscalation =
      journeyType === "escalation" || (confidence !== null && confidence < 0.3);
    if (isEscalation && member.canEscalate) {
      score += 25;
      reasons.push("Can handle escalations");
    }

    // Experience bonus
    if (member.labelsCompleted >= 150) {
      score += 15;
      reasons.push(`${member.labelsCompleted} labels completed`);
    } else if (member.labelsCompleted >= 75) {
      score += 8;
    }

    // Availability
    if (member.status === "available") {
      score += 10;
      reasons.push("Available now");
    } else if (member.status === "away") {
      score -= 20;
      reasons.push("Currently away");
    } else if (member.status === "busy") {
      reasons.push("Currently busy");
    }

    if (score > 0 || reasons.length > 0) {
      results.push({ member, matchScore: Math.min(score, 100), matchReasons: reasons });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.matchScore - a.matchScore);

  return results.slice(0, limit);
}

/* ------------------------------------------------------------------ */
/*  Org tree builder (for chart visualization)                         */
/* ------------------------------------------------------------------ */

export interface OrgNode {
  member: OrgMember;
  children: OrgNode[];
}

export function buildOrgTree(): OrgNode[] {
  const byId = new Map(ORG_MEMBERS.map((m) => [m.id, m]));
  const childMap = new Map<string | null, OrgMember[]>();

  for (const m of ORG_MEMBERS) {
    const list = childMap.get(m.managerId) ?? [];
    list.push(m);
    childMap.set(m.managerId, list);
  }

  function build(parentId: string | null): OrgNode[] {
    const children = childMap.get(parentId) ?? [];
    return children.map((m) => ({
      member: m,
      children: build(m.id),
    }));
  }

  return build(null);
}

/* ------------------------------------------------------------------ */
/*  Mock notification sender                                           */
/* ------------------------------------------------------------------ */

export function simulateNotification(
  req: NotificationRequest
): NotificationResult {
  const member = ORG_MEMBERS.find((m) => m.id === req.memberId);
  return {
    success: true,
    channel: req.channel,
    memberName: member?.name ?? "Unknown",
    sentAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatJourneyType(jt: string): string {
  return jt
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
