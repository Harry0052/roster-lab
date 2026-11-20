# Roster Lab

A local roster for a small company of AI employees. You can create a company, projects, people, and tasks on your own computer. Simulated people are labeled **Simulated**. Claude Duet and OpenAI dots are real products this app does **not** create, wake, or certify.

The exact product Harry asked for — several real Duets and dots, each on a separate computer that this app can assign work to — is **blocked**. The reasons are in `docs/provider-feasibility.md`. This repository is an honest pre-integration build.

Working name only. Check it before any public launch.

## What works with no API key

- Create and reopen a company, projects, people, and tasks. Data is a SQLite file on this computer.
- Run a **simulated** step. The result text starts with `SIMULATED`.
- Hand off a task inside this app. That does not message a provider.
- Export JSON without connector tokens.
- Ask for an approval before a message, purchase, publish, or delete that **this app** would mediate. Approving a message does not send one. The switches do not control what a Duet or dot does inside its own apps.
- Prepare or revoke a local connector credential. Preparing one does not connect a provider.

## What “Simulated” means

A simulated person is a row in the database and a function in this process. There is no browser, no Duet, no dot, and no second computer. The interface, the timeline, and the tests say so.

## Run on a Mac

Tested in this session on Linux, not on a Mac. The commands are the same if Node.js 22.13 or newer is installed. Node’s built-in SQLite is experimental and prints a warning. That warning is expected.

```bash
node --version
npm install
npm test
npm run dev
```

Open [http://127.0.0.1:4318](http://127.0.0.1:4318). The API is on port 4317 and is also bound to localhost.

A production-style local run, after the interface is built:

```bash
npm start
```

That serves the built interface and the API together at [http://127.0.0.1:4317](http://127.0.0.1:4317).

Checks:

```bash
npm run typecheck
npm run lint
npm test
```

### Data and credentials

On a Mac the files live in `~/Library/Application Support/roster-lab/`. On Linux they live in `~/.local/share/roster-lab/`. Override with `ROSTER_LAB_HOME`.

- `roster.sqlite` is the company data.
- `secrets.json` is mode `0600` and holds connector bearers and webhook secrets. This build does not use the macOS Keychain. The token is shown once in the browser and is not written to the audit log.

Deleting a company removes those local secrets. It does not sign you out of Claude or ChatGPT. Do that in the provider if you added a connector.

The server refuses to listen on anything except localhost unless you set `ROSTER_LAB_EXPOSE=1`. Do not do that on a public network. See `docs/hosting.md`.

## Provider status

| Provider | Status in this build |
| --- | --- |
| Simulated | Locally tested. Labeled Simulated. |
| Claude Duet | Not live-tested. No creation, wake, or remote cancel. Custom MCP on Duet itself is unverified. |
| OpenAI dot | Not live-tested. MCP Events are documented for dots. This server can speak that shape to a test callback. OAuth for the ChatGPT plugin form is not implemented, so a real dot is not connected. |

Details: `INTEGRATION_STATUS.md` and `docs/provider-feasibility.md`.

After you have an eligible account, the steps that were **not** run are in `docs/real-account-tests.md`. Duet first, dots second. Never paste a password or token into chat.

## Screenshots

`docs/screenshots/` has three pictures from the local app on 2026-11-20. They are labeled there.

## Limits

- A role is not an employee computer.
- Two cards are not two computers.
- Queueing a task does not wake a Duet.
- Marking a task failed here does not stop a remote agent.
- The independent-computer badge appears only after an operator records a full pass, and the badge says this software did not perform the check.

## Participate

See `CONTRIBUTING.md`, `SECURITY.md`, and `CODE_OF_CONDUCT.md`. Original code is MIT (`LICENSE`). Third-party packages are listed in `THIRD_PARTY_NOTICES.md`.

`package.json` is `"private": true`, so `npm publish` will refuse. Publishing the source to GitHub is a separate step Harry has not taken.

### When you want a GitHub repository

From a clone of this project, after you create an empty private repository you control:

```bash
git remote add github git@github.com:YOUR_ACCOUNT/roster-lab.git
git push -u github main
```

This session did not create or publish a GitHub repository.
