# ADR 0001 — Local core, explicit provider adapters

Date: 2026-11-20. Status: accepted for this build.

## Context

Harry wants real Claude Duet and OpenAI dot employees, each with a separate computer. The official docs read on 2026-11-20 do not give a third-party app a way to create those employees or prove those computers. No Duet or dot account was available here. No earlier prototype archive was supplied.

The local product still has to run with no paid model API key.

## Decision

- One Node.js 22 process and one React interface.
- Persistence is Node’s built-in `node:sqlite` (`DatabaseSync`). Node 22 prints that this module is experimental. It was chosen because it needs no native compile step on a Mac. The warning is expected.
- The process binds to `127.0.0.1` unless `ROSTER_LAB_EXPOSE=1` is set on purpose.
- An employee profile, a provider connection, and a computer record are different rows. Saving a role does not create an agent.
- Each provider adapter exposes capabilities with a support flag and an evidence flag. Unsupported calls return a typed failure. They do not fall through to the simulated worker.
- The simulated worker is an in-process function. Its results are labeled `simulated`.
- A small Streamable HTTP MCP endpoint authenticates with a bearer stored in a mode `0600` file. It is a local protocol, not a verified Duet or dot connection.
- OAuth for the ChatGPT plugin form is not implemented. That gap is recorded instead of guessed.
- No Paperclip, dots-bridge, or bud-relay code is vendored or depended on.

## Consequences

The app can be used locally. It cannot honestly show “Independent computer verified” for a real Duet or dot until Harry runs the checks in `docs/real-account-tests.md` and records the evidence. The exact end-to-end product is blocked. See `docs/provider-feasibility.md`.
