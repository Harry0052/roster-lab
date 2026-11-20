# Security

Roster Lab is a local app. Anyone who can reach its port can use it. The default bind is `127.0.0.1`.

## Reporting

Open a private report to Harry. Do not post tokens, passwords, or customer data in a public issue.

## What this app controls

- Who may see a project, via the allow-list on the profile.
- Which bearer may claim a task. The bearer is the identity. Text inside a task is not.
- Approvals for message, purchase, publish, and delete actions that Roster Lab itself mediates. Approving does not perform the external action. It does not stop a Duet or dot inside the provider’s apps.
- Local deletion of a company and of connector secrets stored here.

## What this app does not control

- A Duet or dot acting in Gmail, a browser, or any other app it can already use.
- Provider-side sessions. Revoke those in Claude or ChatGPT as well.
- Whether a custom connector is available inside Duet. That is unverified.

## Practices in this build

- No tokens in the source tree, URLs, or audit text. The credential is shown once.
- Secrets file mode `0600` in the data directory.
- State-changing `/api` requests require `X-Roster-Request: 1`. If an `Origin` header is present it must be the local app.
- MCP has no anonymous mode. Private webhook callbacks are refused unless a test process sets `ROSTER_LAB_ALLOW_LOOPBACK_CALLBACKS=1`.
- Attachment bodies are limited to 200000 bytes. JSON bodies are limited to 1000000 bytes.
- Task and provider text is rendered as text, not as HTML instructions.
- Dependencies are locked in `package-lock.json`.

This is not a security certification of Duet, dots, or this app.
