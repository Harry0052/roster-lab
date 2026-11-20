# Workspace runtimes

Checked 2026-11-20. Harry asked for a per-project computer, with a local-browser fallback if a VM is not possible on the machine. Paid services stay off.

## What this machine could run

`docker` was not on `PATH`. `/var/run/docker.sock` was absent. No container was started. That is why the demo uses the fallback.

Google Chrome at `/usr/local/bin/google-chrome` did start. `playwright-core` 1.49.1 (Apache-2.0, read from its `package.json` in this install) drives one persistent profile directory per project and saves a PNG. The label stored on the project is `local browser, not isolated VM`.

## Candidates

| Project | What was checked | License | Used? |
| --- | --- | --- | --- |
| Playwright core | npm package 1.49.1, `package.json` license field | Apache-2.0 | Yes. Local browser profiles and screenshots. |
| Apache Guacamole server and client | GitHub repository pages fetched 2026-11-20 | Apache-2.0 | No. It is a real in-browser desktop gateway, and it was not installed here. |
| noVNC | [novnc.com/info](https://novnc.com/info) fetched 2026-11-20 | MPL-2.0 | No. Not MIT or Apache-2.0. |
| E2B runtime | GitHub repository page fetched 2026-11-20 | Apache-2.0 | No. It needs a KVM host or their cloud. Their cloud would be a paid opt-in. Not called. |
| Daytona | README fetched 2026-11-20 says the public repository is no longer maintained as of June 2026 | Not adopted. A secondary writeup called the frozen code AGPL-3.0; the LICENSE file was not copied into this repo. | No. |
| OpenHands | Not installed | Reported MIT by the project’s own materials in search results. Not re-read from a LICENSE file in this session. | No. |
| browser-use | Not installed | Not verified from its LICENSE file in this session. | No. |
| Microsoft Playwright MCP | Not installed | Not depended on. Roster Lab calls Playwright itself. | No. |
| Kasm-style images | Not pulled | Not verified. Often commercial. | No. |

## What a profile is, and is not

Each project gets `browser-profiles/<project id>` and `project-files/<project id>`. A marker file written into one profile directory is not in the other. That is separate browser state on this computer. It is not a virtual machine, not a container, and not a Duet or dot computer.
