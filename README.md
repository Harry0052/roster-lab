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

## One command

Node.js 22.13 or newer. Docker is used when `docker info` works. Google Chrome is the fallback.

```bash
bash scripts/setup.sh
```

Then open [http://127.0.0.1:4318](http://127.0.0.1:4318) and choose **Main bot demo**. With Docker, the Software Engineer project embeds a container desktop from noVNC and is labeled **container desktop**. Without Docker, the label is **local browser, not isolated VM**. The first container start builds `roster-lab-desktop:local`, which can take a few minutes.

Connect an external agent with the stdio MCP server. Put the bearer only in the environment, not in git:

```bash
ROSTER_LAB_HOME="$HOME/Library/Application Support/roster-lab" \
ROSTER_LAB_TOKEN="the token shown once in the app" \
node --experimental-sqlite --import tsx scripts/mcp-stdio.ts
```

HTTP is `POST http://127.0.0.1:4317/mcp` with `Authorization: Bearer` and one JSON-RPC message. That was tested with the app's own client. The official MCP SDK 1.22.0 (MIT) was tested against the stdio server.

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
| Simulated main bot | Locally tested. Delegates inside this app. It is not a Duet or a dot. |
| Project browser profile | Locally tested with Chrome when Docker is off. Labeled local browser, not isolated VM. |
| Container desktop | Locally tested here after installing Docker: two projects, two containers, Playwright over CDP, noVNC embedded. Not a Duet or dot computer. |
| Simulated employees | Locally tested. Labeled Simulated. |
| Claude Duet | Not live-tested. No creation, wake, or remote cancel. Custom MCP on Duet itself is unverified. |
| OpenAI dot | Not live-tested. MCP Events are documented for dots. This server can speak that shape to a test callback. OAuth for the ChatGPT plugin form is not implemented, so a real dot is not connected. |

Details: `INTEGRATION_STATUS.md` and `docs/provider-feasibility.md`.

After you have an eligible account, the steps that were **not** run are in `docs/real-account-tests.md`. Duet first, dots second. Never paste a password or token into chat.

## Screenshots

`docs/screenshots/` has the local app and, when present, the container desktop. The captions are in that folder's README.

## Limits

- A role is not an employee computer.
- A container desktop is a Linux container on the machine running Roster Lab. It is not a Claude Duet or OpenAI dot computer.
- Two browser profiles are not two virtual machines. That path is labeled local browser, not isolated VM.
- noVNC is reachable only on 127.0.0.1. There is no VNC password because the port is not published on other interfaces. Do not change that bind without accepting that the desktop would be exposed.
- Queueing a task does not wake a Duet.
- Marking a task failed here does not stop a remote agent.
- The independent-computer badge appears only after an operator records a full pass, and the badge says this software did not perform the check.
- The stdio MCP server was tested with `@modelcontextprotocol/sdk` 1.22.0. Duet and dots were not the client.

## Participate

See `CONTRIBUTING.md`, `SECURITY.md`, and `CODE_OF_CONDUCT.md`. Original code is MIT (`LICENSE`). Third-party packages are listed in `THIRD_PARTY_NOTICES.md`.

`package.json` is `"private": true`, so `npm publish` will refuse.

### GitHub

Harry asked for a private repository at `https://github.com/Harry0052/roster-lab`. This environment could not create or push it: the GitHub CLI is not logged in, and the connected GitHub App cannot see that repository. After you create an empty private repository named `roster-lab` under `Harry0052`:

```bash
git remote add github git@github.com:Harry0052/roster-lab.git
git push -u github main
```

A `roster-lab.bundle` of this history is saved with the session artifacts when the push cannot be done from here.
