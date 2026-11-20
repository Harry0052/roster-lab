#!/bin/sh
set -eu
export DISPLAY=:1
mkdir -p /work /tmp/.X11-unix
if [ ! -f /work/index.html ]; then
  printf '%s\n' '<!doctype html><title>Roster Lab</title><h1>Roster Lab desktop</h1>' > /work/index.html
fi
Xvfb :1 -screen 0 1280x800x24 -ac +extension RANDR >/tmp/xvfb.log 2>&1 &
sleep 0.4
openbox >/tmp/openbox.log 2>&1 &
chromium \
  --no-sandbox \
  --disable-gpu \
  --disable-dev-shm-usage \
  --remote-debugging-address=0.0.0.0 \
  --remote-debugging-port=9222 \
  --remote-allow-origins=* \
  --user-data-dir=/work/chrome-profile \
  --window-size=1200,760 \
  --window-position=20,20 \
  /work/index.html >/tmp/chromium.log 2>&1 &
x11vnc -display :1 -rfbport 5900 -localhost -nopw -forever -shared -quiet >/tmp/x11vnc.log 2>&1 &
# Chromium binds the DevTools port to 127.0.0.1. socat publishes it inside the container so Docker can forward it.
socat TCP-LISTEN:9223,bind=0.0.0.0,reuseaddr,fork TCP:127.0.0.1:9222 >/tmp/socat.log 2>&1 &
exec websockify --web=/usr/share/novnc 6080 localhost:5900
