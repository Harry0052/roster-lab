# Progress

Updated 2026-11-20, after Harry’s main-bot decision. Commands were run in this Linux environment. Node v22.23.4. No paid API key. No Duet or dot account.

## Harry’s decision

Recorded in `docs/adr/0002-main-bot-and-project-workspaces.md`. A simulated main bot delegates to project bots. Each project can open a workspace. Docker was not available, so the workspace that was actually opened is a Chrome profile labeled `local browser, not isolated VM`.

## Skip link

The skip link had covered the wordmark when focused. It now sits in the page flow only while focused. Rechecked in Playwright on 2026-11-20: an unfocused desktop screenshot shows the full “Roster Lab” wordmark.

## Main bot demo, observed

`npm test` on 2026-11-20 after the change:

```
node --experimental-sqlite --import tsx --test tests/*.test.ts
# tests 9
# pass 9
# fail 0
```

The new test launched Chrome, wrote `note.txt`, saved a PNG larger than 1000 bytes, and checked the audit lines and the profile marker. `dockerAvailable()` was false in that test.

`npm test` on 2026-11-20 after Docker and the MCP stdio server: **11 passed, 0 failed**. That includes the two-container test, the local-browser test, and the MCP SDK client test. `npx tsc --noEmit` exited 0. `npx biome check src tests scripts` exited 0 with a deprecation notice and one warning about `innerText`.

Playwright on `http://127.0.0.1:4318/projects/pr_3e1ed64f4105a6426aa390fd` showed the label **container desktop**, an embedded noVNC frame of Chromium inside the container displaying the task, and the task **Completed**. Screenshot: `docs/screenshots/roster-container-dashboard.png`.

GitHub: `gh auth status` said the CLI is not logged in. There is no GitHub token in the environment. The GitHub App connection could not see `Harry0052/roster-lab` (not granted, private, or not created) and this session has no tool that creates a repository. The private repo was not created and history was not pushed to GitHub.

Container test, after `apt-get install docker.io` and starting `dockerd`:

```
node --experimental-sqlite --import tsx --test tests/container.test.ts tests/mcp-client.test.ts tests/workspace.test.ts
```

Observed before the full-suite re-run: the two-container test passed, the local-browser tests passed, and the MCP SDK stdio test passed after the server was changed to newline JSON (the SDK 1.22 client does not use Content-Length framing).

Browser, Playwright, 2026-11-20, `http://127.0.0.1:4318`, after `POST /api/demo/main-bot`:

- The home page listed “Main bot demo”.
- The Software Engineer project showed the goal, the label `local browser, not isolated VM`, and the Chrome capture inside the page.
- The task “Write the workspace note” was Completed. The timeline said the main bot delegated and that no Duet or dot was messaged, then that a local browser profile was opened, then that it completed.
- Screenshots: `docs/screenshots/roster-project.png`, `roster-task-audit.png`, and `roster-browser-capture.png` (the PNG Chrome wrote).

## Phase 0 — Research and architecture

Decision: fresh project. `Roster_Lab_Prototype.zip` was not supplied.

Evidence: `docs/provider-feasibility.md` (pages fetched 2026-11-20). Architecture: `docs/architecture.md` and `docs/adr/0001-local-core.md`.

Blockers are recorded there. No “unlimited agents” claim.

Gate: met as documentation. Research was not a live provider test.

## Phase 1 — Local app

Stack: React, Vite, Node 22, `node:sqlite`.

Browser, Playwright, 2026-11-20, against `http://127.0.0.1:4318`:

- Empty state, created company “North Office”.
- Added project “Office move” and task “Write the brief”.
- Added person “Simulated research”, allowed the project, set provider Simulated. The page said “Simulated harness… Not a Duet or dot computer.”
- Assigned, ran the simulated step. Result label `simulated`, text begins `SIMULATED`.
- Reloaded the task. Still completed.
- Restarted the dev server with the same `ROSTER_LAB_HOME`. The API still listed “North Office”, and the task page still showed Completed at `2026-11-20T00:39:32.991Z`.
- Settings → “Show an error state” showed “That person is not on this computer.” The browser console recorded the expected 404.
- Tab from a fresh load focused the “Skip to content” link.
- Viewports 1280×900 and 390×844. Screenshots in `docs/screenshots/`.
- Not run on a physical Mac or a physical phone.

Gate: met for this Linux machine. Mac remains untested hardware.

