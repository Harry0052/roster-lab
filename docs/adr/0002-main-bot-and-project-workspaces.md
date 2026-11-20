# ADR 0002 — Main bot and project workspaces

Date: 2026-11-20. Status: accepted. Decided by Harry Malhi.

Harry paused the earlier build, then asked for this architecture as an approved product change. It extends the blueprint. It does not relax the rule that a simulated worker, a role, or a local browser is not a Claude Duet or an OpenAI dot, and it is not a verified separate provider computer.

## Decision

1. A main bot can be a Duet, a dot, or another supported agent. In this build the one that actually runs is a **simulated** main bot. It has its own dashboard. Live Duet and dot calls remain untested.
2. Projects under that main bot are specialized sub-bots. “Software Engineer” is one project, with a goal and a task list. The main bot delegates inside Roster Lab. That delegation is not a message sent to a provider.
3. Each project has an endpoint the runner uses to open a workspace and work on the task.
4. Open-source runtimes were checked. The runtime this session could execute is Playwright’s persistent Chrome profile, one directory per project, using `playwright-core` 1.49.1 (Apache-2.0) and the Chrome already on the machine. Docker was not installed (`docker` was not on `PATH`, and `/var/run/docker.sock` was absent), so a per-project container was not started.
5. When a container or VM cannot be started, the workspace is labeled **local browser, not isolated VM**. Separate profiles are separate browser state. They are not separate machines.
6. The main bot can call MCP tools `list_projects`, `delegate_task`, `open_workspace`, and `get_task_status` with a bearer this app mints. A local simulated caller was tested. Duet and dots were not.

Paid sandboxes stay off. None were called.
