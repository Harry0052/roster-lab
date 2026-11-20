import type { ProviderKind } from "../shared/labels.ts";

export type Support = "supported" | "unsupported" | "unknown";
export type Evidence = "documented" | "inferred" | "locally-tested" | "live-tested" | "unsupported" | "unknown";

export type Capability = {
  id: string;
  label: string;
  support: Support;
  evidence: Evidence;
  detail: string;
};

const DUET: Capability[] = [
  {
    id: "create-agent",
    label: "Create a Duet from Roster Lab",
    support: "unsupported",
    evidence: "documented",
    detail:
      "The Duet help article describes one Duet on the signed-in Claude account. It does not document an API that lets a third-party app create additional Duets. Separate channels share memory, so a channel is not a second computer.",
  },
  {
    id: "provision-computer",
    label: "Provision a computer",
    support: "unsupported",
    evidence: "documented",
    detail:
      "Duet is documented to run on its own cloud computer. The same article says you cannot watch that browser or take it over. Nothing we read lets this app create, inspect, or administer that computer.",
  },
  {
    id: "wake",
    label: "Wake or push work to Duet",
    support: "unsupported",
    evidence: "unknown",
    detail:
      "No official wake or push API was found. A connector call, if Duet can make one, would be started by Duet. Roster Lab does not poll or schedule a wake.",
  },
  {
    id: "custom-mcp",
    label: "Custom remote MCP used by Duet itself",
    support: "unknown",
    evidence: "unknown",
    detail:
      "Anthropic's custom-connector article names Claude, Cowork, and Claude Desktop. It does not name Duet. The Duet article says Duet uses connectors already connected in Claude and gives directory apps as examples. Whether Duet can call a custom remote MCP server is unverified.",
  },
  {
    id: "cancel",
    label: "Cancel work on the Duet computer",
    support: "unsupported",
    evidence: "unknown",
    detail: "No third-party cancellation API was found. Marking a task failed here does not stop Duet.",
  },
  {
    id: "identity",
    label: "Per-employee provider identity",
    support: "unsupported",
    evidence: "unknown",
    detail:
      "A bearer minted by Roster Lab identifies a local connection row. It does not prove the caller is a distinct Duet.",
  },
];

const DOT: Capability[] = [
  {
    id: "create-agent",
    label: "Create a dot from Roster Lab",
    support: "unsupported",
    evidence: "unknown",
    detail:
      "The computers-and-apps article describes your dot's cloud computer and computers you connect. It does not document a way for this app to create dots or choose how many exist.",
  },
  {
    id: "provision-computer",
    label: "Provision a computer",
    support: "unsupported",
    evidence: "documented",
    detail:
      "A dot is documented to have its own cloud computer and browser, plus optional computers you connect in the ChatGPT app. Threads use one computer at a time. That is the provider's model, not a computer this app can create.",
  },
  {
    id: "wake",
    label: "Wake a dot with MCP Events",
    support: "unknown",
    evidence: "documented",
    detail:
      "OpenAI documents MCP Events for Work chats and for dots: the dot subscribes, and the server posts a signed webhook. This build can store a subscription and sign a webhook. No live dot has subscribed, and the ChatGPT plugin OAuth form is not implemented, so a real wake is unverified. Some public bug reports say a dot run may start without the event payload; those reports were not reproduced here.",
  },
  {
    id: "custom-mcp",
    label: "Custom MCP plugin",
    support: "unknown",
    evidence: "documented",
    detail:
      "ChatGPT documents custom MCP plugins over SSE and streaming HTTP. The dots article says a dot can use supported plugins installed for the account. That is not a live test that this server's tools run inside a dot.",
  },
  {
    id: "cancel",
    label: "Cancel work on the dot computer",
    support: "unsupported",
    evidence: "unknown",
    detail: "No cancellation API was found in the pages read on 2026-11-20. A local failure mark does not stop the dot.",
  },
  {
    id: "identity",
    label: "Per-employee provider identity",
    support: "unknown",
    evidence: "unknown",
    detail:
      "OAuth is the documented ChatGPT plugin sign-in. This server uses a bearer instead, which matches Anthropic request headers more clearly than the ChatGPT plugin form. A bearer is not proof of a distinct dot.",
  },
];

const SIMULATED: Capability[] = [
  {
    id: "run",
    label: "Run a simulated step",
    support: "supported",
    evidence: "locally-tested",
    detail: "The local server writes a deterministic result labeled Simulated. No external worker is contacted.",
  },
  {
    id: "computer",
    label: "Separate provider computer",
    support: "unsupported",
    evidence: "unsupported",
    detail: "A simulated profile is a database row and an in-process function. It has no computer.",
  },
  {
    id: "wake",
    label: "Wake an external agent",
    support: "unsupported",
    evidence: "unsupported",
    detail: "Nothing is woken. The simulated step runs only when someone uses Roster Lab.",
  },
];

const NONE: Capability[] = [
  {
    id: "provider",
    label: "Provider connection",
    support: "unsupported",
    evidence: "unsupported",
    detail: "This profile has no provider. Saving a role does not create an agent or a computer.",
  },
];

export function capabilitiesFor(kind: ProviderKind | string): Capability[] {
  if (kind === "claude-duet") return DUET;
  if (kind === "openai-dot") return DOT;
  if (kind === "simulated") return SIMULATED;
  return NONE;
}

export function remoteCancel(kind: string): { ok: false; code: "unsupported" | "unavailable"; reason: string } | { ok: true } {
  if (kind === "simulated") return { ok: true };
  if (kind === "claude-duet") {
    return {
      ok: false,
      code: "unsupported",
      reason: "Claude Duet has no documented cancellation method for this app. The local task can be marked failed. That does not stop Duet.",
    };
  }
  if (kind === "openai-dot") {
    return {
      ok: false,
      code: "unsupported",
      reason: "No OpenAI dot cancellation method was found in the docs read on 2026-11-20. The local task can be marked failed. That does not stop the dot.",
    };
  }
  return { ok: false, code: "unavailable", reason: "No provider is attached." };
}
