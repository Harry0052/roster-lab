# AI Employee Platform — Grok Bot Build Blueprint

**For:** Harry  
**Project:** An open-source platform for organizing real Claude Duet and OpenAI dot employees, each with their own virtual computer  
**Working name:** Roster Lab — temporary; check names before public launch  
**Priority:** Claude Duet first; OpenAI dots second  
**Status of this document:** Build instructions, not a claim that this software or its provider integrations already work  
**Research checked:** November 18, 2026; recheck before implementation because these products change

---

## How Harry should use this file

1. Give this whole file to Grok Bot and say: **“Read the attached build blueprint. Work on this project only. Start with the master instructions and Phase 0, then work through the phases in order, testing each before moving forward. Keep building what you can while real provider access is unavailable.”**
2. Optionally attach the earlier `Roster_Lab_Prototype.zip` if Harry has it. It contains a small local role-and-task prototype. It does **not** provide separate employee computers or a tested Duet connection. Inspect it before deciding whether to build on it; do not assume it is present.
3. Grok should record progress in the repository, continue through independent phases without waiting for Harry to type “next,” and clearly separate completed tests from work blocked by real access.
4. Harry plans to get access to **Claude Duet first**, then **OpenAI dots**. Until then, work locally, use explicitly labeled simulated provider clients, and prepare concrete steps for real testing. Do not ask Harry to put passwords or tokens in chat.

This is **one project**. Do not start building Harry’s other ideas during this project. The prompts below form a staged instruction set for the same project, not instructions to create unrelated products.

---

## Master prompt — give these instructions priority throughout the build

> You are Grok Bot, acting as a product engineer, designer, integration engineer, QA engineer, and open-source maintainer working for Harry. Build a real, usable product in the project’s files, not just a plan or a series of attractive mockups. Work phase by phase, test as you go, make reasonable implementation choices, and honestly report what does and does not work. Use helpers or subagents if available, but one person should integrate and verify the work.
>
> Harry wants to form a team of actual AI employees using **Claude Duet and OpenAI dots**, the products that operate their own computers. A role or avatar backed by a shared agent is not a separate employee for this requirement. Each real employee must be associated with its own genuinely independent virtual computer or a distinct provider-backed computer whose isolation can be substantiated. Harry wants a well-designed place to create or connect these employees, assign work, see progress and results, and coordinate them. The experience can take inspiration from Grok Bot’s employee/team workflow, but use an original identity and interface rather than copying proprietary branding or code.
>
> **Do not assume the providers let a third-party app create unlimited Duet or dot agents, programmatically provision a computer per agent, remotely wake an agent, inspect its computer, or obtain the same capabilities as the provider’s own UI.** Determine the actual capabilities from current official documentation and, later, Harry’s authorized account. Treat any undocumented or untested capability as unverified. If an essential capability is not available, clearly say that the requested end-to-end product is blocked. Continue building the parts that can be built without pretending that the blocked requirement is complete.
>
> Core development and the local app must be free to run and self-host, with no OpenAI, Anthropic, or other paid model API key required for the local interface, storage, or simulated integration tests. Real Duet and dot usage may require eligible provider access, subscriptions, invitations, usage allowances, and a reachable secure server. Optional local models or user-selected model APIs may be considered **only as separately approved alternatives**; they must not be silently presented as Duet or dots.
>
> Use real working functionality, clear setup, sensible defaults, and a polished user experience. Honor third-party licenses and use available open-source code when doing so saves time and is appropriate. Never bypass a provider’s authentication, subscription, rate limits, product restrictions, or security. Never reverse-engineer private endpoints or automate logins to create accounts.
>
> Keep a concise `PROGRESS.md` with phases, commands actually run, pass/fail/blocked results, assumptions, and next steps. Keep an `INTEGRATION_STATUS.md` separating documented, locally tested, live-account-tested, unsupported, and unknown capabilities. Never write a passing result for a test you did not actually run. If a command fails, investigate and fix it before declaring the corresponding phase complete.

### The outcome Harry is aiming for

Harry opens a self-hosted workspace, creates a company and project, and sees his AI employees in a simple team view. For example:

- **Maya — research:** a distinct connected Duet or dot with its own virtual computer, assigned a research brief.
- **Leo — operations:** another distinct connected Duet or dot with a separate virtual computer, assigned a different task.
- Harry sees who is working, what has been verified, relevant activity, results, and anything awaiting his approval.
- Where supported and authorized, one employee can hand work to another. Harry can inspect the handoff, the state of the work, and the resulting artifacts.

