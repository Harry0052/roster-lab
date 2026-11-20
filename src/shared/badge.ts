export type CheckOutcome = "pass" | "fail" | "inconclusive" | "not_run";

export type IsolationEvidence = {
  recordedAt: string;
  observedBy: "operator";
  scope: string;
  sourceNote: string;
  checks: {
    distinctAgents: CheckOutcome;
    distinctComputers: CheckOutcome;
    marker: CheckOutcome;
    markerMethod: string;
    noAccidentalShare: CheckOutcome;
  };
};

export type IndependentBadge = {
  label: "Independent computer verified";
  recordedAt: string;
  observedBy: "operator";
  scope: string;
  softwareObserved: false;
};

const OUTCOMES: CheckOutcome[] = ["pass", "fail", "inconclusive", "not_run"];

export function parseEvidence(value: unknown): IsolationEvidence | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const checks = row.checks;
  if (!checks || typeof checks !== "object") return null;
  const c = checks as Record<string, unknown>;
  const outcome = (item: unknown): CheckOutcome | null =>
    typeof item === "string" && OUTCOMES.includes(item as CheckOutcome) ? (item as CheckOutcome) : null;
  const distinctAgents = outcome(c.distinctAgents);
  const distinctComputers = outcome(c.distinctComputers);
  const marker = outcome(c.marker);
  const noAccidentalShare = outcome(c.noAccidentalShare);
  if (!distinctAgents || !distinctComputers || !marker || !noAccidentalShare) return null;
  if (typeof c.markerMethod !== "string") return null;
  if (row.observedBy !== "operator") return null;
  if (typeof row.recordedAt !== "string" || typeof row.scope !== "string" || typeof row.sourceNote !== "string") {
    return null;
  }
  return {
    recordedAt: row.recordedAt,
    observedBy: "operator",
    scope: row.scope.trim(),
    sourceNote: row.sourceNote.trim(),
    checks: {
      distinctAgents,
      distinctComputers,
      marker,
      markerMethod: c.markerMethod.trim(),
      noAccidentalShare,
    },
  };
}

export function evaluateEvidence(
  providerKind: string,
  evidence: IsolationEvidence,
): { isolation: "independent_computer_verified" | "shared_computer" | "not_connected"; badge: IndependentBadge | null } {
  if (providerKind === "simulated" || providerKind === "none") {
    return { isolation: "not_connected", badge: null };
  }
  const sameRuntime = evidence.checks.distinctAgents === "fail" || evidence.checks.distinctComputers === "fail";
  if (sameRuntime) return { isolation: "shared_computer", badge: null };
  const recorded =
    evidence.scope.length > 0 &&
    evidence.sourceNote.length > 0 &&
    evidence.checks.markerMethod.length > 0 &&
    evidence.recordedAt.length > 0;
  const allPass =
    recorded &&
    evidence.checks.distinctAgents === "pass" &&
    evidence.checks.distinctComputers === "pass" &&
    evidence.checks.marker === "pass" &&
    evidence.checks.noAccidentalShare === "pass";
  if (!allPass) return { isolation: "not_connected", badge: null };
  return {
    isolation: "independent_computer_verified",
    badge: {
      label: "Independent computer verified",
      recordedAt: evidence.recordedAt,
      observedBy: "operator",
      scope: evidence.scope,
      softwareObserved: false,
    },
  };
}
