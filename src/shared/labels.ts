export const TASK_LABELS = {
  draft: "Draft",
  queued: "Queued",
  claimed: "Claimed",
  in_progress: "In progress",
  needs_input: "Needs your input",
  completed: "Completed",
  failed: "Failed",
  unknown: "Unknown",
} as const;

export type TaskState = keyof typeof TASK_LABELS;

export const ISOLATION_LABELS = {
  simulated: "Simulated",
  not_connected: "Not connected",
  connected_isolation_unverified: "Connected, isolation unverified",
  independent_computer_verified: "Independent computer verified",
  shared_computer: "Shared computer — does not meet requirement",
  unavailable: "Unavailable / unsupported",
} as const;

export type IsolationState = keyof typeof ISOLATION_LABELS;

export const PROVIDER_LABELS = {
  none: "No provider",
  simulated: "Simulated",
  "claude-duet": "Claude Duet",
  "openai-dot": "OpenAI dot",
} as const;

export type ProviderKind = keyof typeof PROVIDER_LABELS;

export function taskLabel(state: string): string {
  return TASK_LABELS[state as TaskState] ?? "Unknown";
}

export function isolationLabel(state: string): string {
  return ISOLATION_LABELS[state as IsolationState] ?? "Unavailable / unsupported";
}

export function providerLabel(kind: string): string {
  return PROVIDER_LABELS[kind as ProviderKind] ?? "No provider";
}
