# Integration status

Updated 2026-11-20. “Locally tested” means a test in this repo passed. It does not mean a provider account was used.

## Documented

- Claude Duet: one cloud computer on an eligible US Pro, Max, or Ultra account; channels share memory; connectors you already connected in Claude; no third-party creation API found. Source and date: `docs/provider-feasibility.md`.
- Custom remote MCP for Claude, Cowork, and Claude Desktop: public HTTPS port 443, OAuth or request-header credentials. Duet is not named.
- A dot: its own cloud computer and browser, plus computers you connect in the ChatGPT app.
- ChatGPT custom MCP plugins: SSE and streaming HTTP. OAuth, no auth, or mixed auth.
- MCP Events, including dots: subscribe and signed webhooks. Not polling.

## Locally tested

- Simulated worker: deterministic result labeled `simulated`, duplicate completion ignored. `npm test`, 2026-11-20, 7 passed, 0 failed.
- MCP bearer bound to one profile. A second bearer cannot list or claim the first profile’s task.
- Same idempotency key does not complete twice. A different key, or a result after claim expiry, sets Unknown.
- Revoked bearer returns HTTP 401.
- CSRF: a POST without `X-Roster-Request: 1` returns 403.
- Approvals: deny does not send, spend, publish, or delete. A second decision on a finished approval is rejected.
- Isolation badge: role creation and simulation do not set it. A failed distinct-computer record is stored as shared, with no badge.
- MCP `events/subscribe` against `http://127.0.0.1` only while the test server allows loopback. The task note says the callback success is not proof a live dot received it. An `http://example.com` callback is refused.
- Remote cancel for Duet and dot returns `unsupported`. The local task can still be marked failed, and the reason says the provider was not stopped.

## Live-account-tested

None. No Duet account and no dot account were used.

## Unsupported in this app

- Create a Duet or a dot.
- Provision, inspect, or watch a provider computer.
- Wake Duet.
- Cancel work on a Duet or dot computer.
- Treat a simulated profile, a channel, or a database row as a separate computer.
- OAuth for the ChatGPT plugin form.
- Unauthenticated MCP.

## Unknown

- Whether Duet itself will call a custom remote MCP server.
- Whether ChatGPT’s plugin UI will send this server’s bearer. The retrieved plugin doc lists OAuth and no authentication, not a pasted bearer.
- How many Duets or dots an eligible account may have.
- Whether a real dot delivers MCP Event payloads. Public bug reports were not reproduced here.
- Harry’s plan eligibility. It was not looked up from an account.