## Phase 2 — Domain and simulated lifecycle

`npm test` on 2026-11-20:

```
node --experimental-sqlite --import tsx --test tests/*.test.ts
# tests 7
# pass 7
# fail 0
```

Node printed `ExperimentalWarning: SQLite is an experimental feature`.

Covered: two simulated people, separate task states, reopen of the sqlite file, duplicate simulated completion, cross-company assignment rejected.

Gate: met. The test output says simulation, not two provider computers.

## Phase 3 — Connector foundation

Same test run: CSRF 403 without the header, export JSON did not contain the bearer, second bearer cannot list or claim the first task, revoked bearer HTTP 401, local MCP event subscription delivered to 127.0.0.1 and the note says it is not a live dot, `http://example.com` callback refused.

Gate: met for the local test client. Not described as Duet or dot success.

## Phase 4 — Claude Duet

Adapter flags are in the UI and `GET /api/capabilities`. Wake and remote cancel are unsupported. Custom MCP on Duet itself is unknown. Real-account script: `docs/real-account-tests.md`, actual result **not run**.

Gate: local contract tests passed. Live connection and multi-computer checks are **not live-tested**.

## Phase 5 — OpenAI dots

Separate adapter. MCP Events methods exist and were tested against a local callback. OAuth for the ChatGPT plugin form is not implemented. dots-bridge is documented, not depended on. Simulated results are refused on a dot or Duet task (`POST /simulate` returned 400 in the test).

Gate: local tests passed. Live dot behavior is **not live-tested**.

## Phase 6 — Approvals and control

Test: a purchase request stays unperformed; deny says nothing was sent, spent, published, or deleted; deciding again is rejected. The settings page says the switches do not stop a provider acting in its own apps. Result text is shown as untrusted. Tool calls ignore a name inside the arguments and use the bearer.

Gate: met for actions this app mediates.

## Phase 7 — Quality and open-source files

Also run on 2026-11-20, after the last source edits, before this file was committed:

- `npx tsc --noEmit` — exit 0 (see the commit that includes this note; re-run if you change code).
- `npx biome check src tests scripts` — exit 0, with a deprecation notice about the `recommended` field.
- `npm test` — 7 passed, 0 failed.

`LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `THIRD_PARTY_NOTICES.md`, and `.github/workflows/ci.yml` are in the tree. Nothing was published to GitHub.

## Acceptance checklist

| # | Item | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Local setup, no paid model key | PASS on this Linux VM. NOT TESTED on a Mac. | `npm test` 7/7. Dev server on 127.0.0.1:4318. No provider key in the environment. |
| 2 | Polished UI, keyboard, desktop and mobile browser | PASS for the Playwright session described in Phase 1. | Screenshots. Tab focused “Skip to content”. |
| 3 | Data survives restart; failures shown | PASS | Server restart kept the completed task. Error button showed the 404 message. |
| 4 | Simulated provider, never called live | PASS | Result text and `result_label: simulated`. |
| 5 | Real Duet tested on an eligible account | BLOCKED | No account. Docs do not show a creation or wake API. |
| 6 | Real dot tested on an eligible account | BLOCKED | No account. OAuth plugin sign-in is not implemented. |
| 7 | Two real agents, two computers, isolation checks | BLOCKED | Not run. No permitted provisioning API found. |
| 8 | Each employee bound to its own connection; shared or unverified labeled | PASS for local rows. Live binding BLOCKED. | Bearers are per profile. UI says Not connected or Simulated. Badge test refuses simulation. |
| 9 | Assign and review through a supported integration | PASS for simulation and the local MCP test client. Real delivery BLOCKED. | Queue does not claim a wake. Cancel says the provider was not stopped. |
| 10 | Approval, auth, concurrency, credentials, audit | PASS inside this app. | Tests in Phase 3 and Phase 6. |
| 11 | License, attribution, README, tests, limits | PASS as files. Publication not done. | This repository. |

Overall: **pre-integration build**. Not the complete requested product.

## Assumptions

- Node 22.13+ with built-in SQLite is acceptable on a Mac even though this VM is Linux and the module is marked experimental.
- A mode `0600` secrets file is the documented alternative to the Keychain.
- GitHub star counts in the feasibility note are the numbers the GitHub API returned on 2026-11-20, not a judgment.

## Next step when access exists

Run `docs/real-account-tests.md` for one Duet before any dot. Do not record a pass from this file alone.