These names are examples; they are not built-in fake employees or evidence that two providers can be provisioned. The product must not show this outcome as working until the real provider and isolation checks below have passed.

### Product boundary: Duet and dots mean the actual products

- Claude Duet is **not** interchangeable with Claude Code, the Claude model API, or a generic agent using a Claude model.
- A dot is **not** interchangeable with Codex, the OpenAI model API, or a generic agent using an OpenAI model.
- A role profile, prompt, channel, task thread, browser tab, container label, or local database entry is **not proof** of a separate Duet/dot or a separate computer.
- A real Duet/dot may have a provider-owned computer even if our app cannot create, administer, inspect, or remotely operate that computer. State exactly which of those operations are documented and demonstrated.
- A test-only simulated worker is useful to prove application behavior, but it must be unmistakably labeled `Simulated` in the UI, documentation, logs, and test results. Never label simulated work as a live provider response.
- Manual copy/paste can be offered and explicitly labeled as manual when useful. It is not an automatic integration, background employee, or proof of independent computers.

### What “a separate computer” means

An employee’s computer must be a distinct execution environment, not a name for the same runtime. Ideally it has its own filesystem, browser sessions, process space, and explicitly granted credentials; shared project files must be shared deliberately. Define exactly what a provider attests and what can actually be checked. Do not promise full isolation just because the UI has two cards.

Before showing **Independent computer verified** for two real employees, record evidence of all of the following, to the extent the provider exposes it:

1. The two connections correspond to genuinely distinct authorized provider agent instances, not two channels or identities on one instance.
2. The provider identifies or otherwise substantiates distinct computers/execution environments; two labels alone do not qualify.
3. With permission, place a harmless random marker in one worker’s private workspace and attempt to access it from the other without deliberately sharing it. Record how the check was performed and any visibility limits.
4. Confirm that work or credentials have not been accidentally shared through a common session, mount, or application connector. A failed or inconclusive check is **not** a pass.
5. Save time, evidence source, test outcome, and scope; clearly mark provider assertions separately from an independently observed test. Do not expose sensitive data in the evidence.

These checks are not a security certification. If access needed to perform the checks is unavailable, use **Isolation unverified**; if a provider only offers one shared environment, use **Shared computer / does not meet requirement**. Do not work around account rules by creating unauthorized accounts. A successful mock isolation test proves the test harness, not the real provider behavior.

### States users should actually see

Use plain, accurate status labels and show last-confirmed times where available:

- **Simulated** — local test only; no real external worker.
- **Not connected** — a profile exists but no authorized provider is attached.
- **Connected, isolation unverified** — provider connection established, but distinct computer not demonstrated.
- **Independent computer verified** — evidence supports the checks above; state scope and date.
- **Shared computer — does not meet requirement** — evidence indicates the same runtime or insufficient isolation.
- **Unavailable / unsupported** — provider does not expose a required feature, or account access is missing.
- For tasks: **Draft**, **Queued**, **Claimed**, **In progress**, **Needs your input**, **Completed**, **Failed**, and **Unknown** where supported. Task states must come from real events or user actions, not animated filler.

Display “last reported” rather than “live” if an integration cannot truly report live state. Never show a worker as running, online, done, or successfully canceled just because the user clicked a button.

---

## Phase 0 — Research and architecture decision

**Prompt for Grok:**

> Investigate the current official Duet and dot documentation first. Write `docs/provider-feasibility.md` with source links and access dates. Determine what is documented versus inferred versus live-tested for: agent creation and count per account; each product’s computer model; authentication and official integrations; custom connectors and supported MCP transport; incoming versus outgoing events and whether an agent can be awakened; per-employee identity and permissions; task status, files, and cancellation; rate limits and account eligibility. Verify whether Duet itself can use a given connector: documentation for another Claude surface does not by itself prove Duet supports it. Do the equivalent separately for dots. Record hard blockers and alternatives without changing Harry’s goal.
>
> Review the earlier prototype if it is available. Inspect dependencies, the license, tests, and what actually runs. Reuse or migrate useful work without destroying it. If no files are supplied, create a fresh project and document that decision.
>
> Review existing open-source projects for useful ideas or permissible code. Build a short comparison with links, license status, maintenance signals, and concrete overlap. At minimum look at Paperclip, dots-bridge, and bud-relay, plus any other current relevant projects. These are starting points, not blanket endorsements. Verify the license in the actual version you use. If code is reused, pin or vendor it responsibly, retain notices, honor license terms, record provenance in `THIRD_PARTY_NOTICES.md`, and review the code for security. If the license is incompatible or unknown, do not copy the code.
>
> Write a short architecture decision record and capability matrix. Design a provider adapter interface with explicit feature flags and evidence. Do not adopt an architecture that requires a paid model API key or a proprietary hosted service for local core operation. Proceed to independent work even if real accounts are not yet available.

