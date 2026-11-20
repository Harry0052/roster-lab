# Architecture

Roster Lab is a local company roster. It stores profiles, projects, tasks, approvals, and audit lines. It does not provision Claude Duet or OpenAI dot computers.

```
Browser (React, Vite)
    |  same-origin /api and /mcp, header X-Roster-Request: 1 on changes
Node server, bound to 127.0.0.1
    |-- SQLite file in the data directory
    |-- secrets.json, mode 0600, never returned after the one-time display
    |-- simulated adapter (in process)
    |-- Claude Duet adapter (capability flags; no live client)
    |-- OpenAI dot adapter (capability flags; MCP Events shape only)
    |-- MCP POST /mcp for a bearer-bound profile
```

## Identity

A connector bearer is minted by this app and mapped to one employee row. Tool calls use that row. A name inside a task or a tool argument is not an identity. One bearer cannot list or claim another employee’s tasks, including across companies.

## Task states

Draft, Queued, Claimed, In progress, Needs your input, Completed, Failed, Unknown.

Claims last 15 minutes. The same idempotency key does not complete a task twice. A different key after completion, or a result after the claim has expired, sets Unknown and keeps the first stored result. Reconciliation is a person choosing requeue, mark failed, or accept completed. The app does not retry on its own.

A local “mark failed” updates Roster Lab only. The Duet and dot adapters return `unsupported` for remote cancellation.

## Handoffs

Handoff changes the assignee inside this database and writes that no provider was messaged.

## Isolation badge

`Independent computer verified` is shown only when an operator saves all four operational checks as pass, plus scope, source, time, and how the marker was tried, on a Duet or dot profile. The badge says Roster Lab did not run the check. Simulation and role creation cannot set it. A failed distinct-agent or distinct-computer check is stored as “Shared computer — does not meet requirement”.

## What is not built

- Creating Duet or dot accounts.
- Waking Duet.
- A live dot webhook to ChatGPT. The server can sign a webhook and, in tests, deliver it to `127.0.0.1` only when loopback callbacks are explicitly allowed. Production refuses private callback addresses.
- OAuth for ChatGPT’s plugin form.
- Any claim that two cards are two computers.
