# Project desktop image

This image is a small Debian desktop for one Roster Lab project.

- Xvfb provides the display.
- Openbox is the window manager.
- Chromium is the browser, with DevTools on port 9222 inside the container. `socat` forwards that to port 9223 so Docker can publish it. Playwright on the host connects there.
- x11vnc serves the display on localhost:5900 inside the container.
- Debian's noVNC and websockify serve `http://0.0.0.0:6080/vnc.html`. Roster Lab publishes that port only on `127.0.0.1`.

noVNC is MPL-2.0. This image installs Debian's package. Roster Lab does not vendor or modify the noVNC source. x11vnc and Openbox are GPL-2.0 packages used the same way. Chromium is the Debian package.

Build from the repository root:

```bash
docker build -t roster-lab-desktop:local docker/desktop
```

Roster Lab builds it automatically the first time a container workspace opens, if `docker info` succeeds.