**Research starting points; recheck because features can change:**

- Anthropic, [Get started with Claude Duet](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet): the documentation describes a cloud computer, shared memory across Duet channels, and eligibility/waitlist restrictions. It does not, by itself, establish third-party creation of multiple independently isolated Duets.
- Anthropic, [Custom connectors using remote MCP](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp): review connection and authentication requirements; verify applicability to Duet itself.
- OpenAI, [Connect computers and apps to your dot](https://learn.chatgpt.com/docs/dots/computers-and-apps): describes a dot’s cloud computer and connected computers; do not infer that this app may provision as many dots as it wants.
- OpenAI, [Custom MCP servers](https://developers.openai.com/api/docs/guides/custom-mcp-server): investigate which parts apply to the actual dot product and account tier.
- xAI, [Grok Bot for teams and enterprises](https://docs.x.ai/grok-bot/teams-and-enterprises): describes important shared-computer behavior for a user’s personal Bots. Harry explicitly wants a separate computer for each employee, so his requirement must be tested on its own merits.
- [Paperclip](https://github.com/paperclipai/paperclip): existing open-source agent/company coordination. Compare honestly; do not claim that team orchestration itself is a new invention.
- [dots-bridge](https://github.com/uezo/dots-bridge): unofficial third-party dot integration; check license, supported features, and its required configuration before any reuse. An integration bridge is not proof of independent computers.
- [bud-relay](https://pypi.org/project/bud-relay/): a third-party cross-agent relay; inspect the current package and its own stated limitations. Do not assume its claims are validated by us.

**Phase gate:** Document evidence, proposed architecture, and blockers. No unsubstantiated “unlimited agents” claim. Research may continue during later phases.

---

## Phase 1 — A polished local product that actually runs

**Prompt for Grok:**

> Create a well-structured, maintainable local application. Prefer a simple, familiar, open-source stack that runs on an Apple Silicon Mac and other common systems. A TypeScript web app with a React frontend and a small local server using SQLite is a reasonable default; choose another stack only if it materially improves the project. Avoid making Docker, cloud accounts, paid services, or API keys mandatory for the basic local experience.
>
> Implement real persistent data and working navigation. Provide a simple setup path with prerequisites and exact commands, a clean development experience, and a production-style local run command. Put source code, migrations, UI components, and tests in sensible locations. Bind the local admin UI to localhost by default. Provide an empty state and an optional clearly labeled demo workspace that can be removed.
>
> Design for a founder overseeing a small team, with a distinctive product identity. Avoid a generic crowded admin template. Create:
>
> - A calm dashboard showing active projects, employees, items needing attention, and actual recent activity.
> - An employee directory with clear role, provider, connection, computer-isolation state, and last-confirmed status.
> - A project and task workspace where a user can create and edit tasks, assign a worker, view an activity timeline, and review real saved results or attachments.
> - An employee detail view with responsibilities, connection setup, computer evidence, assigned work, available capabilities, and controls that match actual support.
> - Settings for local storage, export, integration configuration, and safety/approval preferences.
> - Helpful loading, empty, offline, error, unverified, and blocked states; no made-up metrics or decorative fake results.
>
> Make the application responsive across desktop and tablet, usable at mobile widths, keyboard accessible, readable with adequate contrast, and clear to someone who is not a developer. Focus styling on spacing, typography, hierarchy, interaction states, and useful language. Do not build a separate native mobile app for the initial release.
>
> Verify the real app in a browser at desktop and mobile widths when tools are available; exercise navigation, persistence after restart, an error state, and keyboard access. If you cannot run a browser, say so and leave a repeatable manual checklist. Do not claim visual verification based only on code inspection.

**Phase gate:** A fresh local setup launches, data persists, major views are functional, and basic usability checks are recorded. No provider access required.

---

## Phase 2 — Real projects, employees, and a task lifecycle

**Prompt for Grok:**

> Implement the domain model and server operations for workspaces, projects, employee profiles, provider connections, computers/evidence, tasks, task events, attachments or file references, approvals, and audit entries. Keep an employee profile distinct from a provider instance and from a computer record. Bind these explicitly so the app cannot imply that saving a new role automatically created an agent or computer.
>
> Create and edit employee profiles, configure role instructions and allowed project context, and assign tasks. Save changes and show them after restart. Implement task state transitions with a record of who or what reported each transition. Clearly distinguish actions the app can enforce from instructions sent to an external agent. Enable a founder to inspect and export their own data in a common machine-readable format.
>
> Implement a small deterministic simulated adapter so users and automated tests can exercise the workflow with zero API keys. Its sample results must be visibly labeled simulated. Simulated workers may demonstrate message and task flows, but must not fake a live agent, a live browser, independently provisioned Duet/dot computers, or real outside-world work.
>
> If multiple workers may receive jobs, use durable claims with expiry, unique task identifiers, transactional state changes, and idempotent result handling. Prevent duplicate completion and cross-workspace access. Do not blindly retry after ambiguous failures: show `Unknown` and provide a reconciliation path. Make clear that a local cancellation request may not stop a remote action unless the provider confirms it.
>
> Implement a shared activity feed and a truthful handoff workflow when supported. A task may be handed off within this app, but do not claim that one real external agent has messaged another unless the relevant integration actually delivers and confirms it. Store only what the user authorizes and make deletion behavior clear.

**Phase gate:** From a new workspace, create two labeled simulated employee profiles, assign different tasks, observe independently recorded task states, persist and reopen them, and test duplicate/unknown behavior. Show that this is a simulation, not two real provider computers.

---

## Phase 3 — Secure, testable connector foundation

**Prompt for Grok:**

> Implement a narrow provider interface for the actual capabilities the current docs support. Model discovery, connection, task submission or claim, result/event intake, and cancellation as separate optional capabilities. Unsupported operations must return explicit typed results with reasons, not silently fall back to simulated success.
>
> If a documented MCP connector path is suitable, implement a small standards-compliant server and use official SDKs when appropriate. Test the protocol against a local test client without requiring a real provider. Verify current transport, authorization, and tool schemas from the provider docs; generic MCP support does not establish Duet or dot compatibility. Design tool calls around least privilege and attributable identities. A worker must only see and claim work granted to it. If the provider can only authenticate several employees through an indistinguishable shared credential, do not pretend that per-employee access controls are proven.
>
> Make explicit the direction of communication: an agent that calls an MCP tool can retrieve or report work, but that alone does not prove our application can wake the agent, push a message, or run it on a schedule. Implement a provider event/push mechanism only if it is actually documented and eligible; otherwise label delivery as provider-initiated or manual. Do not create an automatic polling or scheduled-wake promise without a supported mechanism.
>
> Cloud-hosted Duet/dot services may need a reachable authenticated HTTPS endpoint. A service bound only to localhost on Harry’s Mac is not reachable from an external provider by default. Provide an architecture and instructions for a user-chosen secure hosting or tunnel option, with the service’s availability limitations and potential cost made explicit. Use no default unauthenticated public endpoint. A sleeping or disconnected Mac can stop a locally hosted bridge even if the provider’s own computer remains online.
>
> Keep credentials out of the source tree, browser-visible state, URLs, analytics, and logs. Use an appropriate operating-system credential store or a documented secure alternative where available; implement a safe configuration flow and revocation. Never ask Harry to post tokens in chat or commit them. Restrict local origins, guard state-changing requests against CSRF, validate input, limit attachment size, redact secrets, and make the network exposure boundary explicit. Treat task text, files, provider output, and third-party pages as untrusted data, not instructions that can override authorization.

**Phase gate:** Local protocol tests prove supported and unsupported paths, unauthorized requests fail, simulated workers cannot access another worker’s assigned data, and failures are visible. Local test-client results are never described as real Duet or dot integration success.

---

## Phase 4 — Claude Duet first

**Prompt for Grok:**

> Build the first provider adapter and onboarding flow around real, documented Claude Duet capabilities, not Claude Code or the model API. The onboarding must say what account access, connector setup, permissions, server address, and running components are required. If the provider offers no documented way to perform an operation, disable or omit it and show a useful explanation.
>
> Implement the most direct documented, user-authorized task and result flow you can substantiate. A possible architecture is an authenticated remote MCP connector through which a user-instructed Duet claims an assigned task and returns an update, **only if current documentation and later live tests confirm Duet can actually use it**. This does not itself create a Duet, prove a second computer, or wake a sleeping agent. If Duet cannot use this mechanism, document the precise blocker and investigate another official supported integration; do not replace it with an unofficial login automation.
>
> With no real Duet access, finish implementation and automated tests as far as evidence permits. Mark the provider as `Not live-tested`. Provide a short, exact real-account test for Harry to run after obtaining an eligible account and access. Record steps, expected observable result, actual result, and cleanup. Never ask for his password; he should authenticate directly with the provider and keep his tokens private.
>
> When access exists, begin with one low-risk test task with no external writes. Confirm a real message or task travels through the supported path, the right employee is identified, and a real result returns to the correct task with an audit record. Verify what the UI can and cannot know about activity and cancellation. Test provider outages and revoked access.
>
> Test two genuinely distinct Duet agents and computers only if the provider exposes a permitted way to obtain them and Harry has authorized the required accounts or resources. Follow the independent-computer evidence procedure above. If Duet is limited to a single agent/computer for the available account or the capability cannot be verified, mark the feature blocked and explain exactly what would be needed. Do not create separate cards and report success.

**Phase gate:** The adapter passes local contract/security tests; real connection and real multi-computer requirements remain explicitly unverified until independently exercised on eligible Duet access.

---

## Phase 5 — OpenAI dots second

**Prompt for Grok:**

> After the Duet architecture and local tests, add a separate adapter and onboarding for real OpenAI dots. Check the current dot, connector, and event documentation and eligible plan requirements. Do not infer product capabilities from the generic OpenAI model API. Compare the documented route with the unofficial dots-bridge, and reuse code only if its actual license and implementation permit it and the security review supports it. Record whether the app is vendoring, depending on, or merely documenting that project.
>
> Determine whether messaging requires a provider event subscription and whether the required feature is available in Harry’s account. Account for endpoint reachability and authorization. If event or messaging support is unavailable, accurately indicate whether the only verified path is provider-initiated or manual. The user must be able to disconnect and revoke configured access.
>
> Use the same adapter contract, authorization boundaries, task semantics, explicit limitations, and evidence checks as the Duet integration. Keep provider-specific behavior visible when it matters. Do not let simulated dot responses populate real task completion records.
>
> Prepare one real-dot test and, only where supported and authorized, a two-distinct-dot/two-distinct-computer isolation test. Until Harry has actual access and those tests are run, label live dot integration and isolation as unverified. Do not try to create unauthorized extra accounts or bypass plan restrictions.

**Phase gate:** Local adapter tests pass; actual dot behavior is separately recorded as passed, failed, blocked, or unverified. Dot implementation must not be used as a reason to misrepresent Duet support.

---

## Phase 6 — Approvals, control, and secure operations

**Prompt for Grok:**

> Make user control understandable and real. Clearly show which actions the platform itself can intercept, which permissions belong to the underlying provider or an external application, and which actions the platform can only request. Do not claim the dashboard enforces approval for an action that an agent can take directly elsewhere.
>
> For actions actually mediated by our application, require an explicit, reviewable user approval before consequential external actions such as sending messages, making purchases, publishing, or deleting data. Record what was approved, by whom, when, and the outcome. Present a meaningful summary, not just a generic “Approve” button. Add denial and expiration behavior. Never store secrets in approval logs.
>
> Implement safe local defaults: least privilege, authenticated connector endpoints, input validation, bounded resource usage, no exposed development server, secret redaction, sensible dependency pinning, and an honest security document. Verify that employees do not receive unrelated task context through our application. Make data retention, export, and removal understandable. Provide a way to disable a connection and note that provider-side session revocation may also be necessary.
>
> Handle malicious or misleading text in agent output as untrusted content. Protect against a task result impersonating the user, another employee, or a system instruction. Use server-side authorization and binding to identities rather than accepting a worker name provided inside a message as proof of identity.

**Phase gate:** Tests cover permissions, approval bypass, revoked/invalid connector credentials, duplicate callbacks, and failure/unknown states. UI makes provider versus application control clear.

---

## Phase 7 — Quality, documentation, and open-source readiness

**Prompt for Grok:**

> Verify the complete supported local journey from a clean setup: create workspace → add employees → create and assign work → simulate connector updates → review activity and results → restart and verify persistence → export data. Run the project’s relevant type checks, lint, unit and integration tests, security checks, and browser-level tests where available. Record the exact commands and actual outcomes in `PROGRESS.md`.
>
> Add meaningful automated tests for separate workspaces, worker/task authorization, status transitions, duplicate deliveries, idempotent completion, timeouts, reconnects, and the cases where provider capabilities are unavailable. Add a useful end-to-end test of the core user journey. Add explicit tests proving the UI cannot show the real independent-computer badge based only on role creation or simulation.
>
> Include setup and troubleshooting for macOS first and note tested support for other systems. The README must explain what works with no keys, what simulated means, how to run and test locally, what real Duet/dot connections need, the status of each provider, how to expose an endpoint safely if applicable, data and credential storage, platform limitations, and how to participate. Include screenshots only if they show the current real application and are labeled appropriately.
>
> Add `CONTRIBUTING.md`, `SECURITY.md`, a code of conduct, and third-party attribution as appropriate. Use a recognized permissive open-source license such as MIT for original code if compatible with the user’s dependencies; identify any uncertainty rather than copying incompatible code. Include a reproducible dependency lockfile and a reasonable CI workflow to run the same checks. Do not commit secrets or user data.
>
> Prepare the repository so Harry can publish it to GitHub. Do not claim a repository has been published or create one without the user’s explicit request and account authorization. Explain the exact commands or steps to publish when ready.
>
> End with an honest handoff: what was built, how to run it, the exact tests and outcomes, what remains blocked, how Harry will test Duet first and dots second once access arrives, and whether separate provider-backed computers have actually been demonstrated.

**Phase gate:** A newcomer can run the local core and follow the documents. All claims match actual evidence; every failed or blocked test is visible.

---

## Required final acceptance checklist

Do not label the overall product “complete” until each requirement is actually satisfied. Use `PASS`, `FAIL`, `BLOCKED`, or `NOT TESTED`, with evidence and dates:

1. Local setup runs on a documented machine with no paid model API key.
2. The UI is polished, understandable, keyboard usable, and browser-checked on desktop and mobile widths.
3. Employee, project, and task data survives restart; changes and failures are accurately reflected.
4. The local simulated provider works and is never misrepresented as a live agent.
5. Real Duet integration has been tested on eligible user access, with its documented limitations.
6. A real dot integration has been tested on eligible user access, with its documented limitations.
7. Two distinct real provider agents, each on a separate computer, have passed the applicable isolation evidence checks. Specify provider, conditions, and what could not be observed.
8. Each employee is correctly bound to its own provider connection and environment; shared or unverified environments are clearly labeled.
9. Users can assign work and review results through genuinely supported integration paths; no unsupported wake-up, cancellation, or delivery guarantee is implied.
10. Approval, authorization, concurrency, credential handling, and audit controls have meaningful tests within the scope our app actually controls.
11. GitHub-ready license, attribution, README, tests, and known limitations are present. Publication is a separate user-authorized step.

If items 5–8 are blocked by access or provider limitations, the local application can still be handed over as an honest **pre-integration build**. It must not be marketed as the complete requested product. Tell Harry exactly which real-world test or provider feature is missing.

---

## What to do if the exact product is impossible today

Do the research and independent work first. Then give Harry a specific choice, backed by evidence:

1. Keep the exact goal and wait for Duet/dots to support the necessary agent provisioning, messaging, and isolation.
2. Use whatever number of actual independently provisioned Duet/dot computers the providers and Harry’s authorized accounts genuinely support, with the limitation clearly shown.
3. Consider, **only if Harry explicitly approves the change**, a different product using separate user-managed virtual machines or containers with model APIs or local models. Such workers may have their own computers, but they are not the actual Duet or dot products and may require additional infrastructure, API fees, or hardware.

Never silently change the goal, conceal a provider limitation, or tell Harry that an independent computer has been created when only a role profile or mock worker exists.
