# Workspace runtimes

Checked 2026-11-20. Harry asked for a per-project computer, with a local-browser fallback if a VM is not possible on the machine. Paid services stay off.

## What this machine could run

Docker Engine 29.1.3 from Ubuntu’s `docker.io` package was installed in this session and `docker info` succeeded. The first check, before that install, had no `docker` binary and no socket.

When Docker is available, `open_workspace` builds `roster-lab-desktop:local` from `docker/desktop` if needed and starts one container per project. The image is Debian Bookworm with Xvfb, Openbox, Chromium, x11vnc, and Debian’s noVNC plus websockify. noVNC is MPL-2.0 and is installed as the Debian package. Roster Lab does not vendor or modify the noVNC source. Chromium’s DevTools port is forwarded with `socat` because current Chromium binds it to 127.0.0.1. Playwright on the host connects with `connectOverCDP`, opens `file:///work/index.html`, reads the page text, and saves a PNG. The container keeps running so the dashboard can embed `vnc.html`. Published ports are bound to `127.0.0.1` only.

Google Chrome at `/usr/local/bin/google-chrome` is the fallback when `docker info` fails, or when a caller passes `local_browser`. `playwright-core` 1.49.1 (Apache-2.0, read from this install’s `package.json`) drives one persistent profile directory per project. That label is `local browser, not isolated VM`.

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
